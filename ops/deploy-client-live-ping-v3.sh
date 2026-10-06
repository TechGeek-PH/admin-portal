#!/usr/bin/env bash
set -euo pipefail

SERVICE="techgeekph-pppoe-ping.service"
OLD_SERVICE="techgeekph-pppoe-monitor.service"
ENV_FILE="/etc/techgeekph-pppoe-monitor.env"
DEST_DIR="/opt/techgeekph-network-monitor"
DEST="$DEST_DIR/mikrotik-pppoe-ping-edge.py"
VENV="$DEST_DIR/.venv"
PYTHON="$VENV/bin/python"
URL="https://raw.githubusercontent.com/TechGeek-PH/admin-portal/main/ops/mikrotik-pppoe-ping-edge.py"
UNIT="/etc/systemd/system/$SERVICE"
TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

if [[ ${EUID:-$(id -u)} -ne 0 ]]; then
  echo "Run as root: sudo bash deploy-client-live-ping-v3.sh"
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE. No changes were made."
  exit 2
fi

for key in MONITOR_INGEST_KEY MIKROTIK_USER MIKROTIK_PASSWORD; do
  if ! grep -qE "^${key}=.+" "$ENV_FILE"; then
    echo "Missing $key in $ENV_FILE. No changes were made."
    exit 3
  fi
done

install -d -m 0755 "$DEST_DIR"

if [[ ! -x "$PYTHON" ]]; then
  if ! python3 -m venv "$VENV" >/dev/null 2>&1; then
    apt-get update
    apt-get install -y python3-venv
    python3 -m venv "$VENV"
  fi
fi

"$VENV/bin/pip" install --disable-pip-version-check --quiet \
  'requests>=2.32.0,<3' 'RouterOS-api>=0.21.0,<1'

curl -fsSL "$URL" -o "$TMP"
"$PYTHON" -m py_compile "$TMP"
install -m 0755 "$TMP" "$DEST"

cat >"$UNIT" <<EOF
[Unit]
Description=TechGeekPH Authoritative MikroTik PPPoE Client Ping Monitor
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=$DEST_DIR
EnvironmentFile=$ENV_FILE
Environment=PPPOE_PING_MONITOR_INTERVAL_SECONDS=60
Environment=PPPOE_PING_COUNT=3
Environment=PPPOE_PING_WORKERS=4
ExecStart=$PYTHON $DEST
Restart=always
RestartSec=5
TimeoutStopSec=20
NoNewPrivileges=true
PrivateTmp=true
ProtectHome=true

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now "$SERVICE"
sleep 4

if ! systemctl is-active --quiet "$SERVICE"; then
  echo "New PPPoE ping monitor failed to start."
  journalctl -u "$SERVICE" -n 50 --no-pager || true
  exit 4
fi

echo "PPPoE ping monitor v3 installed and running."
echo "Using existing $ENV_FILE credentials and Monitor ingest key."
echo "No billing, PPP profile, NAP, ONU, ticketing, Messenger, or client-master code was changed."
echo "Waiting for first complete MikroTik client-ping cycle..."
sleep 50

LOGS="$(journalctl -u "$SERVICE" --since '-2 minutes' --no-pager || true)"
echo "$LOGS"

if echo "$LOGS" | grep -q "version=20261006-edge-v1" && echo "$LOGS" | grep -q "ping_online="; then
  if systemctl is-active --quiet "$OLD_SERVICE" 2>/dev/null; then
    systemctl disable --now "$OLD_SERVICE" || true
    echo "Disabled old broken $OLD_SERVICE only after the new monitor produced a valid cycle."
  fi
  echo
  echo "SUCCESS. Confirm ping_errors=0 above."
else
  echo
  echo "First valid cycle not confirmed yet. Old monitor was left untouched."
  echo "Check with: journalctl -u $SERVICE -n 60 --no-pager"
fi
