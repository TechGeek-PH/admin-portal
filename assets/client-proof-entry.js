(function(){'use strict';
const path=(location.pathname.split('/').pop()||'').toLowerCase();
function ensurePrivacy(){if(document.querySelector('script[data-employee-count-privacy]'))return;const s=document.createElement('script');s.src='assets/employee-count-privacy.js?v=20260830-countprivacy1';s.async=false;s.dataset.employeeCountPrivacy='1';document.head.appendChild(s)}
if(path==='app-tickets.html'){
  if(!document.querySelector('script[data-ticket-concern-colors]')){
    const z=document.createElement('script');z.src='assets/ticket-concern-colors.js?v=20260902-2';z.async=false;z.dataset.ticketConcernColors='1';document.head.appendChild(z);
  }
  if(!document.querySelector('script[data-client-proof-ticket]')){
    const s=document.createElement('script');s.src='assets/client-proof-ticket.js?v=20260902-3';s.async=false;s.dataset.clientProofTicket='1';document.head.appendChild(s);
  }
  if(!document.querySelector('script[data-client-proof-install-generate]')){
    const g=document.createElement('script');g.src='assets/client-proof-install-generate.js?v=20260902-4';g.async=false;g.dataset.clientProofInstallGenerate='1';document.head.appendChild(g);
  }
  if(!document.querySelector('script[data-client-proof-install-save]')){
    const x=document.createElement('script');x.src='assets/client-proof-install-save.js?v=20260902-4';x.async=false;x.dataset.clientProofInstallSave='1';document.head.appendChild(x);
  }
  if(!document.querySelector('script[data-client-proof-install-active-close]')){
    const c=document.createElement('script');c.src='assets/client-proof-install-active-close.js?v=20260902-4';c.async=false;c.dataset.clientProofInstallActiveClose='1';document.head.appendChild(c);
  }
  return;
}
if(path!=='app.html'&&path!=='app')return;
ensurePrivacy();
if(!document.querySelector('script[data-app-ticket-visuals]')){
  const v=document.createElement('script');v.src='assets/app-ticket-visuals.js?v=20260902-global3';v.async=false;v.dataset.appTicketVisuals='1';document.head.appendChild(v);
}
if(!document.querySelector('script[data-ticket-aging-priority]')){
  const a=document.createElement('script');a.src='assets/ticket-aging-priority.js?v=20260902-aging1';a.async=false;a.dataset.ticketAgingPriority='1';document.head.appendChild(a);
}
function refreshWorker(){try{if('serviceWorker' in navigator)navigator.serviceWorker.getRegistration().then(r=>r&&r.update()).catch(()=>{})}catch(_){}}
function proofTile(){const a=document.createElement('a');a.className='tile';a.href='client-proof-photos.html?v=20260830-mobile16';a.dataset.title='Client Proof Photos';a.dataset.clientProofModule='1';a.innerHTML='<span class="ico">📷</span><b>Client Proof Photos</b><small>Search clients and update installation proof pictures</small>';return a}
function monitorTile(){const a=document.createElement('a');a.className='tile';a.href='network-monitor.html?v=20260830-fast9-page20-mobile16';a.dataset.title='Network Monitor';a.dataset.networkMonitorModule='1';a.innerHTML='<span class="ico">📡</span><b>Network Monitor</b><small>Live ping, MikroTik PPPoE, 20-per-page clients and fiber cut alerts</small>';return a}
function sync(){['menu','allModules'].forEach(id=>{const g=document.getElementById(id);if(!g)return;if(!g.querySelector('[data-client-proof-module]'))g.appendChild(proofTile());if(!g.querySelector('[data-network-monitor-module]'))g.appendChild(monitorTile())})}
refreshWorker();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{sync();new MutationObserver(sync).observe(document.body,{childList:true,subtree:true})},{once:true});else{sync();new MutationObserver(sync).observe(document.body,{childList:true,subtree:true})}
})();