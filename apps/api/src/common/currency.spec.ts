import { currencyForCountry, currencyForTimeZone, formatMoney, parseCurrencies, pickCurrency, resolveBrand } from '@matrixhr/shared';

describe('currency', () => {
  it('Pakistan pays PKR; every other country, and an unknown one, pays USD', () => {
    expect(currencyForCountry('PK')).toBe('PKR');
    expect(currencyForCountry(' pk ')).toBe('PKR');
    for (const c of ['US', 'GB', 'AE', 'IN', 'XX', '', undefined, null]) expect(currencyForCountry(c as any)).toBe('USD');
  });
  it('the Karachi time zone is the only time-zone hint for PKR', () => {
    expect(currencyForTimeZone('Asia/Karachi')).toBe('PKR');
    expect(currencyForTimeZone('Europe/London')).toBe('USD');
    expect(currencyForTimeZone(undefined)).toBe('USD');
  });
  it('formats PKR without decimals and USD with decimals only when there are cents', () => {
    expect(formatMoney('18999.00', 'PKR')).toBe('PKR 18,999');
    expect(formatMoney(189990, 'PKR')).toBe('PKR 189,990');
    expect(formatMoney('140', 'PKR')).toBe('PKR 140');
    expect(formatMoney('69.00', 'USD')).toBe('$69');
    expect(formatMoney(0.5, 'USD')).toBe('$0.50');
    expect(formatMoney('1490', 'USD')).toBe('$1,490');
    expect(formatMoney('1502.50', 'USD')).toBe('$1,502.50');
    expect(formatMoney(null, 'USD')).toBe('');
    expect(formatMoney('abc', 'USD')).toBe('');
  });
  it('WL_CURRENCIES limits what a deployment offers and pulls a company into it', () => {
    expect(parseCurrencies(undefined)).toEqual(['PKR', 'USD']);
    expect(parseCurrencies('usd')).toEqual(['USD']);
    expect(parseCurrencies('PKR, USD, EUR')).toEqual(['PKR', 'USD']);
    expect(parseCurrencies('EUR')).toEqual(['PKR', 'USD']);
    expect(pickCurrency('PKR', ['USD'])).toBe('USD');
    expect(pickCurrency('PKR', ['PKR', 'USD'])).toBe('PKR');
    expect(resolveBrand({ WL_PRODUCT_NAME: 'Acme', WL_CURRENCIES: 'PKR' }).currencies).toEqual(['PKR']);
  });
});
