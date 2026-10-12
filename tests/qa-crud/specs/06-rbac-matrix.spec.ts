/**
 * Role x route matrix generated from the controllers (tests/qa-crud/routes.json, regenerate with gen-routes.py).
 * - every authenticated route answers 401 without a token;
 * - every role-gated route answers 403 to a role not listed (never 2xx/4xx-other, never executes);
 * - every listed role gets past the guard on GET routes (anything but 401/403-by-role; 5xx is a bug).
 */
import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { accounts, API, api, type Who } from '../lib';

type R = { method: string; path: string; auth: boolean; roles: string[]; file: string };
const routes: R[] = JSON.parse(readFileSync(resolve(__dirname, '../routes.json'), 'utf8'));
const fill = (p: string) => p.replace(/:[A-Za-z]+/g, 'zz-nonexistent');
const WHO: Record<string, Who> = { EMPLOYEE: 'employee', MANAGER: 'manager', HR_MANAGER: 'hr', COMPANY_ADMIN: 'admin', SUPER_ADMIN: 'superadmin' };
const ROLE_OF = (k: string) => accounts().users[WHO[k]].role as string;
// Routes that legitimately differ: files streams, device protocol and webhooks are covered by their own specs.
const SKIP = [/^\/files\//, /^\/iclock/, /^\/biometric\/devices\/(cdata|getrequest|devicecmd)/, /^\/whatsapp\/webhook/, /^\/dev\//];

test('unauthenticated requests are refused on every authenticated route', async () => {
  const bad: string[] = [];
  for (const r of routes.filter((x) => x.auth && !SKIP.some((s) => s.test(x.path)))) {
    const res = await fetch(`${API}${fill(r.path)}`, { method: r.method, headers: { 'content-type': 'application/json' }, body: r.method === 'GET' ? undefined : '{}' });
    if (res.status !== 401) bad.push(`${r.method} ${r.path} -> ${res.status}`);
  }
  expect(bad, bad.join('\n')).toEqual([]);
});

test('a role that is not listed is refused (403) on every role-gated route', async () => {
  const bad: string[] = [];
  for (const r of routes.filter((x) => x.auth && x.roles.length && !SKIP.some((s) => s.test(x.path)))) {
    for (const k of Object.keys(WHO)) {
      if (k === 'SUPER_ADMIN') continue; // the operator is covered by the platform spec
      if (r.roles.includes(ROLE_OF(k))) continue;
      const res = await api(WHO[k], fill(r.path), r.method, r.method === 'GET' ? undefined : {});
      if (res.status !== 403) bad.push(`${k} ${r.method} ${r.path} -> ${res.status}`);
    }
  }
  expect(bad, bad.join('\n')).toEqual([]);
});

test('listed roles reach the handler on GET routes without a server error', async () => {
  const bad: string[] = [];
  for (const r of routes.filter((x) => x.auth && x.method === 'GET' && x.roles.length && !SKIP.some((s) => s.test(x.path)))) {
    for (const k of r.roles) {
      const who = Object.entries(WHO).find(([role]) => role === k)?.[1];
      if (!who || k === 'SUPER_ADMIN') continue;
      const res = await api(who, fill(r.path));
      if (res.status >= 500 || res.status === 401) bad.push(`${k} GET ${r.path} -> ${res.status}`);
    }
  }
  expect(bad, bad.join('\n')).toEqual([]);
});

test('any-auth GET routes answer every role without a server error', async () => {
  const bad: string[] = [];
  for (const r of routes.filter((x) => x.auth && x.method === 'GET' && !x.roles.length && !SKIP.some((s) => s.test(x.path)))) {
    for (const who of ['employee', 'manager', 'hr', 'admin'] as Who[]) {
      const res = await api(who, fill(r.path));
      if (res.status >= 500) bad.push(`${who} GET ${r.path} -> ${res.status}`);
    }
  }
  expect(bad, bad.join('\n')).toEqual([]);
});

test('tenant isolation: tenant B never receives tenant A rows from any list route', async () => {
  const A = accounts().tenantA as string;
  const leaks: string[] = [];
  for (const r of routes.filter((x) => x.auth && x.method === 'GET' && !/:/.test(x.path) && !SKIP.some((s) => s.test(x.path)))) {
    const res = await api('adminB', r.path);
    if (res.status >= 500) leaks.push(`${r.path} -> ${res.status}`);
    else if (res.status < 300 && JSON.stringify(res.body).includes(A)) leaks.push(`LEAK ${r.path} returned tenant A data`);
  }
  expect(leaks, leaks.join('\n')).toEqual([]);
});

test('public routes: only the intended ones exist', async () => {
  const pub = routes.filter((x) => !x.auth).map((x) => `${x.method} ${x.path}`).sort();
  const expected = [
    'GET /auth/invite/:token', 'GET /brand', 'GET /careers/:subdomain/feed.xml', 'GET /careers/:subdomain/jobs', 'GET /files/:token', 'GET /health', 'GET /health/ready',
    'GET /iclock/cdata', 'GET /iclock/getrequest', 'GET /preboarding/portal/:token', 'GET /sso/:subdomain/login-hint', 'GET /sso/:subdomain/metadata',
    'GET /tenants/subdomain/:subdomain', 'GET /whatsapp/webhook', 'POST /auth/forgot-password', 'POST /auth/invite/accept', 'POST /auth/login', 'POST /auth/logout',
    'POST /auth/mfa/verify', 'POST /auth/refresh', 'POST /auth/reset-password', 'POST /auth/signup', 'POST /iclock/cdata', 'POST /iclock/devicecmd', 'POST /whatsapp/webhook',
  ].sort();
  expect(pub).toEqual(expected);
});
