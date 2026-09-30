#!/usr/bin/env bash
set -euo pipefail

SERVICE="techgeekph-pppoe-monitor.service"
DEST="/opt/techgeekph-network-monitor/mikrotik-pppoe-sync.py"
URL="https://raw.githubusercontent.com/TechGeek-PH/admin-portal/main/ops/mikrotik-pppoe-sync.py"
ENV_FILE="/etc/techgeekph-pppoe-monitor.env"
BACKUP="${DEST}.bak.$(date +%Y%m%d%H%M%S)"
ENV_BACKUP="${ENV_FILE}.bak.$(date +%Y%m%d%H%M%S)"
TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

if [[ ${EUID:-$(id -u)} -ne 0 ]]; then
  echo "Run as root: sudo bash deploy-client-live-ping-fix.sh"
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE. Existing PPPoE monitor configuration was not changed."
  exit 2
fi

if ! systemctl cat "$SERVICE" >/dev/null 2>&1; then
  echo "$SERVICE is not installed. Existing services were not changed."
  exit 3
fi

curl -fsSL "$URL" -o "$TMP"
python3 -m py_compile "$TMP"

cp -a "$ENV_FILE" "$ENV_BACKUP"
if [[ -f "$DEST" ]]; then cp -a "$DEST" "$BACKUP"; fi
install -m 0755 "$TMP" "$DEST"

set_env() {
  local key="$1" value="$2"
  if grep -qE "^${key}=" "$ENV_FILE"; then
    sed -i "s#^${key}=.*#${key}=${value}#" "$ENV_FILE"
  else
    printf '%s=%s\n' "$key" "$value" >> "$ENV_FILE"
  fi
}

# Keep the MikroTik API connection on the known WireGuard management path.
set_env MIKROTIK_HOST 10.200.0.2
set_env MIKROTIK_API_PORT 8728
set_env MIKROTIK_BIND_INTERFACE wg0
set_env MIKROTIK_SOURCE_IP 10.200.0.1
set_env MIKROTIK_TIMEOUT_SECONDS 15
set_env PPPOE_PING_COUNT 5
set_env PPPOE_PING_WORKERS 4
set_env PPPOE_PING_INTERVAL 100ms
chmod 0600 "$ENV_FILE"

if ! systemctl restart "$SERVICE"; then
  echo "Restart failed. Restoring previous monitor script/config."
  [[ -f "$BACKUP" ]] && cp -a "$BACKUP" "$DEST"
  cp -a "$ENV_BACKUP" "$ENV_FILE"
  systemctl restart "$SERVICE" || true
  exit 4
fi

sleep 3
if ! systemctl is-active --quiet "$SERVICE"; then
  echo "Service is not active after update. Restoring previous monitor script/config."
  [[ -f "$BACKUP" ]] && cp -a "$BACKUP" "$DEST"
  cp -a "$ENV_BACKUP" "$ENV_FILE"
  systemctl restart "$SERVICE" || true
  exit 5
fi

echo "Client live PPPoE ping monitor v20260930-6 installed and running."
echo "MikroTik API path is forced to wg0 / 10.200.0.1 -> 10.200.0.2:8728."
echo "Waiting for the first router/API result..."
sleep 18
journalctl -u "$SERVICE" --since '-30 seconds' --no-pager || true

echo
echo "Success line contains: matcher=20260930-6 ... ping_jobs=... ping_online=... ping_errors=0"
echo "If the log instead says 'Router API connection failed', send that line back so the remaining issue can be isolated to MikroTik API/WireGuard reachability."
