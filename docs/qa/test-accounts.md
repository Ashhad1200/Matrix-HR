# QA test accounts (local only, regenerated on every run)

Tenant A: `cmv5bv0m400uo7dcaozy0jtsq` (ZZ-TEST-A mv5bv0bp) · Tenant B: `cmv5bv0xr00v47dca8uhc23fk` (ZZ-TEST-B mv5bv0bp)

| key | role | email |
|---|---|---|
| admin | COMPANY_ADMIN | zz-admin-a-mv5bv0bp@qa.test |
| adminB | COMPANY_ADMIN | zz-admin-b-mv5bv0bp@qa.test |
| hr | HR_MANAGER | zz-hr-mv5bv0bp@qa.test |
| manager | MANAGER | zz-manager-mv5bv0bp@qa.test |
| employee | EMPLOYEE | zz-employee-mv5bv0bp@qa.test |
| employee2 | EMPLOYEE | zz-employee2-mv5bv0bp@qa.test |
| employeeB | EMPLOYEE | zz-employeeB-mv5bv0bp@qa.test |
| superadmin | SUPER_ADMIN | superadmin@acme.com |

Passwords are in `tests/qa-crud/.auth/accounts.json` (git-ignored); the shared test password is `QA_PASSWORD` or the default in `global-setup.ts`. The superadmin is the seeded local operator.
