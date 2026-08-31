from pathlib import Path

p=Path('app.html')
s=p.read_text(encoding='utf-8')

s=s.replace("const BUILD='20260831-team-duty-v12';","const BUILD='20260831-team-picker-v13';")

css='''
.team-picker-backdrop{position:fixed;inset:0;z-index:200;display:none;align-items:flex-end;justify-content:center;background:rgba(4,20,35,.58);padding:14px}.team-picker-backdrop.show{display:flex}.team-picker{width:min(520px,100%);max-height:82dvh;overflow:auto;background:#fff;border:1px solid var(--line);border-radius:22px 22px 16px 16px;box-shadow:0 24px 70px rgba(0,28,54,.36)}.team-picker-head{padding:18px 18px 13px;border-bottom:1px solid var(--line)}.team-picker-head h3{margin:0;font-size:1.05rem;color:var(--ink)}.team-picker-head p{margin:6px 0 0;color:var(--muted);font-size:.72rem;line-height:1.45}.team-picker-list{display:grid;gap:9px;padding:14px}.partner-btn{width:100%;min-height:58px;border:1px solid var(--line);border-radius:13px;background:#fff;color:var(--ink);padding:10px 12px;text-align:left;display:flex;align-items:center;gap:11px}.partner-btn .avatar-mini{display:grid;place-items:center;width:38px;height:38px;flex:0 0 38px;border-radius:50%;background:linear-gradient(135deg,var(--red),var(--blue));color:#fff;font-weight:900}.partner-btn b{display:block;font-size:.82rem}.partner-btn small{display:block;margin-top:3px;color:var(--muted);font-size:.62rem}.partner-btn .check{margin-left:auto;width:24px;height:24px;border:2px solid #c7d3df;border-radius:50%;display:grid;place-items:center;color:#fff;font-size:.72rem}.partner-btn.selected{border-color:var(--blue);background:#edf6fd}.partner-btn.selected .check{background:var(--blue);border-color:var(--blue)}.team-picker-actions{display:grid;gap:8px;padding:0 14px 14px}.only-me-btn,.assign-team-btn,.picker-cancel{min-height:48px;border-radius:11px;font-weight:900}.only-me-btn{border:1px solid #b9d9c9;background:#effaf4;color:#126247}.assign-team-btn{border:0;background:linear-gradient(100deg,var(--blue),var(--blue2));color:#fff}.assign-team-btn:disabled{opacity:.5}.picker-cancel{border:1px solid var(--line);background:#fff;color:var(--muted)}.picker-empty{padding:16px;text-align:center;color:var(--muted);font-size:.72rem;background:#f8fafc;border-radius:11px}
'''
if '.team-picker-backdrop{' not in s:
    s=s.replace('</style>',css+'</style>',1)

modal='''<div id="teamPickerBackdrop" class="team-picker-backdrop" aria-hidden="true"><section class="team-picker" role="dialog" aria-modal="true" aria-labelledby="teamPickerTitle"><div class="team-picker-head"><h3 id="teamPickerTitle">Select Technician Partner</h3><p>Choose employee(s) currently On Duty to join this ticket. You can select more than one partner.</p></div><div id="teamPickerList" class="team-picker-list"></div><div class="team-picker-actions"><button id="assignTeamBtn" class="assign-team-btn" type="button" disabled>Assign Ticket with Selected Partner</button><button id="onlyMeBtn" class="only-me-btn" type="button">Only Me</button><button id="teamPickerCancel" class="picker-cancel" type="button">Cancel</button></div></section></div>'''
if 'id="teamPickerBackdrop"' not in s:
    s=s.replace('<script>\n(function(){\'use strict\';',modal+'\n<script>\n(function(){\'use strict\';',1)

old='''async function claim(no){
  try{
    const options=await request('/rest/v1/rpc/get_on_duty_team_options',{method:'POST',body:'{}'});
    const mates=(Array.isArray(options)?options:[]).filter(x=>String(x.employee_id||'')!==String(profile.employee_id||''));
    let teammateIds=[];
    const onlyMe=confirm('GET THIS TICKET\\n\\nOK = Only Me\\nCancel = Select Co-Technician(s)');
    if(!onlyMe){
      if(!mates.length){alert('No other employees are currently Time In / On Duty. Ticket will be assigned to you only.');}
      else{
        const menu=mates.map((x,i)=>(i+1)+'. '+x.employee_name).join('\\n');
        const raw=prompt('Select co-technician(s) currently ON DUTY.\\nEnter number(s) separated by comma.\\nExample: 1,3\\n\\n'+menu,'');
        if(raw===null)return;
        const idx=[...new Set(raw.split(',').map(v=>parseInt(v.trim(),10)).filter(n=>Number.isInteger(n)&&n>=1&&n<=mates.length))];
        teammateIds=idx.map(n=>mates[n-1].employee_id);
      }
    }
    const r=await request('/rest/v1/rpc/claim_my_ticket_with_team',{method:'POST',body:JSON.stringify({p_ticket_no:no,p_teammate_ids:teammateIds})});
    const names=Array.isArray(r&&r.team)?r.team.join(', '):'Assigned';
    alert('Ticket assigned successfully.\\nTeam: '+names);
    $('ticketRecords').dataset.stage='progress';await loadTickets();
  }catch(e){alert(e.message||'Unable to get ticket.')}
}'''

new='''let pendingClaimTicket='',selectedPartners=new Set();
function initials(v){return String(v||'TG').split(/\\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase()||'TG'}
function closeTeamPicker(){pendingClaimTicket='';selectedPartners.clear();$('teamPickerBackdrop').classList.remove('show');$('teamPickerBackdrop').setAttribute('aria-hidden','true')}
function updatePartnerButton(){const n=selectedPartners.size;$('assignTeamBtn').disabled=n===0;$('assignTeamBtn').textContent=n?'Assign Ticket with '+n+' Partner'+(n>1?'s':''):'Assign Ticket with Selected Partner'}
async function submitTeamClaim(ids){const no=pendingClaimTicket;if(!no)return;try{$('assignTeamBtn').disabled=true;$('onlyMeBtn').disabled=true;const r=await request('/rest/v1/rpc/claim_my_ticket_with_team',{method:'POST',body:JSON.stringify({p_ticket_no:no,p_teammate_ids:ids})});closeTeamPicker();$('ticketRecords').dataset.stage='progress';await loadTickets()}catch(e){alert(e.message||'Unable to get ticket.')}finally{$('onlyMeBtn').disabled=false;updatePartnerButton()}}
async function claim(no){
  try{
    const options=await request('/rest/v1/rpc/get_on_duty_team_options',{method:'POST',body:'{}'});
    const mates=(Array.isArray(options)?options:[]).filter(x=>String(x.employee_id||'')!==String(profile.employee_id||''));
    pendingClaimTicket=no;selectedPartners.clear();
    $('teamPickerList').innerHTML=mates.length?mates.map(x=>'<button class="partner-btn" type="button" data-partner="'+esc(x.employee_id)+'"><span class="avatar-mini">'+esc(initials(x.employee_name))+'</span><span><b>'+esc(x.employee_name)+'</b><small>On Duty · Tap to select as partner</small></span><span class="check">✓</span></button>').join(''):'<div class="picker-empty">No other employee is currently On Duty. You can choose <b>Only Me</b>.</div>';
    $('teamPickerList').querySelectorAll('[data-partner]').forEach(btn=>btn.onclick=()=>{const id=btn.dataset.partner;if(selectedPartners.has(id))selectedPartners.delete(id);else selectedPartners.add(id);btn.classList.toggle('selected',selectedPartners.has(id));updatePartnerButton()});
    updatePartnerButton();$('teamPickerBackdrop').classList.add('show');$('teamPickerBackdrop').setAttribute('aria-hidden','false');
  }catch(e){alert(e.message||'Unable to load on-duty employees.')}
}
$('assignTeamBtn').onclick=()=>submitTeamClaim(Array.from(selectedPartners));
$('onlyMeBtn').onclick=()=>submitTeamClaim([]);
$('teamPickerCancel').onclick=closeTeamPicker;
$('teamPickerBackdrop').addEventListener('click',e=>{if(e.target===$('teamPickerBackdrop'))closeTeamPicker()});'''
if old not in s:
    raise SystemExit('Current browser prompt claim function not found')
s=s.replace(old,new)
p.write_text(s,encoding='utf-8')
