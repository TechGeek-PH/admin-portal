(function(){'use strict';
if((location.pathname.split('/').pop()||'').toLowerCase()!=='app-tickets.html')return;
let db=null,timer=null;
const $=id=>document.getElementById(id);
function isInstall(){return String($('dlgTitle')&&$('dlgTitle').textContent||'').toUpperCase().includes('NEW INSTALLATION')}
function ticketNo(){const m=String($('dlgTitle')&&$('dlgTitle').textContent||'').match(/TKT-[A-Z0-9-]+/i);return m?m[0]:''}
function stop(){if(timer){clearTimeout(timer);timer=null}}
function schedule(ms=1800){stop();timer=setTimeout(check,ms)}
function closed(d){const s=String(d&&d.ticket_status||'').toLowerCase();return d&&(['done','closed','completed','resolved'].includes(s)||d.closed===true)}
function finish(){stop();const dlg=$('dlg');try{if(dlg&&dlg.open)dlg.close()}catch(_){}setTimeout(()=>location.reload(),250)}
async function check(){stop();const dlg=$('dlg');if(!db||!dlg||!dlg.open||!isInstall())return;const no=ticketNo();if(!no)return;try{const r=await db.rpc('get_new_install_router_setup',{p_ticket_no:no});if(r.error)throw r.error;const d=r.data||{};if(closed(d)){finish();return}const st=String(d.pppoe_status||'').toUpperCase(),btn=$('confirmInstall'),wait=$('routerWait'),state=$('pppoeState');if(state&&st){state.textContent=st;state.className='pppoe-status '+(st==='ACTIVE'?'active':st==='FAILED'?'failed':'')}if(btn){const can=st==='ACTIVE'||d.can_confirm_done===true;btn.disabled=!can;if(can){btn.textContent='Finalize Installation';if(wait)wait.textContent='MikroTik PPP Secret is ACTIVE. The ticket should close automatically; this button remains as a manual fallback.'}else if(st==='FAILED'){if(wait)wait.textContent='PPPoE provisioning failed. Tap Save Update to retry provisioning.'}}if(st!=='FAILED')schedule(1800)}catch(_){schedule(2500)}}
function observe(){const dlg=$('dlg');if(!dlg){setTimeout(observe,150);return}new MutationObserver(()=>{if(dlg.open&&isInstall())schedule(250);else stop()}).observe(dlg,{attributes:true,attributeFilter:['open']});new MutationObserver(()=>{if(dlg.open&&isInstall())schedule(200)}).observe($('pppoeReady')||dlg,{childList:true,subtree:true,attributes:true});if(dlg.open&&isInstall())schedule(250)}
async function setup(){db=window.TechGeekSupabase;if(!db){setTimeout(setup,120);return}observe()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});else setup();
})();