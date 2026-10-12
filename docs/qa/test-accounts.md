# QA test accounts (local only, regenerated on every run)

Tenant A: `cmv5ftqje01tj7d7omhbrmcjk` (ZZ-TEST-A mv5ftq94) · Tenant B: `cmv5ftqvh01tz7d7omgxp8npk` (ZZ-TEST-B mv5ftq94)

| key | role | email |
|---|---|---|
| admin | COMPANY_ADMIN | zz-admin-a-mv5ftq94@qa.test |
| adminB | COMPANY_ADMIN | zz-admin-b-mv5ftq94@qa.test |
| hr | HR_MANAGER | zz-hr-mv5ftq94@qa.test |
| manager | MANAGER | zz-manager-mv5ftq94@qa.test |
| employee | EMPLOYEE | zz-employee-mv5ftq94@qa.test |
| employee2 | EMPLOYEE | zz-employee2-mv5ftq94@qa.test |
| employeeB | EMPLOYEE | zz-employeeB-mv5ftq94@qa.test |
| superadmin | SUPER_ADMIN | superadmin@acme.com |

Passwords are in `tests/qa-crud/.auth/accounts.json` (git-ignored); the shared test password is `QA_PASSWORD` or the default in `global-setup.ts`. The superadmin is the seeded local operator.
