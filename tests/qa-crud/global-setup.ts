/**
 * Creates two fresh tenants (ZZ-TEST-A with one user per role, ZZ-TEST-B for isolation checks) and writes their
 * logins to tests/qa-crud/.auth/accounts.json (git-ignored). Refuses to run unless the database is local.
 */
import { execFileSync } from 'child_process';
import { mkdirSync, writeFileSync } from 'fs';
import { createRequire } from 'module';
import { resolve } from 'path';

const API = process.env.API_URL || 'http://localhost:3001/api/v1';
const PG = { host: process.env.PGHOST || '127.0.0.1', port: process.env.PGPORT || '5433', user: process.env.PGUSER || 'matrixhr', db: process.env.PGDATABASE || 'matrixhr' };
export const PASSWORD = process.env.QA_PASSWORD || 'ZzTest#Passw0rd1';
const psql = (q: string) => execFileSync('psql', ['-h', PG.host, '-p', PG.port, '-U', PG.user, '-d', PG.db, '-tAqc', q], { env: { ...process.env, PGPASSWORD: process.env.PGPASSWORD || 'matrixhr' } }).toString().trim();

async function call(path: string, method = 'GET', token?: string, body?: unknown) {
  const res = await fetch(`${API}${path}`, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const t = await res.text(); let j: any; try { j = JSON.parse(t); } catch { j = t; }
  return { status: res.status, body: j };
}

export default async function setup() {
  if (!['127.0.0.1', 'localhost'].includes(PG.host) && !process.env.QA_ALLOW_REMOTE_DB) throw new Error(`Refusing to run: database host "${PG.host}" is not local.`);
  console.log(`QA database: ${PG.host}:${PG.port}/${PG.db} (local)  API: ${API}`);
  const bcrypt = createRequire(resolve(__dirname, '../../apps/api/package.json'))('bcryptjs');
  const hash = await bcrypt.hash(PASSWORD, 10);
  const tag = Date.now().toString(36);
  const mkTenant = async (letter: 'A' | 'B') => {
    const r = await call('/auth/signup', 'POST', undefined, { email: `zz-admin-${letter.toLowerCase()}-${tag}@qa.test`, password: PASSWORD, companyName: `ZZ-TEST-${letter} ${tag}`, subdomain: `zz-test-${letter.toLowerCase()}-${tag}` });
    if (r.status !== 201) throw new Error(`signup ${letter} failed: ${r.status} ${JSON.stringify(r.body)}`);
    return { tenantId: r.body.tenant.id as string, adminEmail: `zz-admin-${letter.toLowerCase()}-${tag}@qa.test`, token: r.body.accessToken as string };
  };
  const A = await mkTenant('A'); const B = await mkTenant('B');

  const accounts: Record<string, any> = { tenantA: A.tenantId, tenantB: B.tenantId, users: {} as Record<string, { email: string; role: string; employeeId?: string; token?: string }> };
  accounts.users.admin = { email: A.adminEmail, role: 'COMPANY_ADMIN' };
  accounts.users.adminB = { email: B.adminEmail, role: 'COMPANY_ADMIN' };

  const mkUser = async (key: string, role: string, first: string, tenant: typeof A, managerId?: string) => {
    const email = `zz-${key}-${tag}@qa.test`;
    const e = await call('/employees', 'POST', tenant.token, { employeeCode: `ZZ-${key.toUpperCase()}-${tag}`, firstName: first, lastName: `ZZ-TEST`, email, managerId, baseSalary: 100000 });
    if (e.status !== 201) throw new Error(`employee ${key} failed: ${e.status} ${JSON.stringify(e.body)}`);
    psql(`insert into "User" (id,"tenantId","employeeId",email,"passwordHash",role,status,"emailVerified","updatedAt") values ('zz_${key}_${tag}','${tenant.tenantId}','${e.body.id}','${email}','${hash}','${role}','ACTIVE',true,now())`);
    accounts.users[key] = { email, role, employeeId: e.body.id };
    return e.body.id as string;
  };
  await mkUser('hr', 'HR_MANAGER', 'Hira', A);
  const mgrEmp = await mkUser('manager', 'MANAGER', 'Mansoor', A);
  await mkUser('employee', 'EMPLOYEE', 'Esha', A, mgrEmp);
  await mkUser('employee2', 'EMPLOYEE', 'Ehsan', A); // not a report of the manager: scoping checks
  await mkUser('employeeB', 'EMPLOYEE', 'Bilal', B);
  accounts.users.superadmin = { email: 'superadmin@acme.com', role: 'SUPER_ADMIN' };

  for (const [k, u] of Object.entries<any>(accounts.users)) {
    const r = await call('/auth/login', 'POST', undefined, { email: u.email, password: k === 'superadmin' ? 'Password123!' : PASSWORD });
    if (r.status !== 201) throw new Error(`login ${k} failed: ${r.status}`);
    u.token = r.body.accessToken; u.password = k === 'superadmin' ? 'Password123!' : PASSWORD;
  }
  mkdirSync(resolve(__dirname, '.auth'), { recursive: true });
  writeFileSync(resolve(__dirname, '.auth/accounts.json'), JSON.stringify(accounts, null, 1));
  writeFileSync(resolve(__dirname, '../../docs/qa/test-accounts.md'), `# QA test accounts (local only, regenerated on every run)\n\nTenant A: \`${A.tenantId}\` (ZZ-TEST-A ${tag}) · Tenant B: \`${B.tenantId}\` (ZZ-TEST-B ${tag})\n\n| key | role | email |\n|---|---|---|\n${Object.entries<any>(accounts.users).map(([k, u]) => `| ${k} | ${u.role} | ${u.email} |`).join('\n')}\n\nPasswords are in \`tests/qa-crud/.auth/accounts.json\` (git-ignored); the shared test password is \`QA_PASSWORD\` or the default in \`global-setup.ts\`. The superadmin is the seeded local operator.\n`);
}
