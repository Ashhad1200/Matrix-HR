import { createHash, randomBytes } from 'crypto';

/** Device tokens are random; only their SHA-256 is stored. The plaintext is shown to the employee once. */
export function newDeviceToken(): { token: string; hash: string } {
  const token = 'mon_' + randomBytes(24).toString('hex');
  return { token, hash: sha256(token) };
}
export const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

/** Minutes since local midnight in an IANA timezone (0..1439). */
export function minutesOfDayIn(timeZone: string, now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(now);
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  return (h % 24) * 60 + m;
}

/** Within the configured work window (handles a window that wraps past midnight, e.g. night shift). */
export function inWorkWindow(nowMin: number, startMin: number, endMin: number): boolean {
  if (startMin === endMin) return true;
  return startMin < endMin ? nowMin >= startMin && nowMin < endMin : nowMin >= startMin || nowMin < endMin;
}

const COMMS = ['slack', 'teams', 'zoom', 'meet', 'outlook', 'gmail', 'whatsapp', 'discord', 'skype', 'webex'];
const IDLE = ['lockapp', 'screensaver', 'idle'];
/** Coarse category from the app/domain name only. Used for the summary breakdown; never inspects content. */
export function classify(app?: string | null, domain?: string | null): string {
  const hay = `${app ?? ''} ${domain ?? ''}`.toLowerCase();
  if (!hay.trim()) return 'other';
  if (IDLE.some((k) => hay.includes(k))) return 'idle';
  if (COMMS.some((k) => hay.includes(k))) return 'communication';
  return 'work';
}
