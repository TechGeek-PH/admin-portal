(function () {
"use strict";
if(window.parent!==window||new URLSearchParams(location.search).get('embed')==='1'||new URLSearchParams(location.search).get('source')==='app-embed')document.documentElement.classList.add('tg-embedded');
const $=id=>document.getElementById(id);
const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
let db=null, routers=[],summary=null, busy=false;
const installedMonth=()=>new Date(Date.now()+8*3600000).toISOString().slice(0,7);
const datePH=v=>v?new Date(v).toLocaleString('en-PH',{timeZone:'Asia/Manila',year:'numeric',month:'short',day:'2-digit',hour:'2-digit',minute:'2-digit'}):'—';
function message(text,type){const n=$('notice');n.textContent=text;n.className='notice'+(type?' '+type:'');}
function setBusy(v){busy=v;['registerBtn','moveBtn','refresh'].forEach(id=>$(id).disabled=v);}
function num(v){return Number(v||0).toLocaleString('en-PH');}
function showStat(id,value){$(id).textContent=num(value);}
async function auth(){
  if(window.TechGeekAuthReady) await window.TechGeekAuthReady;
  db=window.TechGeekSupabase;
  if(!db)throw Error('Supabase connection unavailable. Please reload and sign in.');
  const {data:{user},error:userError}=await db.auth.getUser();
  if(userError||!user)throw Error('Sign in to the TechGeekPH portal first.');
  const {data:profile,error}=await db.from('staff_profiles').select('role,active').eq('user_id',user.id).maybeSingle();
  if(error||!profile||!profile.active||!['OWNER','ADMIN'].includes(String(profile.role).toUpperCase()))throw Error('Owner/Admin access is required.');
}
async function queryAllRouters(){
  const all=[];
  for(let start=0;start<10000;start+=500){
    const {data,error}=await db.from('tg_routers')
      .select('id,serial_no,model,condition,location,assigned_account_no,last_action,last_ticket_no,last_note,updated_at')
      .order('id',{ascending:false}).range(start,start+499);
    if(error)throw error;
    all.push(...(data||[]));
    if(!data||data.length<500)return all;
  }
  throw Error('Inventory exceeded safe page limit. Use a narrower server-side search.');
}
function badges(value){const cls=value==='GOOD'?'good':value==='DEFECTIVE'?'bad':value==='UNTESTED'?'warn':'';return '<span class="badge '+cls+'">'+esc(value.replace(/_/g,' '))+'</span>';}
function render(){
  const s=summary||{};
  [['registered','routers_registered'],['ready','routers_ready'],['defective','routers_defective'],['untested','routers_untested'],['deployed','routers_deployed'],['usedTotal','routers_used_total'],['recoveredTotal','routers_recovered_total']].forEach(([id,k])=>showStat(id,s[k]));
  $('monthMetrics').textContent='Used '+num(s.routers_used_month)+' • Recovered '+num(s.routers_recovered_month);
  const models=s.models||{};
  [['modelV1','ZTE F670L V1'],['modelV9','ZTE F670L V9'],['model6600','ZTE F6600P']].forEach(([id,k])=>showStat(id,models[k]));
  const others=Object.keys(models).filter(k=>!['ZTE F670L V1','ZTE F670L V9','ZTE F6600P'].includes(k));
  $('otherModels').textContent=others.length?'Other models: '+others.map(k=>k+' ('+models[k]+')').join(' • '):'Other models: none recorded';
  const selected=$('routerSelect').value;
  $('routerSelect').innerHTML='<option value="">Select a serial number</option>'+routers.map(r=>'<option value="'+r.id+'">'+esc(r.serial_no)+' — '+esc(r.model)+' ['+esc(r.location)+' / '+esc(r.condition)+']</option>').join('');
  if(routers.some(r=>String(r.id)===selected))$('routerSelect').value=selected;
  describeRouter();
  renderRows();
}
function renderRows(){
  const q=$('search').value.toUpperCase().trim(),model=$('modelFilter').value,loc=$('locationFilter').value,cond=$('conditionFilter').value;
  const out=routers.filter(r=>(!model||r.model===model)&&(!loc||r.location===loc)&&(!cond||r.condition===cond)&&
    (!q||[r.serial_no,r.model,r.assigned_account_no,r.condition,r.location].some(v=>String(v||'').toUpperCase().includes(q))));
  $('rowCount').textContent=out.length+' shown';
  $('routerRows').innerHTML=out.length?out.map(r=>'<tr><td><strong>'+esc(r.serial_no)+'</strong></td><td>'+esc(r.model)+'</td><td>'+badges(r.condition)+'</td><td>'+esc(r.location)+'</td><td>'+esc(r.assigned_account_no||'—')+'</td><td>'+esc(r.last_action.replace(/_/g,' '))+'</td><td>'+esc(datePH(r.updated_at))+'</td><td><button class="secondary" type="button" data-pick="'+r.id+'">Manage</button></td></tr>').join(''):'<tr><td colspan="8" class="empty">No matching router units. Add the first physical router to start inventory.</td></tr>';
}
function renderEvents(events){
  $('eventRows').innerHTML=events.length?events.map(r=>'<tr><td>'+esc(datePH(r.occurred_at))+'</td><td><strong>'+esc(r.serial_no)+'</strong></td><td>'+esc(r.action.replace(/_/g,' '))+'</td><td>'+esc((r.old_location||'NEW')+' → '+r.new_location)+'</td><td>'+esc((r.old_condition||'—')+' → '+r.new_condition)+'</td><td>'+esc(r.account_no||'—')+'</td><td>'+esc(r.ticket_no||'—')+'</td><td>'+esc(r.note||'—')+'</td></tr>').join(''):'<tr><td colspan="8" class="empty">No router movement records yet.</td></tr>';
}
async function reload(){
  if(busy)return;
  setBusy(true);
  try{
    const month=$('month').value||installedMonth();
    const requests=await Promise.all([
      db.rpc('tg_router_dashboard_summary',{p_month:month+'-01'}),
      queryAllRouters(),
      db.from('tg_router_events').select('occurred_at,serial_no,action,old_location,new_location,old_condition,new_condition,account_no,ticket_no,note').order('occurred_at',{ascending:false}).limit(75)
    ]);
    if(requests[0].error)throw requests[0].error;
    if(requests[2].error)throw requests[2].error;
    summary=requests[0].data;routers=requests[1];
    render();renderEvents(requests[2].data||[]);
    message('Inventory loaded. Counts use registered physical units and recorded movements, not estimates.','ok');
  }catch(e){message('Unable to load routers: '+String(e.message||e),'error');}
  finally{setBusy(false);}
}
function describeRouter(){
  const r=routers.find(x=>String(x.id)===$('routerSelect').value);
  $('routerCurrent').textContent=r?'Current: '+r.location+' • '+r.condition+(r.assigned_account_no?' • '+r.assigned_account_no:''):'Select a unit registered in inventory.';
  if(r&&r.location==='DEPLOYED'){$('account').value=r.assigned_account_no||'';}
  refreshAction();
}
function refreshAction(){
  const action=$('action').value;
  const issuing=['NEW_INSTALL','REPLACEMENT_INSTALL'].includes(action);
  $('accountWrap').hidden=!issuing;
  $('inspectionWrap').hidden=action!=='INSPECT';
  $('account').required=issuing;
  $('moveBtn').textContent=action==='INSPECT'?'Save Inspection':action==='RETIRE'?'Retire Router':action.startsWith('RECOVER')?'Recover Router':'Record Router Use';
  const r=routers.find(x=>String(x.id)===$('routerSelect').value);
  if(r&&action==='INSPECT')$('inspectedCondition').value=r.condition;
}
async function register(evt){
  evt.preventDefault();if(busy)return;
  const model=$('model').value==='OTHER'?$('otherModel').value.trim():$('model').value;
  if(model.length<2){message('Enter a valid router model.','error');return}
  const location=$('initialLocation').value,account=$('baselineAccount').value.trim().toUpperCase();
  if(location==='DEPLOYED'&&!/^SATR\d+$/i.test(account)){message('Enter the existing SATR account for a baseline deployed router.','error');return}
  if(!window.confirm('Register this physical router serial number?'))return;
  setBusy(true);
  try{
    const {error}=await db.from('tg_routers').insert({
      serial_no:$('serial').value.trim().toUpperCase(),model,condition:$('condition').value,
      location,assigned_account_no:location==='DEPLOYED'?account:null,
      last_action:location==='DEPLOYED'?'BASELINE':'REGISTER',last_note:$('initialNote').value.trim()||null
    });
    if(error)throw error;
    $('registerForm').reset();$('baselineWrap').hidden=true;$('otherModelWrap').hidden=true;
    message('Router registered successfully.','ok');
  }catch(e){message('Cannot register router: '+String(e.message||e),'error');}
  finally{setBusy(false);}
  if($('notice').classList.contains('ok'))await reload();
}
async function move(evt){
  evt.preventDefault();if(busy)return;
  const r=routers.find(x=>String(x.id)===$('routerSelect').value);
  if(!r){message('Select a router first.','error');return;}
  const action=$('action').value,account=$('account').value.trim().toUpperCase();
  const patch={last_action:action,last_ticket_no:$('ticket').value.trim()||null,last_note:$('note').value.trim()||null};
  if(['NEW_INSTALL','REPLACEMENT_INSTALL'].includes(action)){
    if(!/^SATR\d+$/i.test(account)){message('Provide a valid SATR client account.','error');return}
    patch.location='DEPLOYED';patch.condition='GOOD';patch.assigned_account_no=account;
  }else if(['RECOVER_REPLACEMENT','RECOVER_PULLOUT'].includes(action)){
    patch.location='STOCK';patch.condition='UNTESTED';patch.assigned_account_no=null;
  }else if(action==='INSPECT')patch.condition=$('inspectedCondition').value;
  else if(action==='RETIRE'){patch.location='RETIRED';patch.condition='DEFECTIVE';patch.assigned_account_no=null;}
  if(!window.confirm('Save '+action.replace(/_/g,' ').toLowerCase()+' for serial '+r.serial_no+'? This action will appear in history.'))return;
  setBusy(true);
  try{
    const {data,error}=await db.from('tg_routers').update(patch).eq('id',r.id).eq('updated_at',r.updated_at).select('id');
    if(error)throw error;
    if(!data||!data.length)throw Error('Router record changed on another device. Refresh and retry.');
    $('moveForm').reset();$('routerSelect').value='';
    message('Router action saved and movement history recorded.','ok');
  }catch(e){message('Router action failed: '+String(e.message||e),'error');}
  finally{setBusy(false);}
  if($('notice').classList.contains('ok'))await reload();
}
$('model').addEventListener('change',()=>{$('otherModelWrap').hidden=$('model').value!=='OTHER';$('otherModel').required=!$('otherModelWrap').hidden});
$('initialLocation').addEventListener('change',()=>{$('baselineWrap').hidden=$('initialLocation').value!=='DEPLOYED';$('baselineAccount').required=!$('baselineWrap').hidden});
$('routerSelect').addEventListener('change',describeRouter);
$('action').addEventListener('change',refreshAction);
['search','modelFilter','locationFilter','conditionFilter'].forEach(id=>$(id).addEventListener(id==='search'?'input':'change',renderRows));
$('routerRows').addEventListener('click',e=>{const b=e.target.closest('[data-pick]');if(!b)return;$('routerSelect').value=b.dataset.pick;describeRouter();$('moveForm').scrollIntoView({behavior:'smooth',block:'center'})});
$('registerForm').addEventListener('submit',register);$('moveForm').addEventListener('submit',move);
$('refresh').addEventListener('click',reload);$('month').addEventListener('change',reload);
$('logoutBtn').addEventListener('click',async()=>{if(db)await db.auth.signOut();window.location.href='index.html';});
$('month').value=installedMonth();
auth().then(reload).catch(e=>{message(String(e.message||e),'error');['registerBtn','moveBtn'].forEach(id=>$(id).disabled=true)});
})();