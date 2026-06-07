import { PAKISTAN_TAX_SLABS_2025, EOBI_EMPLOYEE_RATE, EOBI_MIN_WAGE } from '@matrixhr/shared';

describe('Pakistan Payroll Constants', () => {
  it('should have correct tax slabs', () => {
    expect(PAKISTAN_TAX_SLABS_2025[0].rate).toBe(0);
    expect(PAKISTAN_TAX_SLABS_2025[0].max).toBe(600000);
  });

  it('should have correct EOBI rates', () => {
    expect(EOBI_EMPLOYEE_RATE).toBe(0.01);
    expect(EOBI_MIN_WAGE).toBe(37000);
  });
});
