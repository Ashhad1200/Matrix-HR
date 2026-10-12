# QA test accounts (local only, regenerated on every run)

Tenant A: `cmv5kr3ep03u07dsvldnyairy` (ZZ-TEST-A mv5kr34k) · Tenant B: `cmv5kr3rh03ul7dsvkpwgk3rh` (ZZ-TEST-B mv5kr34k)

| key | role | email |
|---|---|---|
| admin | COMPANY_ADMIN | zz-admin-a-mv5kr34k@qa.test |
| adminB | COMPANY_ADMIN | zz-admin-b-mv5kr34k@qa.test |
| hr | HR_MANAGER | zz-hr-mv5kr34k@qa.test |
| manager | MANAGER | zz-manager-mv5kr34k@qa.test |
| employee | EMPLOYEE | zz-employee-mv5kr34k@qa.test |
| employee2 | EMPLOYEE | zz-employee2-mv5kr34k@qa.test |
| employeeB | EMPLOYEE | zz-employeeB-mv5kr34k@qa.test |
| superadmin | SUPER_ADMIN | superadmin@acme.com |

Passwords are in `tests/qa-crud/.auth/accounts.json` (git-ignored); the shared test password is `QA_PASSWORD` or the default in `global-setup.ts`. The superadmin is the seeded local operator.
