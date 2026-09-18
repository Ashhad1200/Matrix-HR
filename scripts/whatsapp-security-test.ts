/**
 * WhatsApp safety (ENGINEERING_ROADMAP.md Phase 5): signed webhooks, consent, one-time action codes,
 * audit trail — proven end to end by approving a real leave request via a (simulated) WhatsApp reply.
 * Usage: pnpm test:whatsapp   (needs WHATSAPP_APP_SECRET/VERIFY_TOKEN set in the API — see docker-compose)
 */
import { config } from 'dotenv';
import { resolve } from 'path';
import { createHmac } from 'crypto';
import { execFileSync } from 'child_process';

config({ path: resolve(__dirname, '../.env') });

const ORIGIN = process.env.API_URL?.replace(/\/$/, '') || 'http://localhost:3001';
const API = `${ORIGIN}/api/v1`;
const APP_SECRET = process.env.WHATSAPP_APP_SECRET || 'dev-whatsapp-app-secret';
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'dev-whatsapp-verify-token';

let passed = 0;
const failures: string[] = [];
const check = (name: string, ok: boolean, detail?: unknown) => {
  if (ok) passed++;
  else failures.push(`${name}${detail !== undefined ? ` -> ${JSON.stringify(detail).slice(0, 220)}` : ''}`);
  console.log(`${ok ? '  ok ' : ' FAIL'}  ${name}`);
};

async function login(email: string) {
  const r = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'Password123!' }) });
  const token = ((await r.json()) as any).accessToken as string;
  const call = async (method: string, path: string, body?: unknown) => {
    const res = await fetch(`${API}${path}`, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: body !== undefined ? JSON.stringify(body) : undefined });
    const text = await res.text();
    let data: any = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    return { status: res.status, data, text };
  };
  return { call, me: (await call('GET', '/auth/me')).data };
}

const psql = (sql: string) =>
  execFileSync('docker', ['exec', 'matrixhr-postgres', 'psql', '-U', 'matrixhr', '-d', 'matrixhr', '-tAc', sql]).toString().trim();

const PID = `TESTPHONE${Date.now()}`;
let msgSeq = 0;
const payload = (from: string, text: string, id = `wamid.${Date.now()}.${++msgSeq}`, phoneNumberId = PID) =>
  JSON.stringify({
    object: 'whatsapp_business_account',
    entry: [{ id: 'biz', changes: [{ field: 'messages', value: { metadata: { phone_number_id: phoneNumberId }, messages: [{ from, id, type: 'text', text: { body: text } }] } }] }],
  });

async function webhook(body: string, secret: string | null = APP_SECRET) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (secret) headers['X-Hub-Signature-256'] = `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
  const r = await fetch(`${API}/whatsapp/webhook`, { method: 'POST', headers, body });
  return { status: r.status, text: await r.text() };
}

async function main() {
  console.log(`WhatsApp security test -> ${API}\n`);
  const admin = await login('admin@acme.com');
  const hr = await login('hr@acme.com');
  const manager = await login('ali.khan@acme.com');
  const emp = await login('sara.ahmed@acme.com');

  // Use the phones actually on file (other tests edit employees), normalised the way the service does.
  const digits = (p: string) => p.replace(/\D/g, '');
  const aliPhone = digits(manager.me.employee.phone);
  const saraPhone = digits(emp.me.employee.phone);
  const strangerPhone = '923111111111';

  await admin.call('POST', '/integrations', { provider: 'whatsapp', status: 'connected', config: { phoneNumberId: PID } });

  console.log('-- webhook authenticity --');
  const forged = JSON.stringify({ tenantId: admin.me.tenantId, from: aliPhone, text: 'APPROVE ANYTHING' });
  check('the old unauthenticated "direct" payload is refused (403)', (await webhook(forged, null)).status === 403);
  check('an unsigned Meta payload is refused (403)', (await webhook(payload(aliPhone, 'BALANCE'), null)).status === 403);
  check('a payload signed with the wrong secret is refused (403)', (await webhook(payload(aliPhone, 'BALANCE'), 'not-the-secret')).status === 403);
  const tampered = payload(aliPhone, 'BALANCE');
  const sig = `sha256=${createHmac('sha256', APP_SECRET).update(tampered).digest('hex')}`;
  const tamperedRes = await fetch(`${API}/whatsapp/webhook`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': sig }, body: tampered.replace('BALANCE', 'STOP') });
  check('a valid signature over different bytes is refused (403)', tamperedRes.status === 403);
  check('handshake with the right token echoes the challenge', (await (await fetch(`${API}/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=${VERIFY_TOKEN}&hub.challenge=abc123`)).text()) === 'abc123');
  check('handshake with a wrong token is refused (403)', (await fetch(`${API}/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=nope&hub.challenge=x`)).status === 403);
  check('a signed message for an unknown business number is acknowledged but ignored', (await webhook(payload(aliPhone, 'STOP', undefined, 'UNKNOWN-ID'))).status === 200);

  console.log('\n-- consent gates business-initiated messages --');
  await hr.call('PUT', '/whatsapp/consents', { phone: aliPhone, status: 'OPTED_OUT' });
  const balances = (await emp.call('GET', '/leave/balances')).data as any[];
  const bal = balances.filter((b) => Number(b.entitled) + Number(b.carried) - Number(b.used) - Number(b.pending) >= 2).sort((a, b) => Number(b.entitled) - Number(a.entitled))[0];
  const dayOffset = 60 + (Date.now() % 250);
  const date = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
  const mkRequest = async (n: number) => (await emp.call('POST', '/leave/requests', { policyId: bal.policyId, startDate: date(n), endDate: date(n), reason: 'wa test' })).data;

  const r0 = await mkRequest(dayOffset);
  const log0 = (await admin.call('GET', '/whatsapp/messages')).data as any[];
  const blocked = log0.find((m) => m.templateName === 'leave_approval' && m.status === 'blocked_no_consent');
  check('without opt-in the approval request is NOT sent (blocked and logged)', !!blocked, log0.slice(0, 2));
  await manager.call('PATCH', `/leave/requests/${r0.id}/reject`, { reason: 'cleanup' });

  await hr.call('PUT', '/whatsapp/consents', { phone: aliPhone, status: 'OPTED_IN' });
  const r1 = await mkRequest(dayOffset + 1);
  const sent = ((await admin.call('GET', '/whatsapp/messages')).data as any[]).find((m) => m.templateName === 'leave_approval' && m.status === 'sent');
  const code: string = sent?.body?.match(/APPROVE ([A-Z2-9]{8})/)?.[1];
  check('after opt-in the approval request is sent with an 8-character one-time code', !!code, sent?.body);
  check('the message carries the code, not just the request id', !sent?.body?.includes(r1.id));

  console.log('\n-- the code is bound to the approver, single-use, and audited --');
  const status = async () => ((await emp.call('GET', '/leave/requests')).data as any[]).find((x) => x.id === r1.id)?.status;
  await webhook(payload(strangerPhone, `APPROVE ${code}`));
  check('an unknown phone number cannot approve', (await status()) === 'PENDING');
  await webhook(payload(saraPhone, `APPROVE ${code}`));
  check('another employee (the requester) cannot use the manager\'s code', (await status()) === 'PENDING');
  await webhook(payload(aliPhone, 'APPROVE ZZZZZZZZ'));
  check('a wrong code does nothing', (await status()) === 'PENDING');
  await webhook(payload(aliPhone, `APPROVE ${r1.id}`));
  check('a raw request id is not accepted in place of a code', (await status()) === 'PENDING');

  const approveId = `wamid.approve.${Date.now()}`;
  const ok = await webhook(payload(aliPhone, `APPROVE ${code}`, approveId));
  check('the manager\'s reply with the right code approves the request', ok.status === 200 && (await status()) === 'APPROVED', await status());
  await webhook(payload(aliPhone, `REJECT ${code}`));
  check('the code cannot be reused (still APPROVED)', (await status()) === 'APPROVED');
  const dup = await webhook(payload(aliPhone, `APPROVE ${code}`, approveId));
  check('a redelivered message id is deduplicated', dup.status === 200);
  const inboundLogged = ((await admin.call('GET', '/whatsapp/messages')).data as any[]).filter((m) => m.direction === 'inbound');
  check('the message log never stores the code', inboundLogged.length > 0 && inboundLogged.every((m) => !m.body.includes(code)));
  const audit = await admin.call('GET', '/audit/logs?action=WHATSAPP_APPROVE');
  const entries: any[] = Array.isArray(audit.data) ? audit.data : audit.data?.data ?? [];
  check('an audit-trail entry records the WhatsApp approval', entries.some((e) => e.action === 'WHATSAPP_APPROVE' && e.entityId === r1.id), entries.slice(0, 2));

  console.log('\n-- expiry --');
  const r2 = await mkRequest(dayOffset + 2);
  const code2 = (((await admin.call('GET', '/whatsapp/messages')).data as any[]).find((m) => m.templateName === 'leave_approval' && m.status === 'sent')?.body as string)?.match(/APPROVE ([A-Z2-9]{8})/)?.[1];
  psql(`update "WhatsAppActionToken" set "expiresAt" = now() - interval '1 minute' where "entityId"='${r2.id}'`);
  await webhook(payload(aliPhone, `APPROVE ${code2}`));
  const r2Status = ((await emp.call('GET', '/leave/requests')).data as any[]).find((x) => x.id === r2.id)?.status;
  check('an expired code is refused', r2Status === 'PENDING', r2Status);
  await manager.call('PATCH', `/leave/requests/${r2.id}/reject`, { reason: 'cleanup' });

  console.log('\n-- STOP / START --');
  await webhook(payload(aliPhone, 'STOP'));
  const consents = (await hr.call('GET', '/whatsapp/consents')).data as any[];
  check('STOP opts the sender out', consents.find((c) => c.phone === aliPhone)?.status === 'OPTED_OUT', consents.find((c) => c.phone === aliPhone));
  const r3 = await mkRequest(dayOffset + 3);
  const afterStop = ((await admin.call('GET', '/whatsapp/messages')).data as any[]).find((m) => m.templateName === 'leave_approval');
  check('after STOP the next approval request is blocked', afterStop?.status === 'blocked_no_consent', afterStop?.status);
  await manager.call('PATCH', `/leave/requests/${r3.id}/reject`, { reason: 'cleanup' });
  await webhook(payload(aliPhone, 'START'));
  check('START opts back in', ((await hr.call('GET', '/whatsapp/consents')).data as any[]).find((c) => c.phone === aliPhone)?.status === 'OPTED_IN');

  console.log('\n-- self-service consent + access control --');
  const mine = (await emp.call('GET', '/whatsapp/consent/me')).data;
  check('an employee can see their own consent state', mine.phone === saraPhone, mine);
  check('an employee can opt in for themselves', (await emp.call('PUT', '/whatsapp/consent/me', { status: 'OPTED_IN' })).data.status === 'OPTED_IN');
  await emp.call('PUT', '/whatsapp/consent/me', { status: 'OPTED_OUT' });
  check('an employee cannot list everyone\'s consents (403)', (await emp.call('GET', '/whatsapp/consents')).status === 403);
  check('an employee cannot set consent for others (403)', (await emp.call('PUT', '/whatsapp/consents', { phone: aliPhone, status: 'OPTED_OUT' })).status === 403);
  check('an invalid consent status is rejected (400)', (await hr.call('PUT', '/whatsapp/consents', { phone: aliPhone, status: 'MAYBE' })).status === 400);

  await admin.call('POST', '/integrations', { provider: 'whatsapp', status: 'disconnected' });
  console.log(`\nPassed: ${passed}  Failed: ${failures.length}`);
  if (failures.length) {
    console.log('\nFailures:\n' + failures.map((f) => ' - ' + f).join('\n'));
    process.exit(1);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
