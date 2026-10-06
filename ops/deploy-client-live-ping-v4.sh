#!/usr/bin/env bash
set -euo pipefail

PING_SERVICE="techgeekph-pppoe-ping.service"
BROKEN_SYNC_SERVICE="techgeekph-pppoe-monitor.service"
WORKING_AGENT_SERVICE="techgeekph-pppoe-agent.service"
MONITOR_ENV="/etc/techgeekph-network-monitor.env"
DEST_DIR="/opt/techgeekph-network-monitor"
DEST="$DEST_DIR/mikrotik-pppoe-ping-edge.py"
URL="https://raw.githubusercontent.com/TechGeek-PH/admin-portal/main/ops/mikrotik-pppoe-ping-edge.py"
UNIT="/etc/systemd/system/$PING_SERVICE"
TMP="$(mktemp)"
RUNTIME_AGENT_ENV="/run/techgeekph-pppoe-ping-agent.env"
trap 'rm -f "$TMP"' EXIT

if [[ ${EUID:-$(id -u)} -ne 0 ]]; then
  echo "Run as root."
  exit 1
fi

if ! systemctl is-active --quiet "$WORKING_AGENT_SERVICE"; then
  echo "Working PPPoE provisioning agent is not active. No changes were made."
  exit 2
fi

AGENT_PID="$(systemctl show -p MainPID --value "$WORKING_AGENT_SERVICE")"
if [[ -z "$AGENT_PID" || "$AGENT_PID" == "0" || ! -r "/proc/$AGENT_PID/cmdline" ]]; then
  echo "Could not inspect the active PPPoE agent process. No changes were made."
  exit 3
fi

PYTHON="$(tr '\0' '\n' <"/proc/$AGENT_PID/cmdline" | sed -n '1p')"
if [[ -z "$PYTHON" || ! -x "$PYTHON" ]]; then
  echo "Could not resolve the working PPPoE agent Python interpreter. No changes were made."
  exit 4
fi

if ! "$PYTHON" -c 'import routeros_api,requests' >/dev/null 2>&1; then
  echo "The working PPPoE agent Python does not expose routeros_api/requests. No changes were made."
  exit 5
fi

if [[ ! -f "$MONITOR_ENV" ]] || ! grep -qE '^MONITOR_INGEST_KEY=.+' "$MONITOR_ENV"; then
  echo "Existing network monitor ingest key was not found. No changes were made."
  exit 6
fi

AGENT_ENV=""
while IFS= read -r line; do
  line="${line#EnvironmentFile=}"
  line="${line#-}"
  line="${line%\"}"
  line="${line#\"}"
  if [[ -f "$line" ]]; then
    AGENT_ENV="$line"
    break
  fi
done < <(systemctl cat "$WORKING_AGENT_SERVICE" 2>/dev/null | sed -n 's/^[[:space:]]*EnvironmentFile=//p' | sed 's/^/EnvironmentFile=/')

if [[ -z "$AGENT_ENV" ]]; then
  : >"$RUNTIME_AGENT_ENV"
  chmod 0600 "$RUNTIME_AGENT_ENV"
  tr '\0' '\n' <"/proc/$AGENT_PID/environ" |
    grep -E '^(MIKROTIK_HOST|MIKROTIK_USER|MIKROTIK_USERNAME|MIKROTIK_PASSWORD|MIKROTIK_PORT|MIKROTIK_API_PORT|MIKROTIK_USE_SSL|MIKROTIK_SSL_VERIFY)='     >"$RUNTIME_AGENT_ENV" || true
  AGENT_ENV="$RUNTIME_AGENT_ENV"
fi

for key in MIKROTIK_PASSWORD; do
  if ! grep -qE "^${key}=.+" "$AGENT_ENV"; then
    echo "The working PPPoE agent credentials could not be reused safely. No changes were made."
    exit 7
  fi
done

if ! grep -qE '^(MIKROTIK_USER|MIKROTIK_USERNAME)=.+' "$AGENT_ENV"; then
  echo "The working PPPoE agent username could not be reused safely. No changes were made."
  exit 8
fi

install -d -m 0755 "$DEST_DIR"
curl -fsSL "$URL" -o "$TMP"
"$PYTHON" -m py_compile "$TMP"
install -m 0755 "$TMP" "$DEST"

cat >"$UNIT" <<EOF
[Unit]
Description=TechGeekPH Authoritative MikroTik PPPoE Client Ping Monitor
After=network-online.target $WORKING_AGENT_SERVICE
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=$DEST_DIR
EnvironmentFile=$MONITOR_ENV
EnvironmentFile=$AGENT_ENV
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
systemctl restart "$PING_SERVICE"
systemctl enable "$PING_SERVICE" >/dev/null 2>&1 || true
sleep 5

if ! systemctl is-active --quiet "$PING_SERVICE"; then
  echo "Ping monitor failed to start."
  journalctl -u "$PING_SERVICE" -n 50 --no-pager || true
  exit 9
fi

echo "PPPoE ping monitor v4 is running with the exact Python + MikroTik credentials used by:"
echo "  $WORKING_AGENT_SERVICE"
echo "No billing, PPP profile, NAP, ONU, ticketing, Messenger, or client-master logic was changed."
echo "Waiting for the first full client-ping cycle..."
sleep 55

LOGS="$(journalctl -u "$PING_SERVICE" --since '-2 minutes' --no-pager || true)"
echo "$LOGS"

if echo "$LOGS" | grep -q 'version=20261006-edge-v1' &&
   echo "$LOGS" | grep -q 'ping_online=' &&
   echo "$LOGS" | grep -q 'ping_errors=0'; then
  if systemctl is-active --quiet "$BROKEN_SYNC_SERVICE" 2>/dev/null; then
    systemctl disable --now "$BROKEN_SYNC_SERVICE" >/dev/null 2>&1 || true
    echo "Disabled the old broken PPPoE sync monitor after v4 passed."
  fi
  echo "SUCCESS: authoritative MikroTik client ping is active."
else
  echo "A clean first cycle was not confirmed yet."
  echo "The old sync monitor was left untouched."
  echo "Check: journalctl -u $PING_SERVICE -n 80 --no-pager"
fi
