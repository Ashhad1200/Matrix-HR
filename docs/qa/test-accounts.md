# QA test accounts (local only, regenerated on every run)

Tenant A: `cmv5c6asa007f7dr3tc4sh4gr` (ZZ-TEST-A mv5c6ai5) · Tenant B: `cmv5c6b3k007v7dr3syby4rue` (ZZ-TEST-B mv5c6ai5)

| key | role | email |
|---|---|---|
| admin | COMPANY_ADMIN | zz-admin-a-mv5c6ai5@qa.test |
| adminB | COMPANY_ADMIN | zz-admin-b-mv5c6ai5@qa.test |
| hr | HR_MANAGER | zz-hr-mv5c6ai5@qa.test |
| manager | MANAGER | zz-manager-mv5c6ai5@qa.test |
| employee | EMPLOYEE | zz-employee-mv5c6ai5@qa.test |
| employee2 | EMPLOYEE | zz-employee2-mv5c6ai5@qa.test |
| employeeB | EMPLOYEE | zz-employeeB-mv5c6ai5@qa.test |
| superadmin | SUPER_ADMIN | superadmin@acme.com |

Passwords are in `tests/qa-crud/.auth/accounts.json` (git-ignored); the shared test password is `QA_PASSWORD` or the default in `global-setup.ts`. The superadmin is the seeded local operator.
