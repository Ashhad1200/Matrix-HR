# Working bug list (folded into CRUD-TEST-REPORT.md at the end)
B1 | Minor | POST /employees/departments (and designations) accepts an empty name -> 201 | spec 01
B2 | Major | Timesheet approve/reject: any manager could decide any employee's entry (non-reports, drafts, own) | FIXED
B3 | Minor | Empty name accepted on expense categories, jobs, courses, review cycles, goals, claims (class-validator MinLength missing) | FIXED
B4 | Minor | Review cycle with end before start accepted | FIXED
B5 | Major (cross-tenant) | 1-on-1 create did not verify the employee belongs to the tenant (tenant B employee linkable + name returned) and let managers schedule non-reports | FIXED
B6 | Major (cross-tenant) | Peer review create, timesheet entry projectId, offboarding employeeId were not tenant-verified | FIXED
B7 | Major | PATCH application status took any string -> 500 from Prisma enum, and could set HIRED without creating an employee | FIXED
B8 | Minor | Peer review rating unbounded (9 accepted) | FIXED
B9 | BLOCKER (security) | POST /enps/surveys/:id/respond had no auth guard: anyone on the internet could post eNPS scores into any company's survey (tenant not checked) | FIXED (guard + tenant check)
OPEN-1 | Decision | eNPS responses carry no respondent id, so one user can vote repeatedly (needs an additive table to dedupe while staying anonymous)
B10 | Minor | Custom field key accepted any text (spaces, symbols), no length limits | FIXED
B11 | Major (ops) | Operator 'Suspend' only switched off plan-gated features: the company kept full access (Tenant.status was never set; no UI/API could set it). Suspending now blocks the tenant and un-suspending restores it | FIXED (behaviour change, see Decisions)
B12 | Major (regression from payroll-cost RBAC) | /reports page: one 403 from payroll-cost (managers) rejected the whole Promise.all, so a manager saw an EMPTY reports page | FIXED (per-call fallback, payroll card HR/admin only)
B13 | Major | Leave, Approvals, Attendance, Onboarding, Employees: write actions had no error handling - a refused request (over balance, duplicate code, forbidden) did nothing visible | FIXED (ErrorAlert + useAction)
B14 | Minor | Employees list had no pagination UI (silently capped at 50) | FIXED
B15 | Minor | Employee Attendance page called the manager-only dashboard (403 in console) | FIXED
B16 | Major | Billing page: a company on a plan that is no longer offered (Enterprise, the old PKR plans: i.e. every existing customer) opened with "That plan is not available", no plan selected and a disabled Continue button | FIXED (falls back to the first offered plan)
OPEN-2 | Decision | A company created through public signup has an admin login but NO employee profile, so Time Clock / Timesheets / My profile / 1-on-1s return 403 for that admin (console errors; pages mostly empty). Suggest: create an employee record for the signup admin
OPEN-3 | Decision | A new trial company lands on the Starter plan; Custom fields, SSO etc. are plan-gated, so a trial customer cannot try them
B17 | Minor (a11y) | Timesheet and 1-on-1 form labels were not associated with their inputs (screen readers / getByLabel) | FIXED
B18 | Major (mobile/keyboard) | Timesheet 'Delete entry' button was display:none until mouse hover: impossible on touch devices and by keyboard | FIXED
B19 | Minor | HR could open Settings > API keys and SSO (page loaded, every call 403) | FIXED (company-admins-only notice)
