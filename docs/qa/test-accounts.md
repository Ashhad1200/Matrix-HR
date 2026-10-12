# QA test accounts (local only, regenerated on every run)

Tenant A: `cmv5hud9j00bj7drm9en0l2uy` (ZZ-TEST-A mv5huczm) · Tenant B: `cmv5hudm000c47drmsusu6hmz` (ZZ-TEST-B mv5huczm)

| key | role | email |
|---|---|---|
| admin | COMPANY_ADMIN | zz-admin-a-mv5huczm@qa.test |
| adminB | COMPANY_ADMIN | zz-admin-b-mv5huczm@qa.test |
| hr | HR_MANAGER | zz-hr-mv5huczm@qa.test |
| manager | MANAGER | zz-manager-mv5huczm@qa.test |
| employee | EMPLOYEE | zz-employee-mv5huczm@qa.test |
| employee2 | EMPLOYEE | zz-employee2-mv5huczm@qa.test |
| employeeB | EMPLOYEE | zz-employeeB-mv5huczm@qa.test |
| superadmin | SUPER_ADMIN | superadmin@acme.com |

Passwords are in `tests/qa-crud/.auth/accounts.json` (git-ignored); the shared test password is `QA_PASSWORD` or the default in `global-setup.ts`. The superadmin is the seeded local operator.
