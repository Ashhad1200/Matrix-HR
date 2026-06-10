import { Injectable, BadRequestException } from '@nestjs/common';

/**
 * Employer-of-Record catalog. Employer cost multipliers approximate
 * statutory employer burdens (social security, severance accruals, etc.)
 * and a flat EOR management fee per worker.
 */
const REGION_DEFAULTS: Record<string, { employerCostPct: number; fee: number }> = {
  'North America': { employerCostPct: 12, fee: 449 },
  'South America': { employerCostPct: 32, fee: 499 },
  Europe: { employerCostPct: 24, fee: 549 },
  Africa: { employerCostPct: 18, fee: 449 },
  Asia: { employerCostPct: 16, fee: 399 },
  Oceania: { employerCostPct: 14, fee: 499 },
  'Middle East': { employerCostPct: 13, fee: 499 },
};

const COUNTRY_OVERRIDES: Record<string, Partial<{ employerCostPct: number; fee: number; currency: string }>> = {
  PK: { employerCostPct: 12, fee: 299, currency: 'PKR' },
  IN: { employerCostPct: 17, fee: 349, currency: 'INR' },
  US: { employerCostPct: 11, fee: 599, currency: 'USD' },
  GB: { employerCostPct: 15, fee: 549, currency: 'GBP' },
  DE: { employerCostPct: 21, fee: 599, currency: 'EUR' },
  FR: { employerCostPct: 45, fee: 649, currency: 'EUR' },
  BR: { employerCostPct: 68, fee: 599, currency: 'BRL' },
  AE: { employerCostPct: 13, fee: 499, currency: 'AED' },
  SA: { employerCostPct: 12, fee: 549, currency: 'SAR' },
  SG: { employerCostPct: 17, fee: 499, currency: 'SGD' },
  AU: { employerCostPct: 16, fee: 549, currency: 'AUD' },
  CA: { employerCostPct: 13, fee: 549, currency: 'CAD' },
  NL: { employerCostPct: 23, fee: 599, currency: 'EUR' },
  ES: { employerCostPct: 30, fee: 549, currency: 'EUR' },
  PL: { employerCostPct: 20, fee: 449, currency: 'PLN' },
  PH: { employerCostPct: 12, fee: 349, currency: 'PHP' },
  ID: { employerCostPct: 10, fee: 349, currency: 'IDR' },
  BD: { employerCostPct: 8, fee: 299, currency: 'BDT' },
  EG: { employerCostPct: 26, fee: 399, currency: 'EGP' },
  NG: { employerCostPct: 12, fee: 399, currency: 'NGN' },
  KE: { employerCostPct: 11, fee: 399, currency: 'KES' },
  TR: { employerCostPct: 23, fee: 449, currency: 'TRY' },
  JP: { employerCostPct: 16, fee: 649, currency: 'JPY' },
  KR: { employerCostPct: 11, fee: 599, currency: 'KRW' },
  CN: { employerCostPct: 38, fee: 599, currency: 'CNY' },
  MX: { employerCostPct: 30, fee: 499, currency: 'MXN' },
};

const COUNTRIES: { code: string; region: string }[] = [
  // North America & Caribbean
  ...['US', 'CA', 'MX', 'GT', 'CR', 'PA', 'DO', 'JM', 'TT', 'BS', 'BB', 'HN', 'SV', 'NI', 'BZ'].map((code) => ({ code, region: 'North America' })),
  // South America
  ...['BR', 'AR', 'CL', 'CO', 'PE', 'EC', 'UY', 'PY', 'BO', 'VE', 'GY', 'SR'].map((code) => ({ code, region: 'South America' })),
  // Europe
  ...['GB', 'DE', 'FR', 'ES', 'IT', 'PT', 'NL', 'BE', 'LU', 'IE', 'DK', 'SE', 'NO', 'FI', 'IS', 'PL', 'CZ', 'SK', 'HU', 'RO', 'BG', 'GR', 'HR', 'SI', 'AT', 'CH', 'EE', 'LV', 'LT', 'UA', 'RS', 'BA', 'MK', 'AL', 'MD', 'GE', 'AM', 'AZ', 'CY', 'MT'].map((code) => ({ code, region: 'Europe' })),
  // Africa
  ...['NG', 'KE', 'ZA', 'EG', 'MA', 'TN', 'DZ', 'GH', 'CI', 'SN', 'CM', 'UG', 'TZ', 'RW', 'ET', 'ZM', 'ZW', 'BW', 'NA', 'MZ', 'AO', 'MU', 'SC', 'TG', 'BJ', 'ML', 'BF', 'NE', 'GA', 'CG'].map((code) => ({ code, region: 'Africa' })),
  // Asia
  ...['PK', 'IN', 'BD', 'LK', 'NP', 'CN', 'JP', 'KR', 'SG', 'MY', 'TH', 'VN', 'PH', 'ID', 'KH', 'LA', 'MM', 'MN', 'KZ', 'UZ', 'KG', 'TJ', 'TM', 'AF', 'BT', 'MV', 'BN', 'TL', 'HK', 'TW', 'MO'].map((code) => ({ code, region: 'Asia' })),
  // Middle East
  ...['AE', 'SA', 'QA', 'KW', 'BH', 'OM', 'JO', 'LB', 'IL', 'IQ', 'TR', 'YE'].map((code) => ({ code, region: 'Middle East' })),
  // Oceania
  ...['AU', 'NZ', 'FJ', 'PG', 'SB', 'VU', 'WS', 'TO'].map((code) => ({ code, region: 'Oceania' })),
];

@Injectable()
export class EorService {
  private displayNames = new Intl.DisplayNames(['en'], { type: 'region' });

  getCountries() {
    const countries = COUNTRIES.map(({ code, region }) => {
      const defaults = REGION_DEFAULTS[region];
      const override = COUNTRY_OVERRIDES[code] ?? {};
      return {
        code,
        name: this.displayNames.of(code) ?? code,
        region,
        currency: override.currency ?? 'USD',
        employerCostPct: override.employerCostPct ?? defaults.employerCostPct,
        monthlyFee: override.fee ?? defaults.fee,
      };
    }).sort((a, b) => a.name.localeCompare(b.name));

    return { total: countries.length, countries };
  }

  getQuote(countryCode: string, monthlySalary: number) {
    if (!countryCode || !monthlySalary || monthlySalary <= 0) {
      throw new BadRequestException('countryCode and a positive monthlySalary are required');
    }
    const { countries } = this.getCountries();
    const country = countries.find((c) => c.code === countryCode.toUpperCase());
    if (!country) throw new BadRequestException(`Country ${countryCode} is not supported`);

    const employerCosts = Math.round(monthlySalary * (country.employerCostPct / 100));
    const totalMonthly = monthlySalary + employerCosts + country.monthlyFee;

    return {
      country,
      monthlySalary,
      employerCosts,
      eorFee: country.monthlyFee,
      totalMonthlyCost: totalMonthly,
      totalAnnualCost: totalMonthly * 12,
      note: 'Estimate only. Statutory employer burdens vary with salary bands and local rules.',
    };
  }
}
