import { test, expect } from '@playwright/test';
import { accounts, api } from '../lib';

test('QA tenants and one user per role exist and can sign in', async () => {
  const a = accounts();
  for (const k of ['admin', 'hr', 'manager', 'employee', 'employee2', 'employeeB', 'adminB', 'superadmin']) {
    const me = await api(k as any, '/auth/me');
    expect(me.status, k).toBe(200);
    expect(me.body.role ?? me.body.user?.role, k).toBe(a.users[k].role);
  }
});
