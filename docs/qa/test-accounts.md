# QA test accounts (local only, regenerated on every run)

Tenant A: `cmv5gdmgv03jc7d7orp6js4b6` (ZZ-TEST-A mv5gdm5p) · Tenant B: `cmv5gdms003js7d7obx42qecq` (ZZ-TEST-B mv5gdm5p)

| key | role | email |
|---|---|---|
| admin | COMPANY_ADMIN | zz-admin-a-mv5gdm5p@qa.test |
| adminB | COMPANY_ADMIN | zz-admin-b-mv5gdm5p@qa.test |
| hr | HR_MANAGER | zz-hr-mv5gdm5p@qa.test |
| manager | MANAGER | zz-manager-mv5gdm5p@qa.test |
| employee | EMPLOYEE | zz-employee-mv5gdm5p@qa.test |
| employee2 | EMPLOYEE | zz-employee2-mv5gdm5p@qa.test |
| employeeB | EMPLOYEE | zz-employeeB-mv5gdm5p@qa.test |
| superadmin | SUPER_ADMIN | superadmin@acme.com |

Passwords are in `tests/qa-crud/.auth/accounts.json` (git-ignored); the shared test password is `QA_PASSWORD` or the default in `global-setup.ts`. The superadmin is the seeded local operator.
