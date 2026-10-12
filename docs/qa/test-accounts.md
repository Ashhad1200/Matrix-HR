# QA test accounts (local only, regenerated on every run)

Tenant A: `cmv5c2whd00007dgyd3u0j1ai` (ZZ-TEST-A mv5c2w79) · Tenant B: `cmv5c2wsu000g7dgy5gw05pbr` (ZZ-TEST-B mv5c2w79)

| key | role | email |
|---|---|---|
| admin | COMPANY_ADMIN | zz-admin-a-mv5c2w79@qa.test |
| adminB | COMPANY_ADMIN | zz-admin-b-mv5c2w79@qa.test |
| hr | HR_MANAGER | zz-hr-mv5c2w79@qa.test |
| manager | MANAGER | zz-manager-mv5c2w79@qa.test |
| employee | EMPLOYEE | zz-employee-mv5c2w79@qa.test |
| employee2 | EMPLOYEE | zz-employee2-mv5c2w79@qa.test |
| employeeB | EMPLOYEE | zz-employeeB-mv5c2w79@qa.test |
| superadmin | SUPER_ADMIN | superadmin@acme.com |

Passwords are in `tests/qa-crud/.auth/accounts.json` (git-ignored); the shared test password is `QA_PASSWORD` or the default in `global-setup.ts`. The superadmin is the seeded local operator.
