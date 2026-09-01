# TechGeekPH MikroTik PPPoE Provisioning Agent

This agent runs on the WireGuard VPS that can reach the PPPoE MikroTik. It polls Supabase for `QUEUED` provisioning jobs, creates or updates `/ppp secret`, verifies the result, then marks the job `ACTIVE` or `FAILED`.

## Required network access

- VPS can reach the MikroTik WireGuard address (default `10.200.0.2`).
- RouterOS API is enabled on the MikroTik (`8728` or preferably API-SSL `8729`).
- Use a dedicated MikroTik API user where possible.

## VPS install

```bash
sudo mkdir -p /opt/techgeekph-pppoe-agent /etc/techgeekph
sudo python3 -m venv /opt/techgeekph-pppoe-agent/venv
sudo /opt/techgeekph-pppoe-agent/venv/bin/pip install -U pip
sudo /opt/techgeekph-pppoe-agent/venv/bin/pip install 'requests>=2.32,<3' 'RouterOS-api>=0.19,<0.20'
```

Copy `agent.py` to `/opt/techgeekph-pppoe-agent/agent.py` and create `/etc/techgeekph/pppoe-agent.env` from `pppoe-agent.env.example`.

**Never commit or paste the Supabase service-role key or MikroTik password into GitHub/chat.** Store them only in `/etc/techgeekph/pppoe-agent.env` and protect the file:

```bash
sudo chmod 600 /etc/techgeekph/pppoe-agent.env
```

Install the service:

```bash
sudo cp techgeekph-pppoe-agent.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now techgeekph-pppoe-agent
sudo systemctl status techgeekph-pppoe-agent --no-pager
```

Live logs:

```bash
sudo journalctl -u techgeekph-pppoe-agent -f
```

## MikroTik API example

Use the actual WireGuard source IP of the VPS in `address=` instead of opening the API to all networks.

```routeros
/ip service set api disabled=no address=<VPS_WG_IP>/32 port=8728
```

For production, API-SSL on `8729` is preferred when a valid RouterOS certificate is available.

## Provisioning flow

1. New Installation generates a reserved Account No., PPPoE username/password and Remote Address.
2. Technician completes client/network details, all proof photos and checklist, selects Done, and taps Save Update.
3. The job becomes `QUEUED` with the final Speed/Profile and LP/NP/CP comment.
4. This VPS agent claims the job, creates/updates `/ppp secret`, verifies it, and marks the job `ACTIVE`.
5. The technician app unlocks `Confirm Router Updated & Close Ticket`.
6. Technician copies the credentials to the client router, confirms internet is working, then closes the ticket.

The agent is idempotent: if the PPP secret already exists by username, it updates it instead of creating a duplicate.
