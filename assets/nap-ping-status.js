// TechGeekPH NAP Checker: replace Remote IP display with live ping result.
(function(){
  'use strict';
  if(!/(^|\/)nap-checker\.html$/i.test(window.location.pathname))return;
  if(window.__tgNapPingStatusLoaded)return;
  window.__tgNapPingStatusLoaded=true;

  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=v=>String(v||'').trim().toUpperCase();
  const cache=new Map();
  const embedded=window.self!==window.top||new URLSearchParams(location.search).get('embed')==='1';
  let refreshTimer=null;
  let requestSeq=0;

  function injectStyles(){
    if(document.getElementById('tgNapPingStyles'))return;
    const style=document.createElement('style');
    style.id='tgNapPingStyles';
    style.textContent=`
      .tg-ping-badge,.tg-live-status{display:inline-flex;align-items:center;min-height:25px;padding:0 9px;border-radius:999px;font-size:.72rem;font-weight:850;white-space:nowrap}
      .tg-ping-badge.online,.tg-live-status.online{background:#e9f8f0;color:#116b4b}
      .tg-ping-badge.offline,.tg-live-status.offline{background:#fff0f4;color:#a7193e}
      .tg-ping-badge.unknown{background:#fff7e8;color:#8b5800}
      @media(max-width:860px){
        #clientRows td:nth-child(4)::before{content:'Ping Status'!important}
        #clientRows td:nth-child(5)::before{content:'Status'!important}
      }
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
      body.tg-nap-app-embed .caps div{padding:7px!important}
      body.tg-nap-app-embed .editgrid,body.tg-nap-app-embed .editactions{grid-template-columns:1fr!important}
      body.tg-nap-app-embed .editgrid .wide,body.tg-nap-app-embed .editactions .wide{grid-column:auto!important}
      body.tg-nap-app-embed .tablewrap{width:100%!important;max-width:100%!important;overflow:visible!important;padding:0 7px 8px!important}
      body.tg-nap-app-embed .tablewrap table{min-width:0!important;width:100%!important;display:block!important}
      body.tg-nap-app-embed .tablewrap thead{display:none!important}
      body.tg-nap-app-embed #clientRows{display:grid!important;gap:7px!important;width:100%!important}
      body.tg-nap-app-embed #clientRows tr{display:block!important;width:100%!important;border:1px solid #e2e8f0!important;border-radius:9px!important;background:#fff!important;overflow:hidden!important}
      body.tg-nap-app-embed #clientRows td{display:grid!important;grid-template-columns:92px minmax(0,1fr)!important;gap:8px!important;align-items:center!important;width:100%!important;padding:7px 9px!important;border-bottom:1px solid #edf1f6!important;font-size:.68rem!important;overflow-wrap:anywhere!important}
      body.tg-nap-app-embed #clientRows td:last-child{border-bottom:0!important}
      body.tg-nap-app-embed #clientRows td::before{font-size:.56rem!important;font-weight:900!important;color:#6b7a8e!important;text-transform:uppercase!important}
      body.tg-nap-app-embed #clientRows td:nth-child(1)::before{content:'Client Port'}
      body.tg-nap-app-embed #clientRows td:nth-child(2)::before{content:'Name'}
      body.tg-nap-app-embed #clientRows td:nth-child(3)::before{content:'Account'}
      body.tg-nap-app-embed #clientRows td:nth-child(4)::before{content:'Ping Status'}
      body.tg-nap-app-embed #clientRows td:nth-child(5)::before{content:'Status'}
      body.tg-nap-app-embed #clientRows td:nth-child(6)::before{content:'LP'}
      body.tg-nap-app-embed #clientRows td:nth-child(7)::before{content:'NP'}
      body.tg-nap-app-embed #clientRows td[colspan]{display:block!important;text-align:center!important;padding:18px!important}
      body.tg-nap-app-embed #clientRows td[colspan]::before{display:none!important}
      @media(max-width:390px){
        body.tg-nap-app-embed .toolbar .left{grid-template-columns:1fr!important}
        body.tg-nap-app-embed .toolbar .left .field:first-child{grid-column:auto!important}
        body.tg-nap-app-embed #napMap{height:360px!important}
        body.tg-nap-app-embed #clientRows td{grid-template-columns:82px minmax(0,1fr)!important}
      }
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

  function updateLabels(){
    const rows=$('clientRows');
    if(!rows)return;
    const table=rows.closest('table');
    const heads=table?table.querySelectorAll('thead th'):[];
    if(heads[3])heads[3].textContent='Ping Status';
    if(heads[4])heads[4].textContent='Status';
    const panel=rows.closest('.panel');
    const p=panel?.querySelector('.head p, .panel-head p');
    if(p)p.textContent='Live ping result determines Online / Disconnected status.';
  }

  function pingText(p){
    if(p&&p.is_reachable===true){
      const ms=Number(p.latency_ms);
      return Number.isFinite(ms)?`Active • ${Math.round(ms)} ms`:'Active';
    }
    if(p&&p.is_reachable===false)return 'No Reply';
    return 'No Ping Data';
  }

  function pingClass(p){
    if(p&&p.is_reachable===true)return 'online';
    if(p&&p.is_reachable===false)return 'offline';
    return 'unknown';
  }

  function statusText(p){return p&&p.is_reachable===true?'Online':'Disconnected'}
  function statusClass(p){return p&&p.is_reachable===true?'online':'offline'}

  function paintRows(){
    const body=$('clientRows');
    if(!body)return;
    body.querySelectorAll('tr').forEach(row=>{
      const cells=row.children;
      if(cells.length<7)return;
      const account=norm(cells[2].textContent);
      if(!account||account==='-')return;
      const p=cache.get(account);
      const signature=p?`${p.is_reachable}|${p.latency_ms??''}|${p.last_checked_at??''}`:'none';
      if(row.dataset.tgPingSignature===signature)return;
      row.dataset.tgPingSignature=signature;
      cells[3].innerHTML=`<span class="tg-ping-badge ${pingClass(p)}">${esc(pingText(p))}</span>`;
      cells[4].innerHTML=`<span class="tg-live-status ${statusClass(p)}">${esc(statusText(p))}</span>`;
      if(p?.last_checked_at){
        const checked=new Date(p.last_checked_at);
        if(!Number.isNaN(checked.getTime()))cells[3].title='Last ping check: '+checked.toLocaleString();
      }else cells[3].removeAttribute('title');
    });
  }

  function visibleAccounts(){
    const body=$('clientRows');
    if(!body)return [];
    return [...new Set([...body.querySelectorAll('tr')].map(row=>{
      const cells=row.children;
      return cells.length>=7?norm(cells[2].textContent):'';
    }).filter(v=>v&&v!=='-'))];
  }

  async function loadPing(force){
    updateLabels();
    const db=window.TechGeekSupabase;
    const accounts=visibleAccounts();
    if(!db||!accounts.length){paintRows();return}

    const missing=force?accounts:accounts.filter(a=>!cache.has(a));
    if(!missing.length){paintRows();return}

    const seq=++requestSeq;
    try{
      const r=await db.from('client_network_status')
        .select('account_no,is_reachable,latency_ms,last_checked_at,target_ip')
        .in('account_no',missing);
      if(seq!==requestSeq)return;
      if(r.error)throw r.error;
      missing.forEach(a=>cache.set(a,null));
      (r.data||[]).forEach(p=>cache.set(norm(p.account_no),p));
      paintRows();
    }catch(e){
      console.error('NAP ping status load failed:',e&&e.message?e.message:e);
      paintRows();
    }
  }

  function schedule(force){
    clearTimeout(refreshTimer);
    refreshTimer=setTimeout(()=>loadPing(!!force),120);
  }

  function setup(){
    injectStyles();
    applyEmbeddedLayout();
    updateLabels();
    const body=$('clientRows');
    if(!body){setTimeout(setup,200);return}

    const observer=new MutationObserver(()=>schedule(false));
    observer.observe(body,{childList:true,subtree:true});
    schedule(true);

    const refresh=$('refreshBtn');
    if(refresh)refresh.addEventListener('click',()=>setTimeout(()=>schedule(true),450));

    document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule(true)});
    window.addEventListener('focus',()=>schedule(true));
    window.setInterval(()=>{if(!document.hidden)schedule(true)},20000);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});
  else setup();
})();
