(function(){'use strict';
if((location.pathname.split('/').pop()||'').toLowerCase()!=='app-tickets.html')return;
let db=null,timer=null,lastTicket='';
const $=id=>document.getElementById(id);
function isInstall(){return String($('dlgTitle')&&$('dlgTitle').textContent||'').toUpperCase().includes('NEW INSTALLATION')}
function ticketNo(){const m=String($('dlgTitle')&&$('dlgTitle').textContent||'').match(/TKT-[A-Z0-9-]+/i);return m?m[0]:''}
function stop(){if(timer){clearTimeout(timer);timer=null}}
function schedule(ms=1800){stop();timer=setTimeout(check,ms)}
async function check(){stop();const dlg=$('dlg');if(!db||!dlg||!dlg.open||!isInstall())return;const no=ticketNo();if(!no)return;lastTicket=no;try{const r=await db.rpc('get_new_install_router_setup',{p_ticket_no:no});if(r.error)throw r.error;const d=r.data||{},st=String(d.pppoe_status||'').toUpperCase(),btn=$('confirmInstall'),wait=$('routerWait'),state=$('pppoeState');if(state&&st){state.textContent=st;state.className='pppoe-status '+(st==='ACTIVE'?'active':st==='FAILED'?'failed':'')}
if(btn){const can=st==='ACTIVE'||d.can_confirm_done===true;btn.disabled=!can;if(can){btn.textContent='Confirm Router Updated & Close Ticket';if(wait)wait.textContent='MikroTik PPP Secret is ACTIVE. Configure/test the client router, then tap the green button below to close this installation ticket.'}else if(st==='FAILED'){if(wait)wait.textContent='PPPoE provisioning failed. Tap Save Update to retry provisioning.'}}
if(st!=='ACTIVE'&&st!=='FAILED')schedule(1800)}catch(_){schedule(2500)}}
function observe(){const dlg=$('dlg');if(!dlg){setTimeout(observe,150);return}new MutationObserver(()=>{if(dlg.open&&isInstall())schedule(250);else stop()}).observe(dlg,{attributes:true,attributeFilter:['open']});new MutationObserver(()=>{if(dlg.open&&isInstall())schedule(200)}).observe($('pppoeReady')||dlg,{childList:true,subtree:true,attributes:true});if(dlg.open&&isInstall())schedule(250)}
async function setup(){db=window.TechGeekSupabase;if(!db){setTimeout(setup,120);return}observe()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});else setup();
})();