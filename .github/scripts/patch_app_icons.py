from pathlib import Path
import re

path = Path('app.html')
text = path.read_text(encoding='utf-8')
original = text

emp = "const EMP=[['app-attendance.html','🕒','Time In / Time Out','Attendance and breaks'],['on-duty-monitoring.html','👷','My Duty Timeline','Time In, shared ticket work, accomplishments and Time Out'],['app-tickets.html','🛠️','Technician Tickets','Installation, repair, relocation and assigned service updates'],['collections.html','💵','Collections','Collection list, field status updates and notes'],['nap-checker-employee.html','📡','NAP Checker','NAP map, ports, clients and live ping status'],['my_expense_request.html','💸','My Expenses','Expense requests'],['app-payslips.html','🧾','Payslips','Payroll records']];"
admin = "const ADMIN=[['tickets.html','🎫','Tickets Admin','Create and manage all installation, repair, relocation and IT service tickets'],['clients.html','👥','Clients','Client master records'],['client-data-quality.html','🔎','Data Quality','Incomplete client records to review'],['billing.html','💳','Billing Control','Billing and payments'],['collections.html','💵','Collections','Collection list, field status updates and notes'],['statement_of_account.html','📄','SOA & Acknowledgement Receipt','Generate client statement of account and acknowledgement receipt'],['nap-checker.html','📡','NAP Checker','NAP ports and clients'],['expense_approval.html','✅','Expense Approval','Review staff expenses'],['payroll-loans.html','🏦','Payroll & Loans','Payroll, employee payslips and loan management'],['on-duty-monitoring.html','👷','On Duty Monitoring','Employee shift timeline, shared ticket work and accomplishments']];"

text, n_emp = re.subn(r"const EMP=\[.*?\];", emp, text, count=1)
text, n_admin = re.subn(r"const ADMIN=\[.*?\];", admin, text, count=1)

nav_replacements = {
    '<i>⌂</i>Home': '<i>🏠</i>Home',
    '<i>▦</i>Modules': '<i>🧩</i>Modules',
    '<i>✓</i>Tickets': '<i>🎫</i>Tickets',
    '<i>●</i>Account': '<i>👤</i>Account',
}
for old, new in nav_replacements.items():
    text = text.replace(old, new)

# Make the icon itself feel like an icon, not a text initial/symbol.
text = text.replace('.tile .ico{font-size:1.28rem}', '.tile .ico{font-size:1.45rem;line-height:1;display:block}')

if n_emp != 1 or n_admin != 1:
    raise SystemExit(f'Expected one EMP and one ADMIN module array, got EMP={n_emp}, ADMIN={n_admin}')

if text == original:
    raise SystemExit('No app icon changes were applied')

path.write_text(text, encoding='utf-8')
print('Patched app.html module and bottom-navigation icons.')
