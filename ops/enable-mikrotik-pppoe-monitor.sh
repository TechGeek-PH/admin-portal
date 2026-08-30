#!/usr/bin/env bash
set -euo pipefail

BASE_ENV=/etc/techgeekph-network-monitor.env
PPPOE_ENV=/etc/techgeekph-pppoe-monitor.env
DIR=/opt/techgeekph-network-monitor
SERVICE=techgeekph-pppoe-monitor.service

if [[ ${EUID:-$(id -u)} -ne 0 ]]; then
  echo "Run as root: sudo bash enable-mikrotik-pppoe-monitor.sh"
  exit 1
fi
if [[ ! -f "$BASE_ENV" ]]; then
  echo "Base Network Monitor is not installed yet: $BASE_ENV not found"
  exit 1
fi

DEFAULT_HOST=10.200.0.2
DEFAULT_USER=tg-monitor
read -rp "MikroTik WireGuard/LAN IP [$DEFAULT_HOST]: " MT_HOST
MT_HOST=${MT_HOST:-$DEFAULT_HOST}
read -rp "MikroTik monitor username [$DEFAULT_USER]: " MT_USER
MT_USER=${MT_USER:-$DEFAULT_USER}
printf 'MikroTik monitor password (input hidden; letters/numbers/dot/_/- only): '
read -rs MT_PASS
echo
if [[ -z "$MT_PASS" ]]; then echo "Password is required."; exit 1; fi
if [[ ! "$MT_PASS" =~ ^[A-Za-z0-9._-]{8,64}$ ]]; then
  echo "Use 8-64 characters: letters, numbers, dot, underscore or dash only."
  exit 1
fi

install -d -m 0755 "$DIR"
curl -fsSL https://raw.githubusercontent.com/TechGeek-PH/admin-portal/main/ops/mikrotik-pppoe-sync.py -o "$DIR/mikrotik-pppoe-sync.py"
chmod 0755 "$DIR/mikrotik-pppoe-sync.py"
curl -fsSL https://raw.githubusercontent.com/TechGeek-PH/admin-portal/main/ops/techgeekph-pppoe-monitor.service -o /etc/systemd/system/$SERVICE

cat >"$PPPOE_ENV" <<EOF
MIKROTIK_HOST=$MT_HOST
MIKROTIK_API_PORT=8728
MIKROTIK_USER=$MT_USER
MIKROTIK_PASSWORD=$MT_PASS
MIKROTIK_TIMEOUT_SECONDS=8
PPPOE_SYNC_INTERVAL_SECONDS=60
EOF
chmod 0600 "$PPPOE_ENV"
unset MT_PASS

python3 - "$MT_HOST" <<'PY'
import socket,sys
host=sys.argv[1]
try:
    with socket.create_connection((host,8728),timeout=4):
        print('MikroTik API TCP 8728: REACHABLE')
except Exception as e:
    print('MikroTik API TCP 8728: NOT REACHABLE -',e)
    print('Enable the MikroTik API service and restrict it to the VPS WireGuard IP before continuing.')
PY

systemctl daemon-reload
systemctl enable --now "$SERVICE"
sleep 3
systemctl --no-pager --full status "$SERVICE" || true
echo
echo "Latest PPPoE sync logs:"
journalctl -u "$SERVICE" -n 10 --no-pager || true
echo
echo "Success looks like: router_secrets=... router_active=... matched=... discovered_by_ip=... pppoe_active=..."
