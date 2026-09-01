from pathlib import Path

p = Path("app-tickets.html")
s = p.read_text(encoding="utf-8")

def replace_once(old, new, label):
    global s
    if old not in s:
        raise SystemExit(f"{label} marker not found")
    s = s.replace(old, new, 1)

replace_once(
    "const BUILD='20260901-pppoe-auto-v12'",
    "const BUILD='20260902-router-confirm-v13'",
    "build"
)

css = r'''.pppoe-ready{display:none;margin:12px 0 14px;padding:14px;border:1px solid #8fc9ac;border-radius:14px;background:#f2fbf7}.pppoe-ready.show{display:block}.pppoe-ready h3{margin:0;color:#126247;font-size:.95rem}.pppoe-ready .sub{margin:5px 0 10px;color:#587064;font-size:.67rem;line-height:1.45}.pppoe-status{display:inline-flex;padding:5px 9px;border-radius:999px;font-size:.62rem;font-weight:950;background:#fff4dc;color:#8b5b00}.pppoe-status.active{background:#e5f8ef;color:#08714b}.pppoe-status.failed{background:#fff0f2;color:#a3153d}.cred-grid,.install-summary{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}.cred,.sum{background:#fff;border:1px solid #d8e9df;border-radius:10px;padding:9px}.cred span,.sum span{display:block;color:#6c7d73;font-size:.58rem;font-weight:900;text-transform:uppercase;letter-spacing:.03em}.cred b,.sum b{display:block;margin-top:4px;font-size:.76rem;word-break:break-word}.cred.secret b{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.86rem}.copy-row{display:flex;flex-wrap:wrap;gap:7px;margin-top:10px}.copy-row button{border:1px solid #9bcdb1;background:#fff;color:#126247;border-radius:9px;padding:8px 10px;font-size:.68rem;font-weight:900}.confirm-install{width:100%;min-height:46px;margin-top:11px;border:0;border-radius:10px;background:#16865e;color:#fff;font-weight:950}.confirm-install:disabled{background:#aebbb5}.router-wait{margin-top:9px;padding:9px 10px;border-radius:9px;background:#fff;color:#536579;font-size:.66rem;line-height:1.45}.summary-title{margin-top:13px;color:#42566a;font-size:.65rem;font-weight:950;text-transform:uppercase;letter-spacing:.04em}@media(max-width:560px){.cred-grid,.install-summary{grid-template-columns:1fr}}'''
replace_once(".embed header{display:none}", css + ".embed header{display:none}", "css")

panel = r'''<section id="pppoeReady" class="pppoe-ready"><h3>PPPoE Ready - Configure Client Router</h3><p class="sub">Copy the PPPoE username and password below and enter them into the client router. The ticket stays open until the MikroTik PPP Secret is ACTIVE and the technician confirms the router was updated.</p><span id="pppoeState" class="pppoe-status">WAITING</span><div id="pppoeCreds" class="cred-grid"></div><div class="copy-row"><button type="button" id="copyUser">Copy Username</button><button type="button" id="copyPass">Copy Password</button><button type="button" id="copyPppoe">Copy PPPoE Details</button></div><div class="summary-title">Final Installation Details</div><div id="installSummary" class="install-summary"></div><div id="routerWait" class="router-wait"></div><button type="button" id="confirmInstall" class="confirm-install" disabled>Confirm Router Updated &amp; Close Ticket</button></section>'''
replace_once('<div id="tasks" class="tasks"></div>', panel + '<div id="tasks" class="tasks"></div>', "panel")

replace_once(
    "let profile=null,tickets=[],updates=new Map(),selected=null,requestedOpened=false,clientDetails=null;",
    "let profile=null,tickets=[],updates=new Map(),selected=null,requestedOpened=false,clientDetails=null,routerSetup=null,routerPoll=null;",
    "state"
)

note_marker = "function note(t,k='ok'){const n=$('notice');n.textContent=t;n.className='notice show '+k;setTimeout(()=>n.className='notice',5200)}"
helpers = r'''function note(t,k='ok'){const n=$('notice');n.textContent=t;n.className='notice show '+k;setTimeout(()=>n.className='notice',5200)}
function hideRouterSetup(){routerSetup=null;if(routerPoll){clearTimeout(routerPoll);routerPoll=null}const b=$('pppoeReady');if(b)b.classList.remove('show')}
function fieldHtml(label,value,secret=false){return `<div class="${secret?'cred secret':'sum'}"><span>${esc(label)}</span><b>${esc(value||'-')}</b></div>`}
function renderRouterSetup(d){if(!d||!(d.ready||d.requires_router_confirmation))return;routerSetup=d;const b=$('pppoeReady');b.classList.add('show');const st=String(d.pppoe_status||'WAITING').toUpperCase(),state=$('pppoeState');state.textContent=st;state.className='pppoe-status '+(st==='ACTIVE'?'active':st==='FAILED'?'failed':'');$('pppoeCreds').innerHTML=fieldHtml('Account No.',d.account_no)+fieldHtml('PPPoE Username',d.pppoe_username,true)+fieldHtml('PPPoE Password',d.pppoe_password,true)+fieldHtml('Local Address',d.local_address)+fieldHtml('Remote Address',d.remote_address)+fieldHtml('Profile',d.pppoe_profile)+fieldHtml('Service',d.pppoe_service||'pppoe')+fieldHtml('Comment',d.pppoe_comment);$('installSummary').innerHTML=fieldHtml('Client Name',d.client_name)+fieldHtml('Plan',d.plan)+fieldHtml('Speed',d.speed)+fieldHtml('Monthly Bill',d.monthly_bill!=null?'PHP '+d.monthly_bill:'-')+fieldHtml('Contact Number',d.phone)+fieldHtml('Email',d.email)+fieldHtml('Service Address',d.service_address)+fieldHtml('Permanent Address',d.permanent_address)+fieldHtml('RD / BLK',d.rd_blk)+fieldHtml('Landmark',d.landmark)+fieldHtml('Google Maps Link',d.google_maps_link)+fieldHtml('Geo Tagging',d.geo_tagging)+fieldHtml('Line Port',d.line_port)+fieldHtml('Network Port / NAP',d.network_port)+fieldHtml('Client Port',d.client_port)+fieldHtml('VLAN ID',d.vlan_id)+fieldHtml('Modem / ONU',d.modem_brand_model)+fieldHtml('Modem Serial No.',d.modem_serial_no)+fieldHtml('ONU MAC',d.onu_mac)+fieldHtml('Band Steering',d.band_steering);const can=!!d.can_confirm_done||st==='ACTIVE';$('confirmInstall').disabled=!can;$('routerWait').textContent=st==='ACTIVE'?'MikroTik PPP Secret is ACTIVE. Update the client router using the credentials above, test the internet connection, then confirm to close the ticket.':st==='FAILED'?'PPPoE provisioning failed. Tap Save Update again to retry provisioning.':`Creating or verifying the PPP Secret on MikroTik. Current status: ${st}. This screen refreshes automatically.`;if(!can&&st!=='FAILED')scheduleRouterPoll()}
async function loadRouterSetup(no){const r=await db.rpc('get_new_install_router_setup',{p_ticket_no:no});if(r.error)throw r.error;if(r.data&&r.data.ready)renderRouterSetup(r.data)}
function scheduleRouterPoll(){if(routerPoll)clearTimeout(routerPoll);routerPoll=setTimeout(async()=>{routerPoll=null;if(!selected||!$('dlg').open)return;try{await loadRouterSetup(selected.ticket_no)}catch(_){}},3500)}
async function copyText(text,label){if(!text)return;try{await navigator.clipboard.writeText(String(text));note(label+' copied.','ok')}catch(_){note('Unable to copy automatically. Press and hold the value to copy.','err')}}
async function confirmInstallDone(){if(!selected||!routerSetup)return;const ticketNo=selected.ticket_no,btn=$('confirmInstall');btn.disabled=true;btn.textContent='Confirming...';try{const r=await db.rpc('confirm_new_install_router_setup',{p_ticket_no:ticketNo});if(r.error)throw r.error;hideRouterSetup();$('dlg').close();try{localStorage.setItem('tg_clients_changed_at',String(Date.now()))}catch(_){}try{window.parent.postMessage({type:'tg-clients-changed'},location.origin)}catch(_){}await load();note('Router updated - PPPoE ACTIVE - installation ticket closed.','ok')}catch(e){note(e.message||'Unable to close installation ticket.','err');try{await loadRouterSetup(ticketNo)}catch(_){}}finally{btn.textContent='Confirm Router Updated & Close Ticket';if(routerSetup)btn.disabled=String(routerSetup.pppoe_status||'').toUpperCase()!=='ACTIVE'}}'''
replace_once(note_marker, helpers, "helpers")

replace_once(
    "$('clientUpdate').classList.remove('show');clientDetails=null;if(allowsClientUpdate(selected))",
    "$('clientUpdate').classList.remove('show');clientDetails=null;hideRouterSetup();if(allowsClientUpdate(selected))",
    "open reset"
)
replace_once(
    "if(allowsClientUpdate(selected)){try{fillClientPanel(await getClientDetails(id),selected,ro)}catch(e){note('Client details could not be loaded: '+(e.message||e),'err')}}$('tasks').innerHTML=",
    "if(allowsClientUpdate(selected)){try{fillClientPanel(await getClientDetails(id),selected,ro)}catch(e){note('Client details could not be loaded: '+(e.message||e),'err')}}if(isInstallation(selected)){try{await loadRouterSetup(id)}catch(e){note('PPPoE setup could not be loaded: '+(e.message||e),'err')}}$('tasks').innerHTML=",
    "open load"
)

replace_once(
    "const result=r.data||{};$('dlg').close();try{localStorage.setItem('tg_clients_changed_at',String(Date.now()))}",
    "const result=r.data||{};try{localStorage.setItem('tg_clients_changed_at',String(Date.now()))}",
    "save close"
)
replace_once(
    "try{window.parent.postMessage({type:'tg-clients-changed'},location.origin)}catch(_){}await load();const pppoe=result.pppoe_status?",
    "try{window.parent.postMessage({type:'tg-clients-changed'},location.origin)}catch(_){}if(result.requires_router_confirmation){const ticketNo=selected.ticket_no;$('work').value='For Checking';await load();await loadRouterSetup(ticketNo);note('Installation details saved. PPPoE credentials are ready to copy. Update the client router, test the connection, then confirm Done.','ok');return}$('dlg').close();await load();const pppoe=result.pppoe_status?",
    "save branch"
)

old_end = "$('q').oninput=render;$('month').onchange=render;$('status').onchange=render;$('close').onclick=$('cancel').onclick=()=>$('dlg').close();$('save').onclick=save;boot();})();"
new_end = r'''$('q').oninput=render;$('month').onchange=render;$('status').onchange=render;$('copyUser').onclick=()=>copyText(routerSetup&&routerSetup.pppoe_username,'PPPoE username');$('copyPass').onclick=()=>copyText(routerSetup&&routerSetup.pppoe_password,'PPPoE password');$('copyPppoe').onclick=()=>copyText(routerSetup?`Account: ${routerSetup.account_no||''}\nUsername: ${routerSetup.pppoe_username||''}\nPassword: ${routerSetup.pppoe_password||''}\nLocal Address: ${routerSetup.local_address||''}\nRemote Address: ${routerSetup.remote_address||''}\nProfile: ${routerSetup.pppoe_profile||''}\nService: ${routerSetup.pppoe_service||'pppoe'}\nComment: ${routerSetup.pppoe_comment||''}`:'','PPPoE details');$('confirmInstall').onclick=confirmInstallDone;$('close').onclick=$('cancel').onclick=()=>{hideRouterSetup();$('dlg').close()};$('save').onclick=save;boot();})();'''
replace_once(old_end, new_end, "handlers")

replace_once(
    "completing the ticket activates the installation record.",
    "marking Done first prepares PPPoE credentials; the ticket closes only after router confirmation.",
    "install hint"
)

p.write_text(s, encoding="utf-8")
print("patched app-tickets.html")
