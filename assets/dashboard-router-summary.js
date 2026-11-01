(function(){
'use strict';
if(!/(^|\/)dashboard\.html$/i.test(location.pathname))return;
const grid=document.querySelector('.workspace .summary-grid');
if(!grid)return;
const panel=document.createElement('section');panel.className='panel';panel.id='routerDashboardSummary';
panel.innerHTML='<div class="panel-head"><div><h2>Client Installations & Router Inventory</h2><p>Live SATR accounts and serial-level router movements</p></div><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><input id="tgInventoryMonth" type="month" aria-label="Report month" style="min-height:35px;border:1px solid #dce4ed;border-radius:7px;padding:4px 8px"><a href="routers.html" class="ghost-btn" style="text-decoration:none;display:inline-flex;align-items:center">Manage Routers</a></div></div>'+
'<div class="summary-grid" style="padding:14px;grid-template-columns:repeat(auto-fit,minmax(145px,1fr))">'+
[['New Client Installs','tgNewInstalls','Installation date, chosen month'],['Total Active Clients','tgActiveAccounts','Account status Active'],['Total Disconnected','tgDisconnectedAccounts','Account status Disconnected'],['Routers Used','tgRouterUsed','New installation + replacement (all time)'],['Router Recovery','tgRouterRecovered','Change + pullout (all time)'],['Ready to Use','tgRouterReady','Good routers currently in stock'],['Defective','tgRouterDefective','Defective routers currently in stock'],['For Testing','tgRouterTesting','Stock not yet cleared for reuse']].map(x=>'<article class="card"><span>'+x[0]+'</span><strong id="'+x[1]+'">—</strong><small>'+x[2]+'</small></article>').join('')+
'</div><div style="padding:0 14px 15px;color:#64748b;font-size:.72rem" id="tgRouterContext">Checking live inventory…</div>';
grid.insertAdjacentElement('afterend',panel);
const $=id=>document.getElementById(id);
$('tgInventoryMonth').value=new Date(Date.now()+8*3600000).toISOString().slice(0,7);
function setCount(id,n){$(id).textContent=Number(n||0).toLocaleString('en-PH');}
async function ready(){
  for(let i=0;i<80;i++){if(window.TechGeekSupabase){if(window.TechGeekAuthReady)await window.TechGeekAuthReady;return window.TechGeekSupabase}await new Promise(r=>setTimeout(r,150))}
  throw Error('Supabase session not ready. Refresh the dashboard.');
}
let db=null,loading=false;
async function refresh(){
  if(loading)return;loading=true;
  try{
    if(!db)db=await ready();
    const {data:{user},error:authError}=await db.auth.getUser();
    if(authError||!user)throw Error('Please sign in to view live statistics.');
    const {data,error}=await db.rpc('tg_router_dashboard_summary',{p_month:$('tgInventoryMonth').value+'-01'});
    if(error)throw error;
    [['tgNewInstalls','new_installs'],['tgActiveAccounts','active_clients'],['tgDisconnectedAccounts','disconnected_clients'],['tgRouterUsed','routers_used_total'],['tgRouterRecovered','routers_recovered_total'],['tgRouterReady','routers_ready'],['tgRouterDefective','routers_defective'],['tgRouterTesting','routers_untested']].forEach(([id,key])=>setCount(id,data[key]));
    const models=data.models||{};
    $('tgRouterContext').textContent='Month '+data.month+' • New client installs: '+data.new_installs+' • Routers used this month: '+data.routers_used_month+' • Recovered this month: '+data.routers_recovered_month+' • Current deployed: '+data.routers_deployed+' • Models: F670L V1 '+(models['ZTE F670L V1']||0)+', F670L V9 '+(models['ZTE F670L V9']||0)+', F6600P '+(models['ZTE F6600P']||0)+'. Stock begins at 0 until physical serials are registered.';
  }catch(e){$('tgRouterContext').textContent='Router statistics unavailable: '+String(e.message||e);}
  finally{loading=false}
}
$('tgInventoryMonth').addEventListener('change',refresh);
window.addEventListener('focus',refresh);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
refresh();
})();