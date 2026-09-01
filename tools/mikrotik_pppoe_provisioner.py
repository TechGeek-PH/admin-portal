#!/usr/bin/env python3
import os
import sys
import time
import requests
import routeros_api

PROVISION_URL = os.environ.get(
    "TGPH_PROVISION_URL",
    "https://tcexzfztdgximrzuosqs.supabase.co/functions/v1/network-monitor-ingest",
).strip()
MONITOR_KEY = os.environ.get("TGPH_MONITOR_KEY", "").strip()
MIKROTIK_HOST = os.environ.get("MIKROTIK_HOST", "10.200.0.2").strip()
MIKROTIK_PORT = int(os.environ.get("MIKROTIK_PORT", "8728"))
MIKROTIK_USER = os.environ.get("MIKROTIK_USER", "").strip()
MIKROTIK_PASSWORD = os.environ.get("MIKROTIK_PASSWORD", "")
POLL_SECONDS = max(2, int(os.environ.get("TGPH_PROVISION_POLL_SECONDS", "5")))
BATCH_LIMIT = max(1, min(20, int(os.environ.get("TGPH_PROVISION_BATCH", "10"))))


def require_env():
    missing = []
    if not MONITOR_KEY:
        missing.append("TGPH_MONITOR_KEY")
    if not MIKROTIK_USER:
        missing.append("MIKROTIK_USER")
    if not MIKROTIK_PASSWORD:
        missing.append("MIKROTIK_PASSWORD")
    if missing:
        raise RuntimeError("Missing required environment variables: " + ", ".join(missing))


def post(payload):
    response = requests.post(
        PROVISION_URL,
        headers={"x-monitor-key": MONITOR_KEY, "content-type": "application/json"},
        json=payload,
        timeout=25,
    )
    response.raise_for_status()
    data = response.json()
    if isinstance(data, dict) and data.get("ok") is False:
        raise RuntimeError(data.get("error") or "Provision API request failed")
    return data


def pull_jobs():
    data = post({"action": "provision-pull", "limit": BATCH_LIMIT})
    return data.get("jobs", []) if isinstance(data, dict) else []


def report(job_id, success, message=None, router_secret_id=None):
    return post(
        {
            "action": "provision-result",
            "job_id": job_id,
            "success": bool(success),
            "message": message,
            "router_secret_id": router_secret_id,
        }
    )


def connect_router():
    pool = routeros_api.RouterOsApiPool(
        MIKROTIK_HOST,
        username=MIKROTIK_USER,
        password=MIKROTIK_PASSWORD,
        port=MIKROTIK_PORT,
        plaintext_login=True,
    )
    return pool, pool.get_api()


def secret_id(row):
    return row.get("id") or row.get(".id") or ""


def provision_one(job):
    username = str(job["username"]).strip()
    if not username:
        raise RuntimeError("Provisioning job has no PPPoE username")

    pool = None
    try:
        pool, api = connect_router()
        secrets = api.get_resource("/ppp/secret")
        existing = secrets.get(name=username)

        params = {
            "name": username,
            "password": str(job["password"]),
            "service": str(job.get("service") or "pppoe"),
            "profile": str(job["profile"]),
            "local_address": str(job["local_address"]),
            "remote_address": str(job["remote_address"]),
            "comment": str(job.get("comment") or ""),
            "disabled": "yes" if job.get("disabled") else "no",
        }

        if existing:
            rid = secret_id(existing[0])
            if not rid:
                raise RuntimeError(f"Existing PPP Secret {username} has no RouterOS id")
            update = dict(params)
            update.pop("name", None)
            secrets.set(id=rid, **update)
        else:
            secrets.add(**params)

        verified = secrets.get(name=username)
        if not verified:
            raise RuntimeError(f"PPP Secret {username} was not found after write")

        row = verified[0]
        rid = secret_id(row)
        expected = {
            "profile": params["profile"],
            "local-address": params["local_address"],
            "remote-address": params["remote_address"],
            "service": params["service"],
            "comment": params["comment"],
        }
        for key, value in expected.items():
            actual = str(row.get(key, row.get(key.replace("-", "_"), "")))
            if actual != str(value):
                raise RuntimeError(f"PPP Secret verification failed for {key}: expected {value}, got {actual}")

        return rid
    finally:
        if pool is not None:
            try:
                pool.disconnect()
            except Exception:
                pass


def main():
    require_env()
    print(f"TechGeekPH PPPoE provisioner started for MikroTik {MIKROTIK_HOST}:{MIKROTIK_PORT}", flush=True)
    while True:
        try:
            jobs = pull_jobs()
            if not jobs:
                time.sleep(POLL_SECONDS)
                continue

            for job in jobs:
                job_id = int(job["job_id"])
                account = str(job.get("account_no") or "")
                try:
                    rid = provision_one(job)
                    report(job_id, True, f"PPP Secret active for {account}", rid)
                    print(
                        f"ACTIVE {account} {job.get('username')} {job.get('remote_address')} {job.get('profile')} | {job.get('comment')}",
                        flush=True,
                    )
                except Exception as exc:
                    msg = str(exc)[:500]
                    try:
                        report(job_id, False, msg, None)
                    except Exception as report_exc:
                        print(f"REPORT ERROR job={job_id}: {report_exc}", file=sys.stderr, flush=True)
                    print(f"FAILED {account} job={job_id}: {msg}", file=sys.stderr, flush=True)
        except KeyboardInterrupt:
            return
        except Exception as exc:
            print(f"LOOP ERROR: {exc}", file=sys.stderr, flush=True)
            time.sleep(max(POLL_SECONDS, 10))


if __name__ == "__main__":
    main()
