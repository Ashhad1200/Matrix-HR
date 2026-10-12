# QA test accounts (local only, regenerated on every run)

Tenant A: `cmv5fy7s3027p7d7or6u7lfo3` (ZZ-TEST-A mv5fy7hh) · Tenant B: `cmv5fy83h02857d7o6axxmeh5` (ZZ-TEST-B mv5fy7hh)

| key | role | email |
|---|---|---|
| admin | COMPANY_ADMIN | zz-admin-a-mv5fy7hh@qa.test |
| adminB | COMPANY_ADMIN | zz-admin-b-mv5fy7hh@qa.test |
| hr | HR_MANAGER | zz-hr-mv5fy7hh@qa.test |
| manager | MANAGER | zz-manager-mv5fy7hh@qa.test |
| employee | EMPLOYEE | zz-employee-mv5fy7hh@qa.test |
| employee2 | EMPLOYEE | zz-employee2-mv5fy7hh@qa.test |
| employeeB | EMPLOYEE | zz-employeeB-mv5fy7hh@qa.test |
| superadmin | SUPER_ADMIN | superadmin@acme.com |

Passwords are in `tests/qa-crud/.auth/accounts.json` (git-ignored); the shared test password is `QA_PASSWORD` or the default in `global-setup.ts`. The superadmin is the seeded local operator.
