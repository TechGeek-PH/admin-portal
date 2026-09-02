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
function renderGate(d){const st=String(d&&d.pppoe_status||'WAITING').toUpperCase();const ping=d&&d.ping_reachable===true;const btn=$('confirmInstall'),wait=$('routerWait'),state=$('pppoeState');if(state){state.textContent=st;state.className='pppoe-status '+(st==='ACTIVE'?'active':st==='FAILED'?'failed':'')}
if(!btn)return;const can=d&&d.can_confirm_done===true;btn.disabled=!can;if(can){btn.textContent='Close Ticket — Router Active & Ping OK';if(wait)wait.textContent='READY TO CLOSE: PPPoE Secret is ACTIVE and the client Remote IP is pingable'+(d.ping_latency_ms!=null?' ('+d.ping_latency_ms+' ms)':'')+'. Confirm service with the client, then close the ticket.';return}
if(st==='FAILED'){btn.textContent='Close Ticket — Provisioning Failed';if(wait)wait.textContent='PPPoE provisioning failed. Correct the issue and tap Save & Bind Account to Server again.';return}
if(st==='ACTIVE'&&!ping){btn.textContent='Close Ticket — Waiting for Client Ping';if(wait)wait.textContent='PPPoE account is already ACTIVE on MikroTik, but the client Remote IP is not pingable yet. Configure the generated PPPoE username/password on the client router and wait for a successful ping.';return}
btn.textContent='Close Ticket — Waiting for Server';if(wait)wait.textContent='Close Ticket stays disabled until the PPPoE account is ACTIVE on MikroTik and the client Remote IP becomes pingable.'}
async function check(){stop();const dlg=$('dlg');if(!db||!dlg||!dlg.open||!isInstall())return;const no=ticketNo();if(!no)return;try{const r=await db.rpc('get_new_install_router_setup',{p_ticket_no:no});if(r.error)throw r.error;const d=r.data||{};if(closed(d)){finish();return}renderGate(d);if(String(d.pppoe_status||'').toUpperCase()!=='FAILED'&&d.can_confirm_done!==true)schedule(1800)}catch(_){schedule(2500)}}
function observe(){const dlg=$('dlg');if(!dlg){setTimeout(observe,150);return}new MutationObserver(()=>{if(dlg.open&&isInstall())schedule(250);else stop()}).observe(dlg,{attributes:true,attributeFilter:['open']});new MutationObserver(()=>{if(dlg.open&&isInstall())schedule(200)}).observe($('pppoeReady')||dlg,{childList:true,subtree:true,attributes:true});if(dlg.open&&isInstall())schedule(250)}
async function setup(){db=window.TechGeekSupabase;if(!db){setTimeout(setup,120);return}observe()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});else setup();
})();