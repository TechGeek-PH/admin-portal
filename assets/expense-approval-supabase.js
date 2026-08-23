(function(){
'use strict';
if(!/(^|\/)expense_approval\.html$/i.test(location.pathname))return;

const BASE='https://tcexzfztdgximrzuosqs.supabase.co';
const KEY='sb_publishable_8H8_S7NTWvzPCLvYUe2C4g_k3Ltjfiz';
const SESSION_KEYS=['tg_session_v3','sb-tcexzfztdgximrzuosqs-auth-token','techgeekph_admin_session','techgeekph_session'];
let rows=[],profile=null,busy=false,els={};

function parse(v){try{return JSON.parse(v||'null')}catch(_){return null}}
function session(){
  for(const k of SESSION_KEYS){
    const v=parse(localStorage.getItem(k));
    if(!v)continue;
    const token=v.access_token||(v.session&&v.session.access_token)||'';
    const user=v.user||(v.session&&v.session.user)||null;
    if(token)return{token,user};
  }
  return null;
}
function jwtSub(token){try{const p=String(token||'').split('.')[1];if(!p)return'';const s=p.replace(/-/g,'+').replace(/_/g,'/');return JSON.parse(atob(s)).sub||''}catch(_){return''}}
function headers(extra){const s=session();if(!s)throw new Error('Supabase login session not found. Please sign in again.');return Object.assign({apikey:KEY,Authorization:'Bearer '+s.token,'Content-Type':'application/json'},extra||{})}
async function api(path,opt){const r=await fetch(BASE+path,Object.assign({},opt||{},{headers:headers(opt&&opt.headers)}));const t=await r.text();let d=null;try{d=t?JSON.parse(t):null}catch(_){d=t}if(!r.ok)throw new Error((d&&(d.message||d.hint||d.error_description))||(typeof d==='string'&&d)||('Request failed '+r.status));return d}
const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=v=>String(v||'').trim().toLowerCase();
const money=v=>'₱ '+Number(v||0).toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2});
function dateText(v){if(!v)return'—';const raw=String(v).slice(0,10),d=new Date(raw+'T00:00:00');return isNaN(d)?raw:d.toLocaleDateString('en-PH',{year:'numeric',month:'short',day:'2-digit'})}
function initials(v){return String(v||'TG').split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0].toUpperCase()).join('')||'TG'}
function isCompanyExpense(row){return /\bcompany expense\b/i.test(String(row&&row.remarks||''))}
function statusClass(s){s=norm(s);if(s==='approved')return'approved';if(s==='released'||s.startsWith('deducted'))return'released';if(s==='rejected')return'rejected';return''}
function note(msg,type){if(!els.notice)return;els.notice.textContent=msg||'';els.notice.className='notice '+(msg?'':'is-hidden')+(type?' '+type:'')}

function grab(){
  els={notice:document.getElementById('notice'),avatar:document.getElementById('avatar'),userName:document.getElementById('userName'),userRole:document.getElementById('userRole'),metricTotal:document.getElementById('metricTotal'),metricPending:document.getElementById('metricPending'),metricReleased:document.getElementById('metricReleased'),metricAmount:document.getElementById('metricAmount'),rowCount:document.getElementById('rowCount'),refreshBtn:document.getElementById('refreshBtn'),exportBtn:document.getElementById('exportBtn'),searchInput:document.getElementById('searchInput'),employeeFilter:document.getElementById('employeeFilter'),statusFilter:document.getElementById('statusFilter'),dateFilter:document.getElementById('dateFilter'),expenseRows:document.getElementById('expenseRows')};
  if(els.statusFilter)els.statusFilter.value='Pending';
}

async function loadProfile(){
  const s=session();if(!s)throw new Error('Supabase login session not found.');
  const uid=(s.user&&s.user.id)||jwtSub(s.token);if(!uid)throw new Error('Unable to identify signed-in account.');
  const data=await api('/rest/v1/staff_profiles?select=user_id,employee_id,full_name,role,active&user_id=eq.'+encodeURIComponent(uid)+'&limit=1',{method:'GET'});
  profile=Array.isArray(data)?data[0]:null;
  if(!profile||!profile.active||!['OWNER','ADMIN'].includes(String(profile.role||'').toUpperCase()))throw new Error('Owner or Admin access is required for Expense Approval.');
  if(els.userName)els.userName.textContent=profile.full_name||'TechGeekPH Admin';
  if(els.userRole)els.userRole.textContent=String(profile.role||'ADMIN').toUpperCase()+' · Finance approval';
  if(els.avatar)els.avatar.textContent=initials(profile.full_name);
}

function filtered(){
  const q=norm(els.searchInput&&els.searchInput.value),emp=norm(els.employeeFilter&&els.employeeFilter.value),st=norm(els.statusFilter&&els.statusFilter.value),dt=String(els.dateFilter&&els.dateFilter.value||'');
  return rows.filter(r=>{const text=[r.expense_id,r.employee_name,r.employee_id,r.category,r.purpose,r.remarks,r.status].join(' ').toLowerCase();return(!q||text.includes(q))&&(!emp||norm(r.employee_name)===emp)&&(!st||norm(r.status)===st)&&(!dt||String(r.expense_date||'').slice(0,10)===dt)});
}
function employees(){
  if(!els.employeeFilter)return;const cur=els.employeeFilter.value;const names=[...new Set(rows.map(r=>String(r.employee_name||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b));els.employeeFilter.innerHTML='<option value="">All employees</option>'+names.map(n=>'<option value="'+esc(n)+'">'+esc(n)+'</option>').join('');if(names.includes(cur))els.employeeFilter.value=cur;
}
function actionHtml(row){
  const st=norm(row.status||'Pending'),id=esc(row.expense_id);
  if(st==='pending'||!st){
    if(isCompanyExpense(row))return '<div class="actions"><button class="warn-btn small" data-expense-action="CompanyReleased" data-expense-id="'+id+'">Release Company Expense</button><button class="danger-btn small" data-expense-action="Rejected" data-expense-id="'+id+'">Reject</button></div>';
    return '<div class="actions"><button class="ok-btn small" data-expense-action="Approved" data-expense-id="'+id+'">Approve</button><button class="warn-btn small" data-expense-action="CompanyReleased" data-expense-id="'+id+'">Release as Company Expense</button><button class="danger-btn small" data-expense-action="Rejected" data-expense-id="'+id+'">Reject</button></div>';
  }
  if(st==='approved')return '<div class="actions"><button class="warn-btn small" data-expense-action="Released" data-expense-id="'+id+'">Mark Released</button><button class="danger-btn small" data-expense-action="Rejected" data-expense-id="'+id+'">Reject</button></div>';
  return '<span style="color:#7d8b9d;font-size:.72rem">No action needed</span>';
}
function receipt(row){if(row.receipt_path)return '<button class="small-btn" data-receipt-path="'+esc(row.receipt_path)+'">Open</button>';if(row.legacy_receipt_link)return '<a class="small-btn" href="'+esc(row.legacy_receipt_link)+'" target="_blank" rel="noopener">Open</a>';return'—'}
function cutoff(row){if(!row.payroll_cutoff_start||!row.payroll_cutoff_end)return'';return '<div style="margin-top:5px;color:#7d8b9d;font-size:.68rem">Payroll cutoff: '+esc(dateText(row.payroll_cutoff_start))+' – '+esc(dateText(row.payroll_cutoff_end))+(row.payroll_salary_date?' · Salary '+esc(dateText(row.payroll_salary_date)):'')+'</div>'}
function render(){
  const view=filtered();
  if(els.metricTotal)els.metricTotal.textContent=rows.length.toLocaleString();
  if(els.metricPending)els.metricPending.textContent=rows.filter(r=>norm(r.status)==='pending').length.toLocaleString();
  if(els.metricReleased)els.metricReleased.textContent=rows.filter(r=>norm(r.status)==='released'||norm(r.status).startsWith('deducted')).length.toLocaleString();
  if(els.metricAmount)els.metricAmount.textContent=money(view.reduce((s,r)=>s+Number(r.amount||0),0));
  if(els.rowCount)els.rowCount.textContent=view.length+' record'+(view.length===1?'':'s');
  if(!els.expenseRows)return;
  if(!view.length){els.expenseRows.innerHTML='<tr><td colspan="11">No expense records found for the selected filter.</td></tr>';return}
  els.expenseRows.innerHTML=view.map(row=>{const st=row.status||'Pending',badge=isCompanyExpense(row)?'<div style="margin-top:5px;color:#7a4e10;font-size:.68rem;font-weight:900">COMPANY EXPENSE · NO PAYROLL DEDUCTION</div>':'';return '<tr><td data-label="Expense ID"><b>'+esc(row.expense_id)+'</b></td><td data-label="Date">'+esc(dateText(row.expense_date))+'</td><td data-label="Employee"><b>'+esc(row.employee_name)+'</b><div style="margin-top:3px;color:#7d8b9d;font-size:.68rem">'+esc(row.employee_id)+'</div></td><td data-label="Category">'+esc(row.category)+badge+'</td><td data-label="Amount" class="amount">'+esc(money(row.amount))+'</td><td data-label="Purpose">'+esc(row.purpose)+cutoff(row)+(row.remarks?'<div style="margin-top:5px;color:#526274;font-size:.68rem"><b>Remarks:</b> '+esc(row.remarks)+'</div>':'')+'</td><td data-label="Receipt">'+receipt(row)+'</td><td data-label="Status"><span class="status-pill '+statusClass(st)+'">'+esc(st)+'</span></td><td data-label="Approved By">'+esc(row.approved_by||'—')+'</td><td data-label="Released By">'+esc(row.released_by||'—')+'</td><td data-label="Action">'+actionHtml(row)+'</td></tr>'}).join('');
}

async function load(silent){if(!silent)note('Loading live expense requests...');const d=await api('/rest/v1/app_expenses?select=*&order=created_at.desc&limit=1000',{method:'GET'});rows=Array.isArray(d)?d:[];employees();render();if(!silent)note('Live expense records updated. Pending: '+rows.filter(r=>norm(r.status)==='pending').length+'.','ok')}
async function updateStatus(id,requested){
  if(busy)return;const row=rows.find(r=>String(r.expense_id)===String(id));if(!row)return;
  const company=requested==='CompanyReleased',next=company?'Released':requested;
  const verb=company?'release as COMPANY EXPENSE (no payroll deduction)':next==='Approved'?'approve':next==='Released'?'mark as released':'reject';
  if(!confirm('Confirm: '+verb+' '+id+' for '+row.employee_name+' ('+money(row.amount)+')?'))return;
  const def=company?'Company Expense — Released directly; not payroll deductible.':next==='Approved'?'Approved by admin.':next==='Released'?'Released / paid by admin.':'Rejected by admin.';
  const entered=prompt('Remarks',company&&row.remarks&&!/company expense/i.test(row.remarks)?'Company Expense — '+row.remarks:(row.remarks||def));if(entered===null)return;
  busy=true;note('Updating '+id+'...');
  try{
    let remarks=String(entered||'').trim()||null;if(company&&remarks&&!/company expense/i.test(remarks))remarks='Company Expense — '+remarks;if(company&&!remarks)remarks=def;
    const now=new Date().toISOString(),payload={status:next,remarks};
    if(next==='Approved'){payload.approved_by=profile.full_name;payload.approved_at=now;payload.released_by=null;payload.released_at=null}
    if(next==='Released'){payload.released_by=profile.full_name;payload.released_at=now;if(company){payload.approved_by=null;payload.approved_at=null}}
    if(next==='Rejected'){payload.released_by=null;payload.released_at=null}
    const d=await api('/rest/v1/app_expenses?expense_id=eq.'+encodeURIComponent(id),{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify(payload)});if(!Array.isArray(d)||!d.length)throw new Error('Expense record was not updated.');await load(true);note(id+' updated to '+next+(company?' as Company Expense — no payroll deduction.':'.'),'ok');
  }catch(e){note('Unable to update expense. '+(e.message||e),'error')}finally{busy=false}
}
async function openReceipt(path){try{const enc=String(path||'').split('/').map(encodeURIComponent).join('/');const d=await api('/storage/v1/object/sign/expense-receipts/'+enc,{method:'POST',body:JSON.stringify({expiresIn:600})});const u=d&&(d.signedURL||d.signedUrl||d.signed_url);if(!u)throw new Error('Unable to create receipt link.');open(String(u).startsWith('http')?u:BASE+u,'_blank','noopener')}catch(e){note('Unable to open receipt. '+(e.message||e),'error')}}
function exportCsv(){const view=filtered(),h=['Expense ID','Date','Employee ID','Employee Name','Category','Amount','Purpose','Status','Remarks','Approved By','Released By'];const a=[h].concat(view.map(r=>[r.expense_id,r.expense_date,r.employee_id,r.employee_name,r.category,r.amount,r.purpose,r.status,r.remarks,r.approved_by,r.released_by]));const csv=a.map(line=>line.map(v=>'"'+String(v==null?'':v).replace(/"/g,'""')+'"').join(',')).join('\n');const b=new Blob([csv],{type:'text/csv'}),u=URL.createObjectURL(b),x=document.createElement('a');x.href=u;x.download='expense_approval_'+new Date().toISOString().slice(0,10)+'.csv';document.body.appendChild(x);x.click();x.remove();URL.revokeObjectURL(u)}
function bind(){
  if(els.searchInput)els.searchInput.oninput=render;if(els.employeeFilter)els.employeeFilter.onchange=render;if(els.statusFilter)els.statusFilter.onchange=render;if(els.dateFilter)els.dateFilter.onchange=render;if(els.refreshBtn)els.refreshBtn.onclick=()=>load().catch(e=>note(e.message,'error'));if(els.exportBtn)els.exportBtn.onclick=exportCsv;
  if(els.expenseRows)els.expenseRows.onclick=e=>{const a=e.target.closest('[data-expense-action]');if(a){updateStatus(a.dataset.expenseId,a.dataset.expenseAction);return}const r=e.target.closest('[data-receipt-path]');if(r)openReceipt(r.dataset.receiptPath)};
}
async function init(){grab();bind();try{await loadProfile();await load(false)}catch(e){note(e.message||String(e),'error');if(els.expenseRows)els.expenseRows.innerHTML='<tr><td colspan="11">Unable to load expense approval data.</td></tr>'}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
