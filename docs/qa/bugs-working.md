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
