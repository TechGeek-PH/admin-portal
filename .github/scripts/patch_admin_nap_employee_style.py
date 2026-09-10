from pathlib import Path

p = Path('nap-checker-v2.html')
s = p.read_text(encoding='utf-8')

STYLE_MARKER = 'TG-ADMIN-EMPLOYEE-STYLE-20260910'
if STYLE_MARKER not in s:
    css = r'''
/* TG-ADMIN-EMPLOYEE-STYLE-20260910
   Keep Admin-only controls, but match the Employee port cards/details. */
.port-layout{padding:10px;gap:9px}
.port-summary{align-items:flex-start;margin-bottom:0}
.port-summary b{display:block;color:var(--blue);font-size:.72rem}
.port-summary small{display:block;margin-top:2px;color:var(--muted);font-size:.55rem;line-height:1.4}
.port-legend{font-size:.56rem;gap:8px}
.port-grid{grid-template-columns:repeat(4,minmax(0,1fr));gap:7px}
.port{min-height:70px;border:2px solid #cbd5e1;border-radius:10px;background:#f8fafc;color:#526174;gap:3px;padding:5px;transition:border-color .12s ease,box-shadow .12s ease,transform .12s ease}
.port:hover{transform:translateY(-1px)}
.port strong{font-size:1rem;line-height:1}
.port small,.port em{font-size:.43rem;font-weight:950;letter-spacing:.02em;text-align:center;line-height:1.2}
.port.active{background:#eefaf5;border-color:#2b9b70;color:#126247}
.port.down{background:#fff1f4;border-color:#c91448;color:#9f1239}
.port.pending{background:#fff1f4;border-color:#c91448;color:#9f1239}
.port.conflict{background:#fff5ea;border-color:#d97706;color:#8b5800}
.port.selected{box-shadow:0 0 0 3px rgba(6,79,131,.13)}
.port-detail{margin-top:0;padding:10px;border:1px solid var(--line);border-radius:10px;background:#fbfcfe}
.port-detail-head{align-items:flex-start}
.port-detail-head h4{font-size:.82rem}
.badge{min-height:24px;padding:0 8px;font-size:.52rem}
.badge.down{background:#fff0f4;color:#9f1239}
.info{grid-template-columns:1fr 1fr;gap:6px;margin-top:8px}
.info div{padding:7px;border:1px solid #e2e8f0;border-radius:8px;background:#fff}
.info span{font-size:.47rem;color:var(--muted);font-weight:850;text-transform:uppercase}
.info b{margin-top:3px;font-size:.61rem;line-height:1.35}
.alert,.okbox{margin-top:8px;padding:9px;font-size:.62rem;line-height:1.4}
.live-down{border-color:#f4a3b8;background:#fff1f4;color:#8f1235}
.bindbox{margin-top:8px;padding:9px}
.bindbox h5{font-size:.62rem}
.bindrow select,.bindrow button{min-height:36px;font-size:.6rem}
.bindhint{font-size:.52rem}
@media(max-width:650px){.port-grid{grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}.port{min-height:65px}.info{grid-template-columns:1fr 1fr}.port-layout{padding:9px}}
@media(max-width:380px){.port-grid{gap:5px}.port{min-height:62px;padding:4px}.port strong{font-size:.92rem}.port small,.port em{font-size:.4rem}.info{gap:5px}.info div{padding:6px}}
'''
    s = s.replace('</style>', css + '\n</style>', 1)

s = s.replace(
    "const BUILD='20260905-fiber-optical',db=window.TechGeekSupabase,$=id=>document.getElementById(id);",
    "const BUILD='20260910-admin-employee-style-fast-live',LIVE_REFRESH_MS=10000,FULL_REFRESH_MS=60000,db=window.TechGeekSupabase,$=id=>document.getElementById(id);"
)
s = s.replace(
    "selectedPort='',sessionUser=null,refreshTimer=null;",
    "selectedPort='',sessionUser=null,refreshTimer=null,liveRefreshTimer=null,liveRefreshBusy=false;"
)

anchor = "function pppoeText(r){const p=pppoeCache.get(norm(r.account_no));if(!p)return'No Data';return p.profile||(p.session_active?'Active':'Inactive')}"
helpers = anchor + "\nfunction liveState(r){const p=pingCache.get(norm(r?.account_no)),sig=signalFor(r);if(p?.is_reachable===false||['OFFLINE','DYINGGASP'].includes(sig))return'DOWN';if(p?.is_reachable===true)return'ONLINE';return'ACTIVE'}\nfunction pingCheckedText(r){const p=pingCache.get(norm(r?.account_no));return fmtDate(p?.last_checked_at)}"
if 'function liveState(r)' not in s:
    if anchor not in s:
        raise SystemExit('pppoeText anchor not found')
    s = s.replace(anchor, helpers, 1)

old = "klass=conflict?'conflict':pending?'pending':'active',label=conflict?'CONFLICT':pending?'PENDING CONFIRMATION':'ACTIVE',b=bindingFor(r)"
new = "state=liveState(r),klass=conflict?'conflict':pending?'pending':state==='DOWN'?'down':'active',label=conflict?'CONFLICT':pending?'PENDING CONFIRMATION':state,b=bindingFor(r)"
if old in s:
    s = s.replace(old, new, 1)

old = '<div><span>Ping</span><b>${esc(pingText(r))}</b></div><div><span>PPPoE Profile</span>'
new = '<div><span>Ping</span><b>${esc(pingText(r))}</b></div><div><span>Last Ping Check</span><b>${esc(pingCheckedText(r))}</b></div><div><span>PPPoE Profile</span>'
if old in s and 'Last Ping Check' not in s:
    s = s.replace(old, new, 1)

old = "<div><span>Remote Address</span><b>${esc(r.remote_address||'-')}</b></div></div>${bindingBox(r)}"
new = "<div><span>Remote Address</span><b>${esc(r.remote_address||'-')}</b></div></div>${state==='DOWN'?`<div class=\"alert live-down\"><b>DOWN detected.</b> Last ping check: ${esc(pingCheckedText(r))}</div>`:''}${bindingBox(r)}"
if old in s and 'DOWN detected.' not in s:
    s = s.replace(old, new, 1)

old = "b.className='port '+kind;b.dataset.port=p;"
new = "const visualKind=x?.row&&kind==='active'&&liveState(x.row)==='DOWN'?'down':kind;b.className='port '+visualKind;b.dataset.port=p;"
if old in s:
    s = s.replace(old, new, 1)

old = "${kind==='active'?'ACTIVE':kind==='pending'?'PENDING':kind==='conflict'?'CONFLICT':'AVAILABLE'}"
new = "${kind==='active'?liveState(x.row):kind==='pending'?'PENDING':kind==='conflict'?'CONFLICT':'AVAILABLE'}"
if old in s:
    s = s.replace(old, new, 1)

old = "<small>Occupied ${used} · Pending ${pending} · Free ${free} · Active Income ${esc(money(income))}/month</small>"
new = "<small>Tap a block for live connection and fiber readings · Auto-check every 10 seconds</small>"
if old in s:
    s = s.replace(old, new, 1)

old = "ui.selectedChip.textContent=`LP${p2(selected.line_port)} • NP${p2(selected.network_port)}`;"
new = "ui.selectedChip.textContent=`LP${p2(selected.line_port)} • NP${p2(selected.network_port)} • LIVE 10s`;"
if old in s:
    s = s.replace(old, new, 1)

refresh_anchor = "async function bindOnu(r){"
if 'async function refreshSelectedLive()' not in s:
    if refresh_anchor not in s:
        raise SystemExit('bindOnu anchor not found')
    refresh_fn = r'''async function refreshSelectedLive(){
if(!selected||liveRefreshBusy||document.hidden)return;
liveRefreshBusy=true;
try{
  const rows=napClients(selected);
  await loadLive(rows);
  const ids=new Set(rows.map(r=>String(r.id)));
  const sb=bindings.filter(b=>ids.has(String(b.client_id)));
  const olts=[...new Set(sb.map(b=>String(b.olt_id||'')).filter(Boolean))];
  if(olts.length){
    const or=await db.from('onu_optical_status').select('*').in('olt_id',olts).limit(3000);
    if(!or.error){
      const fresh=or.data||[];
      fresh.forEach(o=>opticalByKey.set(okKey(o.olt_id,o.pon_port,o.onu_id),o));
      const freshKeys=new Set(fresh.map(o=>okKey(o.olt_id,o.pon_port,o.onu_id)));
      opticals=opticals.filter(o=>!freshKeys.has(okKey(o.olt_id,o.pon_port,o.onu_id))).concat(fresh);
    }
  }
  const fs=fiberSummary(selected);
  ui.fGood.textContent=fs.good;ui.fWarn.textContent=fs.warn;ui.fBad.textContent=fs.bad;ui.fNone.textContent=fs.none;
  ui.selectedChip.textContent=`LP${p2(selected.line_port)} • NP${p2(selected.network_port)} • LIVE 10s`;
  renderPorts(selected);
}catch(e){console.error('Fast NAP live refresh failed:',e?.message||e)}finally{liveRefreshBusy=false}
}
'''
    s = s.replace(refresh_anchor, refresh_fn + refresh_anchor, 1)

old = "initMap();loadData(true,null);refreshTimer=setInterval(()=>loadData(false,selected?.id),60000);window.addEventListener('beforeunload',()=>clearInterval(refreshTimer));"
new = "initMap();loadData(true,null);refreshTimer=setInterval(()=>loadData(false,selected?.id),FULL_REFRESH_MS);liveRefreshTimer=setInterval(refreshSelectedLive,LIVE_REFRESH_MS);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshSelectedLive()});window.addEventListener('beforeunload',()=>{clearInterval(refreshTimer);clearInterval(liveRefreshTimer)});"
if old in s:
    s = s.replace(old, new, 1)
elif 'liveRefreshTimer=setInterval' not in s:
    raise SystemExit('timer anchor not found')

p.write_text(s, encoding='utf-8')

loader = Path('nap-checker.html')
ls = loader.read_text(encoding='utf-8')
ls = ls.replace('20260905-fiber-optical', '20260910-admin-employee-style-fast-live')
loader.write_text(ls, encoding='utf-8')

agent = Path('ops/network-monitor-agent.py')
a = agent.read_text(encoding='utf-8')
a = a.replace("INTERVAL=max(20,int(os.environ.get('MONITOR_INTERVAL_SECONDS','60')))", "INTERVAL=max(20,int(os.environ.get('MONITOR_INTERVAL_SECONDS','20')))")
agent.write_text(a, encoding='utf-8')

installer = Path('ops/install-network-monitor.sh')
i = installer.read_text(encoding='utf-8')
i = i.replace('MONITOR_INTERVAL_SECONDS=60', 'MONITOR_INTERVAL_SECONDS=20')
installer.write_text(i, encoding='utf-8')
