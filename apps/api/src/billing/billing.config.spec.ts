import { sniffProof, receiptNumber, RECEIPT_ISSUER } from './billing.config';

const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(16)]);
const jpg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(16)]);
const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(8)]);
const pdf = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(16)]);

describe('sniffProof', () => {
  it('identifies png, jpg, webp and pdf by their bytes', () => {
    expect(sniffProof(png)?.mime).toBe('image/png');
    expect(sniffProof(jpg)?.mime).toBe('image/jpeg');
    expect(sniffProof(webp)?.mime).toBe('image/webp');
    expect(sniffProof(pdf)?.mime).toBe('application/pdf');
  });
  it('rejects a script or html renamed to .png, and truncated or empty files', () => {
    expect(sniffProof(Buffer.from('<html><script>alert(1)</script></html>'))).toBeNull();
    expect(sniffProof(Buffer.from('MZ\x90\x00 pretend exe'.padEnd(40)))).toBeNull();
    expect(sniffProof(Buffer.alloc(0))).toBeNull();
    expect(sniffProof(Buffer.from([0x89, 0x50]))).toBeNull();
  });
  it('rejects a RIFF container that is not webp (e.g. wav/avi)', () => {
    expect(sniffProof(Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WAVE'), Buffer.alloc(8)]))).toBeNull();
  });
});

describe('receipts', () => {
  it('numbers as TVX-R-YYYY-NNNNNN', () => {
    expect(receiptNumber(2026, 1)).toBe('TVX-R-2026-000001');
    expect(receiptNumber(2026, 123456)).toBe('TVX-R-2026-123456');
  });
  it('keeps the issuer text exactly as supplied by the owner', () => {
    expect(RECEIPT_ISSUER.text).toBe(
      'TREEVOXA, an Association of Persons (partnership firm) registered with FBR Pakistan, NTN J883480, Plot No. R-326, Hansa Society, Scheme-33, Karachi East, Karachi, Sindh, Pakistan. support@treevoxa.com',
    );
  });
});
