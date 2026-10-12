# QA test accounts (local only, regenerated on every run)

Tenant A: `cmv5i8m7e01p17drmezijnow9` (ZZ-TEST-A mv5i8lwd) · Tenant B: `cmv5i8mi701pm7drm328y5xrb` (ZZ-TEST-B mv5i8lwd)

| key | role | email |
|---|---|---|
| admin | COMPANY_ADMIN | zz-admin-a-mv5i8lwd@qa.test |
| adminB | COMPANY_ADMIN | zz-admin-b-mv5i8lwd@qa.test |
| hr | HR_MANAGER | zz-hr-mv5i8lwd@qa.test |
| manager | MANAGER | zz-manager-mv5i8lwd@qa.test |
| employee | EMPLOYEE | zz-employee-mv5i8lwd@qa.test |
| employee2 | EMPLOYEE | zz-employee2-mv5i8lwd@qa.test |
| employeeB | EMPLOYEE | zz-employeeB-mv5i8lwd@qa.test |
| superadmin | SUPER_ADMIN | superadmin@acme.com |

Passwords are in `tests/qa-crud/.auth/accounts.json` (git-ignored); the shared test password is `QA_PASSWORD` or the default in `global-setup.ts`. The superadmin is the seeded local operator.
