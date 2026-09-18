/**
 * Auth hardening (checklist.md #2 password-reset TTL, #5 rate limiting, MFA, session revocation).
 * Runs against a throwaway tenant it creates via /auth/signup, so demo accounts are untouched.
 * Usage: pnpm test:auth   (stack running; docker on PATH for the expiry check)
 */
import { config } from 'dotenv';
import { resolve } from 'path';
import { execFileSync } from 'child_process';
import { totpAt } from '../apps/api/src/auth/totp';

config({ path: resolve(__dirname, '../.env') });

const API = `${process.env.API_URL?.replace(/\/$/, '') || 'http://localhost:3001'}/api/v1`;
let passed = 0;
const failures: string[] = [];
const check = (name: string, ok: boolean, detail?: unknown) => {
  if (ok) passed++;
  else failures.push(`${name}${detail !== undefined ? ` -> ${JSON.stringify(detail).slice(0, 220)}` : ''}`);
  console.log(`${ok ? '  ok ' : ' FAIL'}  ${name}`);
};

async function call(method: string, path: string, body?: unknown, token?: string) {
  const r = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: r.status, data, text };
}

const psql = (sql: string) =>
  execFileSync('docker', ['exec', 'matrixhr-postgres', 'psql', '-U', 'matrixhr', '-d', 'matrixhr', '-tAc', sql]).toString().trim();

async function outboxLink(adminToken: string, to: string) {
  const box = (await call('GET', '/dev/outbox', undefined, adminToken)).data as any[];
  const mail = box.find((m) => m.to === to);
  return mail?.text.match(/token=([a-f0-9]+)/)?.[1] as string | undefined;
}

async function main() {
  console.log(`Auth security test -> ${API}\n`);
  const stamp = Date.now();
  const email = `authtest${stamp}@example.com`;
  const password = 'Str0ngPass1';
  const sub = `authtest-${stamp}`;

  console.log('-- signup validation + secret hygiene --');
  check('72+ char password rejected (bcrypt would truncate it)', (await call('POST', '/auth/signup', { email, password: 'Aa1' + 'x'.repeat(80), companyName: 'T', subdomain: sub })).status === 400);
  const signup = await call('POST', '/auth/signup', { email, password, companyName: `Auth Test ${stamp}`, subdomain: sub });
  check('throwaway tenant created', signup.status === 201, signup.data);
  let token: string = signup.data.accessToken;
  const refresh1: string = signup.data.refreshToken;

  const me = (await call('GET', '/auth/me', undefined, token)).data;
  const secretKeys = ['passwordHash', 'twoFaSecret', 'twoFaRecoveryCodes', 'twoFaLastStep', 'emailVerifyToken', 'passwordResetToken', 'passwordResetExpires', 'failedAttempts', 'lockedUntil'];
  check('/auth/me exposes no credential material', secretKeys.every((k) => !(k in me)), secretKeys.filter((k) => k in me));
  check('/auth/me tenant object has no credential fields either', !/passwordHash|twoFaSecret/.test(JSON.stringify(me)));

  console.log('\n-- refresh rotation + logout --');
  const rot = await call('POST', '/auth/refresh', { refreshToken: refresh1 });
  check('refresh issues new tokens', rot.status === 201 && !!rot.data.refreshToken, rot);
  check('the old refresh token is dead after use (rotation)', (await call('POST', '/auth/refresh', { refreshToken: refresh1 })).status === 401);
  await call('POST', '/auth/logout', { refreshToken: rot.data.refreshToken });
  check('logout revokes the session', (await call('POST', '/auth/refresh', { refreshToken: rot.data.refreshToken })).status === 401);

  console.log('\n-- password reset --');
  const login1 = await call('POST', '/auth/login', { email, password });
  token = login1.data.accessToken;
  const preResetToken = token;
  const preResetRefresh = login1.data.refreshToken;
  const unknown = await call('POST', '/auth/forgot-password', { email: `nobody${stamp}@example.com` });
  const known = await call('POST', '/auth/forgot-password', { email });
  check('same response whether or not the email has an account (no enumeration)', unknown.status === known.status && unknown.data.message === known.data.message, [unknown.data, known.data]);
  const seed = await call('POST', '/auth/login', { email: 'admin@acme.com', password: 'Password123!' });
  const adminToken = seed.data.accessToken;
  const firstToken = await outboxLink(adminToken, email);
  check('a reset link was "emailed" (dev outbox)', !!firstToken);
  await call('POST', '/auth/forgot-password', { email });
  const secondToken = await outboxLink(adminToken, email);
  check('a new request invalidates the previous link', firstToken !== secondToken && (await call('POST', '/auth/reset-password', { token: firstToken, password: 'Newer1Pass' })).status === 400);
  check('weak new password rejected (400)', (await call('POST', '/auth/reset-password', { token: secondToken, password: 'password' })).status === 400);
  try {
    psql(`update "User" set "passwordResetExpires" = now() - interval '1 minute' where email='${email}'`);
    check('an expired link is refused (30-minute TTL)', (await call('POST', '/auth/reset-password', { token: secondToken, password: 'Newer1Pass' })).status === 400);
  } catch (e: any) {
    check('expiry check (needs docker on PATH)', false, e.message);
  }
  await call('POST', '/auth/forgot-password', { email });
  const liveToken = await outboxLink(adminToken, email);
  const reset = await call('POST', '/auth/reset-password', { token: liveToken, password: 'Newer1Pass' });
  check('reset succeeds with a live link', reset.status === 201, reset);
  check('the link is single-use', (await call('POST', '/auth/reset-password', { token: liveToken, password: 'Another1Pass' })).status === 400);
  check('old password no longer works', (await call('POST', '/auth/login', { email, password })).status === 401);
  check('an access token issued before the reset is revoked', (await call('GET', '/auth/me', undefined, preResetToken)).status === 401);
  check('refresh tokens from before the reset are revoked', (await call('POST', '/auth/refresh', { refreshToken: preResetRefresh })).status === 401);
  const login2 = await call('POST', '/auth/login', { email, password: 'Newer1Pass' });
  check('new password works', login2.status === 201);
  token = login2.data.accessToken;

  console.log('\n-- change password --');
  check('wrong current password refused', (await call('POST', '/auth/change-password', { currentPassword: 'nope', newPassword: 'Third1Pass' }, token)).status === 401);
  const changed = await call('POST', '/auth/change-password', { currentPassword: 'Newer1Pass', newPassword: 'Third1Pass' }, token);
  check('change succeeds and returns a fresh session', changed.status === 201 && !!changed.data.accessToken, changed.data);
  check('the previous access token is revoked', (await call('GET', '/auth/me', undefined, token)).status === 401);
  token = changed.data.accessToken;
  check('the fresh session works', (await call('GET', '/auth/me', undefined, token)).status === 200);
  const finalPassword = 'Third1Pass';

  console.log('\n-- two-factor authentication (TOTP) --');
  const setup = await call('POST', '/auth/mfa/setup', undefined, token);
  check('setup returns a secret and otpauth URL', setup.status === 201 && /^otpauth:\/\/totp\//.test(setup.data.otpauthUrl), setup.data);
  const secret: string = setup.data.secret;
  check('the secret is encrypted at rest', psql(`select "twoFaSecret" from "User" where email='${email}'`).startsWith('enc:v1:'));
  check('login is unaffected until MFA is confirmed', (await call('POST', '/auth/login', { email, password: finalPassword })).data.mfaRequired === undefined);
  check('enable with a wrong code is refused', (await call('POST', '/auth/mfa/enable', { code: '000000' }, token)).status === 400);
  const enableCode = totpAt(secret, Date.now());
  const enabled = await call('POST', '/auth/mfa/enable', { code: enableCode }, token);
  check('enable with the right code returns 8 recovery codes', enabled.status === 201 && enabled.data.recoveryCodes?.length === 8, enabled.data);
  const recovery: string[] = enabled.data.recoveryCodes;
  check('recovery codes are stored hashed only', !psql(`select "twoFaRecoveryCodes"::text from "User" where email='${email}'`).includes(recovery[0]));

  const gated = await call('POST', '/auth/login', { email, password: finalPassword });
  check('login now demands a second factor and issues NO session', gated.data.mfaRequired === true && !gated.data.accessToken && !!gated.data.mfaToken, gated.data);
  const mfaToken: string = gated.data.mfaToken;
  check('a wrong code is refused', (await call('POST', '/auth/mfa/verify', { mfaToken, code: '111111' })).status === 401);
  check('a code that was already used cannot be replayed', (await call('POST', '/auth/mfa/verify', { mfaToken, code: enableCode })).status === 401);
  const nextCode = totpAt(secret, Date.now() + 30_000);
  const verified = await call('POST', '/auth/mfa/verify', { mfaToken, code: nextCode });
  check('a fresh code completes login', verified.status === 201 && !!verified.data.accessToken, verified.data);
  check('that code cannot be replayed either', (await call('POST', '/auth/mfa/verify', { mfaToken, code: nextCode })).status === 401);
  check('an access token can NOT be used as an MFA token', (await call('POST', '/auth/mfa/verify', { mfaToken: verified.data.accessToken, code: nextCode })).status === 401);

  const gated2 = await call('POST', '/auth/login', { email, password: finalPassword });
  const viaRecovery = await call('POST', '/auth/mfa/verify', { mfaToken: gated2.data.mfaToken, code: recovery[0] });
  check('a recovery code works once', viaRecovery.status === 201 && !!viaRecovery.data.accessToken, viaRecovery.data);
  const gated3 = await call('POST', '/auth/login', { email, password: finalPassword });
  check('...and only once', (await call('POST', '/auth/mfa/verify', { mfaToken: gated3.data.mfaToken, code: recovery[0] })).status === 401);

  const authed = viaRecovery.data.accessToken as string;
  check('disable needs the password', (await call('POST', '/auth/mfa/disable', { password: 'wrong', code: recovery[1] }, authed)).status === 401);
  const disabled = await call('POST', '/auth/mfa/disable', { password: finalPassword, code: recovery[1] }, authed);
  check('disable works with password + a recovery code', disabled.status === 201, disabled.data);
  check('login no longer asks for a second factor', (await call('POST', '/auth/login', { email, password: finalPassword })).data.mfaRequired === undefined);

  console.log('\n-- lockout + disabled accounts --');
  for (let i = 0; i < 5; i++) await call('POST', '/auth/login', { email, password: 'wrong-password' });
  const locked = await call('POST', '/auth/login', { email, password: finalPassword });
  check('5 wrong passwords lock the account, even for the right password', locked.status === 401 && /locked/i.test(locked.text), locked.data);
  psql(`update "User" set "lockedUntil" = null, "failedAttempts" = 0, status = 'INACTIVE' where email='${email}'`);
  const disabledLogin = await call('POST', '/auth/login', { email, password: finalPassword });
  check('a deactivated user cannot log in', disabledLogin.status === 401 && /disabled/i.test(disabledLogin.text), disabledLogin.data);

  console.log(`\nPassed: ${passed}  Failed: ${failures.length}`);
  if (failures.length) {
    console.log('\nFailures:\n' + failures.map((f) => ' - ' + f).join('\n'));
    process.exit(1);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
