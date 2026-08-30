#!/usr/bin/env bash
set -euo pipefail

ENV_FILE=/etc/techgeekph-network-monitor.env
AGENT=/opt/techgeekph-network-monitor/network-monitor-agent.py
SERVICE=techgeekph-network-monitor.service

if [[ ${EUID:-$(id -u)} -ne 0 ]]; then
  echo "Run as root: sudo bash enable-mikrotik-pppoe-monitor.sh"
  exit 1
fi
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Network Monitor is not installed yet: $ENV_FILE not found"
  exit 1
fi

CURRENT_HOST=$(grep -E '^MIKROTIK_HOST=' "$ENV_FILE" 2>/dev/null | tail -1 | cut -d= -f2- || true)
CURRENT_USER=$(grep -E '^MIKROTIK_USER=' "$ENV_FILE" 2>/dev/null | tail -1 | cut -d= -f2- || true)
DEFAULT_HOST=${CURRENT_HOST:-10.200.0.2}
DEFAULT_USER=${CURRENT_USER:-tg-monitor}

read -rp "MikroTik WireGuard/LAN IP [$DEFAULT_HOST]: " MT_HOST
MT_HOST=${MT_HOST:-$DEFAULT_HOST}
read -rp "MikroTik monitor username [$DEFAULT_USER]: " MT_USER
MT_USER=${MT_USER:-$DEFAULT_USER}
printf 'MikroTik monitor password (input hidden; use letters/numbers only): '
read -rs MT_PASS
echo
if [[ -z "$MT_PASS" ]]; then
  echo "Password is required."
  exit 1
fi
if [[ ! "$MT_PASS" =~ ^[A-Za-z0-9._-]{8,64}$ ]]; then
  echo "For safe EnvironmentFile storage, use 8-64 characters: letters, numbers, dot, underscore or dash only."
  exit 1
fi

curl -fsSL https://raw.githubusercontent.com/TechGeek-PH/admin-portal/main/ops/network-monitor-agent.py -o "$AGENT"
chmod 0755 "$AGENT"

TMP=$(mktemp)
grep -vE '^MIKROTIK_(HOST|API_PORT|USER|PASSWORD|TIMEOUT_SECONDS)=' "$ENV_FILE" > "$TMP" || true
cat >>"$TMP" <<EOF
MIKROTIK_HOST=$MT_HOST
MIKROTIK_API_PORT=8728
MIKROTIK_USER=$MT_USER
MIKROTIK_PASSWORD=$MT_PASS
MIKROTIK_TIMEOUT_SECONDS=8
EOF
install -m 0600 "$TMP" "$ENV_FILE"
rm -f "$TMP"
unset MT_PASS

python3 - "$MT_HOST" <<'PY'
import socket,sys
host=sys.argv[1]
try:
    with socket.create_connection((host,8728),timeout=4):
        print('MikroTik API TCP 8728: REACHABLE')
except Exception as e:
    print('MikroTik API TCP 8728: NOT REACHABLE -',e)
    print('Enable /ip service api on the MikroTik and allow only the VPS WireGuard IP.')
PY

systemctl daemon-reload
systemctl restart "$SERVICE"
sleep 3
systemctl --no-pager --full status "$SERVICE" || true
echo
echo "Latest monitor logs:"
journalctl -u "$SERVICE" -n 8 --no-pager || true
echo
echo "Expected successful line includes: pppoe_checked=... pppoe_active=... router_active=..."
