from pathlib import Path

path = Path('app-tickets.html')
text = path.read_text(encoding='utf-8')
original = text

replacements = [
    (
        "const BUILD='20260921-new-install-accountfix-v3'",
        "const BUILD='20260923-new-install-pppoe-retry-v4'",
    ),
    (
        "st==='FAILED'?'Provisioning failed. Use Retry / Refresh Provisioning to queue the account again.':",
        "st==='FAILED'?'MikroTik provisioning failed. You may continue to Proof Photos while the router connection is being restored. Final completion stays locked until PPPoE is ACTIVE. Use Retry / Refresh Provisioning to try again.':",
    ),
    (
        "$('toProof').disabled=st!=='ACTIVE';",
        "$('toProof').disabled=!(st==='ACTIVE'||st==='FAILED');",
    ),
    (
        "$('retryProvision').onclick=()=>saveInstallDetails();",
        "$('retryProvision').onclick=async()=>{if(!selected)return;const btn=$('retryProvision');btn.disabled=true;btn.textContent='Retrying…';try{const r=await db.rpc('retry_new_install_provisioning',{p_ticket_no:selected.ticket_no});if(r.error)throw r.error;renderRouterSetup(r.data||null);note((r.data&&r.data.message)||'Existing PPPoE account requeued for MikroTik provisioning.','ok');if(String(r.data&&r.data.pppoe_status||'').toUpperCase()!=='ACTIVE')scheduleRouterPoll()}catch(e){note(e.message||'Unable to retry MikroTik provisioning.','err')}finally{btn.disabled=false;btn.textContent='Retry / Refresh Provisioning'}};",
    ),
]

for old, new in replacements:
    if old not in text:
        raise SystemExit(f'Expected marker not found; refusing partial patch: {old[:100]}')
    text = text.replace(old, new, 1)

if text == original:
    raise SystemExit('No changes made')

path.write_text(text, encoding='utf-8')
print('Patched app-tickets.html: New Install PPPoE retry + FAILED proof-photo continuation only.')
