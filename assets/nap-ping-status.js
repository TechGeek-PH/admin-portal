// TechGeekPH NAP Checker: clickable port blocks + live connection health.
(function(){
  'use strict';
  if(!/(^|\/)nap-checker\.html$/i.test(window.location.pathname))return;
  if(window.__tgNapPortGridLoaded)return;
  window.__tgNapPortGridLoaded=true;

  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const digits=v=>String(v??'').replace(/\D/g,'');
  const p2=v=>{const d=digits(v);return d?String(Number(d)).padStart(2,'0'):''};
  const norm=v=>String(v||'').trim().toUpperCase();
  const isDisconnected=r=>{const a=norm(r?.account_status),s=norm(r?.service_status);return ['DISCONNECTED','CANCELLED'].includes(a)||['DISCONNECTED','CANCELLED'].includes(s)};
  const embedded=window.self!==window.top||new URLSearchParams(location.search).get('embed')==='1';
  const pingCache=new Map();
  let lastNapId='';
  let activeLoad=0;
  let selectedPort='';
  let currentState=null;

  function injectStyles(){
    if(document.getElementById('tgNapPortGridStyles'))return;
    const style=document.createElement('style');
    style.id='tgNapPortGridStyles';
    style.textContent=`
      .tg-port-layout{padding:14px 16px 16px;display:grid;gap:14px}
      .tg-port-summary{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
      .tg-port-summary strong{color:#064f83;font-size:.9rem}
      .tg-port-summary small{color:#64748b;font-size:.72rem}
      .tg-port-legend{display:flex;gap:8px;flex-wrap:wrap;font-size:.66rem;color:#64748b}
      .tg-port-legend span{display:inline-flex;align-items:center;gap:5px}
      .tg-port-dot{width:9px;height:9px;border-radius:3px;display:inline-block;border:1px solid rgba(15,23,42,.14)}
      .tg-port-dot.active{background:#dff5e9;border-color:#46a57c}
      .tg-port-dot.pending{background:#ffe7ec;border-color:#d72b58}
      .tg-port-dot.vacant{background:#f7f9fc;border-color:#aab6c5}
      .tg-port-grid{display:grid;grid-template-columns:repeat(8,minmax(62px,1fr));gap:8px}
      .tg-port-btn{min-height:74px;border:2px solid #cbd5e1;border-radius:10px;background:#fff;color:#334155;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;padding:7px;transition:border-color .12s ease,box-shadow .12s ease,transform .12s ease}
      .tg-port-btn:hover{transform:translateY(-1px)}
      .tg-port-btn:focus-visible{outline:3px solid rgba(6,79,131,.2);outline-offset:2px}
      .tg-port-btn.is-selected{box-shadow:0 0 0 3px rgba(6,79,131,.12)}
      .tg-port-btn.active{background:#eefaf5;border-color:#2b9b70;color:#116247}
      .tg-port-btn.pending{background:#fff1f4;border-color:#d31f50;color:#98113b}
      .tg-port-btn.vacant{background:#f8fafc;border-color:#cbd5e1;color:#526174}
      .tg-port-btn.conflict{background:#fff3e8;border-color:#d97706;color:#8a4d06}
      .tg-port-no{font-size:1.08rem;font-weight:950;line-height:1}
      .tg-port-state{font-size:.54rem;font-weight:950;letter-spacing:.04em;text-align:center;line-height:1.15}
      .tg-port-detail{border:1px solid #d9e1ec;border-radius:10px;background:#fbfcfe;padding:13px;display:grid;gap:11px}
      .tg-port-detail-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}
      .tg-port-detail-title{font-weight:950;color:#064f83;font-size:1rem}
      .tg-port-detail-sub{font-size:.7rem;color:#64748b;margin-top:3px}
      .tg-port-badge{display:inline-flex;align-items:center;min-height:25px;padding:0 9px;border-radius:999px;font-size:.64rem;font-weight:900;white-space:nowrap}
      .tg-port-badge.active{background:#e8f7f1;color:#116247}
      .tg-port-badge.pending{background:#fff0f4;color:#a7193e}
      .tg-port-badge.vacant{background:#eef2f7;color:#526174}
      .tg-port-badge.conflict{background:#fff7e8;color:#8b5800}
      .tg-port-info{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
      .tg-port-info div{border:1px solid #e2e8f0;border-radius:8px;background:#fff;padding:9px;min-width:0}
      .tg-port-info span,.tg-port-info strong{display:block;overflow-wrap:anywhere}
      .tg-port-info span{font-size:.58rem;color:#6b7a8e;font-weight:850;text-transform:uppercase}
      .tg-port-info strong{margin-top:4px;font-size:.74rem;color:#263548}
      .tg-port-alert{border:1px solid #fecdd3;border-radius:8px;background:#fff1f4;color:#8f1235;padding:10px 11px;font-size:.72rem;line-height:1.45}
      .tg-port-ok{border:1px solid #bbd7c9;border-radius:8px;background:#f1faf6;color:#145f45;padding:10px 11px;font-size:.72rem;line-height:1.45}
      .tg-port-confirm{min-height:40px;border:1px solid #c91448;border-radius:8px;background:#c91448;color:#fff;font-weight:900;padding:0 13px;cursor:pointer}
      .tg-port-confirm:disabled{opacity:.55;cursor:not-allowed}
      .tg-port-empty{padding:18px;text-align:center;color:#64748b;font-size:.78rem;border:1px dashed #cbd5e1;border-radius:9px}
      .tg-hidden-client-table{display:none!important}
      body.tg-nap-app-embed{overflow-x:hidden!important;padding-bottom:12px!important}
      body.tg-nap-app-embed .content{padding:7px!important;gap:9px!important;max-width:none!important;width:100%!important;overflow-x:hidden!important}
      body.tg-nap-app-embed .summary{display:none!important}
      body.tg-nap-app-embed .mapgrid{display:grid!important;grid-template-columns:minmax(0,1fr)!important;gap:9px!important;width:100%!important}
      body.tg-nap-app-embed .panel{min-width:0!important;max-width:100%!important;border-radius:10px!important;box-shadow:none!important}
      body.tg-nap-app-embed .head{padding:10px 12px!important;gap:8px!important;align-items:center!important}
      body.tg-nap-app-embed .head h2{font-size:.86rem!important}
      body.tg-nap-app-embed .head p{font-size:.64rem!important;line-height:1.35!important}
      body.tg-nap-app-embed .toolbar{display:grid!important;grid-template-columns:1fr!important;gap:7px!important;padding:8px!important}
      body.tg-nap-app-embed .toolbar .left{display:grid!important;grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important;gap:6px!important;width:100%!important}
      body.tg-nap-app-embed .toolbar .left .field:first-child{grid-column:1/-1!important}
      body.tg-nap-app-embed .toolbar .right{display:grid!important;grid-template-columns:1fr 1fr!important;gap:6px!important;width:100%!important}
      body.tg-nap-app-embed .toolbar .field{min-width:0!important;width:100%!important}
      body.tg-nap-app-embed .toolbar input,body.tg-nap-app-embed .toolbar select,body.tg-nap-app-embed .toolbar button{width:100%!important;min-height:38px!important;font-size:.7rem!important}
      body.tg-nap-app-embed #napMap{height:clamp(330px,52dvh,445px)!important;width:100%!important}
      body.tg-nap-app-embed .legend{display:flex!important;flex-wrap:nowrap!important;overflow-x:auto!important;gap:9px!important;padding:8px 10px!important;white-space:nowrap!important;font-size:.6rem!important;scrollbar-width:thin}
      body.tg-nap-app-embed .details{position:relative!important;top:auto!important;width:100%!important;max-width:100%!important;overflow:hidden!important}
      body.tg-nap-app-embed .detailbody{padding:10px!important;gap:9px!important}
      body.tg-nap-app-embed .caps{grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:5px!important}
      @media(max-width:920px){.tg-port-grid{grid-template-columns:repeat(4,minmax(58px,1fr))}.tg-port-info{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media(max-width:520px){.tg-port-layout{padding:10px}.tg-port-grid{grid-template-columns:repeat(4,minmax(52px,1fr));gap:6px}.tg-port-btn{min-height:66px;padding:5px}.tg-port-no{font-size:.95rem}.tg-port-state{font-size:.48rem}.tg-port-info{grid-template-columns:1fr 1fr}.tg-port-detail-head{align-items:center}}
    `;
    document.head.appendChild(style);
  }

  function applyEmbeddedLayout(){
    if(!embedded||!document.body)return;
    document.body.classList.add('tg-nap-app-embed');
    document.documentElement.style.overflowX='hidden';
    setTimeout(()=>window.dispatchEvent(new Event('resize')),180);
    setTimeout(()=>window.dispatchEvent(new Event('resize')),650);
  }

  function findPanel(){
    const rows=$('clientRows');
    return rows?rows.closest('.panel'):null;
  }

  function ensureLayout(){
    const rows=$('clientRows');
    const panel=findPanel();
    if(!rows||!panel)return null;
    const wrap=rows.closest('.tablewrap');
    if(wrap)wrap.classList.add('tg-hidden-client-table');
    let host=$('tgPortLayout');
    if(!host){
      host=document.createElement('div');
      host.id='tgPortLayout';
      host.className='tg-port-layout';
      if(wrap)wrap.before(host);else panel.appendChild(host);
    }
    const h=panel.querySelector('.head h2');
    const p=panel.querySelector('.head p');
    if(h)h.textContent='NAP Port Layout';
    if(p)p.textContent='Port 01–16. Click a block to view client details. Red ports require confirmation before reuse or device pullout.';
    return host;
  }

  function connectionHealth(account,row){
    if(isDisconnected(row))return 'Disconnected';
    const p=pingCache.get(norm(account));
    if(p?.is_reachable===true)return 'Good';
    if(p?.is_reachable===false)return 'No Ping';
    return 'No Data';
  }

  async function loadPing(accounts){
    const db=window.TechGeekSupabase;
    const list=[...new Set(accounts.map(norm).filter(Boolean))];
    if(!db||!list.length)return;
    try{
      const r=await db.from('client_network_status').select('account_no,is_reachable,latency_ms,last_checked_at,target_ip').in('account_no',list);
      if(r.error)throw r.error;
      list.forEach(a=>pingCache.set(a,null));
      (r.data||[]).forEach(x=>pingCache.set(norm(x.account_no),x));
    }catch(e){console.error('NAP connection health load failed:',e?.message||e)}
  }

  function buildAssignments(nap,clients){
    const total=Math.max(1,Math.min(64,Number(nap.total_ports)||16));
    const byPort=new Map();
    for(const r of clients){
      const cp=p2(r.client_port);
      const pp=p2(r.pending_client_port);
      if(r.port_release_status==='PENDING_CONFIRMATION'&&pp&&Number(pp)>=1&&Number(pp)<=total){
        const existing=byPort.get(pp);
        byPort.set(pp,{kind:existing?'conflict':'pending',row:r,other:existing||null});
        continue;
      }
      if(!isDisconnected(r)&&cp&&Number(cp)>=1&&Number(cp)<=total){
        const existing=byPort.get(cp);
        byPort.set(cp,{kind:existing?'conflict':'active',row:r,other:existing||null});
      }
    }
    return {total,byPort};
  }

  function renderDetail(portNo,assignment,nap){
    const host=$('tgPortDetail');
    if(!host)return;
    selectedPort=portNo;
    document.querySelectorAll('.tg-port-btn').forEach(b=>b.classList.toggle('is-selected',b.dataset.port===portNo));
    if(!assignment){
      host.innerHTML=`<div class="tg-port-detail-head"><div><div class="tg-port-detail-title">Port ${esc(portNo)}</div><div class="tg-port-detail-sub">${esc(nap.display_name||nap.nap_id||'NAP')}</div></div><span class="tg-port-badge vacant">AVAILABLE</span></div><div class="tg-port-ok"><b>Confirmed vacant.</b> This port has no active or pending client assignment and may be used for a new installation.</div>`;
      return;
    }
    const r=assignment.row||{};
    const kind=assignment.kind;
    const pending=kind==='pending';
    const conflict=kind==='conflict';
    const badge=conflict?'CONFLICT':pending?'PENDING CONFIRMATION':'ACTIVE';
    const badgeClass=conflict?'conflict':pending?'pending':'active';
    const health=connectionHealth(r.account_no,r);
    const requested=r.port_release_requested_at?new Date(r.port_release_requested_at).toLocaleString():'-';
    host.innerHTML=`
      <div class="tg-port-detail-head"><div><div class="tg-port-detail-title">Port ${esc(portNo)}</div><div class="tg-port-detail-sub">${esc(nap.display_name||nap.nap_id||'NAP')}</div></div><span class="tg-port-badge ${badgeClass}">${badge}</span></div>
      <div class="tg-port-info">
        <div><span>Client</span><strong>${esc(r.client_name||'-')}</strong></div>
        <div><span>Account No.</span><strong>${esc(r.account_no||'-')}</strong></div>
        <div><span>Connection Health</span><strong>${esc(health)}</strong></div>
        <div><span>Account Status</span><strong>${esc(r.account_status||'-')}</strong></div>
        <div><span>Service Status</span><strong>${esc(r.service_status||'-')}</strong></div>
        <div><span>LP / NP</span><strong>${esc(p2(r.line_port)||'-')} / ${esc(p2(r.network_port)||'-')}</strong></div>
        <div><span>Remote Address</span><strong>${esc(r.remote_address||'-')}</strong></div>
        ${pending?`<div><span>Release Requested</span><strong>${esc(requested)}</strong></div>`:''}
      </div>
      ${conflict?'<div class="tg-port-alert"><b>Port conflict detected.</b> More than one assignment is referencing this physical port. Resolve the client records before using this port.</div>':''}
      ${pending&&!conflict?`<div class="tg-port-alert"><b>Bakante dahil disconnected, pero HINDI PA AVAILABLE.</b><br>Need muna ng confirmation from the client / device pullout confirmation bago gamitin sa bagong installation.</div><button class="tg-port-confirm" id="tgConfirmVacantBtn" type="button">Confirm Port Available / Pullout Completed</button>`:''}
    `;
    const btn=$('tgConfirmVacantBtn');
    if(btn)btn.addEventListener('click',()=>confirmVacant(r,portNo));
  }

  function renderGrid(nap,clients){
    const host=ensureLayout();
    if(!host)return;
    const state=buildAssignments(nap,clients);
    currentState={nap,clients,...state};
    const counts={active:0,pending:0,vacant:0,conflict:0};
    let buttons='';
    for(let i=1;i<=state.total;i++){
      const no=String(i).padStart(2,'0');
      const a=state.byPort.get(no);
      const kind=a?.kind||'vacant';
      counts[kind]=(counts[kind]||0)+1;
      const text=kind==='active'?'ACTIVE':kind==='pending'?'PENDING':kind==='conflict'?'CONFLICT':'AVAILABLE';
      buttons+=`<button type="button" class="tg-port-btn ${kind}" data-port="${no}" aria-label="Port ${no} ${text}"><span class="tg-port-no">${no}</span><span class="tg-port-state">${text}</span></button>`;
    }
    host.innerHTML=`
      <div class="tg-port-summary"><div><strong>${esc(nap.display_name||nap.nap_id||'Selected NAP')}</strong><br><small>${state.total} ports • Active ${counts.active} • Pending ${counts.pending} • Available ${counts.vacant}${counts.conflict?' • Conflict '+counts.conflict:''}</small></div><div class="tg-port-legend"><span><i class="tg-port-dot active"></i>Active</span><span><i class="tg-port-dot pending"></i>Pending confirmation</span><span><i class="tg-port-dot vacant"></i>Available</span></div></div>
      <div class="tg-port-grid" id="tgPortGrid">${buttons}</div>
      <div class="tg-port-detail" id="tgPortDetail"><div class="tg-port-empty">Click a port block to view the client details.</div></div>
    `;
    host.querySelectorAll('.tg-port-btn').forEach(b=>b.addEventListener('click',()=>renderDetail(b.dataset.port,state.byPort.get(b.dataset.port)||null,nap)));
    if(selectedPort&&Number(selectedPort)<=state.total)renderDetail(selectedPort,state.byPort.get(selectedPort)||null,nap);
  }

  async function confirmVacant(row,portNo){
    if(!row?.id)return;
    const ok=window.confirm(`Confirm Port ${portNo} as AVAILABLE?\n\nUse this only after client confirmation and/or device pullout is completed.`);
    if(!ok)return;
    const btn=$('tgConfirmVacantBtn');
    if(btn){btn.disabled=true;btn.textContent='Confirming...'}
    try{
      const db=window.TechGeekSupabase;
      if(!db)throw Error('Supabase client unavailable.');
      const r=await db.from('clients').update({pending_client_port:null,port_release_status:'RELEASED',port_release_confirmed_at:new Date().toISOString()}).eq('id',row.id).select('id').single();
      if(r.error)throw r.error;
      selectedPort=portNo;
      await loadSelectedNap(true);
      const notice=$('notice');
      if(notice){notice.textContent=`Port ${portNo} confirmed available.`;notice.className='notice ok';setTimeout(()=>{if(notice.textContent===`Port ${portNo} confirmed available.`)notice.className='notice hidden'},3500)}
    }catch(e){
      console.error('Confirm port release failed:',e);
      if(btn){btn.disabled=false;btn.textContent='Confirm Port Available / Pullout Completed'}
      window.alert('Unable to confirm port: '+(e?.message||e));
    }
  }

  async function loadSelectedNap(force){
    const box=$('boxSelect');
    const id=String(box?.value||'').trim();
    const host=ensureLayout();
    if(!host)return;
    if(!id){
      lastNapId='';selectedPort='';currentState=null;
      host.innerHTML='<div class="tg-port-empty">Select a NAP marker or NAP box to view ports 01–16.</div>';
      return;
    }
    if(!force&&id===lastNapId&&currentState)return;
    lastNapId=id;
    const seq=++activeLoad;
    host.innerHTML='<div class="tg-port-empty">Loading NAP ports...</div>';
    try{
      const db=window.TechGeekSupabase;
      if(!db)throw Error('Supabase client unavailable.');
      const nr=await db.from('nap_boxes').select('id,nap_id,display_name,line_port,network_port,total_ports').eq('id',id).single();
      if(nr.error)throw nr.error;
      const cr=await db.from('clients').select('id,account_no,client_name,account_status,service_status,line_port,network_port,client_port,pending_client_port,port_release_status,port_release_requested_at,port_release_confirmed_at,remote_address').limit(2000);
      if(cr.error)throw cr.error;
      if(seq!==activeLoad)return;
      const lp=p2(nr.data.line_port),np=p2(nr.data.network_port);
      const rows=(cr.data||[]).filter(r=>p2(r.line_port)===lp&&p2(r.network_port)===np);
      await loadPing(rows.map(r=>r.account_no));
      if(seq!==activeLoad)return;
      renderGrid(nr.data,rows);
    }catch(e){
      console.error('NAP port grid load failed:',e);
      if(seq===activeLoad)host.innerHTML=`<div class="tg-port-empty">Unable to load port layout: ${esc(e?.message||e)}</div>`;
    }
  }

  function setup(){
    injectStyles();
    applyEmbeddedLayout();
    const host=ensureLayout();
    if(!host){setTimeout(setup,180);return}
    loadSelectedNap(true);

    const box=$('boxSelect');
    if(box)box.addEventListener('change',()=>{selectedPort='';loadSelectedNap(true)});
    const refresh=$('refreshBtn');
    if(refresh)refresh.addEventListener('click',()=>setTimeout(()=>loadSelectedNap(true),500));

    const detail=$('detailName');
    if(detail){
      const obs=new MutationObserver(()=>setTimeout(()=>loadSelectedNap(true),30));
      obs.observe(detail,{childList:true,subtree:true,characterData:true});
    }

    window.setInterval(()=>{
      const id=String($('boxSelect')?.value||'');
      if(id!==lastNapId){selectedPort='';loadSelectedNap(true)}
    },400);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});
  else setup();
})();
