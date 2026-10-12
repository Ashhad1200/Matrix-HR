# QA test accounts (local only, regenerated on every run)

Tenant A: `cmv5lx6ej00007d0mkslswy5z` (ZZ-TEST-A mv5lx649) · Tenant B: `cmv5lx6r0000l7d0ma9d4gfib` (ZZ-TEST-B mv5lx649)

| key | role | email |
|---|---|---|
| admin | COMPANY_ADMIN | zz-admin-a-mv5lx649@qa.test |
| adminB | COMPANY_ADMIN | zz-admin-b-mv5lx649@qa.test |
| hr | HR_MANAGER | zz-hr-mv5lx649@qa.test |
| manager | MANAGER | zz-manager-mv5lx649@qa.test |
| employee | EMPLOYEE | zz-employee-mv5lx649@qa.test |
| employee2 | EMPLOYEE | zz-employee2-mv5lx649@qa.test |
| employeeB | EMPLOYEE | zz-employeeB-mv5lx649@qa.test |
| superadmin | SUPER_ADMIN | superadmin@acme.com |

Passwords are in `tests/qa-crud/.auth/accounts.json` (git-ignored); the shared test password is `QA_PASSWORD` or the default in `global-setup.ts`. The superadmin is the seeded local operator.
