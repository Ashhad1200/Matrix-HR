/**
 * Phase 4 verification: encrypted credentials, honest marketplace catalog, signed/retrying
 * webhooks with health, ZKTeco ADMS attendance push, QuickBooks journal export, bank-file validation.
 * Usage: pnpm test:integrations   (stack must be running; needs docker on PATH for the DB ciphertext check)
 */
import { config } from 'dotenv';
import { resolve } from 'path';
import { createServer, type IncomingMessage } from 'http';
import { createHmac } from 'crypto';
import { execFileSync } from 'child_process';

config({ path: resolve(__dirname, '../.env') });

const ORIGIN = process.env.API_URL?.replace(/\/$/, '') || 'http://localhost:3001';
const API = `${ORIGIN}/api/v1`;
const PASSWORD = 'Password123!';

let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) passed++;
  else failures.push(`${name}${detail !== undefined ? ` -> ${JSON.stringify(detail)}` : ''}`);
  console.log(`${ok ? '  ok ' : ' FAIL'}  ${name}`);
}

async function login(email: string) {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: PASSWORD }),
  });
  return ((await res.json()) as any).accessToken as string;
}

function client(token: string) {
  return async (method: string, path: string, body?: unknown) => {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let data: any = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    return { status: res.status, data };
  };
}

async function device(method: string, path: string, body?: string) {
  const res = await fetch(`${ORIGIN}${path}`, { method, headers: { 'Content-Type': 'text/plain' }, body });
  return { status: res.status, text: await res.text() };
}

const psql = (sql: string) =>
  execFileSync('docker', ['exec', 'matrixhr-postgres', 'psql', '-U', 'matrixhr', '-d', 'matrixhr', '-tAc', sql]).toString().trim();

async function main() {
  console.log(`Phase 4 integrations test -> ${API}\n`);
  const admin = client(await login('admin@acme.com'));
  const employee = client(await login('sara.ahmed@acme.com'));

  console.log('-- catalog honesty --');
  const catalog = (await admin('GET', '/marketplace/integrations')).data as any[];
  const byId = Object.fromEntries(catalog.map((a) => [a.id, a]));
  check('every app declares a maturity', catalog.every((a) => ['available', 'beta', 'planned'].includes(a.maturity)));
  check('zkteco + quickbooks are beta with a real mode', byId.zkteco?.maturity === 'beta' && byId.zkteco.mode === 'push' && byId.quickbooks?.maturity === 'beta' && byId.quickbooks.mode === 'export');
  check('stubs (e.g. Okta, Deel) are planned', byId.okta?.maturity === 'planned' && byId.deel?.maturity === 'planned');
  const planned = await admin('POST', '/marketplace/okta/connect');
  check('a planned app cannot be connected (400)', planned.status === 400, planned);
  check('the fake sync endpoint is gone (404)', (await admin('POST', '/marketplace/slack/sync')).status === 404);
  check('employee cannot connect apps (403)', (await employee('POST', '/marketplace/zkteco/connect')).status === 403);
  check('employee cannot read sync logs (403)', (await employee('GET', '/marketplace/zkteco/logs')).status === 403);

  console.log('\n-- credentials are encrypted at rest and never returned --');
  const created = await admin('POST', '/integrations', { provider: 'phase4-test', status: 'connected' });
  const patched = await admin('PATCH', `/integrations/${created.data.id}`, { accessToken: 'xoxb-plain-token-123', refreshToken: 'refresh-abc' });
  check('update succeeds', patched.status === 200, patched);
  check('response hides tokens but reports they exist', patched.data.accessToken === undefined && patched.data.hasAccessToken === true && patched.data.hasRefreshToken === true, patched.data);
  const listed = ((await admin('GET', '/integrations')).data as any[]).find((i) => i.provider === 'phase4-test');
  check('list also hides tokens', listed && listed.accessToken === undefined && listed.hasAccessToken === true);
  try {
    const stored = psql(`select "accessToken" from "TenantIntegration" where provider='phase4-test'`);
    check('database holds ciphertext, not the token', stored.startsWith('enc:v1:') && !stored.includes('xoxb-plain-token-123'), stored.slice(0, 20));
  } catch (e: any) {
    check('database ciphertext check (needs docker on PATH)', false, e.message);
  }
  await admin('PATCH', `/integrations/${created.data.id}`, { status: 'disconnected' });

  console.log('\n-- webhooks: signed, retried, health-tracked --');
  let respondWith = 200;
  const received: { headers: IncomingMessage['headers']; body: string }[] = [];
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      received.push({ headers: req.headers, body });
      res.statusCode = respondWith;
      res.end('x');
    });
  });
  await new Promise<void>((r) => server.listen(0, '0.0.0.0', r));
  const port = (server.address() as any).port;
  const hookUrl = `http://host.docker.internal:${port}/hook`;

  check('non-http URL rejected (400)', (await admin('POST', '/webhooks', { url: 'ftp://example.com/x', events: ['employee.terminated'] })).status === 400);
  const wh = await admin('POST', '/webhooks', { url: hookUrl, events: ['employee.terminated'] });
  check('webhook created and secret shown once', wh.status === 201 && typeof wh.data.secret === 'string' && wh.data.secret.length >= 32, wh);
  const secret = wh.data.secret as string;
  const whId = wh.data.id as string;
  const fetched = await admin('GET', `/webhooks/${whId}`);
  check('secret is not returned again', fetched.data.secret === undefined && fetched.data.secretConfigured === true);
  try {
    const stored = psql(`select secret from "Webhook" where id='${whId}'`);
    check('webhook secret encrypted at rest', stored.startsWith('enc:v1:'), stored.slice(0, 12));
  } catch (e: any) {
    check('webhook secret ciphertext check', false, e.message);
  }

  const ok = await admin('POST', `/webhooks/${whId}/test`);
  check('test delivery reaches the receiver', ok.data?.status === 'delivered' && received.length === 1, ok.data);
  if (received[0]) {
    const h = received[0].headers;
    const expected = `sha256=${createHmac('sha256', secret).update(`${h['x-webhook-timestamp']}.${received[0].body}`).digest('hex')}`;
    check('HMAC signature verifies with the shared secret', h['x-webhook-signature'] === expected);
    check('the secret itself is never sent in a header', !Object.values(h).some((v) => String(v).includes(secret)));
  }
  check('health is healthy after success', (await admin('GET', `/webhooks/${whId}`)).data.health === 'healthy');

  respondWith = 500;
  const bad = await admin('POST', `/webhooks/${whId}/test`);
  check('failed delivery is queued for retry, not dropped', bad.data?.status === 'retrying' && bad.data.attempts === 1 && !!bad.data.nextAttemptAt, bad.data);
  const degraded = (await admin('GET', `/webhooks/${whId}`)).data;
  check('health degrades and records the error', degraded.health === 'degraded' && degraded.consecutiveFailures === 1 && /500/.test(degraded.lastError), degraded);
  respondWith = 200;
  const redelivered = await admin('POST', `/webhooks/deliveries/${bad.data.id}/redeliver`);
  check('manual redelivery succeeds once the endpoint recovers', redelivered.data?.status === 'delivered', redelivered.data);
  check('health recovers', (await admin('GET', `/webhooks/${whId}`)).data.health === 'healthy');
  const deliveries = (await admin('GET', `/webhooks/${whId}/deliveries`)).data as any[];
  check('delivery log is visible', deliveries.length >= 2);
  check('employee cannot see webhook deliveries (403)', (await employee('GET', `/webhooks/${whId}/deliveries`)).status === 403);
  await admin('DELETE', `/webhooks/${whId}`);
  server.close();

  console.log('\n-- ZKTeco ADMS: device punches become attendance --');
  const sn = `TEST${Date.now().toString().slice(-9)}`;
  const saraMe = (await employee('GET', '/auth/me')).data;
  const saraEmpId = saraMe.employeeId ?? saraMe.employee?.id;
  await admin('PATCH', `/employees/${saraEmpId}`, { biometricPin: '77001' });

  await admin('POST', '/marketplace/zkteco/disconnect').catch(() => null);
  check('cannot register a device while disconnected (400)', (await admin('POST', '/biometric/devices', { serialNumber: sn, name: 'Front door' })).status === 400);
  check('zkteco connects', (await admin('POST', '/marketplace/zkteco/connect')).status === 201);
  const reg = await admin('POST', '/biometric/devices', { serialNumber: sn, name: 'Front door', location: 'HQ' });
  check('device registered', reg.status === 201 && reg.data.online === false, reg);
  check('duplicate serial rejected (409)', (await admin('POST', '/biometric/devices', { serialNumber: sn, name: 'dup' })).status === 409);
  check('employee cannot manage devices (403)', (await employee('GET', '/biometric/devices')).status === 403);

  check('unknown device is refused (403)', (await device('GET', '/iclock/cdata?SN=NOPE0000&options=all')).status === 403);
  const hs = await device('GET', `/iclock/cdata?SN=${sn}&options=all`);
  check('registered device gets a handshake', hs.status === 200 && hs.text.includes('GET OPTION FROM'), hs);
  check('device now shows online', ((await admin('GET', '/biometric/devices')).data as any[]).find((d) => d.serialNumber === sn)?.online === true);

  const punches = [
    '77001\t2019-03-04 08:55:10\t0\t1\t0',
    '77001\t2019-03-04 13:00:00\t0\t1\t0',
    '77001\t2019-03-04 18:02:30\t1\t1\t0',
    '99999\t2019-03-04 09:00:00\t0\t1\t0',
    'garbage line',
  ].join('\n');
  const push = await device('POST', `/iclock/cdata?SN=${sn}&table=ATTLOG&Stamp=1`, punches);
  check('push accepted, reports matched punches', push.status === 201 && push.text === 'OK: 3', push);

  const logs = (await employee('GET', '/attendance/my-logs?month=2019-03')).data as any[];
  const log = logs.find((l) => l.date.startsWith('2019-03-04'));
  check('attendance record created from the device', !!log && log.source === 'BIOMETRIC', log);
  check('device local time converted to UTC (Asia/Karachi +5)', log?.clockIn === '2019-03-04T03:55:10.000Z' && log?.clockOut === '2019-03-04T13:02:30.000Z', log);
  check('hours computed from first to last punch', Number(log?.hours) === 9.12, log?.hours);

  await device('POST', `/iclock/cdata?SN=${sn}&table=ATTLOG&Stamp=2`, punches);
  const again = ((await employee('GET', '/attendance/my-logs?month=2019-03')).data as any[]).filter((l) => l.date.startsWith('2019-03-04'));
  check('re-pushing the same punches is idempotent', again.length === 1 && again[0].clockIn === log.clockIn && again[0].clockOut === log.clockOut);

  const syncLog = ((await admin('GET', '/marketplace/zkteco/logs')).data as any[])[0];
  check('sync log shows a PARTIAL inbound run with the failures', syncLog?.status === 'PARTIAL' && syncLog.direction === 'INBOUND' && syncLog.recordsFailed === 2 && /99999/.test(syncLog.message), syncLog);
  const listedAfter = ((await admin('GET', '/marketplace/integrations')).data as any[]).find((a) => a.id === 'zkteco');
  check('marketplace surfaces last run status (health)', listedAfter.lastRun?.status === 'PARTIAL');

  check('disconnecting stops accepting pushes (403)', ((await admin('POST', '/marketplace/zkteco/disconnect')), (await device('POST', `/iclock/cdata?SN=${sn}&table=ATTLOG`, punches)).status === 403));
  await admin('DELETE', `/biometric/devices/${reg.data.id}`);
  await admin('PATCH', `/employees/${saraEmpId}`, { biometricPin: null });

  console.log('\n-- payroll: bank file validation + accounting journal --');
  const runs = (await admin('GET', '/payroll/runs')).data as any[];
  const locked = runs.find((r) => r.status === 'APPROVED' || r.status === 'LOCKED');
  const draft = runs.find((r) => r.status === 'DRAFT');
  if (draft) {
    check('bank file refused for a draft run (400)', (await admin('GET', `/payroll/runs/${draft.id}/bank-file?bank=meezan`)).status === 400);
    check('journal refused for a draft run (400)', (await admin('GET', `/payroll/runs/${draft.id}/journal`)).status === 400);
  }
  if (!locked) throw new Error('no APPROVED/LOCKED payroll run available to test against');
  const bank = (await admin('GET', `/payroll/runs/${locked.id}/bank-file?bank=meezan`)).data;
  const runItems = ((await admin('GET', `/payroll/runs/${locked.id}`)).data as any).items.length;
  check('bank file has only valid rows and accounts for every employee', bank.summary.included > 0 && bank.content.split('\n').length === bank.summary.included && bank.summary.included + bank.summary.excluded === runItems, bank.summary);
  check('every excluded employee is reported with a reason', bank.excluded.length === bank.summary.excluded && bank.excluded.every((x: any) => x.problem), bank.excluded);
  check('excluded staff (no bank details) never appear in the file', bank.excluded.every((x: any) => !bank.content.includes(x.employeeCode)));
  check('bank file still labelled unvalidated (layout unconfirmed)', bank.validated === false);
  check('employee cannot fetch bank files (403)', (await employee('GET', `/payroll/runs/${locked.id}/bank-file?bank=meezan`)).status === 403);

  await admin('POST', '/marketplace/quickbooks/disconnect').catch(() => null);
  check('journal requires QuickBooks to be connected (400)', (await admin('GET', `/payroll/runs/${locked.id}/journal`)).status === 400);
  check('quickbooks connects', (await admin('POST', '/marketplace/quickbooks/connect')).status === 201);
  const journal = (await admin('GET', `/payroll/runs/${locked.id}/journal`)).data;
  check('journal is balanced', journal.balanced === true && journal.totals.debit === journal.totals.credit && journal.totals.debit > 0, journal.totals);
  check('journal CSV has the import header and an expense line', journal.content.startsWith('*JournalNo,*JournalDate,*AccountName') && journal.content.includes('Salaries & Wages'));
  const qbLog = ((await admin('GET', '/marketplace/quickbooks/logs')).data as any[])[0];
  check('export recorded as an OUTBOUND SUCCESS in the sync log', qbLog?.direction === 'OUTBOUND' && qbLog.status === 'SUCCESS' && qbLog.recordsProcessed > 0, qbLog);
  check('employee cannot export journals (403)', (await employee('GET', `/payroll/runs/${locked.id}/journal`)).status === 403);
  await admin('POST', '/marketplace/quickbooks/disconnect');

  console.log(`\nPassed: ${passed}  Failed: ${failures.length}`);
  if (failures.length) {
    console.log('\nFailures:\n' + failures.map((f) => ' - ' + f).join('\n'));
    process.exit(1);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
