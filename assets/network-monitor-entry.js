(function(){'use strict';
const path=(location.pathname.split('/').pop()||'').toLowerCase();
if(path!=='app.html'&&path!=='app')return;
function refreshWorker(){try{if('serviceWorker' in navigator)navigator.serviceWorker.getRegistration().then(r=>r&&r.update()).catch(()=>{})}catch(_){}}
function makeTile(){const a=document.createElement('a');a.className='tile';a.href='network-monitor.html?v=20260830-fast9-page20-mobile15';a.dataset.title='Network Monitor';a.dataset.networkMonitorModule='1';a.innerHTML='<span class="ico">📡</span><b>Network Monitor</b><small>Live ping, MikroTik PPPoE, 20-per-page clients, account update tags and possible fiber cut alerts</small>';return a}
function sync(){['menu','allModules'].forEach(id=>{const g=document.getElementById(id);if(g&&!g.querySelector('[data-network-monitor-module]'))g.appendChild(makeTile())})}
refreshWorker();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{sync();new MutationObserver(sync).observe(document.body,{childList:true,subtree:true})},{once:true});else{sync();new MutationObserver(sync).observe(document.body,{childList:true,subtree:true})}
})();