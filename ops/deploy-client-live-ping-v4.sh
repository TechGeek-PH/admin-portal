#!/usr/bin/env bash
set -euo pipefail

PING_SERVICE="techgeekph-pppoe-ping.service"
BROKEN_SYNC_SERVICE="techgeekph-pppoe-monitor.service"
WORKING_AGENT_SERVICE="techgeekph-pppoe-agent.service"
MONITOR_ENV="/etc/techgeekph-network-monitor.env"
DEST_DIR="/opt/techgeekph-network-monitor"
DEST="$DEST_DIR/mikrotik-pppoe-ping-edge.py"
WRAPPER="$DEST_DIR/run-pppoe-ping-v4.sh"
URL="https://raw.githubusercontent.com/TechGeek-PH/admin-portal/main/ops/mikrotik-pppoe-ping-edge.py"
UNIT="/etc/systemd/system/$PING_SERVICE"
TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

if [[ ${EUID:-$(id -u)} -ne 0 ]]; then
  echo "Run as root."
  exit 1
fi

if ! systemctl is-active --quiet "$WORKING_AGENT_SERVICE"; then
  echo "Working PPPoE provisioning agent is not active. No changes were made."
  exit 2
fi

if [[ ! -f "$MONITOR_ENV" ]] || ! grep -qE '^MONITOR_INGEST_KEY=.+' "$MONITOR_ENV"; then
  echo "Existing network monitor ingest key was not found. No changes were made."
  exit 3
fi

AGENT_PID="$(systemctl show -p MainPID --value "$WORKING_AGENT_SERVICE")"
if [[ -z "$AGENT_PID" || "$AGENT_PID" == "0" || ! -r "/proc/$AGENT_PID/cmdline" ]]; then
  echo "Could not inspect the active PPPoE agent process. No changes were made."
  exit 4
fi

PYTHON="$(tr '\0' '\n' <"/proc/$AGENT_PID/cmdline" | sed -n '1p')"
if [[ -z "$PYTHON" || ! -x "$PYTHON" ]]; then
  echo "Could not resolve the working PPPoE agent Python interpreter. No changes were made."
  exit 5
fi

if ! "$PYTHON" -c 'import routeros_api,requests' >/dev/null 2>&1; then
  echo "Working PPPoE agent Python is missing routeros_api/requests. No changes were made."
  exit 6
fi

if ! tr '\0' '\n' <"/proc/$AGENT_PID/environ" | grep -qE '^(MIKROTIK_USER|MIKROTIK_USERNAME)=.+'; then
  echo "Working PPPoE agent has no MikroTik username in its runtime environment. No changes were made."
  exit 7
fi
if ! tr '\0' '\n' <"/proc/$AGENT_PID/environ" | grep -qE '^MIKROTIK_PASSWORD=.+'; then
  echo "Working PPPoE agent has no MikroTik password in its runtime environment. No changes were made."
  exit 8
fi

install -d -m 0755 "$DEST_DIR"
curl -fsSL "$URL" -o "$TMP"
"$PYTHON" -m py_compile "$TMP"
install -m 0755 "$TMP" "$DEST"

cat >"$WRAPPER" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

AGENT_SERVICE="techgeekph-pppoe-agent.service"
MONITOR_ENV="/etc/techgeekph-network-monitor.env"
SCRIPT="/opt/techgeekph-network-monitor/mikrotik-pppoe-ping-edge.py"

PID="$(systemctl show -p MainPID --value "$AGENT_SERVICE")"
if [[ -z "$PID" || "$PID" == "0" || ! -r "/proc/$PID/environ" || ! -r "/proc/$PID/cmdline" ]]; then
  echo "Working PPPoE agent runtime is unavailable." >&2
  exit 20
fi

PYTHON="$(tr '\0' '\n' <"/proc/$PID/cmdline" | sed -n '1p')"
if [[ -z "$PYTHON" || ! -x "$PYTHON" ]]; then
  echo "Working PPPoE agent Python is unavailable." >&2
  exit 21
fi

set -a
. "$MONITOR_ENV"
set +a

while IFS= read -r -d '' entry; do
  case "$entry" in
    MIKROTIK_HOST=*|MIKROTIK_USER=*|MIKROTIK_USERNAME=*|MIKROTIK_PASSWORD=*|MIKROTIK_PORT=*|MIKROTIK_API_PORT=*|MIKROTIK_USE_SSL=*|MIKROTIK_SSL_VERIFY=*)
      export "$entry"
      ;;
  esac
done <"/proc/$PID/environ"

exec "$PYTHON" "$SCRIPT"
EOF
chmod 0755 "$WRAPPER"

cat >"$UNIT" <<EOF
[Unit]
Description=TechGeekPH Authoritative MikroTik PPPoE Client Ping Monitor
After=network-online.target $WORKING_AGENT_SERVICE
Requires=$WORKING_AGENT_SERVICE
Wants=network-online.target

[Service]
Type=simple
ExecStart=$WRAPPER
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

echo "PPPoE ping monitor v4 is running with the exact runtime used by:"
echo "  $WORKING_AGENT_SERVICE"
echo "No passwords were copied to a new persistent config file."
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
    echo "Disabled old broken $BROKEN_SYNC_SERVICE after v4 passed."
  fi
  echo "SUCCESS: authoritative MikroTik client ping is active."
else
  echo "A clean first cycle was not confirmed yet."
  echo "The old sync monitor was left untouched."
  echo "Check: journalctl -u $PING_SERVICE -n 80 --no-pager"
fi
