// TechGeekPH shared NAP overlap picker for Admin Web + Employee/Installer app.
(function(){
  'use strict';
  if(window.TechGeekNapPicker)return;
  const THRESHOLD_METERS=14;
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function meters(a,b){
    const R=6371000,rad=Math.PI/180;
    const lat1=Number(a.latitude)*rad,lat2=Number(b.latitude)*rad;
    const dLat=(Number(b.latitude)-Number(a.latitude))*rad;
    const dLng=(Number(b.longitude)-Number(a.longitude))*rad;
    const h=Math.sin(dLat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLng/2)**2;
    return 2*R*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));
  }
  function cluster(rows){
    const groups=[];
    (rows||[]).forEach(n=>{
      let g=groups.find(x=>meters(n,x.anchor)<=THRESHOLD_METERS);
      if(!g){g={anchor:n,items:[]};groups.push(g)}
      g.items.push(n);
      g.lat=g.items.reduce((s,x)=>s+Number(x.latitude),0)/g.items.length;
      g.lng=g.items.reduce((s,x)=>s+Number(x.longitude),0)/g.items.length;
    });
    return groups;
  }
  function injectStyles(){
    if(document.getElementById('tgNapPickerStyles'))return;
    const s=document.createElement('style');s.id='tgNapPickerStyles';s.textContent=`
      .tg-nap-group-marker{width:58px;height:58px;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#0b6fa4;color:#fff;border:4px solid #fff;box-shadow:0 3px 12px rgba(0,0,0,.28);font-weight:950;line-height:1;position:relative}
      .tg-nap-group-marker:before,.tg-nap-group-marker:after{content:'';position:absolute;inset:4px;border-radius:50%;border:2px solid rgba(255,255,255,.42)}
      .tg-nap-group-marker:after{inset:9px;border-color:rgba(255,255,255,.22)}
      .tg-nap-group-marker strong,.tg-nap-group-marker small{position:relative;z-index:1}.tg-nap-group-marker strong{font-size:.92rem}.tg-nap-group-marker small{font-size:.46rem;margin-top:4px;letter-spacing:.05em}
      .tg-nap-picker{min-width:230px;max-width:300px}.tg-nap-picker h4{margin:0;color:#064f83;font-size:.9rem}.tg-nap-picker>p{margin:4px 0 9px;color:#64748b;font-size:.7rem;line-height:1.35}
      .tg-nap-picker-list{display:grid;gap:6px;max-height:260px;overflow:auto}.tg-nap-choice{width:100%;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:7px;align-items:center;text-align:left;border:1px solid #dbe4ee;border-radius:9px;background:#fff;padding:8px 9px;color:#16202f;cursor:pointer}.tg-nap-choice:hover,.tg-nap-choice:focus{border-color:#7db6df;background:#eef7ff;outline:none}.tg-nap-choice b{font-size:.73rem;color:#064f83;overflow-wrap:anywhere}.tg-nap-choice span{font-size:.62rem;color:#64748b;overflow-wrap:anywhere}.tg-nap-choice em{font-style:normal;font-size:.62rem;font-weight:900;color:#064f83;white-space:nowrap}
      @media(max-width:520px){.tg-nap-picker{min-width:205px;max-width:245px}.tg-nap-picker-list{max-height:220px}.tg-nap-choice{padding:9px}.tg-nap-choice b{font-size:.7rem}}
    `;document.head.appendChild(s);
  }
  function icon(L,g){
    return L.divIcon({className:'nap-marker-wrap',html:`<div class="tg-nap-group-marker"><strong>${g.items.length}</strong><small>NAP BOXES</small></div>`,iconSize:[60,60],iconAnchor:[30,30],popupAnchor:[0,-28]});
  }
  function popup(g,capFn){
    const items=g.items.slice().sort((a,b)=>String(a.display_name||a.nap_id).localeCompare(String(b.display_name||b.nap_id),undefined,{numeric:true}));
    return `<div class="tg-nap-picker"><h4>${items.length} NAP boxes in this location</h4><p>Select the exact NAP box before opening its details and client list.</p><div class="tg-nap-picker-list">${items.map(n=>{const c=capFn(n);return `<button type="button" class="tg-nap-choice" data-nap-choice="${esc(n.id)}"><span><b>${esc(n.display_name||n.nap_id)}</b><br><span>${esc(n.line_port||'-')} / ${esc(n.network_port||'-')} • ${esc(n.status||'-')}${n.area?' • '+esc(n.area):''}</span></span><em>${c.used}/${c.total||'?'} ports</em></button>`}).join('')}</div></div>`;
  }
  function bind(onChoose){
    if(window.__tgNapPickerBound)return;window.__tgNapPickerBound=true;
    document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('[data-nap-choice]');if(!b)return;e.preventDefault();e.stopPropagation();onChoose&&onChoose(b.getAttribute('data-nap-choice'))});
  }
  injectStyles();
  window.TechGeekNapPicker={cluster,icon,popup,bind,thresholdMeters:THRESHOLD_METERS};
})();
