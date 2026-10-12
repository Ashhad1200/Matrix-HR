import { test, expect } from '@playwright/test';
import { randomUUID } from 'crypto';
import { accounts, api } from '../lib';

const tag = `ZZ-TEST-${Date.now().toString(36)}`;
const sub = () => `zz-p-${Math.random().toString(36).slice(2, 8)}`;

test.describe('Platform operator: tenants, plans, subscription, overrides', () => {
  let tenantId = '';
  test('create tenant: validation, duplicate subdomain, then read', async () => {
    expect((await api('superadmin', '/platform/tenants', 'POST', {})).status).toBe(400);
    const s = sub();
    const r = await api('superadmin', '/platform/tenants', 'POST', { companyName: `${tag} Co`, subdomain: s, adminEmail: `${s}@qa.test` });
    expect(r.status, JSON.stringify(r.body)).toBeLessThan(300);
    tenantId = r.body.tenant?.id ?? r.body.id;
    const dup = await api('superadmin', '/platform/tenants', 'POST', { companyName: `${tag} Co2`, subdomain: s, adminEmail: `x${s}@qa.test` });
    expect(dup.status, 'duplicate subdomain').toBeGreaterThanOrEqual(400);
    expect(dup.status).toBeLessThan(500);
    expect((await api('superadmin', `/platform/tenants/${tenantId}`)).status).toBe(200);
    expect(JSON.stringify((await api('superadmin', '/platform/tenants')).body)).toContain(tenantId);
    expect((await api('admin', '/platform/tenants')).status).toBe(403);
    expect((await api('superadmin', '/platform/tenants/nope-zz')).status).toBe(404);
  });
  test('subscription status, plan assignment, overrides', async () => {
    const plans = await api('superadmin', '/platform/plans');
    expect(plans.status).toBe(200);
    expect((await api('superadmin', `/platform/tenants/${tenantId}/subscription`, 'POST', { planCode: 'growth' })).status).toBeLessThan(300);
    expect((await api('superadmin', `/platform/tenants/${tenantId}/subscription`, 'POST', { planCode: 'does-not-exist' })).status).toBeGreaterThanOrEqual(400);
    expect((await api('superadmin', `/platform/tenants/${tenantId}/subscription/status`, 'PATCH', { status: 'bogus' })).status).toBe(400);
    expect((await api('superadmin', `/platform/tenants/${tenantId}/subscription/status`, 'PATCH', { status: 'suspended' })).status).toBeLessThan(300);
    const ov = await api('superadmin', `/platform/tenants/${tenantId}/overrides`, 'POST', { featureKey: 'ai.ask', enabled: true, reason: 'ZZ test override' });
    expect(ov.status, JSON.stringify(ov.body)).toBeLessThan(300);
    expect((await api('superadmin', `/platform/tenants/${tenantId}/overrides/${ov.body.id}`, 'DELETE')).status).toBeLessThan(300);
    expect((await api('superadmin', `/platform/tenants/${tenantId}/subscription/status`, 'PATCH', { status: 'active' })).status).toBeLessThan(300);
    expect((await api('superadmin', '/platform/audit')).status).toBe(200);
    expect(JSON.stringify((await api('superadmin', '/platform/audit')).body)).toContain('SET_SUBSCRIPTION_STATUS');
  });
  test('a suspended company cannot use the app', async () => {
    const A = accounts();
    expect((await api('superadmin', `/platform/tenants/${A.tenantB}/subscription/status`, 'PATCH', { status: 'suspended' })).status).toBeLessThan(300);
    const me = await api('adminB', '/leave/policies');
    expect(me.status, 'suspended tenant still served').toBeGreaterThanOrEqual(400);
    expect((await api('superadmin', `/platform/tenants/${A.tenantB}/subscription/status`, 'PATCH', { status: 'active' })).status).toBeLessThan(300);
    expect((await api('adminB', '/leave/policies')).status).toBe(200);
  });
});

test.describe('Billing backoffice', () => {
  test('payment account CRUD, settings, plan/pack edit, grants are idempotent', async () => {
    const c = await api('superadmin', '/platform/billing/accounts', 'POST', { label: `${tag} bank`, bankName: 'ZZ Bank', accountTitle: 'ZZ Test', iban: 'PK00ZZ0000000000', currency: 'USD' });
    expect(c.status, JSON.stringify(c.body)).toBeLessThan(300);
    expect((await api('superadmin', '/platform/billing/accounts', 'POST', { label: 'x' })).status).toBe(400);
    expect((await api('superadmin', `/platform/billing/accounts/${c.body.id}`, 'PATCH', { label: `${tag} bank 2`, isActive: false })).status).toBeLessThan(300);
    expect(JSON.stringify((await api('superadmin', '/platform/billing/accounts')).body)).toContain(`${tag} bank 2`);
    expect((await api('admin', '/platform/billing/accounts')).status).toBe(403);
    expect((await api('superadmin', '/platform/billing/settings', 'PUT', { graceDays: 99 })).status, 'grace days upper bound').toBe(400);
    expect((await api('superadmin', '/platform/billing/settings')).status).toBe(200);

    const key = randomUUID();
    const g1 = await api('superadmin', `/platform/billing/tenants/${accounts().tenantB}/credits`, 'POST', { credits: 7, reason: 'ZZ test grant', idempotencyKey: key });
    const g2 = await api('superadmin', `/platform/billing/tenants/${accounts().tenantB}/credits`, 'POST', { credits: 7, reason: 'ZZ test grant', idempotencyKey: key });
    expect(g1.status, JSON.stringify(g1.body)).toBeLessThan(300);
    expect(g2.body.applied, 'the same key must grant once').toBe(false);
    expect((await api('superadmin', `/platform/billing/tenants/${accounts().tenantB}/credits`, 'POST', { credits: -5, reason: 'ZZ negative', idempotencyKey: randomUUID() })).status).toBe(400);
    expect((await api('superadmin', `/platform/billing/tenants/nope-zz/credits`, 'POST', { credits: 5, reason: 'ZZ missing', idempotencyKey: randomUUID() })).status).toBe(404);
    expect((await api('superadmin', '/platform/billing/plans')).status).toBe(200);
    expect((await api('superadmin', '/platform/billing/packs')).status).toBe(200);
    expect((await api('superadmin', '/platform/billing/clock-report')).status).toBe(200);
  });
  test('tenant payment request: quote is server-computed, one open request, cancel, other tenant blocked', async () => {
    const q = await api('admin', '/billing/quote', 'POST', { purpose: 'plan', planCode: 'starter', period: 'monthly' });
    expect(q.status, JSON.stringify(q.body)).toBeLessThan(300);
    const forged = await api('admin', '/billing/quote', 'POST', { purpose: 'plan', planCode: 'starter', period: 'monthly', expectedAmount: 1 });
    expect(forged.status === 400 || Number(forged.body.expectedAmount ?? forged.body.total ?? q.body.expectedAmount) === Number(q.body.expectedAmount), 'a client-sent amount must be ignored or refused').toBe(true);
    const acct = (await api('superadmin', '/platform/billing/accounts')).body.find((a: any) => a.isActive);
    const open = await api('admin', '/billing/requests', 'POST', { purpose: 'plan', planCode: 'starter', period: 'monthly', accountId: acct?.id });
    if (acct) {
      expect(open.status, JSON.stringify(open.body)).toBeLessThan(300);
      const second = await api('admin', '/billing/requests', 'POST', { purpose: 'plan', planCode: 'growth', period: 'monthly', accountId: acct.id });
      expect(second.status, 'only one open request per purpose').toBe(409);
      expect([403, 404]).toContain((await api('adminB', `/billing/requests/${open.body.id}`)).status);
      expect([403, 404]).toContain((await api('adminB', `/billing/requests/${open.body.id}/cancel`, 'POST')).status);
      expect((await api('admin', `/billing/requests/${open.body.id}/cancel`, 'POST')).status).toBeLessThan(300);
    }
    expect((await api('employee', '/billing/state')).status).toBe(403);
    expect((await api('manager', '/billing/requests', 'POST', {})).status).toBe(403);
  });
});

test.describe('AI settings and chat access', () => {
  test('only the operator reads/writes AI settings; keys never come back', async () => {
    expect((await api('admin', '/platform/ai/settings')).status).toBe(403);
    const s = await api('superadmin', '/platform/ai/settings');
    expect(s.status).toBe(200);
    expect(JSON.stringify(s.body)).not.toMatch(/sk-|enc:v1/);
    expect((await api('superadmin', '/platform/ai/settings', 'PUT', { openaiModel: 'gpt-unpriced-zz' })).status).toBe(400);
    expect((await api('superadmin', '/platform/ai/settings', 'PUT', { provider: 'bogus' })).status).toBe(400);
  });
  test('company toggle: HR/admin only; chat refused when off; conversation privacy', async () => {
    expect((await api('employee', '/ai/tenant', 'PUT', { enabled: false })).status).toBe(403);
    expect((await api('hr', '/ai/tenant', 'PUT', { enabled: false })).status).toBeLessThan(300);
    expect((await api('employee', '/ai/chat', 'POST', { message: 'hi' })).status).toBe(403);
    expect((await api('hr', '/ai/tenant', 'PUT', { enabled: true })).status).toBeLessThan(300);
    expect((await api('employee', '/ai/conversations/zz-nonexistent')).status).toBe(404);
    expect((await api('employee', '/ai/actions/zz-nonexistent/confirm', 'POST')).status).toBe(404);
    expect((await api('employee', '/ai/chat', 'POST', { message: 'x'.repeat(5000) })).status).toBe(400);
  });
});
