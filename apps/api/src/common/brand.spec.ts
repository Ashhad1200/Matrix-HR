import { resolveBrand, brandPalette, brandPrefix } from '@matrixhr/shared';
import { receiptIssuer, RECEIPT_ISSUER, receiptNumber } from '../billing/billing.config';
import { PayslipPdfService } from '../payroll/payslip-pdf.service';
import { inflateSync } from 'zlib';

const WL = { WL_PRODUCT_NAME: 'Acme Payroll Cloud', WL_SUPPORT_EMAIL: 'help@acme.example', WL_PRIMARY_COLOR: '#7C3AED' };
const FORBIDDEN = /matrix\s*-?hr|treevoxa/i;

describe('brand', () => {
  afterEach(() => { for (const k of Object.keys(WL)) delete (process.env as any)[k]; delete process.env.WL_LEGAL_TEXT; });

  it('is the standard product when WL_PRODUCT_NAME is unset or blank', () => {
    expect(resolveBrand({}).whiteLabel).toBe(false);
    expect(resolveBrand({ WL_PRODUCT_NAME: '   ' }).whiteLabel).toBe(false);
    expect(resolveBrand({}).name).toBe('MatrixHR');
  });

  it('reads every setting, defaults the sender to the product name and rejects a bad colour', () => {
    const b = resolveBrand({ ...WL });
    expect(b).toMatchObject({ whiteLabel: true, name: 'Acme Payroll Cloud', emailFromName: 'Acme Payroll Cloud', supportEmail: 'help@acme.example', primaryColor: '#7c3aed' });
    expect(resolveBrand({ WL_PRODUCT_NAME: 'X', WL_PRIMARY_COLOR: 'purple' }).primaryColor).toBeNull();
    expect(resolveBrand({ WL_PRODUCT_NAME: 'X', WL_EMAIL_FROM_NAME: 'Sender' }).emailFromName).toBe('Sender');
  });

  it('never leaks the vendor into a white-label brand, even with nothing configured but the name', () => {
    expect(JSON.stringify(resolveBrand({ WL_PRODUCT_NAME: 'Acme' }))).not.toMatch(FORBIDDEN);
  });

  it('builds a 50–950 palette whose 500 is the chosen colour', () => {
    const p = brandPalette('#7c3aed');
    expect(Object.keys(p)).toHaveLength(11);
    expect(p['500']).toBe('#7c3aed');
    expect(p['50']).not.toBe(p['950']);
  });

  it('derives a receipt prefix from the product name', () => {
    expect(brandPrefix(resolveBrand({}))).toBe('TVX');
    expect(brandPrefix(resolveBrand({ WL_PRODUCT_NAME: 'Acme Payroll Cloud' }))).toBe('APC');
    expect(brandPrefix(resolveBrand({ WL_PRODUCT_NAME: 'Acme' }))).toBe('ACM');
  });

  it('issues receipts as the reseller, with their own number series', () => {
    expect(receiptIssuer()).toBe(RECEIPT_ISSUER);
    Object.assign(process.env, WL, { WL_LEGAL_TEXT: 'Acme Ltd, Dubai' });
    const issuer = receiptIssuer();
    expect(issuer.name).toBe('Acme Payroll Cloud');
    expect(JSON.stringify(issuer)).not.toMatch(FORBIDDEN);
    expect(receiptNumber(2031, 7)).toBe('APC-R-2031-000007');
  });

  it('prints the reseller on the payslip PDF (footer) and never the vendor', async () => {
    Object.assign(process.env, WL);
    const buf = await new PayslipPdfService().generate({
      tenantName: 'Client Co', period: '2031-01', employeeName: 'A B', employeeCode: 'E1',
      breakdown: { gross: 1000, net: 900, baseSalary: 1000 } as any,
    } as any);
    // PDFKit deflates content streams; inflate each and collect the text operands.
    const raw = buf.toString('latin1');
    let text = raw;
    for (const m of raw.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
      try { text += '\n' + inflateSync(Buffer.from(m[1], 'latin1')).toString('latin1'); } catch { /* not a deflate stream */ }
    }
    const strings = [...text.matchAll(/<([0-9a-fA-F]+)>/g)].map((x) => Buffer.from(x[1], 'hex').toString('latin1')).join('');
    expect(strings).not.toMatch(FORBIDDEN);
    expect(strings).toContain('Acme Payroll Cloud');
  });
});
