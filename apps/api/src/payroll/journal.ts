export type JournalAccounts = {
  salaryExpense: string;
  incomeTaxPayable: string;
  eobiPayable: string;
  pfPayable: string;
  recoveries: string;
  reimbursements: string;
  salariesPayable: string;
};

export const DEFAULT_ACCOUNTS: JournalAccounts = {
  salaryExpense: 'Salaries & Wages',
  incomeTaxPayable: 'Income Tax Payable',
  eobiPayable: 'EOBI Payable',
  pfPayable: 'Provident Fund Payable',
  recoveries: 'Employee Recoveries',
  reimbursements: 'Expense Reimbursements',
  salariesPayable: 'Salaries Payable',
};

export type JournalItem = {
  grossSalary: unknown;
  netSalary: unknown;
  taxAmount: unknown;
  eobiAmount: unknown;
  pfAmount: unknown;
  /** Payroll item breakdown; `reimbursements` (approved expense claims paid with the run) is read from it. */
  breakdown?: unknown;
};

type Row = { account: string; debit: number; credit: number; memo: string };

const cents = (v: unknown) => Math.round(Number(v ?? 0) * 100);
const money = (c: number) => (c / 100).toFixed(2);
const csv = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** Last calendar day of "YYYY-MM". */
function periodEnd(period: string) {
  const [y, m] = period.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

/**
 * One balanced journal entry for a payroll run, in a column layout QuickBooks Online's
 * journal-entry CSV import understands. Amounts are summed in integer cents so debits
 * always equal credits exactly.
 * ponytail: employer-side contributions (employer EOBI/PF) are not in the payroll items,
 * so they are not journaled — add when Phase 2's employer cost lines exist.
 */
export function buildJournal(
  items: JournalItem[],
  period: string,
  accounts: Partial<JournalAccounts> = {},
) {
  const a = { ...DEFAULT_ACCOUNTS, ...accounts };
  const sum = (pick: (i: JournalItem) => unknown) => items.reduce((s, i) => s + cents(pick(i)), 0);
  const gross = sum((i) => i.grossSalary);
  const net = sum((i) => i.netSalary);
  const tax = sum((i) => i.taxAmount);
  const eobi = sum((i) => i.eobiAmount);
  const pf = sum((i) => i.pfAmount);
  // Reimbursements are paid on top of net pay and are not part of gross.
  const reimb = sum((i) => (i.breakdown as any)?.reimbursements);
  // Everything else taken out of gross (loans, advances, other deductions).
  const other = gross + reimb - net - tax - eobi - pf;

  const memo = `Payroll ${period}`;
  const rows: Row[] = [{ account: a.salaryExpense, debit: gross, credit: 0, memo }];
  if (reimb) rows.push({ account: a.reimbursements, debit: reimb, credit: 0, memo: `${memo} (expense reimbursements)` });
  if (tax) rows.push({ account: a.incomeTaxPayable, debit: 0, credit: tax, memo });
  if (eobi) rows.push({ account: a.eobiPayable, debit: 0, credit: eobi, memo });
  if (pf) rows.push({ account: a.pfPayable, debit: 0, credit: pf, memo });
  if (other > 0) rows.push({ account: a.recoveries, debit: 0, credit: other, memo });
  if (other < 0) rows.push({ account: a.recoveries, debit: -other, credit: 0, memo: `${memo} (adjustment)` });
  rows.push({ account: a.salariesPayable, debit: 0, credit: net, memo });

  const debits = rows.reduce((s, r) => s + r.debit, 0);
  const credits = rows.reduce((s, r) => s + r.credit, 0);

  const journalNo = `PAY-${period}`;
  const date = periodEnd(period);
  const header = '*JournalNo,*JournalDate,*AccountName,Debits,Credits,Description';
  const lines = rows.map((r) =>
    [journalNo, date, csv(r.account), r.debit ? money(r.debit) : '', r.credit ? money(r.credit) : '', csv(r.memo)].join(','),
  );

  return {
    journalNo,
    date,
    content: [header, ...lines].join('\n'),
    balanced: debits === credits,
    totals: { debit: debits / 100, credit: credits / 100, gross: gross / 100, net: net / 100 },
    rows: rows.length,
  };
}
