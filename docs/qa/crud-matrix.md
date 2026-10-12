# CRUD matrix (derived from the controllers in `apps/api/src` and the pages in `apps/web/src/app`)

Legend: ✔ exists (API+UI) · API = API only (no UI) · UI? = UI calls a route that is missing · — = operation does not exist (finding if a client would expect it).
Roles: SA=SUPER_ADMIN (platform operator), CA=COMPANY_ADMIN, HR=HR_MANAGER, MG=MANAGER, EM=EMPLOYEE. "own" = object-level scoping (self / direct reports) in the service.
Admin-class pages are guarded by `permissions.ts` nav; the API `@Roles` is the real boundary.

| Module | Entity | C | R (list/detail) | U | D | Other actions | Roles (write) | UI path | API route |
|---|---|---|---|---|---|---|---|---|---|
| People | Employee | ✔ | ✔ list+detail (directory projection below HR) | ✔ (HR) / self-edit limited | — (by design: exit via offboarding) | CSV import, documents upload+signed link, payslip link | CA, HR | /employees, /employees/[id], /my-profile | `/employees`, `/employees/:id`, `/employees/import`, `/employees/me/self`, `/employees/:id/documents` |
| People | Department | ✔ | ✔ | — | — | | CA, HR | /employees (create dialog) | `/employees/departments` |
| People | Designation | ✔ | ✔ | — | — | | CA, HR | /employees | `/employees/designations` |
| People | Staff login (invite) | ✔ | ✔ people list | resend | revoke (DELETE) | accept (public) | CA, HR (CA only for admin role) | /settings/logins, /accept-invite | `/invites*` |
| Time | Leave request | ✔ (own) | ✔ scoped | — (no edit) | — (**no cancel**) | approve, reject | EM create; MG/HR/CA decide | /leave, /approvals | `/leave/requests*` |
| Time | Leave policy | ✔ | ✔ | ✔ (incl. deactivate) | — (deactivate) | rebuild balances | HR, CA | /settings/leave | `/leave/policies*`, `/leave/balances/rebuild` |
| Time | Holiday | ✔ | ✔ | ✔ | ✔ | | HR, CA | /settings/leave | `/leave/holidays*` |
| Time | Attendance log | clock-in/out, regularisation | ✔ my-logs, dashboard | — | — | | any / MG,HR,CA dashboard | /attendance | `/attendance/*` |
| Time | Timesheet project | ✔ | ✔ | ✔ | ✔ | | any-auth (**role-check in service?**) | /timesheets | `/timesheets/projects*` |
| Time | Timesheet entry | ✔ | ✔ | ✔ | ✔ | submit, approve, reject | own; approvers MG+ | /timesheets | `/timesheets/entries*` |
| Pay | Payroll run | ✔ | ✔ | recalculate | — | submit, approve, lock, reopen (CA), payslip, journal, bank file | HR, CA | /payroll | `/payroll/runs*` |
| Pay | Compensation item | ✔ | ✔ | — | ✔ | | HR, CA | /payroll | `/payroll/compensation-items*` |
| Pay | Expense category | ✔ | ✔ | ✔ | — | | HR, CA | /expenses | `/expenses/categories*` |
| Pay | Expense claim | ✔ | ✔ | ✔ (draft) | ✔ (draft) | submit, cancel, decision, receipt link | EM own; MG/HR/CA decide | /expenses | `/expenses/claims*` |
| Pay | Loan/advance | ✔ | ✔ | — | — (cancel) | decision, cancel | EM own; HR/CA decide | /loans | `/loans*` |
| Talent | Job posting | ✔ | ✔ | — (**no edit/close**) | — | public careers feed | HR, CA | /recruitment | `/recruitment/jobs` |
| Talent | Application | ✔ | ✔ | status | — | hire (+invite) | HR, CA | /recruitment, /recruitment/kanban | `/recruitment/applications*` |
| Talent | Pre-boarding invite | ✔ | ✔ | — | — | portal by token | HR, CA | /recruitment/preboarding | `/preboarding*` |
| Talent | Onboarding | start | ✔ | complete task | — | | HR, CA | /onboarding | `/onboarding*` |
| Talent | Offboarding case | ✔ | ✔ | decision, clearance, interview, recalc | — | complete (CA), cancel | EM request; MG/HR/CA | /offboarding | `/offboarding*` |
| Talent | Review cycle | ✔ | ✔ | — | — | | HR, CA | /performance | `/performance/cycles` |
| Talent | Review | ✔ | ✔ | ✔ | — | | HR create; own/manager update | /performance/reviews | `/performance/reviews*` |
| Talent | Goal | ✔ | ✔ | progress | — | | any | /performance | `/performance/goals*` |
| Talent | Peer review | ✔ | ✔ | ✔ | ✔ | | MG, HR, CA | **no page** (API only) | `/peer-reviews*` |
| Talent | eNPS survey | ✔ | ✔ | ✔ | ✔ | respond | HR, CA; any respond | /performance/enps | `/enps/surveys*` |
| Talent | 1-on-1 | ✔ | ✔ | ✔ | ✔ | | MG, HR, CA | /one-on-ones | `/one-on-ones*` |
| Talent | LMS course | ✔ | ✔ | — | — | enroll, progress | HR, CA create | /lms | `/lms/*` |
| Insights | Report definition | ✔ | ✔ | ✔ | ✔ | | HR, CA | **no page** | `/report-definitions*` |
| Insights | Built-in reports | — | ✔ | — | — | headcount, leave, attendance (MG+), payroll-cost (HR/CA) | | /reports | `/reports/*` |
| Company | Workflow | ✔ | ✔ | ✔ | ✔ | instances | HR, CA | /settings/workflows | `/workflows*` |
| Company | Custom field | ✔ | ✔ | ✔ | ✔ | | HR, CA | /settings/custom-fields | `/custom-fields*` |
| Company | Formula | ✔ | ✔ | ✔ | ✔ | | HR, CA | **no page** | `/formulas*` |
| Company | API key | ✔ | ✔ | — | ✔ (revoke) | | CA | /settings/api-keys | `/api-keys` |
| Company | Webhook | ✔ | ✔ | ✔ | ✔ | test, redeliver, deliveries | HR, CA | /settings/webhooks | `/webhooks*` |
| Company | Integration | ✔ | ✔ | ✔ | — | install | HR, CA | /marketplace | `/integrations*`, `/marketplace/*` |
| Company | Biometric device | ✔ | ✔ | ✔ | ✔ | | HR, CA | /settings/devices | `/biometric/devices*` |
| Company | SSO config | upsert | ✔ | ✔ | — | | CA | /settings/sso | `/sso/config` |
| Company | Branding | — | ✔ | ✔ | — | | CA | /settings | `/tenants/branding` |
| Company | WhatsApp consent | upsert | ✔ | ✔ | — | | HR/CA; self | /whatsapp | `/whatsapp/*` |
| Company | Audit log | — | ✔ | — | — | | HR, CA | /settings/audit | `/audit/logs` |
| Company | E-sign, EOR | ✔ | quote | sign | — | | HR, CA | /settings/eor | `/esign/*`, `/eor/*` |
| Billing | Payment request | ✔ | ✔ | proof upload | — (cancel) | quote, receipt | CA, HR | /billing, /receipt/[id] | `/billing/*` |
| Billing | Plan/pack/accounts/settings/period/credits | ✔ | ✔ | ✔ | — | approve/reject payments | SA | /platform/billing | `/platform/billing/*` |
| Platform | Tenant, plan, subscription, override | ✔ | ✔ | ✔ | override ✔ | suspend/resume | SA | /platform, /platform/plans, /platform/[id] | `/platform/*` |
| AI | Conversation | ✔ (chat) | ✔ | — | ✔ | confirm/cancel action, attachment | any | /ai | `/ai/*` |
| AI | Settings | upsert | ✔ | ✔ | — (clear key) | | SA | /platform/ai | `/platform/ai/settings` |
| Account | Notifications | — | ✔ | mark read | — | | any | bell | `/notifications*` |
| Account | Password / MFA | — | ✔ | change, enable/disable | — | reset, forgot | any | /security, /login | `/auth/*` |

## Findings from the inventory alone
- API only (no UI): peer reviews, report definitions, formulas.
- Missing operations a client may expect: leave-request cancel/edit, job posting edit/close, department/designation rename/delete, review-cycle edit, LMS course edit, loan edit, API-key rename.
- The route extractor mislabels roles for files holding several controllers (ai, billing, invites); the table above uses the real decorators.
