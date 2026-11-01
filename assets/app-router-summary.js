(function(){
'use strict';
const stats=document.getElementById('stats'),roleNode=document.getElementById('topRole'),shell=document.getElementById('shell');
if(!stats||!roleNode||!shell)return;
const $=id=>document.getElementById(id);
const block=document.createElement('section');block.id='tgAppRouterBlock';block.style.cssText='display:none;margin-top:13px';
block.innerHTML='<div class="section-title"><h2>Client Installations & Routers</h2><input id="tgAppRouterMonth" type="month" aria-label="Report month" style="min-height:36px;border:1px solid #dbe4ee;border-radius:8px;padding:5px;max-width:145px"></div>'+
'<div class="stats">'+[['New Installs','tgAppInstalls','Selected month'],['Active Clients','tgAppActive','Account status'],['Disconnected','tgAppDisconnected','Account status'],['Routers Used','tgAppUsed','New + replacement, total'],['Recovered','tgAppRecovered','Change + pullout, total'],['Ready to Use','tgAppReady','Good stock'],['Defective','tgAppDefective','Defective stock'],['For Testing','tgAppTesting','Inspection needed']].map(x=>'<div class="stat"><span>'+x[0]+'</span><b id="'+x[1]+'">—</b><small>'+x[2]+'</small></div>').join('')+'</div>'+
'<p id="tgAppRouterNote" style="font-size:.67rem;line-height:1.5;color:#64748b;margin:8px 2px"></p>'+
'<a href="routers.html" data-title="Routers Inventory" class="tile" style="min-height:65px;margin-top:9px;display:block"><b style="margin:0">Manage Routers Inventory →</b><small>Model counts, router tags, issuance, recovery and audit history</small></a>';
stats.insertAdjacentElement('afterend',block);
const month=$('tgAppRouterMonth');
month.value=new Date(Date.now()+8*3600000).toISOString().slice(0,7);
const BASE='https://tcexzfztdgximrzuosqs.supabase.co',KEY='sb_publishable_8H8_S7NTWvzPCLvYUe2C4g_k3Ltjfiz';
let loading=false,loadedOnce=false;
function session(){for(const key of ['tg_session_v3','sb-tcexzfztdgximrzuosqs-auth-token']){try{const s=JSON.parse(localStorage.getItem(key)||'null');if(s&&s.access_token)return s;}catch(_){}}return null;}
async function load(){
 if(shell.classList.contains('hidden')||!['OWNER','ADMIN'].includes(String(roleNode.textContent||'').trim().toUpperCase())){block.style.display='none';return}
 block.style.display='block';if(loading)return;loading=true;
 try{
  const s=session();if(!s)throw Error('Please sign in again');
  const response=await fetch(BASE+'/rest/v1/rpc/tg_router_dashboard_summary',{method:'POST',headers:{apikey:KEY,Authorization:'Bearer '+s.access_token,'Content-Type':'application/json'},body:JSON.stringify({p_month:month.value+'-01'})});
  if(!response.ok)throw Error('Live summary unavailable ('+response.status+')');
  const d=await response.json();
  [['tgAppInstalls','new_installs'],['tgAppActive','active_clients'],['tgAppDisconnected','disconnected_clients'],['tgAppUsed','routers_used_total'],['tgAppRecovered','routers_recovered_total'],['tgAppReady','routers_ready'],['tgAppDefective','routers_defective'],['tgAppTesting','routers_untested']].forEach(([id,k])=>$(id).textContent=Number(d[k]||0).toLocaleString('en-PH'));
  const m=d.models||{};
  $('tgAppRouterNote').textContent='Month '+d.month+' • Routers used '+d.routers_used_month+' • Recovered '+d.routers_recovered_month+' • F670L V1: '+(m['ZTE F670L V1']||0)+' • F670L V9: '+(m['ZTE F670L V9']||0)+' • F6600P: '+(m['ZTE F6600P']||0)+'. Register actual serials to start stock counts.';
  loadedOnce=true;
 }catch(e){$('tgAppRouterNote').textContent=String(e.message||e);}
 finally{loading=false}
}
month.addEventListener('change',load);
new MutationObserver(()=>{if(!loadedOnce&&['OWNER','ADMIN'].includes(String(roleNode.textContent||'').trim().toUpperCase()))load();else if(shell.classList.contains('hidden'))block.style.display='none'}).observe(roleNode,{childList:true,characterData:true,subtree:true});
setTimeout(load,800);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)load()});
setInterval(()=>{if(!document.hidden)load()},60000);
})();