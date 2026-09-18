// One-shot, idempotent: brings an already-seeded database in line with the Phase 4 seed changes
// (new plan features + valid IBANs). Fresh databases get this from seed.ts. Run inside the api container.
import { PrismaClient } from '@prisma/client';
import { seedCommercial } from './seed-commercial';

const prisma = new PrismaClient();

function pkIban(bankCode: string, account16: string): string {
  const bban = `${bankCode}${account16}`;
  let rem = 0;
  for (const ch of `${bban}PK00`) {
    const digits = /[A-Z]/.test(ch) ? String(ch.charCodeAt(0) - 55) : ch;
    for (const d of digits) rem = (rem * 10 + Number(d)) % 97;
  }
  return `PK${String(98 - rem).padStart(2, '0')}${bban}`;
}

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { subdomain: 'acme' } });
  if (!tenant) throw new Error('acme tenant not found');
  await seedCommercial(prisma, tenant.id);

  const employees = await prisma.employee.findMany({
    where: { tenantId: tenant.id, iban: { startsWith: 'PK36MEZN' } },
    orderBy: { employeeCode: 'asc' },
  });
  let n = 0;
  for (const e of employees) {
    n++;
    await prisma.employee.update({ where: { id: e.id }, data: { iban: pkIban('MEZN', String(1000000000000000 + n)) } });
  }
  console.log(`features seeded; repaired ${employees.length} IBANs`);
}

main().finally(() => prisma.$disconnect());
