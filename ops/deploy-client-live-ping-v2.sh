#!/usr/bin/env bash
set -euo pipefail

SERVICE="techgeekph-pppoe-ping.service"
OLD_SERVICE="techgeekph-pppoe-monitor.service"
DEST_DIR="/opt/techgeekph-network-monitor"
DEST="${DEST_DIR}/mikrotik-pppoe-ping-v2.py"
URL="https://raw.githubusercontent.com/TechGeek-PH/admin-portal/main/ops/mikrotik-pppoe-ping-v2.py"
AGENT_ENV="/etc/techgeekph/pppoe-agent.env"
PYTHON="/opt/techgeekph/pppoe-agent-v2/.venv/bin/python"
UNIT="/etc/systemd/system/${SERVICE}"
TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

if [[ ${EUID:-$(id -u)} -ne 0 ]]; then
  echo "Run as root: sudo bash deploy-client-live-ping-v2.sh"
  exit 1
fi

if [[ ! -f "$AGENT_ENV" ]]; then
  echo "Missing $AGENT_ENV. No changes were made."
  exit 2
fi

if [[ ! -x "$PYTHON" ]]; then
  echo "Missing PPPoE agent Python at $PYTHON. No changes were made."
  exit 3
fi

if ! "$PYTHON" -c 'import routeros_api,requests' >/dev/null 2>&1; then
  echo "The existing PPPoE agent environment is missing routeros_api/requests. No changes were made."
  exit 4
fi

install -d -m 0755 "$DEST_DIR"
curl -fsSL "$URL" -o "$TMP"
"$PYTHON" -m py_compile "$TMP"
install -m 0755 "$TMP" "$DEST"

cat >"$UNIT" <<EOF
[Unit]
Description=TechGeekPH Authoritative MikroTik PPPoE Client Ping Monitor
After=network-online.target techgeekph-pppoe-agent-v2.service
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=${DEST_DIR}
EnvironmentFile=${AGENT_ENV}
Environment=PPPOE_PING_MONITOR_INTERVAL_SECONDS=60
Environment=PPPOE_PING_COUNT=3
Environment=PPPOE_PING_WORKERS=4
ExecStart=${PYTHON} ${DEST}
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
  journalctl -u "$SERVICE" -n 40 --no-pager || true
  exit 5
fi

echo "New isolated PPPoE ping monitor is running."
echo "It reuses the proven PPPoE agent credentials and routeros_api library."
echo "Billing/provisioning, NAP, ONU, tickets, Messenger, and client master code were not changed."
echo "Waiting for the first authoritative ping cycle..."
sleep 45

LOGS="$(journalctl -u "$SERVICE" --since '-2 minutes' --no-pager || true)"
echo "$LOGS"

if echo "$LOGS" | grep -q "ping_online="; then
  if systemctl is-active --quiet "$OLD_SERVICE" 2>/dev/null; then
    systemctl disable --now "$OLD_SERVICE" || true
    echo
    echo "Disabled the old broken PPPoE monitor after the new monitor produced a valid cycle."
  fi
  echo
  echo "SUCCESS: look for version=20261006-pppoe-ping-v2 and ping_errors=0."
else
  echo
  echo "The new service is active but the first full cycle has not completed yet."
  echo "Run: journalctl -u $SERVICE -n 50 --no-pager"
  echo "The old monitor was left untouched."
fi
