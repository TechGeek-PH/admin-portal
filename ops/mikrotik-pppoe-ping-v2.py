#!/usr/bin/env python3
"""TechGeekPH authoritative PPPoE client ping monitor v2.

This service is deliberately isolated from billing/provisioning logic.
It reuses the already-working PPPoE agent environment and RouterOS API
library, reads active PPP sessions, pings each active client FROM MikroTik,
and only writes network health through ingest_network_ping_batch.
"""

from __future__ import annotations

import concurrent.futures
import ipaddress
import json
import os
import re
import statistics
import sys
import time
from typing import Any

import requests
import routeros_api

VERSION = "20261006-pppoe-ping-v2"

def env(*names: str, default: str = "") -> str:
    for name in names:
        value = os.getenv(name)
        if value is not None and str(value).strip():
            return str(value).strip()
    return default

SUPABASE_URL = env("SUPABASE_URL").rstrip("/")
SUPABASE_KEY = env("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_KEY")
MIKROTIK_HOST = env("MIKROTIK_HOST", default="10.200.0.2")
MIKROTIK_USER = env("MIKROTIK_USER", "MIKROTIK_USERNAME")
MIKROTIK_PASSWORD = env("MIKROTIK_PASSWORD")
MIKROTIK_PORT = int(env("MIKROTIK_PORT", "MIKROTIK_API_PORT", default="8728"))
MIKROTIK_USE_SSL = env("MIKROTIK_USE_SSL", default="false").lower() in {"1", "true", "yes", "on"}
MIKROTIK_SSL_VERIFY = env("MIKROTIK_SSL_VERIFY", default="false").lower() in {"1", "true", "yes", "on"}
INTERVAL = max(30, int(env("PPPOE_PING_MONITOR_INTERVAL_SECONDS", default="60")))
PING_COUNT = max(2, min(5, int(env("PPPOE_PING_COUNT", default="3"))))
PING_WORKERS = max(1, min(6, int(env("PPPOE_PING_WORKERS", default="4"))))
HTTP_TIMEOUT = max(5.0, float(env("PPPOE_PING_HTTP_TIMEOUT", default="25")))
SOURCE = f"mikrotik-pppoe-ping:{MIKROTIK_HOST}"

def validate_config() -> None:
    missing = []
    if not SUPABASE_URL:
        missing.append("SUPABASE_URL")
    if not SUPABASE_KEY:
        missing.append("SUPABASE_SERVICE_ROLE_KEY")
    if not MIKROTIK_USER:
        missing.append("MIKROTIK_USER")
    if not MIKROTIK_PASSWORD:
        missing.append("MIKROTIK_PASSWORD")
    if missing:
        raise RuntimeError("Missing required environment variables: " + ", ".join(missing))

def headers() -> dict[str, str]:
    return {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": f"TechGeekPH-PPPoE-Ping/{VERSION}",
    }

def rest_get(path: str) -> Any:
    r = requests.get(f"{SUPABASE_URL}/rest/v1/{path}", headers=headers(), timeout=HTTP_TIMEOUT)
    if not r.ok:
        raise RuntimeError(f"Supabase GET failed {r.status_code}: {r.text[:500]}")
    return r.json()

def rpc(name: str, body: dict[str, Any]) -> Any:
    r = requests.post(
        f"{SUPABASE_URL}/rest/v1/rpc/{name}",
        headers=headers(),
        json=body,
        timeout=HTTP_TIMEOUT,
    )
    if not r.ok:
        raise RuntimeError(f"Supabase RPC {name} failed {r.status_code}: {r.text[:500]}")
    return r.json() if r.text.strip() else None

def router_pool() -> routeros_api.RouterOsApiPool:
    return routeros_api.RouterOsApiPool(
        MIKROTIK_HOST,
        username=MIKROTIK_USER,
        password=MIKROTIK_PASSWORD,
        port=MIKROTIK_PORT,
        plaintext_login=True,
        use_ssl=MIKROTIK_USE_SSL,
        ssl_verify=MIKROTIK_SSL_VERIFY,
        ssl_verify_hostname=MIKROTIK_SSL_VERIFY,
    )

def valid_ip(value: Any) -> str | None:
    try:
        return str(ipaddress.ip_address(str(value or "").strip()))
    except Exception:
        return None

def suffix_key(value: Any) -> str | None:
    m = re.search(r"(\d{3,6})$", str(value or "").strip())
    return str(int(m.group(1))) if m else None

def account_candidates(account: str) -> list[str]:
    a = str(account or "").strip().upper()
    if not a:
        return []
    out = [a, "MKTECH_" + a, "TGPH" + a, "TGPH_" + a]
    m = re.search(r"(\d+)$", a)
    if m:
        digits = m.group(1)
        out.extend([
            "SATR" + digits,
            "MKTECH_SATR" + digits,
            "TGPHSATR" + digits,
            "TGPH_SATR" + digits,
        ])
    seen: list[str] = []
    for value in out:
        key = value.lower()
        if key not in seen:
            seen.append(key)
    return seen

def parse_time_ms(value: Any) -> float | None:
    text = str(value or "").strip().lower()
    if not text:
        return None
    m = re.fullmatch(r"([0-9.]+)\s*(ns|us|µs|ms|s)", text)
    if m:
        number = float(m.group(1))
        unit = m.group(2)
        if unit == "ns":
            return number / 1_000_000
        if unit in {"us", "µs"}:
            return number / 1_000
        if unit == "ms":
            return number
        return number * 1000
    m = re.fullmatch(r"(?:(\d+):)?(\d+):(\d+(?:\.\d+)?)", text)
    if m:
        hours = int(m.group(1) or 0)
        minutes = int(m.group(2))
        seconds = float(m.group(3))
        return (hours * 3600 + minutes * 60 + seconds) * 1000
    try:
        return float(text)
    except ValueError:
        return None

def health(reachable: bool, latency_ms: float | None) -> str:
    if not reachable:
        return "NO CONNECTION"
    if latency_ms is None or latency_ms <= 50:
        return "GOOD"
    if latency_ms <= 100:
        return "FAIR"
    if latency_ms <= 200:
        return "HIGH LATENCY"
    return "POOR"

def router_snapshot() -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    pool = router_pool()
    try:
        api = pool.get_api()
        active = list(api.get_resource("/ppp/active").get())
        secrets = list(api.get_resource("/ppp/secret").get())
        return active, secrets
    finally:
        pool.disconnect()

def ping_chunk(jobs: list[tuple[str, str]]) -> list[dict[str, Any]]:
    if not jobs:
        return []
    pool = router_pool()
    out: list[dict[str, Any]] = []
    try:
        api = pool.get_api()
        ping = api.get_resource("/ping")
        for account, target in jobs:
            try:
                rows = ping.call(address=target, count=str(PING_COUNT), interval="100ms")
                samples = [parse_time_ms(row.get("time")) for row in rows if isinstance(row, dict)]
                samples = [round(float(v), 3) for v in samples if v is not None]
                reachable = bool(samples)
                latency = round(float(statistics.median(samples)), 2) if samples else None
                loss = round((PING_COUNT - len(samples)) * 100.0 / PING_COUNT, 1)
                out.append({
                    "account_no": account,
                    "target_ip": target,
                    "reachable": reachable,
                    "latency_ms": latency,
                    "ping_samples": samples,
                    "packet_loss": loss,
                    "connection_health": health(reachable, latency),
                    "source": SOURCE,
                    "error": None if reachable else "No ping reply from active PPPoE client",
                })
            except Exception as exc:
                out.append({
                    "account_no": account,
                    "target_ip": target,
                    "reachable": None,
                    "latency_ms": None,
                    "ping_samples": [],
                    "packet_loss": None,
                    "connection_health": None,
                    "source": SOURCE,
                    "error": f"Router ping error: {type(exc).__name__}: {exc}",
                    "_ping_error": True,
                })
        return out
    finally:
        pool.disconnect()

def cycle() -> None:
    clients = rest_get("clients?select=id,account_no,client_name,remote_address,account_status,service_status&order=account_no.asc&limit=2500")
    creds = rest_get("client_network_credentials?select=client_id,pppoe_username&pppoe_username=not.is.null&limit=2500")
    user_by_client = {str(row.get("client_id")): str(row.get("pppoe_username") or "").strip() for row in creds}

    active, secrets = router_snapshot()
    active_by_name = {str(row.get("name") or "").strip().lower(): row for row in active if row.get("name")}
    secret_by_name = {str(row.get("name") or "").strip().lower(): row for row in secrets if row.get("name")}

    active_by_ip: dict[str, dict[str, Any]] = {}
    for row in active:
        ip = valid_ip(row.get("address"))
        if ip and ip not in active_by_ip:
            active_by_ip[ip] = row

    secret_by_ip: dict[str, dict[str, Any]] = {}
    for row in secrets:
        ip = valid_ip(row.get("remote-address"))
        if ip and ip not in secret_by_ip:
            secret_by_ip[ip] = row

    secret_by_suffix: dict[str, dict[str, Any] | None] = {}
    duplicate_suffixes: set[str] = set()
    for row in secrets:
        key = suffix_key(row.get("name"))
        if not key:
            continue
        if key in secret_by_suffix:
            duplicate_suffixes.add(key)
        else:
            secret_by_suffix[key] = row
    for key in duplicate_suffixes:
        secret_by_suffix.pop(key, None)

    ping_jobs: list[tuple[str, str]] = []
    offline_results: list[dict[str, Any]] = []
    matched = 0

    for client in clients:
        account = str(client.get("account_no") or "").strip()
        if not account:
            continue
        client_id = str(client.get("id") or "")
        remote_ip = valid_ip(client.get("remote_address"))
        username = user_by_client.get(client_id, "")
        session = active_by_name.get(username.lower()) if username else None
        secret = secret_by_name.get(username.lower()) if username else None

        if not username and remote_ip:
            session = active_by_ip.get(remote_ip)
            secret = secret_by_ip.get(remote_ip)
            candidate = (session or secret or {}).get("name")
            if candidate:
                username = str(candidate).strip()

        if not username:
            for key in account_candidates(account):
                if key in active_by_name or key in secret_by_name:
                    session = active_by_name.get(key)
                    secret = secret_by_name.get(key)
                    username = str((session or secret or {}).get("name") or "").strip()
                    break

        if not username:
            sk = suffix_key(account)
            candidate = secret_by_suffix.get(sk) if sk else None
            if candidate:
                username = str(candidate.get("name") or "").strip()
                secret = candidate
                session = active_by_name.get(username.lower())

        if not username:
            continue

        matched += 1
        active_address = valid_ip((session or {}).get("address"))
        if session is not None and active_address:
            ping_jobs.append((account, active_address))
        else:
            target = valid_ip((secret or {}).get("remote-address")) or remote_ip
            offline_results.append({
                "account_no": account,
                "target_ip": target,
                "reachable": False,
                "latency_ms": None,
                "ping_samples": [],
                "packet_loss": 100.0,
                "connection_health": "NO CONNECTION",
                "source": SOURCE,
                "error": "PPPoE session inactive",
            })

    chunks: list[list[tuple[str, str]]] = [[] for _ in range(PING_WORKERS)]
    for index, job in enumerate(ping_jobs):
        chunks[index % PING_WORKERS].append(job)

    ping_results: list[dict[str, Any]] = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=PING_WORKERS) as executor:
        futures = [executor.submit(ping_chunk, chunk) for chunk in chunks if chunk]
        for future in concurrent.futures.as_completed(futures):
            ping_results.extend(future.result())

    ping_errors = sum(1 for row in ping_results if row.pop("_ping_error", False))
    ingestable = offline_results + [row for row in ping_results if row.get("reachable") is not None]

    for index in range(0, len(ingestable), 250):
        rpc("ingest_network_ping_batch", {"p_results": ingestable[index:index + 250]})

    online = sum(1 for row in ingestable if row.get("reachable") is True)
    down = sum(1 for row in ingestable if row.get("reachable") is False)
    print(
        time.strftime("%Y-%m-%d %H:%M:%S"),
        f"version={VERSION} clients={len(clients)} router_active={len(active)} router_secrets={len(secrets)} "
        f"matched={matched} unmatched={len(clients)-matched} ping_jobs={len(ping_jobs)} "
        f"ping_online={online} ping_down={down} ping_errors={ping_errors}",
        flush=True,
    )

def main() -> int:
    validate_config()
    print(
        f"TechGeekPH authoritative PPPoE ping monitor starting: version={VERSION} "
        f"router={MIKROTIK_HOST}:{MIKROTIK_PORT} interval={INTERVAL}s workers={PING_WORKERS} count={PING_COUNT}",
        flush=True,
    )
    while True:
        started = time.monotonic()
        try:
            cycle()
        except Exception as exc:
            print(
                time.strftime("%Y-%m-%d %H:%M:%S"),
                f"PPPoE ping cycle failed: {type(exc).__name__}: {exc}",
                file=sys.stderr,
                flush=True,
            )
        time.sleep(max(1, INTERVAL - (time.monotonic() - started)))

if __name__ == "__main__":
    raise SystemExit(main())
