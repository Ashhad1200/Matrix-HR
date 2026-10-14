# QA test accounts (local only, regenerated on every run)

Tenant A: `cmv8lq85f006e7das2vtsyvhv` (ZZ-TEST-A mv8lq7vp) · Tenant B: `cmv8lq8gm006z7dasqen0pp0o` (ZZ-TEST-B mv8lq7vp)

| key | role | email |
|---|---|---|
| admin | COMPANY_ADMIN | zz-admin-a-mv8lq7vp@qa.test |
| adminB | COMPANY_ADMIN | zz-admin-b-mv8lq7vp@qa.test |
| hr | HR_MANAGER | zz-hr-mv8lq7vp@qa.test |
| manager | MANAGER | zz-manager-mv8lq7vp@qa.test |
| employee | EMPLOYEE | zz-employee-mv8lq7vp@qa.test |
| employee2 | EMPLOYEE | zz-employee2-mv8lq7vp@qa.test |
| employeeB | EMPLOYEE | zz-employeeB-mv8lq7vp@qa.test |
| superadmin | SUPER_ADMIN | superadmin@acme.com |

Passwords are in `tests/qa-crud/.auth/accounts.json` (git-ignored); the shared test password is `QA_PASSWORD` or the default in `global-setup.ts`. The superadmin is the seeded local operator.
