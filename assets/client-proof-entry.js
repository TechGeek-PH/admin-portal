(function(){'use strict';
const path=(location.pathname.split('/').pop()||'').toLowerCase();
if(path==='app-tickets.html'){
  if(!document.querySelector('script[data-client-proof-ticket]')){
    const s=document.createElement('script');s.src='assets/client-proof-ticket.js?v=20260830-2';s.async=false;s.dataset.clientProofTicket='1';document.head.appendChild(s);
  }
  return;
}
if(path!=='app.html'&&path!=='app')return;
function makeTile(){const a=document.createElement('a');a.className='tile';a.href='client-proof-photos.html';a.dataset.title='Client Proof Photos';a.dataset.clientProofModule='1';a.innerHTML='<span class="ico">📷</span><b>Client Proof Photos</b><small>Search clients and update installation proof pictures</small>';return a}
function sync(){['menu','allModules'].forEach(id=>{const g=document.getElementById(id);if(g&&!g.querySelector('[data-client-proof-module]'))g.appendChild(makeTile())})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{sync();new MutationObserver(sync).observe(document.body,{childList:true,subtree:true})},{once:true});else{sync();new MutationObserver(sync).observe(document.body,{childList:true,subtree:true})}
})();