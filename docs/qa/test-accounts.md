# QA test accounts (local only, regenerated on every run)

Tenant A: `cmv5c9okb00007d7opgcur7d2` (ZZ-TEST-A mv5c9o9e) · Tenant B: `cmv5c9owk000g7d7o7u57r5j9` (ZZ-TEST-B mv5c9o9e)

| key | role | email |
|---|---|---|
| admin | COMPANY_ADMIN | zz-admin-a-mv5c9o9e@qa.test |
| adminB | COMPANY_ADMIN | zz-admin-b-mv5c9o9e@qa.test |
| hr | HR_MANAGER | zz-hr-mv5c9o9e@qa.test |
| manager | MANAGER | zz-manager-mv5c9o9e@qa.test |
| employee | EMPLOYEE | zz-employee-mv5c9o9e@qa.test |
| employee2 | EMPLOYEE | zz-employee2-mv5c9o9e@qa.test |
| employeeB | EMPLOYEE | zz-employeeB-mv5c9o9e@qa.test |
| superadmin | SUPER_ADMIN | superadmin@acme.com |

Passwords are in `tests/qa-crud/.auth/accounts.json` (git-ignored); the shared test password is `QA_PASSWORD` or the default in `global-setup.ts`. The superadmin is the seeded local operator.
