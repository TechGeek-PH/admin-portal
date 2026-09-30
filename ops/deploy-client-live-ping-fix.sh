#!/usr/bin/env bash
set -euo pipefail

SERVICE="techgeekph-pppoe-monitor.service"
DEST="/opt/techgeekph-network-monitor/mikrotik-pppoe-sync.py"
URL="https://raw.githubusercontent.com/TechGeek-PH/admin-portal/main/ops/mikrotik-pppoe-sync.py"
BACKUP="${DEST}.bak.$(date +%Y%m%d%H%M%S)"
TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

if [[ ${EUID:-$(id -u)} -ne 0 ]]; then
  echo "Run as root: sudo bash deploy-client-live-ping-fix.sh"
  exit 1
fi

if [[ ! -f /etc/techgeekph-pppoe-monitor.env ]]; then
  echo "Missing /etc/techgeekph-pppoe-monitor.env. Existing PPPoE monitor configuration was not changed."
  exit 2
fi

if ! systemctl cat "$SERVICE" >/dev/null 2>&1; then
  echo "$SERVICE is not installed. Existing services were not changed."
  exit 3
fi

curl -fsSL "$URL" -o "$TMP"
python3 -m py_compile "$TMP"

if [[ -f "$DEST" ]]; then
  cp -a "$DEST" "$BACKUP"
fi
install -m 0755 "$TMP" "$DEST"

if ! systemctl restart "$SERVICE"; then
  echo "Restart failed. Restoring previous monitor script."
  if [[ -f "$BACKUP" ]]; then
    cp -a "$BACKUP" "$DEST"
    systemctl restart "$SERVICE" || true
  fi
  exit 4
fi

sleep 4
if ! systemctl is-active --quiet "$SERVICE"; then
  echo "Service is not active after update. Restoring previous monitor script."
  if [[ -f "$BACKUP" ]]; then
    cp -a "$BACKUP" "$DEST"
    systemctl restart "$SERVICE" || true
  fi
  exit 5
fi

echo "Client live PPPoE ping monitor deployed successfully."
echo "Expected log fields: matcher=20260930-5, ping_jobs=, ping_online=, ping_down=, ping_errors="
journalctl -u "$SERVICE" -n 30 --no-pager
