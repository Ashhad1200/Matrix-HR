/**
 * READ-ONLY. Classifies a database against this repo's migration history, so you know whether
 * `prisma migrate deploy` will start cleanly *before* deploying. Never writes.
 *
 *   DATABASE_URL=... pnpm --filter @matrixhr/database exec tsx prisma/preflight.ts
 *
 * Exit code 0 = deploy is safe as-is, 2 = needs a human step (printed), 1 = could not connect.
 */
import { PrismaClient } from '@prisma/client';
import { readdirSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();
type Row = Record<string, unknown>;
const q = (sql: string) => prisma.$queryRawUnsafe<Row[]>(sql);

async function main() {
  const dir = join(__dirname, 'migrations');
  const onDisk = readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();

  const tables = (await q(`select table_name from information_schema.tables where table_schema='public'`)).map((r) => String(r.table_name));
  const has = (t: string) => tables.includes(t);
  const appTables = tables.filter((t) => t !== '_prisma_migrations');
  const applied = has('_prisma_migrations')
    ? await q(`select migration_name, finished_at, rolled_back_at from _prisma_migrations order by started_at`)
    : [];

  const report: Record<string, unknown> = {
    appTableCount: appTables.length,
    hasMigrationsTable: has('_prisma_migrations'),
    migrationsOnDisk: onDisk,
    migrationsApplied: applied.map((r) => ({ name: r.migration_name, finished: !!r.finished_at, rolledBack: !!r.rolled_back_at })),
    hasExpenseLoanTables: ['ExpenseCategory', 'ExpenseClaim', 'ExpenseItem', 'LoanRequest'].every(has),
    hasBillingTables: has('PaymentRequest'),
  };

  let verdict: string;
  let code = 0;
  const failed = applied.filter((r) => !r.finished_at && !r.rolled_back_at);
  const unknown = applied.filter((r) => !onDisk.includes(String(r.migration_name)));
  if (appTables.length === 0) verdict = 'EMPTY database: migrate deploy will build everything.';
  else if (!has('_prisma_migrations')) {
    code = 2;
    verdict = 'NO MIGRATION HISTORY on a non-empty database (built with `db push`). migrate deploy would FAIL with P3005.\n' +
      '  Fix (safe, never resets): back up, then `prisma migrate resolve --applied 0_init`, then deploy. 1_ai_billing is idempotent.';
  } else if (failed.length) {
    code = 2;
    verdict = `FAILED migration(s) recorded: ${failed.map((r) => r.migration_name).join(', ')}. migrate deploy will refuse to continue. Inspect, then \`migrate resolve --rolled-back <name>\` or --applied if the SQL actually completed.`;
  } else if (unknown.length) {
    code = 2;
    verdict = `History mismatch: applied but not in this repo: ${unknown.map((r) => r.migration_name).join(', ')}. Do not deploy until reconciled.`;
  } else {
    const pending = onDisk.filter((m) => !applied.some((r) => r.migration_name === m));
    verdict = pending.length ? `HISTORY OK. migrate deploy will apply: ${pending.join(', ')}.` : 'HISTORY OK. Nothing pending.';
  }
  report.verdict = verdict;

  // Tenant/plan snapshot for the "quiet first cycle" check. Column list adapts to what exists.
  if (has('Tenant') && has('Subscription')) {
    const cols = (await q(`select column_name from information_schema.columns where table_name='Subscription'`)).map((r) => String(r.column_name));
    const periodEnd = cols.includes('currentPeriodEnd') ? `s."currentPeriodEnd"` : 'NULL::timestamp';
    report.tenants = await q(
      `select t.id, t.subdomain, t.name, t.status::text as tenant_status, p.code as plan, s.status as sub_status, ${periodEnd} as period_end,
              (select count(*) from "Employee" e where e."tenantId" = t.id) as employees
         from "Tenant" t left join "Subscription" s on s."tenantId" = t.id
         left join "PlanVersion" pv on pv.id = s."planVersionId" left join "Plan" p on p.id = pv."planId" order by t."createdAt"`,
    );
  }
  console.log(JSON.stringify(report, (_k, v) => (typeof v === 'bigint' ? Number(v) : v), 2));
  console.log(`\nVERDICT: ${verdict}`);
  process.exitCode = code;
}

main().catch((e) => { console.error('preflight could not run:', e.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
