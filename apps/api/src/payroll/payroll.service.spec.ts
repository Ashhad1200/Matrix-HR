import { PayrollService } from './payroll.service';

describe('PayrollService', () => {
  let service: PayrollService;

  beforeEach(() => {
    service = new PayrollService(null as any);
  });

  describe('calculateMonthlyTax', () => {
    it('should return 0 tax for salary below 600000 annual', () => {
      expect(service.calculateMonthlyTax(500000)).toBe(0);
    });

    it('should calculate tax for 2.4M annual salary (200k/month)', () => {
      const monthlyTax = service.calculateMonthlyTax(2400000);
      expect(monthlyTax).toBeGreaterThan(0);
    });

    it('should calculate higher tax for higher salary', () => {
      const tax1 = service.calculateMonthlyTax(1200000);
      const tax2 = service.calculateMonthlyTax(3600000);
      expect(tax2).toBeGreaterThan(tax1);
    });
  });

  describe('calculateEobi', () => {
    it('should calculate 1% employee and 5% employer on min wage', () => {
      const result = service.calculateEobi(30000);
      expect(result.employee).toBe(Math.round(37000 * 0.01));
      expect(result.employer).toBe(Math.round(37000 * 0.05));
    });
  });

  describe('calculatePf', () => {
    it('should calculate 8% PF by default', () => {
      const result = service.calculatePf(200000);
      expect(result.employee).toBe(16000);
      expect(result.employer).toBe(16000);
    });
  });
});
