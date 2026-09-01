#!/usr/bin/env python3
import logging
import os
import signal
import sys
import time

import requests
import routeros_api

STOP = False


def env(name, default=None, required=False):
    value = os.getenv(name, default)
    if required and not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


SUPABASE_URL = env("SUPABASE_URL", "https://tcexzfztdgximrzuosqs.supabase.co").rstrip("/")
SUPABASE_SERVICE_ROLE_KEY = env("SUPABASE_SERVICE_ROLE_KEY", required=True)
MIKROTIK_HOST = env("MIKROTIK_HOST", "10.200.0.2")
MIKROTIK_PORT = int(env("MIKROTIK_PORT", "8728"))
MIKROTIK_USER = env("MIKROTIK_USER", required=True)
MIKROTIK_PASSWORD = env("MIKROTIK_PASSWORD", required=True)
MIKROTIK_USE_SSL = env("MIKROTIK_USE_SSL", "false").lower() in {"1", "true", "yes", "on"}
MIKROTIK_SSL_VERIFY = env("MIKROTIK_SSL_VERIFY", "false").lower() in {"1", "true", "yes", "on"}
POLL_SECONDS = max(1, int(env("POLL_SECONDS", "3")))
HTTP_TIMEOUT = max(5, int(env("HTTP_TIMEOUT", "20")))

logging.basicConfig(
    level=getattr(logging, env("LOG_LEVEL", "INFO").upper(), logging.INFO),
    format="%(asctime)s %(levelname)s %(message)s",
)
log = logging.getLogger("tgph-pppoe-agent")


def stop_handler(_sig, _frame):
    global STOP
    STOP = True


signal.signal(signal.SIGTERM, stop_handler)
signal.signal(signal.SIGINT, stop_handler)


def rpc(name, payload=None):
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
    }
    response = requests.post(
        f"{SUPABASE_URL}/rest/v1/rpc/{name}",
        headers=headers,
        json=payload or {},
        timeout=HTTP_TIMEOUT,
    )
    if not response.ok:
        raise RuntimeError(f"Supabase RPC {name} failed: HTTP {response.status_code} {response.text[:500]}")
    return response.json()


def mikrotik_connection():
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


def first_value(row, *keys):
    for key in keys:
        if key in row and row[key] is not None:
            return str(row[key])
    return ""


def normalize_bool(v):
    return "yes" if bool(v) else "no"


def provision(job):
    if str(job.get("profile") or "").upper() == "PENDING":
        raise RuntimeError("PPPoE profile is still PENDING. Save a valid client Speed before provisioning.")

    pool = mikrotik_connection()
    try:
        api = pool.get_api()
        secrets = api.get_resource("/ppp/secret")
        username = str(job["pppoe_username"])
        existing = secrets.get(name=username)
        attrs = {
            "password": str(job["pppoe_password"]),
            "service": str(job.get("service") or "pppoe"),
            "profile": str(job["profile"]),
            "local_address": str(job["local_address"]),
            "remote_address": str(job["remote_address"]),
            "disabled": normalize_bool(job.get("disabled", False)),
            "comment": str(job.get("comment") or ""),
        }

        if existing:
            rid = first_value(existing[0], "id", ".id")
            if not rid:
                raise RuntimeError(f"Existing PPP secret {username} has no RouterOS ID.")
            secrets.set(id=rid, **attrs)
            action = "updated"
        else:
            secrets.add(name=username, **attrs)
            action = "created"

        verify = secrets.get(name=username)
        if not verify:
            raise RuntimeError(f"PPP secret {username} was not found after create/update.")
        row = verify[0]

        checks = {
            "profile": str(job["profile"]),
            "local-address": str(job["local_address"]),
            "remote-address": str(job["remote_address"]),
            "service": str(job.get("service") or "pppoe"),
            "comment": str(job.get("comment") or ""),
        }
        actual = {
            "profile": first_value(row, "profile"),
            "local-address": first_value(row, "local-address", "local_address"),
            "remote-address": first_value(row, "remote-address", "remote_address"),
            "service": first_value(row, "service"),
            "comment": first_value(row, "comment"),
        }
        mismatch = [k for k, expected in checks.items() if actual.get(k, "") != expected]
        if mismatch:
            detail = ", ".join(f"{k}: expected={checks[k]!r} actual={actual.get(k)!r}" for k in mismatch)
            raise RuntimeError(f"PPP secret verification mismatch: {detail}")

        rid = first_value(row, "id", ".id")
        return rid, f"PPP secret {action} and verified on {MIKROTIK_HOST}."
    finally:
        try:
            pool.disconnect()
        except Exception:
            pass


def finish(job_id, success, router_secret_id=None, message=None):
    return rpc(
        "tg_agent_finish_pppoe_job",
        {
            "p_job_id": int(job_id),
            "p_success": bool(success),
            "p_router_secret_id": router_secret_id,
            "p_message": message,
        },
    )


def run_once():
    claimed = rpc("tg_agent_claim_pppoe_job")
    job = claimed.get("job") if isinstance(claimed, dict) else None
    if not job:
        return False

    job_id = job["id"]
    label = f"job={job_id} account={job.get('account_no')} user={job.get('pppoe_username')}"
    log.info("Claimed %s", label)
    try:
        rid, message = provision(job)
        finish(job_id, True, rid, message)
        log.info("ACTIVE %s router_id=%s", label, rid)
    except Exception as exc:
        msg = str(exc)[:900]
        log.exception("FAILED %s: %s", label, msg)
        try:
            finish(job_id, False, None, msg)
        except Exception:
            log.exception("Could not mark failed job %s in Supabase", job_id)
    return True


def main():
    log.info(
        "Starting TechGeekPH PPPoE provisioner: MikroTik=%s:%s SSL=%s Supabase=%s",
        MIKROTIK_HOST,
        MIKROTIK_PORT,
        MIKROTIK_USE_SSL,
        SUPABASE_URL,
    )
    while not STOP:
        try:
            had_job = run_once()
            if not had_job:
                time.sleep(POLL_SECONDS)
        except Exception:
            log.exception("Agent loop error")
            time.sleep(max(POLL_SECONDS, 5))
    log.info("Stopped")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        log.error("Fatal startup error: %s", exc)
        sys.exit(1)
