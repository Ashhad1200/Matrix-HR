import { buildPkIban, isValidPkIban } from './iban';
import { buildBankFile } from './bank-file';
import { buildJournal } from './journal';

const goodIban = buildPkIban('MEZN', '0001234567890123');
const emp = (code: string, iban: string | null, extra = {}) => ({
  netSalary: 50000,
  employee: { employeeCode: code, firstName: 'A', lastName: 'B', iban, bankAccount: null, ...extra },
});

describe('IBAN', () => {
  it('generates IBANs that validate, and rejects tampered ones', () => {
    expect(goodIban).toHaveLength(24);
    expect(isValidPkIban(goodIban)).toBe(true);
    expect(isValidPkIban(goodIban.replace(/.$/, (c) => (c === '0' ? '1' : '0')))).toBe(false);
    expect(isValidPkIban('PK36MEZN100000000000')).toBe(false); // the old 20-char seed value
    expect(isValidPkIban('GB82WEST12345698765432')).toBe(false); // valid IBAN, wrong country
  });
});

describe('buildBankFile', () => {
  it('includes valid rows and reports (not silently ships) bad ones', () => {
    const result = buildBankFile(
      [emp('E1', goodIban), emp('E2', null), emp('E3', 'PK00BAD'), emp('E4', goodIban), { ...emp('E5', goodIban.replace(/\d{16}$/, '9999999999999999')), netSalary: 0 }],
      '2026-09',
      'meezan',
    );
    expect(result.summary).toEqual({ included: 1, excluded: 4, totalAmount: 50000 });
    expect(result.excluded.map((x) => x.employeeCode)).toEqual(['E2', 'E3', 'E4', 'E5']);
    expect(result.excluded.find((x) => x.employeeCode === 'E4')!.problem).toMatch(/already used by E1/);
    expect(result.content.split('\n')).toHaveLength(1);
    expect(result.validated).toBe(false);
  });

  it('strips separators from names so a row cannot break the file', () => {
    const r = buildBankFile([emp('E1', goodIban, { firstName: 'Ali,Khan', lastName: 'x|y' })], '2026-09', 'meezan');
    expect(r.content.split(',')).toHaveLength(4);
  });
});

describe('buildJournal', () => {
  const item = (gross: number, tax: number, eobi: number, pf: number, net: number) => ({
    grossSalary: gross, taxAmount: tax, eobiAmount: eobi, pfAmount: pf, netSalary: net,
  });

  it('always balances, folding loans/other deductions into recoveries', () => {
    const j = buildJournal([item(100000, 5000, 370, 8000, 80000), item(50000.55, 0, 370, 4000, 45000.33)], '2026-09');
    expect(j.balanced).toBe(true);
    expect(j.totals.debit).toBe(j.totals.credit);
    expect(j.content).toContain('Employee Recoveries');
    expect(j.date).toBe('2026-09-30');
  });

  it('omits empty lines and honours custom account names with commas', () => {
    const j = buildJournal([item(1000, 0, 0, 0, 1000)], '2026-02', { salaryExpense: 'Wages, Payroll' });
    expect(j.content).toContain('"Wages, Payroll"');
    expect(j.content).not.toContain('Tax Payable');
    expect(j.date).toBe('2026-02-28');
    expect(j.balanced).toBe(true);
  });
});
