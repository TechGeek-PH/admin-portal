#!/usr/bin/env bash
set -euo pipefail

if [[ ${EUID:-$(id -u)} -ne 0 ]]; then
  echo "Run this installer as root: sudo bash install-network-monitor.sh"
  exit 1
fi

apt-get update
apt-get install -y python3 iputils-ping curl ca-certificates

install -d -m 0755 /opt/techgeekph-network-monitor
curl -fsSL https://raw.githubusercontent.com/TechGeek-PH/admin-portal/main/ops/network-monitor-agent.py -o /opt/techgeekph-network-monitor/network-monitor-agent.py
chmod 0755 /opt/techgeekph-network-monitor/network-monitor-agent.py
curl -fsSL https://raw.githubusercontent.com/TechGeek-PH/admin-portal/main/ops/techgeekph-network-monitor.service -o /etc/systemd/system/techgeekph-network-monitor.service

printf 'Paste the Supabase SERVICE ROLE key (input hidden): '
read -rs SERVICE_KEY
echo
if [[ -z "$SERVICE_KEY" ]]; then
  echo "Service role key is required. Nothing was started."
  exit 1
fi

cat >/etc/techgeekph-network-monitor.env <<EOF
SUPABASE_URL=https://tcexzfztdgximrzuosqs.supabase.co
SUPABASE_SERVICE_ROLE_KEY=$SERVICE_KEY
PING_INTERFACE=wg0
MONITOR_INTERVAL_SECONDS=60
PING_TIMEOUT_SECONDS=1
PING_WORKERS=40
MONITOR_SOURCE=digitalocean-wireguard
EOF
chmod 0600 /etc/techgeekph-network-monitor.env
unset SERVICE_KEY

systemctl daemon-reload
systemctl enable --now techgeekph-network-monitor.service
sleep 2
systemctl --no-pager --full status techgeekph-network-monitor.service || true

echo
echo "Installed. Live logs: journalctl -u techgeekph-network-monitor -f"
echo "Portal module: https://techgeek-ph.github.io/admin-portal/network-monitor.html"
