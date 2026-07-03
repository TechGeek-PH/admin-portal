# TechGeekPH Admin Portal Build

Generated on 2026-07-03 from the provided `admin/` folder.

## Active Pages

- `index.html` - admin-only login
- `dashboard.html` - admin dashboard
- `application_form.html` - application form
- `clients.html` - clients
- `tickets.html` - tickets
- `nap-checker.html` - NAP checker
- `statement_of_account.html` - statement of account
- `daily_time_record.html` - my time record
- `daily_time_record_admin.html` - admin time records
- `my_expense_request.html` - my expense request
- `expense_approval.html` - expense approval
- `payslip_generator.html` - payslip generator
- `consumable_stock.html` - consumable stock
- `company_assets.html` - company assets
- `investor_morwin_gapud.html` - Morwin Gapud investor report
- `investor_marivie_viana_gapud.html` - Marivie Viana Gapud investor report
- `404.html` - fallback page

## Sidebar Standard

The same admin sidebar block is used on all 15 content pages.

Sidebar groups:

- Dashboard
- Operations: Application Form, Clients, Tickets, NAP Checker, Statement of Account
- Attendance & Expenses: My Time Record, Admin Time Records, My Expense Request, Expense Approval, Payslip Generator
- Stock & Assets: Consumable Stock, Company Assets
- Investor: Morwin Gapud, Marivie Viana Gapud

## Notes

- The pages use the existing `BACKEND_URL` from the source files.
- Admin session storage is standardized to `techgeekph_admin_session`.
- Shared admin sidebar support files are in `assets/admin-shell.css` and `assets/admin-shell.js`.
- `index.html` now uses the local bundle asset path `assets/TechGeekPH - logo.png` so the compiled folder works by itself.
