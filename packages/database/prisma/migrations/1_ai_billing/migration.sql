-- 1_ai_billing: manual payments, billing lifecycle, email outbox, AI assistant.
--
-- ADDITIVE AND IDEMPOTENT. Every statement is guarded (IF NOT EXISTS / duplicate_object), so it is safe to apply
-- to a database that already has some of these objects (e.g. built with `prisma db push`) and safe to apply twice.
-- It contains no destructive statements (no table or column removal, no renames, no column type changes). It also creates the ExpenseCategory/ExpenseClaim/ExpenseItem/
-- LoanRequest tables that 0_init never had (a no-op where they already exist).
-- Generated with `prisma migrate diff --from-migrations ... --to-schema-datamodel ... --script`, then made idempotent.

DO $$ BEGIN
  CREATE TYPE "ExpenseClaimStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'REIMBURSED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "LoanStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'COMPLETED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "CompensationItem" ADD COLUMN IF NOT EXISTS     "sourceId" TEXT,
ADD COLUMN IF NOT EXISTS     "sourceType" TEXT;

ALTER TABLE "PlanVersion" ADD COLUMN IF NOT EXISTS     "aiCreditsMonthly" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS     "currency" TEXT NOT NULL DEFAULT 'PKR',
ADD COLUMN IF NOT EXISTS     "maxAdminUsers" INTEGER,
ADD COLUMN IF NOT EXISTS     "maxEmployees" INTEGER,
ADD COLUMN IF NOT EXISTS     "offeredToNew" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS     "overagePerEmployee" DECIMAL(12,2),
ADD COLUMN IF NOT EXISTS     "priceMonthly" DECIMAL(12,2),
ADD COLUMN IF NOT EXISTS     "priceYearly" DECIMAL(12,2);

ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS     "billingPeriod" TEXT NOT NULL DEFAULT 'monthly',
ADD COLUMN IF NOT EXISTS     "currentPeriodEnd" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS     "trialEndsAt" TIMESTAMP(3);

ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS     "aiEnabled" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS "ExpenseCategory" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "maxAmountPerItem" DECIMAL(12,2),
    "requiresReceipt" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExpenseCategory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ExpenseClaim" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "ExpenseClaimStatus" NOT NULL DEFAULT 'DRAFT',
    "totalAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'PKR',
    "submittedAt" TIMESTAMP(3),
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "reimbursedAt" TIMESTAMP(3),
    "reimbursedInPeriod" TEXT,
    "workflowInstanceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpenseClaim_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ExpenseItem" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "description" TEXT NOT NULL,
    "receiptUrl" TEXT,

    CONSTRAINT "ExpenseItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "LoanRequest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "installments" INTEGER NOT NULL,
    "firstDeductionPeriod" TEXT NOT NULL,
    "reason" TEXT,
    "status" "LoanStatus" NOT NULL DEFAULT 'PENDING',
    "decidedAt" TIMESTAMP(3),
    "workflowInstanceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoanRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PaymentAccount" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "accountTitle" TEXT NOT NULL,
    "accountNumber" TEXT,
    "iban" TEXT,
    "swift" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "instructions" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PaymentRequest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "planCode" TEXT,
    "planVersionId" TEXT,
    "billingPeriod" TEXT,
    "packCode" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "expectedAmount" DECIMAL(12,2) NOT NULL,
    "lineItems" JSONB NOT NULL,
    "reference" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "declaredAmount" DECIMAL(12,2),
    "declaredCurrency" TEXT,
    "customerNote" TEXT,
    "status" TEXT NOT NULL DEFAULT 'AWAITING_PROOF',
    "createdByUserId" TEXT NOT NULL,
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "approvedAmount" DECIMAL(12,2),
    "reviewReason" TEXT,
    "rejectReason" TEXT,
    "periodStartAt" TIMESTAMP(3),
    "periodEndAt" TIMESTAMP(3),
    "creditsGranted" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PaymentProof" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "filename" TEXT,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentProof_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Receipt" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Receipt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ReceiptCounter" (
    "year" INTEGER NOT NULL,
    "last" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ReceiptCounter_pkey" PRIMARY KEY ("year")
);

CREATE TABLE IF NOT EXISTS "BillingSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "graceDays" INTEGER NOT NULL DEFAULT 3,
    "provisionalHours" INTEGER NOT NULL DEFAULT 72,
    "reminderDays" TEXT NOT NULL DEFAULT '7,1,0',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingSettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ProvisionalAccess" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "until" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProvisionalAccess_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "BillingReminder" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "kind" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingReminder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "EmailOutbox" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "toAddress" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "dedupeKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "EmailOutbox_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AiSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "provider" TEXT NOT NULL DEFAULT 'openai',
    "openaiModel" TEXT NOT NULL DEFAULT 'gpt-4o-mini',
    "anthropicModel" TEXT NOT NULL DEFAULT 'claude-haiku-4-5-20251001',
    "geminiModel" TEXT NOT NULL DEFAULT 'gemini-2.0-flash',
    "openaiKeyEnc" TEXT,
    "anthropicKeyEnc" TEXT,
    "geminiKeyEnc" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiSettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AiConversation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiConversation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AiMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AiActionToken" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tool" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiActionToken_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AiCreditAccount" (
    "tenantId" TEXT NOT NULL,
    "monthlyMc" INTEGER NOT NULL DEFAULT 0,
    "purchasedMc" INTEGER NOT NULL DEFAULT 0,
    "monthlyResetAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiCreditAccount_pkey" PRIMARY KEY ("tenantId")
);

CREATE TABLE IF NOT EXISTS "AiCreditLedger" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "deltaMc" INTEGER NOT NULL,
    "monthlyPartMc" INTEGER NOT NULL DEFAULT 0,
    "purchasedPartMc" INTEGER NOT NULL DEFAULT 0,
    "refId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "detail" JSONB,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiCreditLedger_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CreditPack" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "credits" INTEGER NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "CreditPack_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ExpenseCategory_tenantId_idx" ON "ExpenseCategory"("tenantId");

CREATE UNIQUE INDEX IF NOT EXISTS "ExpenseCategory_tenantId_name_key" ON "ExpenseCategory"("tenantId", "name");

CREATE INDEX IF NOT EXISTS "ExpenseClaim_tenantId_status_idx" ON "ExpenseClaim"("tenantId", "status");

CREATE INDEX IF NOT EXISTS "ExpenseClaim_tenantId_employeeId_idx" ON "ExpenseClaim"("tenantId", "employeeId");

CREATE INDEX IF NOT EXISTS "ExpenseItem_claimId_idx" ON "ExpenseItem"("claimId");

CREATE INDEX IF NOT EXISTS "LoanRequest_tenantId_status_idx" ON "LoanRequest"("tenantId", "status");

CREATE INDEX IF NOT EXISTS "LoanRequest_tenantId_employeeId_idx" ON "LoanRequest"("tenantId", "employeeId");

CREATE UNIQUE INDEX IF NOT EXISTS "PaymentRequest_reference_key" ON "PaymentRequest"("reference");

CREATE INDEX IF NOT EXISTS "PaymentRequest_tenantId_status_idx" ON "PaymentRequest"("tenantId", "status");

CREATE INDEX IF NOT EXISTS "PaymentRequest_status_createdAt_idx" ON "PaymentRequest"("status", "createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS "PaymentProof_requestId_key" ON "PaymentProof"("requestId");

CREATE UNIQUE INDEX IF NOT EXISTS "Receipt_requestId_key" ON "Receipt"("requestId");

CREATE UNIQUE INDEX IF NOT EXISTS "Receipt_number_key" ON "Receipt"("number");

CREATE INDEX IF NOT EXISTS "Receipt_tenantId_idx" ON "Receipt"("tenantId");

CREATE UNIQUE INDEX IF NOT EXISTS "ProvisionalAccess_subscriptionId_periodEnd_key" ON "ProvisionalAccess"("subscriptionId", "periodEnd");

CREATE UNIQUE INDEX IF NOT EXISTS "BillingReminder_subscriptionId_periodEnd_kind_key" ON "BillingReminder"("subscriptionId", "periodEnd", "kind");

CREATE UNIQUE INDEX IF NOT EXISTS "EmailOutbox_dedupeKey_key" ON "EmailOutbox"("dedupeKey");

CREATE INDEX IF NOT EXISTS "EmailOutbox_status_nextAttemptAt_idx" ON "EmailOutbox"("status", "nextAttemptAt");

CREATE INDEX IF NOT EXISTS "AiConversation_tenantId_userId_updatedAt_idx" ON "AiConversation"("tenantId", "userId", "updatedAt");

CREATE INDEX IF NOT EXISTS "AiMessage_conversationId_createdAt_idx" ON "AiMessage"("conversationId", "createdAt");

CREATE INDEX IF NOT EXISTS "AiActionToken_tenantId_userId_idx" ON "AiActionToken"("tenantId", "userId");

CREATE UNIQUE INDEX IF NOT EXISTS "AiCreditLedger_idempotencyKey_key" ON "AiCreditLedger"("idempotencyKey");

CREATE INDEX IF NOT EXISTS "AiCreditLedger_tenantId_createdAt_idx" ON "AiCreditLedger"("tenantId", "createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS "CreditPack_code_key" ON "CreditPack"("code");

CREATE INDEX IF NOT EXISTS "CompensationItem_sourceType_sourceId_idx" ON "CompensationItem"("sourceType", "sourceId");

DO $$ BEGIN
  ALTER TABLE "ExpenseCategory" ADD CONSTRAINT "ExpenseCategory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ExpenseClaim" ADD CONSTRAINT "ExpenseClaim_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ExpenseClaim" ADD CONSTRAINT "ExpenseClaim_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ExpenseItem" ADD CONSTRAINT "ExpenseItem_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "ExpenseClaim"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ExpenseItem" ADD CONSTRAINT "ExpenseItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "LoanRequest" ADD CONSTRAINT "LoanRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "LoanRequest" ADD CONSTRAINT "LoanRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "PaymentRequest" ADD CONSTRAINT "PaymentRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "PaymentRequest" ADD CONSTRAINT "PaymentRequest_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "PaymentAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "PaymentProof" ADD CONSTRAINT "PaymentProof_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "PaymentRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "PaymentRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ProvisionalAccess" ADD CONSTRAINT "ProvisionalAccess_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "BillingReminder" ADD CONSTRAINT "BillingReminder_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "AiConversation" ADD CONSTRAINT "AiConversation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "AiMessage" ADD CONSTRAINT "AiMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AiConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "AiActionToken" ADD CONSTRAINT "AiActionToken_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "AiCreditAccount" ADD CONSTRAINT "AiCreditAccount_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- One open (awaiting proof or pending) request per tenant per purpose. Prisma cannot express partial indexes.
CREATE UNIQUE INDEX IF NOT EXISTS "PaymentRequest_one_open_per_purpose"
  ON "PaymentRequest" ("tenantId", "purpose") WHERE "status" IN ('AWAITING_PROOF', 'PENDING');

-- Zero or negative prices are never valid.
DO $$ BEGIN
  ALTER TABLE "PlanVersion" ADD CONSTRAINT "PlanVersion_prices_positive"
    CHECK (("priceMonthly" IS NULL OR "priceMonthly" > 0) AND ("priceYearly" IS NULL OR "priceYearly" > 0));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "CreditPack" ADD CONSTRAINT "CreditPack_positive" CHECK ("price" > 0 AND "credits" > 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "PaymentRequest" ADD CONSTRAINT "PaymentRequest_expected_positive" CHECK ("expectedAmount" > 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
