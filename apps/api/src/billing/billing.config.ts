import { brand, docPrefix } from '../common/brand';
/** Who issues receipts. One place, shown on every receipt and served to the web app. Edit here only. */
export const RECEIPT_ISSUER = {
  name: 'TREEVOXA',
  legalForm: 'An Association of Persons (partnership firm) registered with FBR Pakistan',
  ntn: 'J883480',
  address: 'Plot No. R-326, Hansa Society, Scheme-33, Karachi East, Karachi, Sindh, Pakistan',
  email: 'support@treevoxa.com',
  // The exact line the owner supplied, used where a single string is needed.
  text:
    'TREEVOXA, an Association of Persons (partnership firm) registered with FBR Pakistan, NTN J883480, ' +
    'Plot No. R-326, Hansa Society, Scheme-33, Karachi East, Karachi, Sindh, Pakistan. support@treevoxa.com',
} as const;

/** Issuer printed on receipts. White-label deployments show the reseller instead of the platform owner. */
export function receiptIssuer() {
  const b = brand();
  if (!b.whiteLabel) return RECEIPT_ISSUER;
  const legal = process.env.WL_LEGAL_TEXT?.trim();
  return { name: b.name, legalForm: legal ?? '', ntn: '', address: '', email: b.supportEmail, text: [b.name, legal, b.supportEmail].filter(Boolean).join(', ') };
}

export const PROOF_MAX_BYTES = 5 * 1024 * 1024;
export const PROVISIONAL_DEFAULT_HOURS = 72;
export const GRACE_DEFAULT_DAYS = 3;
import { TRIAL_DAYS, TRIAL_CREDITS } from '@matrixhr/shared';
export { TRIAL_DAYS, TRIAL_CREDITS };
export const OPEN_REQUEST_STATUSES = ['AWAITING_PROOF', 'PENDING'] as const;
/** No 0/O/1/I so a reference read off a phone or typed into a bank note survives. */
export const REFERENCE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export type ProofKind = { mime: 'image/png' | 'image/jpeg' | 'image/webp' | 'application/pdf'; ext: 'png' | 'jpg' | 'webp' | 'pdf' };

/** Identify a proof by its real bytes. The client-supplied extension and Content-Type are never trusted. */
export function sniffProof(buf: Buffer): ProofKind | null {
  if (buf.length < 12) return null;
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { mime: 'image/png', ext: 'png' };
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { mime: 'image/jpeg', ext: 'jpg' };
  if (buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') return { mime: 'image/webp', ext: 'webp' };
  if (buf.subarray(0, 5).toString('latin1') === '%PDF-') return { mime: 'application/pdf', ext: 'pdf' };
  return null;
}

export const receiptNumber = (year: number, n: number) => `${docPrefix()}-R-${year}-${String(n).padStart(6, '0')}`;
