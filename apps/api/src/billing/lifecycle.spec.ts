import { computeLifecycle, addMonths, LAPSED_ALLOWED_PATH } from './lifecycle';

const d = (s: string) => new Date(s);
const base = { graceDays: 3 };

describe('computeLifecycle', () => {
  it('never lapses a tenant that has no period end', () => {
    for (const periodEnd of [null, undefined]) {
      const l = computeLifecycle({ ...base, now: d('2030-01-01'), periodEnd });
      expect(l).toMatchObject({ state: 'none', blocked: false });
    }
  });

  it('walks ok -> due_soon -> grace -> lapsed on the boundaries', () => {
    const end = d('2026-10-31T00:00:00Z');
    const at = (iso: string) => computeLifecycle({ ...base, now: d(iso), periodEnd: end });
    expect(at('2026-10-20T00:00:00Z').state).toBe('ok');
    expect(at('2026-10-24T00:00:00Z').state).toBe('due_soon'); // exactly 7 days out
    expect(at('2026-10-31T00:00:00Z').state).toBe('due_soon'); // the end instant is still paid
    expect(at('2026-10-31T00:00:01Z').state).toBe('grace');
    expect(at('2026-11-03T00:00:00Z').state).toBe('grace'); // exactly end + 3d
    const lapsed = at('2026-11-03T00:00:01Z');
    expect(lapsed).toMatchObject({ state: 'lapsed', blocked: true });
  });

  it('respects the configured grace days', () => {
    const end = d('2026-10-31T00:00:00Z');
    expect(computeLifecycle({ now: d('2026-11-02T00:00:00Z'), periodEnd: end, graceDays: 0 }).blocked).toBe(true);
    expect(computeLifecycle({ now: d('2026-11-09T00:00:00Z'), periodEnd: end, graceDays: 10 }).blocked).toBe(false);
  });

  it('opens access while a provisional window is live, and closes it when it ends or is revoked', () => {
    const end = d('2026-10-31T00:00:00Z');
    const now = d('2026-11-10T00:00:00Z');
    const on = computeLifecycle({ ...base, now, periodEnd: end, provisionalUntil: d('2026-11-11T00:00:00Z') });
    expect(on).toMatchObject({ state: 'provisional', blocked: false });
    expect(computeLifecycle({ ...base, now, periodEnd: end, provisionalUntil: d('2026-11-09T00:00:00Z') })).toMatchObject({ state: 'lapsed', blocked: true });
    expect(computeLifecycle({ ...base, now, periodEnd: end, provisionalUntil: null })).toMatchObject({ blocked: true });
  });
});

describe('addMonths', () => {
  it('clamps to the end of a shorter month', () => {
    expect(addMonths(d('2026-01-31T00:00:00Z'), 1).toISOString().slice(0, 10)).toBe('2026-02-28');
    expect(addMonths(d('2028-01-31T00:00:00Z'), 1).toISOString().slice(0, 10)).toBe('2028-02-29');
    expect(addMonths(d('2026-03-15T00:00:00Z'), 12).toISOString().slice(0, 10)).toBe('2027-03-15');
  });
});

describe('LAPSED_ALLOWED_PATH', () => {
  it('allows only auth, billing and health', () => {
    for (const p of ['/api/v1/auth/me', '/api/v1/billing/state', '/api/v1/billing', '/api/v1/health', '/api/v1/auth/login?x=1']) expect(LAPSED_ALLOWED_PATH.test(p)).toBe(true);
    for (const p of ['/api/v1/employees', '/api/v1/payroll/runs', '/api/v1/authx/me', '/api/v1/billingx', '/api/v1/ai/chat', '/api/v1/platform/tenants']) expect(LAPSED_ALLOWED_PATH.test(p)).toBe(false);
  });
});
