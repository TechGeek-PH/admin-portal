from pathlib import Path

p=Path('app.html')
s=p.read_text(encoding='utf-8')
s=s.replace("const BUILD='20260831-soa-module-v10';","const BUILD='20260831-team-duty-v12';")

old_emp="const EMP=[['app-attendance.html','⏱','Time In / Time Out','Attendance and breaks'],['app-tickets.html','✓','Technician Tickets','Installation, repair, relocation and assigned service updates'],['nap-checker-employee.html','◉','NAP Checker','NAP map, ports, clients and live ping status'],['my_expense_request.html','₱','My Expenses','Expense requests'],['app-payslips.html','▥','Payslips','Payroll records']];"
new_emp="const EMP=[['app-attendance.html','⏱','Time In / Time Out','Attendance and breaks'],['on-duty-monitoring.html','👷','My Duty Timeline','Time In, shared ticket work, accomplishments and Time Out'],['app-tickets.html','✓','Technician Tickets','Installation, repair, relocation and assigned service updates'],['nap-checker-employee.html','◉','NAP Checker','NAP map, ports, clients and live ping status'],['my_expense_request.html','₱','My Expenses','Expense requests'],['app-payslips.html','▥','Payslips','Payroll records']];"
if old_emp in s:s=s.replace(old_emp,new_emp)

old_admin="const ADMIN=[['tickets.html','🎫','Tickets Admin','Create and manage all installation, repair, relocation and IT service tickets'],['clients.html','👥','Clients','Client master records'],['client-data-quality.html','⚠','Data Quality','Incomplete client records to review'],['billing.html','₱','Billing Control','Billing and payments'],['statement_of_account.html','🧾','SOA & Acknowledgement Receipt','Generate client statement of account and acknowledgement receipt'],['nap-checker.html','◉','NAP Checker','NAP ports and clients'],['expense_approval.html','₱','Expense Approval','Review staff expenses'],['payroll-loans.html','₱','Payroll & Loans','Payroll, employee payslips and loan management']];"
new_admin="const ADMIN=[['tickets.html','🎫','Tickets Admin','Create and manage all installation, repair, relocation and IT service tickets'],['clients.html','👥','Clients','Client master records'],['client-data-quality.html','⚠','Data Quality','Incomplete client records to review'],['billing.html','₱','Billing Control','Billing and payments'],['statement_of_account.html','🧾','SOA & Acknowledgement Receipt','Generate client statement of account and acknowledgement receipt'],['nap-checker.html','◉','NAP Checker','NAP ports and clients'],['expense_approval.html','₱','Expense Approval','Review staff expenses'],['payroll-loans.html','₱','Payroll & Loans','Payroll, employee payslips and loan management'],['on-duty-monitoring.html','👷','On Duty Monitoring','Employee shift timeline, shared ticket work and accomplishments']];"
if old_admin in s:s=s.replace(old_admin,new_admin)

old_can="function canUpdateTicket(t){if(role()!=='EMPLOYEE'||ticketStage(t)!=='progress')return false;const mineById=String(t.assigned_employee_id||'')&&String(t.assigned_employee_id||'')===String(profile.employee_id||'');const mineByName=!t.assigned_employee_id&&sameName(t.assigned_tech,profile.full_name);return !!(mineById||mineByName)}"
new_can="function canUpdateTicket(t){if(role()!=='EMPLOYEE'||ticketStage(t)!=='progress')return false;const mineById=String(t.assigned_employee_id||'')&&String(t.assigned_employee_id||'')===String(profile.employee_id||'');const mineByName=String(t.assigned_tech||'').split(',').some(n=>sameName(n,profile.full_name));return !!(mineById||mineByName)}"
if old_can not in s:raise SystemExit('canUpdateTicket pattern not found')
s=s.replace(old_can,new_can)

old_claim="async function claim(no){if(!confirm('Get this ticket and assign it to you?'))return;try{await request('/rest/v1/rpc/claim_my_ticket',{method:'POST',body:JSON.stringify({p_ticket_no:no})});$('ticketRecords').dataset.stage='progress';await loadTickets()}catch(e){alert(e.message||'Unable to get ticket.')}}"
new_claim="""async function claim(no){
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
}"""
if old_claim not in s:raise SystemExit('claim pattern not found')
s=s.replace(old_claim,new_claim)

old_myt="['My Tickets',tickets.filter(t=>String(t.assigned_employee_id||'')===String(profile.employee_id||'')).length,'Assigned to me']"
new_myt="['My Tickets',tickets.filter(t=>String(t.assigned_employee_id||'')===String(profile.employee_id||'')||String(t.assigned_tech||'').split(',').some(n=>sameName(n,profile.full_name))).length,'Assigned to me / my team']"
if old_myt in s:s=s.replace(old_myt,new_myt)
p.write_text(s,encoding='utf-8')

p=Path('app-tickets.html')
s=p.read_text(encoding='utf-8')
s=s.replace("const BUILD='20260830-unified-ticket-v8'","const BUILD='20260831-team-ticket-v9'")
old="all=all.filter(t=>String(t.assigned_employee_id||'')===String(profile.employee_id||'')||(!t.assigned_employee_id&&sameName(t.assigned_tech,profile.full_name)));"
new="all=all.filter(t=>String(t.assigned_employee_id||'')===String(profile.employee_id||'')||String(t.assigned_tech||'').split(',').some(n=>sameName(n,profile.full_name)));"
if old not in s:raise SystemExit('app-tickets assignment filter pattern not found')
s=s.replace(old,new)
p.write_text(s,encoding='utf-8')
