// TechGeekPH NAP Port Health Overlay
// Good <= 80 ms, Fair 81-150 ms, Bad > 150 ms, unreachable = No Ping.
(function(){
  'use strict';
  if(!/(^|\/)nap-checker-v2\.html$/i.test(window.location.pathname)) return;
  if(window.__tgNapPortHealthLoaded) return;
  window.__tgNapPortHealthLoaded=true;

  const db=window.TechGeekSupabase;
  if(!db){ console.warn('NAP port health: Supabase unavailable'); return; }
  const $=id=>document.getElementById(id);
  const norm=v=>String(v||'').trim().toUpperCase();
  const digits=v=>String(v??'').replace(/\D/g,'');
  const p2=v=>{const d=digits(v);return d?String(Number(d)).padStart(2,'0'):''};
  const activeRow=r=>![norm(r.account_status),norm(r.service_status)].some(v=>['DISCONNECTED','CANCELLED'].includes(v));

  let busy=false;
  let rerun=false;
  let lastState={byPort:new Map(), ping:new Map(), lp:'', np:''};

  function injectStyles(){
    if(document.getElementById('tgNapPortHealthStyles')) return;
    const s=document.createElement('style');
    s.id='tgNapPortHealthStyles';
    s.textContent=`
      .port.health-good{background:#e8f7f1!important;border-color:#26956d!important;color:#126247!important}
      .port.health-fair{background:#fff7e8!important;border-color:#d97706!important;color:#8b5800!important}
      .port.health-down{background:#c91448!important;border-color:#a50f39!important;color:#fff!important;box-shadow:0 0 0 2px rgba(201,20,72,.11)}
      .port.health-nodata{background:#eef2f7!important;border-color:#94a3b8!important;color:#526174!important}
      .port.pending{background:#fff1f4!important;border-color:#c91448!important;color:#9f1239!important;background-image:repeating-linear-gradient(135deg,rgba(201,20,72,.06) 0 7px,transparent 7px 14px)!important}
      .port.conflict{background:#fff5ea!important;border-color:#d97706!important;color:#8b5800!important}
      .sq.health-good{background:#e8f7f1;border-color:#26956d}
      .sq.health-fair{background:#fff7e8;border-color:#d97706}
      .sq.health-down{background:#c91448;border-color:#a50f39}
      .sq.health-nodata{background:#eef2f7;border-color:#94a3b8}
      .tg-down-count,.tg-untagged-count{display:inline-flex;align-items:center;min-height:24px;padding:0 8px;border-radius:999px;font-size:.56rem;font-weight:950;margin-left:6px}
      .tg-down-count{background:#fff0f4;color:#a50f39;border:1px solid #fecdd3}
      .tg-untagged-count{background:#fff7e8;color:#8b5800;border:1px solid #fed7aa}
      .tg-health-line{margin-top:5px;font-size:.58rem;color:#64748b}
      .tg-health-line .down{color:#b11242;font-weight:950}
      .badge.health-good{background:#e8f7f1;color:#126247}
      .badge.health-fair{background:#fff7e8;color:#8b5800}
      .badge.health-down{background:#c91448;color:#fff}
      .badge.health-nodata{background:#eef2f7;color:#526174}
    `;
    document.head.appendChild(s);
  }

  function classify(p){
    if(!p) return {klass:'health-nodata',label:'NO DATA',detail:'No Data'};
    if(p.is_reachable===false) return {klass:'health-down',label:'NO PING',detail:'No Ping'};
    if(p.is_reachable!==true) return {klass:'health-nodata',label:'NO DATA',detail:'No Data'};
    const ms=Number(p.latency_ms);
    if(Number.isFinite(ms) && ms>150) return {klass:'health-down',label:'BAD PING',detail:`Bad • ${Math.round(ms)} ms`};
    if(Number.isFinite(ms) && ms>80) return {klass:'health-fair',label:'FAIR',detail:`Fair • ${Math.round(ms)} ms`};
    return {klass:'health-good',label:'GOOD',detail:Number.isFinite(ms)?`Good • ${Math.round(ms)} ms`:'Good'};
  }

  function selectedNapKey(){
    const chip=$('selectedChip');
    const txt=String(chip?.textContent||'');
    const m=txt.match(/LP\s*0*([0-9]+).*NP\s*0*([0-9]+)/i);
    if(m) return {lp:String(Number(m[1])).padStart(2,'0'),np:String(Number(m[2])).padStart(2,'0')};
    return null;
  }

  async function queryState(){
    const key=selectedNapKey();
    if(!key) return null;
    const cr=await db.from('clients').select('id,account_no,client_name,account_status,service_status,line_port,network_port,client_port,pending_client_port,port_release_status,remote_address').limit(2000);
    if(cr.error) throw cr.error;
    const rows=(cr.data||[]).filter(r=>p2(r.line_port)===key.lp&&p2(r.network_port)===key.np);
    const allActive=rows.filter(activeRow);
    const active=allActive.filter(r=>Number(p2(r.client_port))>0);
    const accounts=[...new Set(allActive.map(r=>norm(r.account_no)).filter(Boolean))];
    const ping=new Map();
    if(accounts.length){
      const pr=await db.from('client_network_status').select('account_no,is_reachable,latency_ms,last_checked_at').in('account_no',accounts);
      if(pr.error) throw pr.error;
      (pr.data||[]).forEach(p=>ping.set(norm(p.account_no),p));
    }
    const byPort=new Map();
    for(const r of active){
      const cp=p2(r.client_port); if(cp) byPort.set(cp,r);
    }
    return {key,rows,allActive,active,byPort,ping};
  }

  function paintLegend(){
    const legend=document.querySelector('.port-legend');
    if(!legend) return;
    legend.innerHTML='<span><i class="sq health-good"></i>Good</span><span><i class="sq health-fair"></i>Fair / High Ping</span><span><i class="sq health-down"></i>No Ping / Bad Ping</span><span><i class="sq pending"></i>Pending Release</span><span><i class="sq vacant"></i>Available</span><span><i class="sq conflict"></i>Conflict</span>';
  }

  function paintSummary(state){
    const summary=document.querySelector('.port-summary');
    if(!summary) return;
    let down=0,fair=0,good=0,noData=0;
    for(const r of state.active){
      const c=classify(state.ping.get(norm(r.account_no)));
      if(c.klass==='health-down') down++;
      else if(c.klass==='health-fair') fair++;
      else if(c.klass==='health-good') good++;
      else noData++;
    }
    const untaggedDown=state.allActive.filter(r=>Number(p2(r.client_port))===0&&classify(state.ping.get(norm(r.account_no))).klass==='health-down');
    let chip=summary.querySelector('.tg-down-count');
    if(!chip){chip=document.createElement('span');chip.className='tg-down-count';summary.appendChild(chip)}
    chip.textContent=`DOWN ${down}`;
    let untag=summary.querySelector('.tg-untagged-count');
    if(untaggedDown.length){
      if(!untag){untag=document.createElement('span');untag.className='tg-untagged-count';summary.appendChild(untag)}
      untag.textContent=`UNTAGGED DOWN ${untaggedDown.length}`;
      untag.title=untaggedDown.map(r=>`${r.account_no} - ${r.client_name}`).join('\n');
    }else if(untag){untag.remove()}
    let line=summary.querySelector('.tg-health-line');
    if(!line){line=document.createElement('div');line.className='tg-health-line';const first=summary.firstElementChild;if(first)first.appendChild(line)}
    line.innerHTML=`Good ${good} · Fair ${fair} · <span class="down">Down ${down}</span>${noData?` · No Data ${noData}`:''}${untaggedDown.length?` · Untagged Down ${untaggedDown.length}`:''}`;
  }

  function paintPorts(state){
    document.querySelectorAll('.port[data-port]').forEach(btn=>{
      const port=p2(btn.dataset.port);
      if(btn.classList.contains('pending')||btn.classList.contains('conflict')) return;
      btn.classList.remove('health-good','health-fair','health-down','health-nodata');
      const row=state.byPort.get(port);
      if(!row) return;
      const c=classify(state.ping.get(norm(row.account_no)));
      btn.classList.add(c.klass);
      const small=btn.querySelector('small');
      if(small) small.textContent=c.label;
      btn.title=`${row.client_name||row.account_no||'Client'} • ${c.detail}`;
    });
  }

  function paintOpenDetail(state){
    const box=$('portDetail');
    if(!box) return;
    const h=box.querySelector('.port-detail-head h4');
    const m=String(h?.textContent||'').match(/Port\s*([0-9]+)/i);
    if(!m) return;
    const port=String(Number(m[1])).padStart(2,'0');
    const row=state.byPort.get(port);
    if(!row) return;
    const c=classify(state.ping.get(norm(row.account_no)));
    const info=[...box.querySelectorAll('.info div')];
    const cell=info.find(d=>norm(d.querySelector('span')?.textContent)==='CONNECTION HEALTH');
    if(cell){const b=cell.querySelector('b');if(b)b.textContent=c.detail}
    const badge=box.querySelector('.badge');
    if(badge&&!badge.classList.contains('pending')&&!badge.classList.contains('conflict')){
      badge.classList.remove('active','health-good','health-fair','health-down','health-nodata');
      badge.classList.add(c.klass);
      badge.textContent=c.label;
    }
  }

  async function refresh(){
    if(busy){rerun=true;return}
    busy=true;
    try{
      const state=await queryState();
      if(!state) return;
      lastState={byPort:state.byPort,ping:state.ping,lp:state.key.lp,np:state.key.np};
      paintLegend();paintSummary(state);paintPorts(state);paintOpenDetail(state);
    }catch(e){console.warn('NAP port health refresh failed:',e?.message||e)}
    finally{busy=false;if(rerun){rerun=false;setTimeout(refresh,250)}}
  }

  function bind(){
    injectStyles();
    const sel=$('napSelect'); if(sel) sel.addEventListener('change',()=>setTimeout(refresh,350));
    const ref=$('refresh'); if(ref) ref.addEventListener('click',()=>setTimeout(refresh,700));
    const host=$('portHost');
    if(host){new MutationObserver(()=>setTimeout(refresh,180)).observe(host,{childList:true})}
    document.addEventListener('click',e=>{if(e.target.closest&&e.target.closest('.port[data-port]'))setTimeout(()=>paintOpenDetail({byPort:lastState.byPort,ping:lastState.ping,active:[...lastState.byPort.values()]}),40)});
    try{
      db.channel('tg-nap-health-'+Math.random().toString(36).slice(2))
        .on('postgres_changes',{event:'*',schema:'public',table:'client_network_status'},()=>refresh())
        .on('postgres_changes',{event:'*',schema:'public',table:'clients'},()=>refresh())
        .subscribe();
    }catch(_){}
    setInterval(()=>{if(!document.hidden)refresh()},15000);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
    window.addEventListener('focus',refresh);
    setTimeout(refresh,900);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',bind,{once:true}); else bind();
})();
