# QA test accounts (local only, regenerated on every run)

Tenant A: `cmv5ohj8s00007df4efhm2bhv` (ZZ-TEST-A mv5ohiyq) · Tenant B: `cmv5ohjjh000l7df4zf6qraqc` (ZZ-TEST-B mv5ohiyq)

| key | role | email |
|---|---|---|
| admin | COMPANY_ADMIN | zz-admin-a-mv5ohiyq@qa.test |
| adminB | COMPANY_ADMIN | zz-admin-b-mv5ohiyq@qa.test |
| hr | HR_MANAGER | zz-hr-mv5ohiyq@qa.test |
| manager | MANAGER | zz-manager-mv5ohiyq@qa.test |
| employee | EMPLOYEE | zz-employee-mv5ohiyq@qa.test |
| employee2 | EMPLOYEE | zz-employee2-mv5ohiyq@qa.test |
| employeeB | EMPLOYEE | zz-employeeB-mv5ohiyq@qa.test |
| superadmin | SUPER_ADMIN | superadmin@acme.com |

Passwords are in `tests/qa-crud/.auth/accounts.json` (git-ignored); the shared test password is `QA_PASSWORD` or the default in `global-setup.ts`. The superadmin is the seeded local operator.
