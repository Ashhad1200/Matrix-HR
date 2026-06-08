-- Phase 7: PostgreSQL Row-Level Security policies (apply manually in production)
-- Enable after setting app.tenant_id per request via SET LOCAL

ALTER TABLE "Employee" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LeaveRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PayrollRun" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_employee ON "Employee"
  USING ("tenantId" = current_setting('app.tenant_id', true));

CREATE POLICY tenant_isolation_leave ON "LeaveRequest"
  USING ("tenantId" = current_setting('app.tenant_id', true));

CREATE POLICY tenant_isolation_payroll ON "PayrollRun"
  USING ("tenantId" = current_setting('app.tenant_id', true));
