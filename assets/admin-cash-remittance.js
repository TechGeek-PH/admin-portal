
(function(){
'use strict';
if(window.__tgAdminCashRemittanceLoaded)return;
window.__tgAdminCashRemittanceLoaded=true;

var BASE='https://tcexzfztdgximrzuosqs.supabase.co';
var KEY='sb_publishable_8H8_S7NTWvzPCLvYUe2C4g_k3Ltjfiz';
var SESSION_KEYS=['sb-tcexzfztdgximrzuosqs-auth-token','techgeekph-employee-v2-auth','tg_session_v3','techgeekph_session','techgeekph_employee_session'];
var state={rows:[],filtered:[],selected:new Set(),current:null,busy:false};
var root=null,modal=null,voidModal=null;

function byId(id){return document.getElementById(id)}
function parse(v){try{return JSON.parse(v)}catch(_){return null}}
function tokenFrom(v,d){d=d||0;if(d>7||v==null)return'';if(typeof v==='string'){if(v.split('.').length===3&&v.length>80)return v;var p=parse(v);return p?tokenFrom(p,d+1):''}if(Array.isArray(v)){for(var i=0;i<v.length;i++){var t=tokenFrom(v[i],d+1);if(t)return t}return''}if(typeof v==='object'){if(v.access_token)return String(v.access_token);for(var k in v){var x=tokenFrom(v[k],d+1);if(x)return x}}return''}
function loadToken(){var stores=[localStorage,sessionStorage];for(var a=0;a<stores.length;a++){for(var i=0;i<SESSION_KEYS.length;i++){var t=tokenFrom(stores[a].getItem(SESSION_KEYS[i])||'',0);if(t)return t}}return''}
function esc(v){return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')}
function money(v){return new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP',minimumFractionDigits:2}).format(Number(v)||0)}
function dateTime(v){if(!v)return'—';var d=new Date(v);return Number.isNaN(d.getTime())?String(v):new Intl.DateTimeFormat('en-PH',{timeZone:'Asia/Manila',month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'}).format(d)}
function label(v){v=String(v||'').toUpperCase();if(v==='FOR_REMITTANCE')return'FOR REMITTANCE';if(v==='REMITTED')return'REMITTED / SETTLED';if(v==='VOIDED')return'VOIDED';return v.replace(/_/g,' ')}
function cls(v){v=String(v||'').toUpperCase();if(v==='FOR_REMITTANCE')return'pending';if(v==='REMITTED')return'remitted';return'voided'}
function detail(name,value,wide){return '<div class="acr-detail'+(wide?' wide':'')+'"><small>'+esc(name)+'</small><strong>'+esc(value||'—')+'</strong></div>'}
function showNotice(msg,type){var n=byId('acrNotice');if(!n)return;n.textContent=msg;n.className='acr-notice show '+(type||'')}
function clearNotice(){var n=byId('acrNotice');if(n){n.textContent='';n.className='acr-notice'}}
async function rpc(name,args){
  var token=loadToken();if(!token)throw new Error('No authenticated staff session found. Please sign in again.');
  var r=await fetch(BASE+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:KEY,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(args||{})});
  var txt=await r.text(),data=null;try{data=txt?JSON.parse(txt):null}catch(_){data=null}
  if(!r.ok)throw new Error(data&&data.message?data.message:(data&&data.error?data.error:'Request failed ('+r.status+')'));
  return data;
}
function mount(){
  if(byId('adminCashRemittancePanel'))return;
  var target=document.querySelector('.panel');
  if(!target)return;
  root=document.createElement('section');
  root.id='adminCashRemittancePanel';
  root.className='admin-cash-remit';
  root.innerHTML=
    '<div class="acr-head"><div><b>Admin Cash Remittance</b><span>Field cash collections, Admin settlement and protected void/reversal workflow.</span></div><span id="acrMeta">Loading…</span></div>'+
    '<div class="acr-summary">'+
      '<div class="acr-stat"><small>For Remittance</small><strong id="acrPending">₱0.00</strong></div>'+
      '<div class="acr-stat"><small>Remitted / Settled</small><strong id="acrRemitted">₱0.00</strong></div>'+
      '<div class="acr-stat"><small>Collector Fees</small><strong id="acrFees">₱0.00</strong></div>'+
      '<div class="acr-stat"><small>Transactions</small><strong id="acrCount">0</strong></div>'+
    '</div>'+
    '<div class="acr-tools">'+
      '<input id="acrSearch" type="search" placeholder="Search collector, client, account, collection ID…">'+
      '<select id="acrStatus"><option value="FOR_REMITTANCE">For Remittance</option><option value="REMITTED">Remitted / Settled</option><option value="VOIDED">Voided</option><option value="">All Cash Records</option></select>'+
      '<button id="acrSelectPending" class="acr-btn" type="button">Select / Clear All Pending</button>'+
      '<button id="acrReceive" class="acr-btn primary" type="button" disabled>Receive Selected</button>'+
    '</div>'+
    '<div id="acrNotice" class="acr-notice"></div>'+
    '<div id="acrGrid" class="acr-grid"><div class="acr-empty">Loading cash collection records…</div></div>';
  target.parentNode.insertBefore(root,target);
  mountModals();
  bind();
}
function mountModals(){
  modal=document.createElement('div');modal.id='acrModalBg';modal.className='acr-modal-bg';modal.setAttribute('aria-hidden','true');
  modal.innerHTML=
    '<section class="acr-modal" role="dialog" aria-modal="true">'+
      '<div class="acr-modal-head"><div><small>COLLECTION DETAILS</small><h2 id="acrMCollection">—</h2><p id="acrMClient">—</p></div><button id="acrMClose" class="acr-close" type="button">×</button></div>'+
      '<div class="acr-modal-body"><div id="acrMDetails" class="acr-detail-grid"></div><div id="acrMReceipt" class="acr-receipt"></div><div id="acrMAudit" class="acr-audit"></div></div>'+
      '<div class="acr-actions"><button id="acrMVoid" class="acr-btn danger acr-hidden" type="button">Void Collection</button><button id="acrMDone" class="acr-btn" type="button">Close</button></div>'+
    '</section>';
  document.body.appendChild(modal);

  voidModal=document.createElement('div');voidModal.id='acrVoidBg';voidModal.className='acr-modal-bg';voidModal.setAttribute('aria-hidden','true');
  voidModal.innerHTML=
    '<section class="acr-modal" role="dialog" aria-modal="true">'+
      '<div class="acr-modal-head"><div><small>ADMIN FINANCIAL REVERSAL</small><h2>Void Collection?</h2><p id="acrVoidLabel">—</p></div><button id="acrVoidClose" class="acr-close" type="button">×</button></div>'+
      '<div class="acr-modal-body">'+
        '<div class="acr-warning">This collection will be reversed because it was recorded by mistake. The client billing affected by this collection will return to its previous UNPAID / outstanding state, the remittance amount will be removed, and the ₱10 collector fee will also be cancelled.<br><br>This action is recorded in the audit trail and does not permanently delete financial history.</div>'+
        '<div class="acr-field"><label>Reason *</label><div class="acr-reasons" id="acrReasons">'+
          '<label><input type="radio" name="acrVoidReason" value="Wrong client/account selected">Wrong client/account selected</label>'+
          '<label><input type="radio" name="acrVoidReason" value="Collector tagged payment by mistake">Collector tagged payment by mistake</label>'+
          '<label><input type="radio" name="acrVoidReason" value="Wrong amount">Wrong amount</label>'+
          '<label><input type="radio" name="acrVoidReason" value="Duplicate collection">Duplicate collection</label>'+
          '<label><input type="radio" name="acrVoidReason" value="Payment was not actually received">Payment was not actually received</label>'+
          '<label><input type="radio" name="acrVoidReason" value="Other">Other</label>'+
        '</div></div>'+
        '<div id="acrOtherWrap" class="acr-field acr-hidden"><label>Other Reason</label><textarea id="acrOther" placeholder="Enter the required reason…"></textarea></div>'+
      '</div>'+
      '<div class="acr-actions"><button id="acrVoidCancel" class="acr-btn" type="button">Cancel</button><button id="acrVoidConfirm" class="acr-btn danger" type="button">Confirm Void Collection</button></div>'+
    '</section>';
  document.body.appendChild(voidModal);
}
async function load(){
  clearNotice();
  try{
    var d=await rpc('admin_cash_collection_data',{p_status:null});
    state.rows=Array.isArray(d&&d.rows)?d.rows:[];state.selected.clear();
    renderSummary(d&&d.summary||{});apply();
  }catch(e){
    if(/Owner\/Admin access required/i.test(String(e.message||e))){if(root)root.remove();if(modal)modal.remove();if(voidModal)voidModal.remove();return}
    showNotice(String(e.message||e),'err');
  }
}
function renderSummary(s){
  byId('acrPending').textContent=money(s.for_remittance);
  byId('acrRemitted').textContent=money(s.remitted);
  byId('acrFees').textContent=money(s.collector_fees);
  byId('acrCount').textContent=Number(s.count||0).toLocaleString();
  byId('acrMeta').textContent='Updated '+new Intl.DateTimeFormat('en-PH',{timeZone:'Asia/Manila',hour:'numeric',minute:'2-digit'}).format(new Date());
}
function apply(){
  var q=byId('acrSearch').value.trim().toLowerCase(),status=byId('acrStatus').value.trim().toUpperCase();
  state.filtered=state.rows.filter(function(r){
    if(status&&String(r.remittance_status||'').toUpperCase()!==status)return false;
    if(!q)return true;
    return [r.collection_id,r.account_no,r.client_name,r.collector_name,r.collector_employee_id,r.remittance_status,r.void_reason,r.voided_by_name].join(' ').toLowerCase().indexOf(q)!==-1;
  });
  var valid=new Set(state.rows.filter(function(r){return String(r.remittance_status||'').toUpperCase()==='FOR_REMITTANCE'}).map(function(r){return Number(r.id)}));
  state.selected=new Set(Array.from(state.selected).filter(function(id){return valid.has(Number(id))}));
  renderCards();syncSelection();
}
function renderCards(){
  var g=byId('acrGrid');
  if(!state.filtered.length){g.innerHTML='<div class="acr-empty">No cash collection records match this view.</div>';return}
  g.innerHTML=state.filtered.map(function(r){
    var st=String(r.remittance_status||'').toUpperCase(),c=cls(st),pending=st==='FOR_REMITTANCE',checked=state.selected.has(Number(r.id))?' checked':'';
    return '<article class="acr-card '+c+'">'+
      '<div class="acr-card-top"><div class="acr-pick">'+
        (pending?'<input class="acr-check" type="checkbox" data-acr-check="'+esc(r.id)+'"'+checked+' aria-label="Select '+esc(r.collection_id)+'">':'')+
        '<div><small>COLLECTION ID</small><strong class="acr-cid">'+esc(r.collection_id)+'</strong></div></div>'+
        '<span class="acr-badge '+c+'">'+esc(label(st))+'</span></div>'+
      '<div class="acr-compact">'+
        '<div class="acr-box"><small>CLIENT / ACCOUNT</small><strong>'+esc(r.client_name)+'</strong><span class="acr-sub">'+esc(r.account_no)+'</span></div>'+
        '<div class="acr-box"><small>COLLECTOR</small><strong>'+esc(r.collector_name||'—')+'</strong><span class="acr-sub">'+esc(r.collector_employee_id||'')+'</span></div>'+
        '<div class="acr-box"><small>BILL PAID</small><strong>'+esc(money(r.bill_amount))+'</strong></div>'+
        '<div class="acr-box admin"><small>ADMIN RECEIVES</small><strong>'+esc(money(r.bill_amount))+'</strong></div>'+
        '<div class="acr-box"><small>CASH STATUS</small><strong>'+esc(label(st))+'</strong></div>'+
        '<div class="acr-box"><small>COLLECTED</small><strong>'+esc(dateTime(r.collected_at))+'</strong></div>'+
      '</div>'+
      '<div class="acr-bottom"><div class="acr-time">'+(st==='VOIDED'?'Voided '+esc(dateTime(r.voided_at)):(st==='REMITTED'?'Settled '+esc(dateTime(r.remitted_at)):'Waiting for Admin'))+'</div><button class="acr-view" type="button" data-acr-view="'+esc(r.id)+'">View details →</button></div>'+
    '</article>';
  }).join('');
}
function syncSelection(){
  var n=state.selected.size,b=byId('acrReceive');b.disabled=state.busy||n===0;b.textContent=n?'Receive Selected ('+n+')':'Receive Selected';
}
function togglePending(){
  var ids=state.filtered.filter(function(r){return String(r.remittance_status||'').toUpperCase()==='FOR_REMITTANCE'}).map(function(r){return Number(r.id)});
  var all=ids.length&&ids.every(function(id){return state.selected.has(id)});
  ids.forEach(function(id){if(all)state.selected.delete(id);else state.selected.add(id)});
  renderCards();syncSelection();
}
async function receiveSelected(){
  if(state.busy||!state.selected.size)return;
  var valid=new Set(state.rows.filter(function(r){return String(r.remittance_status||'').toUpperCase()==='FOR_REMITTANCE'}).map(function(r){return Number(r.id)}));
  var ids=Array.from(state.selected).map(Number).filter(function(id){return valid.has(id)});
  if(!ids.length){state.selected.clear();syncSelection();showNotice('No valid FOR REMITTANCE collection is selected.','err');return}
  var total=state.rows.filter(function(r){return ids.indexOf(Number(r.id))!==-1}).reduce(function(a,r){return a+Number(r.bill_amount||0)},0);
  if(!window.confirm('Confirm Admin received '+money(total)+' from '+ids.length+' selected collection(s)? The ₱10 collector fee stays with the collector.'))return;
  state.busy=true;syncSelection();
  try{
    var out=await rpc('admin_receive_cash_collections',{p_collection_ids:ids,p_note:null});
    showNotice('Cash received: '+money(out.total_received)+' · '+Number(out.count||ids.length)+' collection(s) settled.','ok');
    await load();var ref=byId('refresh');if(ref)ref.click();
  }catch(e){showNotice(String(e.message||e),'err')}
  finally{state.busy=false;syncSelection()}
}
function openDetails(id){
  var r=state.rows.find(function(x){return Number(x.id)===Number(id)});if(!r)return;state.current=r;
  byId('acrMCollection').textContent=r.collection_id||'—';byId('acrMClient').textContent=(r.client_name||'—')+' · '+(r.account_no||'—');
  byId('acrMDetails').innerHTML=
    detail('Client / Account',(r.client_name||'—')+' · '+(r.account_no||'—'))+
    detail('Collector',(r.collector_name||'—')+(r.collector_employee_id?' · '+r.collector_employee_id:''))+
    detail('Bill Paid',money(r.bill_amount))+detail('Collector Fee',money(r.collection_charge))+
    detail('Client Cash',money(r.total_cash))+detail('Admin Receives',money(r.bill_amount))+
    detail('Bills Covered',String(r.bill_count||0)+' bill(s)')+detail('Billing Periods',(r.billing_periods||[]).join(', '))+
    detail('Collected',dateTime(r.collected_at))+detail('Cash Status',label(r.remittance_status))+
    detail('Collection Note',r.collection_note||'—',true);
  byId('acrMReceipt').innerHTML=
    '<div class="acr-receipt-row"><span>Bill Paid</span><strong>'+esc(money(r.bill_amount))+'</strong></div>'+
    '<div class="acr-receipt-row"><span>Collector Fee</span><strong style="color:#ffd178">'+esc(money(r.collection_charge))+'</strong></div>'+
    '<div class="acr-receipt-row total"><span>CLIENT CASH</span><strong>'+esc(money(r.total_cash))+'</strong></div>';
  var st=String(r.remittance_status||'').toUpperCase();
  byId('acrMAudit').innerHTML=st==='VOIDED'
    ?'<b>VOIDED</b><br>Reason: '+esc(r.void_reason||'—')+'<br>By: '+esc(r.voided_by_name||'—')+'<br>At: '+esc(dateTime(r.voided_at))+'<br><br>Original collection ID, collector, client/account, bill amount, fee and collection timestamp remain preserved.'
    :(st==='REMITTED'
      ?'<b>REMITTED / SETTLED</b><br>Received by: '+esc(r.remitted_by_name||'Admin')+'<br>At: '+esc(dateTime(r.remitted_at))+'<br><br>This collection has already been remitted. Reverse the remittance first.'
      :'<b>FOR REMITTANCE</b><br>Waiting for Admin cash confirmation. Only this pending state may be voided.');
  byId('acrMVoid').classList.toggle('acr-hidden',st!=='FOR_REMITTANCE');
  modal.classList.add('show');modal.setAttribute('aria-hidden','false');
}
function closeDetails(){if(state.busy)return;modal.classList.remove('show');modal.setAttribute('aria-hidden','true');state.current=null}
function openVoid(){
  var r=state.current;if(!r)return;
  if(String(r.remittance_status||'').toUpperCase()!=='FOR_REMITTANCE'){showNotice('This collection has already been remitted. Reverse the remittance first.','err');return}
  Array.prototype.forEach.call(document.querySelectorAll('input[name="acrVoidReason"]'),function(x){x.checked=false});
  byId('acrOther').value='';byId('acrOtherWrap').classList.add('acr-hidden');byId('acrVoidLabel').textContent=(r.collection_id||'Collection')+' · '+(r.client_name||r.account_no||'');
  voidModal.classList.add('show');voidModal.setAttribute('aria-hidden','false');
}
function closeVoid(){if(state.busy)return;voidModal.classList.remove('show');voidModal.setAttribute('aria-hidden','true')}
function getReason(){var x=document.querySelector('input[name="acrVoidReason"]:checked');if(!x)return'';return x.value==='Other'?byId('acrOther').value.trim():x.value}
async function confirmVoid(){
  if(state.busy||!state.current)return;var reason=getReason();if(!reason){showNotice('Void reason is required.','err');return}
  if(!window.confirm('Final confirmation: reverse '+state.current.collection_id+' and restore only the billing records created by this collection?'))return;
  state.busy=true;byId('acrVoidConfirm').disabled=true;byId('acrVoidConfirm').textContent='Voiding…';
  try{
    var out=await rpc('admin_void_cash_collection',{p_collection_id:Number(state.current.id),p_reason:reason});
    closeVoid();closeDetails();showNotice((out.collection_id||'Collection')+' is VOIDED. Billing was restored to outstanding and the collector fee was cancelled from valid totals.','ok');
    await load();var ref=byId('refresh');if(ref)ref.click();
    window.dispatchEvent(new CustomEvent('techgeekph:collection-voided',{detail:out}));
  }catch(e){showNotice(String(e.message||e),'err')}
  finally{state.busy=false;byId('acrVoidConfirm').disabled=false;byId('acrVoidConfirm').textContent='Confirm Void Collection';syncSelection()}
}
function bind(){
  byId('acrSearch').addEventListener('input',apply);byId('acrStatus').addEventListener('change',apply);byId('acrSelectPending').addEventListener('click',togglePending);byId('acrReceive').addEventListener('click',receiveSelected);
  root.addEventListener('change',function(e){var c=e.target.closest('[data-acr-check]');if(!c)return;var id=Number(c.getAttribute('data-acr-check')),r=state.rows.find(function(x){return Number(x.id)===id});if(!r||String(r.remittance_status||'').toUpperCase()!=='FOR_REMITTANCE'){c.checked=false;state.selected.delete(id)}else if(c.checked)state.selected.add(id);else state.selected.delete(id);syncSelection()});
  root.addEventListener('click',function(e){var b=e.target.closest('[data-acr-view]');if(b){e.preventDefault();openDetails(Number(b.getAttribute('data-acr-view')))}});
  byId('acrMClose').addEventListener('click',closeDetails);byId('acrMDone').addEventListener('click',closeDetails);byId('acrMVoid').addEventListener('click',openVoid);modal.addEventListener('click',function(e){if(e.target===modal)closeDetails()});
  byId('acrVoidClose').addEventListener('click',closeVoid);byId('acrVoidCancel').addEventListener('click',closeVoid);byId('acrVoidConfirm').addEventListener('click',confirmVoid);voidModal.addEventListener('click',function(e){if(e.target===voidModal)closeVoid()});
  byId('acrReasons').addEventListener('change',function(e){byId('acrOtherWrap').classList.toggle('acr-hidden',e.target.value!=='Other');if(e.target.value==='Other')byId('acrOther').focus()});
  document.addEventListener('keydown',function(e){if(e.key==='Escape'){if(voidModal.classList.contains('show'))closeVoid();else if(modal.classList.contains('show'))closeDetails()}});
}
async function init(){mount();if(root)await load()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
