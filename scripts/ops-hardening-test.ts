/**
 * Operational hardening (checklist.md #4 CORS, #6 error handling, #8 logging/monitoring): health probes,
 * request ids, clean error bodies, CORS allow-list, no docs/stack leakage.
 * Usage: pnpm test:ops   (stack running)
 */
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(__dirname, '../.env') });

const ORIGIN = process.env.API_URL?.replace(/\/$/, '') || 'http://localhost:3001';
const API = `${ORIGIN}/api/v1`;
let passed = 0;
const failures: string[] = [];
const check = (name: string, ok: boolean, detail?: unknown) => {
  if (ok) passed++;
  else failures.push(`${name}${detail !== undefined ? ` -> ${JSON.stringify(detail).slice(0, 200)}` : ''}`);
  console.log(`${ok ? '  ok ' : ' FAIL'}  ${name}`);
};

async function main() {
  console.log(`Ops hardening test -> ${API}\n`);

  console.log('-- health probes --');
  const live = await fetch(`${API}/health`);
  check('liveness answers without authentication', live.status === 200 && (await live.json() as any).status === 'ok');
  const ready = await fetch(`${API}/health/ready`);
  const readyBody: any = await ready.json();
  check('readiness reports the database is up', ready.status === 200 && readyBody.checks?.database === 'up', readyBody);

  console.log('\n-- request ids --');
  const r1 = await fetch(`${API}/health`);
  check('every response carries an X-Request-Id', /^[\w-]{8,64}$/.test(r1.headers.get('x-request-id') ?? ''));
  const r2 = await fetch(`${API}/health`, { headers: { 'X-Request-Id': 'lb-trace-12345678' } });
  check('a sane inbound id from a load balancer is honoured', r2.headers.get('x-request-id') === 'lb-trace-12345678');
  const r3 = await fetch(`${API}/health`, { headers: { 'X-Request-Id': 'bad id with spaces & <script>' } });
  check('a hostile inbound id is replaced, not echoed', r3.headers.get('x-request-id') !== 'bad id with spaces & <script>' && /^[\w-]{8,64}$/.test(r3.headers.get('x-request-id') ?? ''));

  console.log('\n-- error responses --');
  const nf = await fetch(`${API}/definitely-not-a-route`);
  const nfBody: any = await nf.json();
  check('unknown route: structured 404 that quotes the request id', nf.status === 404 && nfBody.requestId === nf.headers.get('x-request-id'), nfBody);
  const malformed = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"email": ' });
  const malformedBody: any = await malformed.json();
  check('malformed JSON: clean 400, no parser internals', malformed.status === 400 && !/SyntaxError|at JSON|Unexpected/.test(JSON.stringify(malformedBody)), malformedBody);
  const huge = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'a@b.co', password: 'x'.repeat(300_000) }) });
  check('an oversized body is refused (413)', huge.status === 413, huge.status);
  const unauth = await fetch(`${API}/employees`);
  const unauthBody: any = await unauth.json();
  check('unauthenticated request: 401 with the standard shape', unauth.status === 401 && unauthBody.statusCode === 401 && !!unauthBody.requestId, unauthBody);
  const val = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'not-an-email', password: 'x', extra: 1 }) });
  const valBody: any = await val.json();
  check('validation: 400 listing the problems, unknown fields rejected', val.status === 400 && Array.isArray(valBody.message) && valBody.message.some((m: string) => /extra/.test(m)), valBody);
  check('no response ever contains a stack trace', ![nfBody, malformedBody, unauthBody, valBody].some((b) => /\bat .*\(.*:\d+:\d+\)|node_modules/.test(JSON.stringify(b))));

  console.log('\n-- CORS allow-list --');
  const own = await fetch(`${API}/health`, { headers: { Origin: 'http://localhost:3000' } });
  check('the configured web origin is allowed', own.headers.get('access-control-allow-origin') === 'http://localhost:3000');
  const evil = await fetch(`${API}/health`, { headers: { Origin: 'https://evil.example' } });
  check('any other origin gets no CORS grant', !evil.headers.get('access-control-allow-origin'), evil.headers.get('access-control-allow-origin'));
  const preflight = await fetch(`${API}/employees`, { method: 'OPTIONS', headers: { Origin: 'https://evil.example', 'Access-Control-Request-Method': 'GET' } });
  check('a preflight from another origin is not approved', !preflight.headers.get('access-control-allow-origin'));
  check('the wildcard is never used', own.headers.get('access-control-allow-origin') !== '*');

  console.log('\n-- security headers (helmet) --');
  check('X-Content-Type-Options: nosniff', r1.headers.get('x-content-type-options') === 'nosniff');
  check('framing is denied/limited', /DENY|SAMEORIGIN/i.test(r1.headers.get('x-frame-options') ?? ''));
  check('server does not advertise its framework', !r1.headers.get('x-powered-by'));

  console.log(`\nPassed: ${passed}  Failed: ${failures.length}`);
  if (failures.length) {
    console.log('\nFailures:\n' + failures.map((f) => ' - ' + f).join('\n'));
    process.exit(1);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
