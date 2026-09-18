import { isValidPkIban, normalizeIban } from './iban';

export type BankFileItem = {
  netSalary: unknown;
  employee: {
    employeeCode: string;
    firstName: string;
    lastName: string;
    iban: string | null;
    bankAccount: string | null;
  };
};

export type BankFileIssue = { employeeCode: string; name: string; problem: string };

// Field separators inside a name would corrupt a CSV/pipe file, so they are stripped.
const clean = (s: string) => s.replace(/[,|\r\n"]/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * Pre-flight validation + file generation. Rows that would fail at the bank (no/invalid IBAN,
 * non-positive amount, duplicate account) are left OUT of the file and reported, so a bad
 * record can never silently ride along in a disbursement.
 * ponytail: the column layouts below are still unverified against real HBL/Meezan specs.
 */
export function buildBankFile(items: BankFileItem[], period: string, bank: string) {
  const excluded: BankFileIssue[] = [];
  const seen = new Map<string, string>();
  const lines: string[] = [];
  let total = 0;

  for (const item of items) {
    const e = item.employee;
    const name = `${e.firstName} ${e.lastName}`;
    const net = Math.round(Number(item.netSalary) * 100) / 100;
    const iban = normalizeIban(e.iban);
    const problem = !(net > 0)
      ? 'Net pay is zero or negative'
      : !iban
        ? e.bankAccount
          ? 'No IBAN on record (account-number-only payouts are not supported)'
          : 'No bank details on record'
        : !isValidPkIban(iban)
          ? 'IBAN is not a valid Pakistani IBAN (check length and check digits)'
          : seen.has(iban)
            ? `IBAN is already used by ${seen.get(iban)}`
            : null;
    if (problem) {
      excluded.push({ employeeCode: e.employeeCode, name, problem });
      continue;
    }
    seen.set(iban, e.employeeCode);
    total += net;
    const nm = clean(name);
    switch (bank) {
      case 'hbl':
        lines.push(`HBL|${iban}|${net.toFixed(2)}|${e.employeeCode}|Salary`);
        break;
      case 'meezan':
        lines.push(`${iban},${nm},${net.toFixed(2)},Salary ${period}`);
        break;
      default:
        lines.push(`${e.employeeCode},${nm},${iban},${net.toFixed(2)}`);
    }
  }

  return {
    bank,
    period,
    format: 'csv' as const,
    content: lines.join('\n'),
    // The layout itself is unconfirmed by any bank; only the data is validated.
    validated: false,
    summary: { included: lines.length, excluded: excluded.length, totalAmount: Math.round(total * 100) / 100 },
    excluded,
  };
}
