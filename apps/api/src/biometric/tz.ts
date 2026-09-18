/**
 * Terminals report wall-clock time in their own zone with no offset. Convert a
 * "YYYY-MM-DD HH:mm:ss" string in an IANA timezone to the real UTC instant.
 */
export function zonedTimeToUtc(local: string, timeZone: string): Date | null {
  const m = local.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/);
  if (!m) return null;
  const [y, mo, d, h, mi, s] = m.slice(1).map(Number);
  const asUtc = Date.UTC(y, mo - 1, d, h, mi, s);
  if (Number.isNaN(asUtc)) return null;

  const offsetAt = (instant: number) => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone, hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(new Date(instant));
    const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
    const shown = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
    return shown - instant;
  };

  // Two passes handle zones whose offset differs between the guess and the answer (DST edges).
  const first = asUtc - offsetAt(asUtc);
  return new Date(asUtc - offsetAt(first));
}
