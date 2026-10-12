-- 2_hr_modules: company weekend days (leave counts working days only) and one-answer-per-employee eNPS.
--
-- ADDITIVE AND IDEMPOTENT: every statement is guarded, so it is safe on a database that already has these objects and
-- safe to apply twice. No destructive statements. Existing tenants get the default weekend (Saturday + Sunday).

ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "weekendDays" INTEGER[] DEFAULT ARRAY[6, 0]::INTEGER[];

-- Stores WHO answered a survey, never WHAT they answered (the answer rows stay anonymous).
CREATE TABLE IF NOT EXISTS "EnpsParticipation" (
    "surveyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnpsParticipation_pkey" PRIMARY KEY ("surveyId","employeeId")
);

DO $$ BEGIN
  ALTER TABLE "EnpsParticipation" ADD CONSTRAINT "EnpsParticipation_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "EnpsSurvey"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
