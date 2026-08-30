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
    `;
    document.head.appendChild(style);
  }

  function updateLabels(){
    const rows=$('clientRows');
    if(!rows)return;
    const table=rows.closest('table');
    const heads=table?table.querySelectorAll('thead th'):[];
    if(heads[3])heads[3].textContent='Ping Status';
    if(heads[4])heads[4].textContent='Status';
    const panel=rows.closest('.panel');
    const p=panel?.querySelector('.panel-head p');
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
