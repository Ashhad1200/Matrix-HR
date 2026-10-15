/**
 * End-to-end: the REAL agent Runner (with the mock capture) against a RUNNING MatrixHR API.
 * Pairs a device the proper way (admin enables monitoring → employee consents → pairs), runs the Runner for a few
 * short windows, then confirms the server stored the samples and the rollup shows them. Run: tsx test/live-ingest.e2e.ts
 */
import assert from 'node:assert/strict';
import { Runner } from '../src/runner';
import { createMockCapture } from '../src/capture/mock';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const API = process.env.API_URL || 'http://localhost:3001/api/v1';
const PASS = 'Password123!';
const login = async (email: string) => {
  const r = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: PASS }) });
  return (await r.json()).accessToken as string;
};
const authed = (token: string) => async (path: string, method = 'GET', body?: unknown) => {
  const r = await fetch(`${API}${path}`, { method, headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: body === undefined ? undefined : JSON.stringify(body) });
  const t = await r.text(); let j: any; try { j = JSON.parse(t); } catch { j = t; }
  return { status: r.status, body: j };
};

async function main() {
  const adminT = await login('admin@acme.com');
  const empEmail = 'sara.ahmed@acme.com';
  const empT = await login(empEmail);
  const admin = authed(adminT); const emp = authed(empT);

  // 1. enable monitoring (all-day window so nothing is filtered), employee consents
  const s = await admin('/monitoring/settings', 'PUT', { enabled: true, policyText: 'E2E policy: time and activity only.', workdayStartMin: 0, workdayEndMin: 1439, trackApps: true, trackDomains: true });
  assert.ok(s.status < 300, 'enable settings: ' + JSON.stringify(s.body));
  await emp('/monitoring/me/consent', 'POST');

  // 2. pair a device the real way → one-time token
  const paired = await emp('/monitoring/me/devices', 'POST', { name: `agent-e2e-${Date.now()}`, platform: process.platform });
  assert.ok(paired.status < 300, 'pair: ' + JSON.stringify(paired.body));
  const token: string = paired.body.token;
  assert.ok(token.startsWith('mon_'));
  const deviceId: string = paired.body.deviceId;

  // 3. run the actual Runner with a mock capture and short windows, pointed at the live server
  const dir = mkdtempSync(join(tmpdir(), 'agent-e2e-'));
  const cfg = { serverUrl: API, deviceToken: token, deviceName: 'e2e', windowSeconds: 2, flushSeconds: 2, idleThresholdSeconds: 60 };
  const logs: string[] = [];
  const runner = new Runner(cfg as any, createMockCapture({ app: 'Code.exe', domain: 'github.com' }), (m) => logs.push(m), join(dir, 'queue.json'));
  runner.start();
  await new Promise((r) => setTimeout(r, 7000)); // ~3 windows
  await runner.stop();
  assert.ok(logs.some((l) => l.startsWith('sent ')), 'agent should have sent at least one batch; logs=' + JSON.stringify(logs));

  // 4. the server has samples for this device, and the rollup produces a summary with activity
  await admin('/monitoring/run-maintenance', 'POST');
  const devices = (await admin('/monitoring/devices')).body as any[];
  const dev = devices.find((d) => d.id === deviceId);
  assert.ok(dev, 'device present on server');
  assert.ok(dev.lastSeenAt, 'server recorded lastSeenAt from the agent');
  assert.equal(dev.agentVersion, '0.1.0');

  const me = (await emp('/monitoring/me')).body;
  assert.ok(me.today, 'employee has a summary today');
  assert.ok(me.today.activeSeconds > 0, 'active seconds recorded, got ' + me.today.activeSeconds);
  assert.ok(me.today.mouseEvents > 0 && me.today.keyboardEvents > 0, 'event counts recorded');

  console.log(`PASS — agent sent batches; server active=${me.today.activeSeconds}s mouse=${me.today.mouseEvents} kb=${me.today.keyboardEvents}; device online via agent v${dev.agentVersion}`);
}
main().catch((e) => { console.error('FAIL', e); process.exit(1); });
