/** ISO 13616 mod-97 check over an IBAN string (already stripped/uppercased). */
function mod97(iban: string): number {
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const ch of rearranged) {
    const digits = /[A-Z]/.test(ch) ? String(ch.charCodeAt(0) - 55) : ch;
    for (const d of digits) remainder = (remainder * 10 + Number(d)) % 97;
  }
  return remainder;
}

export const normalizeIban = (raw: string | null | undefined) => (raw ?? '').replace(/\s+/g, '').toUpperCase();

/** Pakistan IBANs are 24 chars: PK + 2 check digits + 4-letter bank code + 16-char account number. */
export function isValidPkIban(raw: string | null | undefined): boolean {
  const iban = normalizeIban(raw);
  return /^PK\d{2}[A-Z]{4}[A-Z0-9]{16}$/.test(iban) && mod97(iban) === 1;
}

/** Builds a valid PK IBAN for a bank code and 16-char account number (used by seed data and tests). */
export function buildPkIban(bankCode: string, account16: string): string {
  const bban = `${bankCode}${account16}`.toUpperCase();
  const provisional = `PK00${bban}`;
  const check = 98 - mod97(provisional);
  return `PK${String(check).padStart(2, '0')}${bban}`;
}
