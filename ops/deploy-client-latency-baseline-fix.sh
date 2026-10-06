#!/usr/bin/env bash
set -euo pipefail

SERVICE="techgeekph-network-monitor.service"
EXPERIMENTAL="techgeekph-pppoe-ping.service"
DEST="/opt/techgeekph-network-monitor/network-monitor-agent.py"
ENV_FILE="/etc/techgeekph-network-monitor.env"
URL="https://raw.githubusercontent.com/TechGeek-PH/admin-portal/main/ops/network-monitor-agent.py"
STAMP="$(date +%Y%m%d%H%M%S)"
BACKUP="$DEST.bak.$STAMP"
ENV_BACKUP="$ENV_FILE.bak.$STAMP"
TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

if [[ ${EUID:-$(id -u)} -ne 0 ]]; then
  echo "Run as root."
  exit 1
fi

if [[ ! -f "$DEST" || ! -f "$ENV_FILE" ]]; then
  echo "Existing network monitor files are missing. No changes were made."
  exit 2
fi

curl -fsSL "$URL" -o "$TMP"
python3 -m py_compile "$TMP"

cp -a "$DEST" "$BACKUP"
cp -a "$ENV_FILE" "$ENV_BACKUP"
install -m 0755 "$TMP" "$DEST"

set_env() {
  local key="$1" value="$2"
  if grep -qE "^${key}=" "$ENV_FILE"; then
    sed -i "s#^${key}=.*#${key}=${value}#" "$ENV_FILE"
  else
    printf '%s=%s\n' "$key" "$value" >> "$ENV_FILE"
  fi
}

set_env LATENCY_BASELINE_TARGET 10.200.0.2
set_env LATENCY_BASELINE_COUNT 5
set_env CLIENT_PING_COUNT 3
set_env CLIENT_PING_INTERVAL 0.1
chmod 0600 "$ENV_FILE"

if systemctl list-unit-files | grep -q "^${EXPERIMENTAL}"; then
  systemctl disable --now "$EXPERIMENTAL" >/dev/null 2>&1 || true
fi

if ! systemctl restart "$SERVICE"; then
  echo "Restart failed. Restoring previous monitor."
  cp -a "$BACKUP" "$DEST"
  cp -a "$ENV_BACKUP" "$ENV_FILE"
  systemctl restart "$SERVICE" || true
  exit 3
fi

sleep 25
if ! systemctl is-active --quiet "$SERVICE"; then
  echo "Network monitor is not active. Restoring previous monitor."
  cp -a "$BACKUP" "$DEST"
  cp -a "$ENV_BACKUP" "$ENV_FILE"
  systemctl restart "$SERVICE" || true
  exit 4
fi

LOGS="$(journalctl -u "$SERVICE" --since '-90 seconds' --no-pager || true)"
echo "$LOGS"

if echo "$LOGS" | grep -q 'baseline=' && ! echo "$LOGS" | grep -q 'baseline=unavailable'; then
  echo
  echo "SUCCESS: same-cycle WireGuard baseline latency correction is active."
  echo "Client reachability still comes from each client's own IP."
  echo "Only the displayed/stored latency is corrected for the common VPS-to-MikroTik tunnel RTT."
else
  echo
  echo "Monitor is running, but a usable baseline was not confirmed yet."
  echo "Backup kept at: $BACKUP"
fi
