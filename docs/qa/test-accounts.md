# QA test accounts (local only, regenerated on every run)

Tenant A: `cmv5dmloj00iw7d7od3quou3s` (ZZ-TEST-A mv5dmld9) · Tenant B: `cmv5dmlz500jc7d7ohnyh62b3` (ZZ-TEST-B mv5dmld9)

| key | role | email |
|---|---|---|
| admin | COMPANY_ADMIN | zz-admin-a-mv5dmld9@qa.test |
| adminB | COMPANY_ADMIN | zz-admin-b-mv5dmld9@qa.test |
| hr | HR_MANAGER | zz-hr-mv5dmld9@qa.test |
| manager | MANAGER | zz-manager-mv5dmld9@qa.test |
| employee | EMPLOYEE | zz-employee-mv5dmld9@qa.test |
| employee2 | EMPLOYEE | zz-employee2-mv5dmld9@qa.test |
| employeeB | EMPLOYEE | zz-employeeB-mv5dmld9@qa.test |
| superadmin | SUPER_ADMIN | superadmin@acme.com |

Passwords are in `tests/qa-crud/.auth/accounts.json` (git-ignored); the shared test password is `QA_PASSWORD` or the default in `global-setup.ts`. The superadmin is the seeded local operator.
