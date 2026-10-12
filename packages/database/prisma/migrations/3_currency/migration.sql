-- 3_currency: two billing currencies. PKR for Pakistan, USD for everyone else; both price lists live on the same plan version.
--
-- ADDITIVE AND IDEMPOTENT: only ADD COLUMN IF NOT EXISTS and guarded UPDATEs that fill NULLs (never overwrite a price an
-- operator has set), safe to apply twice. No drops, renames or type changes. Existing subscriptions keep their plan version.

ALTER TABLE "CreditPack" ADD COLUMN IF NOT EXISTS "pricePkr" DECIMAL(12,2);

ALTER TABLE "PlanVersion"
  ADD COLUMN IF NOT EXISTS "priceMonthlyPkr" DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS "priceYearlyPkr" DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS "overagePerEmployeePkr" DECIMAL(12,2);

ALTER TABLE "Tenant"
  ADD COLUMN IF NOT EXISTS "billingCurrency" TEXT NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS "country" TEXT;

-- Starting PKR prices on the plan version currently offered to new customers (set by hand later in the backoffice).
-- Yearly = 10 x monthly. Only fills columns that are still NULL.
UPDATE "PlanVersion" v SET
  "priceMonthlyPkr" = COALESCE(v."priceMonthlyPkr", c.m),
  "priceYearlyPkr" = COALESCE(v."priceYearlyPkr", c.y),
  "overagePerEmployeePkr" = COALESCE(v."overagePerEmployeePkr", c.o)
FROM "Plan" p,
  (VALUES ('starter', 6999, 69990, NULL::numeric), ('growth', 18999, 189990, NULL::numeric), ('business', 39999, 399990, 140::numeric)) AS c(code, m, y, o)
WHERE p.id = v."planId" AND p.code = c.code AND v."isCurrent" = true AND v."offeredToNew" = true AND v."currency" = 'USD';

UPDATE "CreditPack" SET "pricePkr" = CASE "code" WHEN 'small' THEN 2799 WHEN 'medium' THEN 12499 WHEN 'large' THEN 32999 END
WHERE "pricePkr" IS NULL AND "code" IN ('small', 'medium', 'large');

-- Companies that were already on a PKR plan keep paying in PKR; everyone else stays USD (the column default).
UPDATE "Tenant" t SET "billingCurrency" = 'PKR'
WHERE t."billingCurrency" = 'USD' AND EXISTS (
  SELECT 1 FROM "Subscription" s JOIN "PlanVersion" v ON v.id = s."planVersionId" WHERE s."tenantId" = t.id AND v."currency" = 'PKR'
);
