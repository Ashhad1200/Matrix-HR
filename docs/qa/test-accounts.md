# QA test accounts (local only, regenerated on every run)

Tenant A: `cmv5hf45r00007dwh88rx2w15` (ZZ-TEST-A mv5hf3rn) · Tenant B: `cmv5hf4tk000l7dwh8s6kq4ox` (ZZ-TEST-B mv5hf3rn)

| key | role | email |
|---|---|---|
| admin | COMPANY_ADMIN | zz-admin-a-mv5hf3rn@qa.test |
| adminB | COMPANY_ADMIN | zz-admin-b-mv5hf3rn@qa.test |
| hr | HR_MANAGER | zz-hr-mv5hf3rn@qa.test |
| manager | MANAGER | zz-manager-mv5hf3rn@qa.test |
| employee | EMPLOYEE | zz-employee-mv5hf3rn@qa.test |
| employee2 | EMPLOYEE | zz-employee2-mv5hf3rn@qa.test |
| employeeB | EMPLOYEE | zz-employeeB-mv5hf3rn@qa.test |
| superadmin | SUPER_ADMIN | superadmin@acme.com |

Passwords are in `tests/qa-crud/.auth/accounts.json` (git-ignored); the shared test password is `QA_PASSWORD` or the default in `global-setup.ts`. The superadmin is the seeded local operator.
