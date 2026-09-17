/**
 * MatrixHR full UI/RBAC demo-readiness check.
 * Usage: node scripts/ui-test-full.mjs
 */
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '../.ui-test');
mkdirSync(OUT, { recursive: true });

const USERS = [
  { label: 'SuperAdmin', email: 'superadmin@acme.com', expectNav: ['Employees', 'Settings'] },
  { label: 'Admin', email: 'admin@acme.com', expectNav: ['Employees', 'Settings'] },
  { label: 'HR', email: 'hr@acme.com', expectNav: ['Employees', 'Payroll'] },
  { label: 'Manager', email: 'ali.khan@acme.com', expectNav: ['My Team', 'Approvals'] },
  { label: 'Employee', email: 'sara.ahmed@acme.com', expectNav: ['My Info', 'Pay Stubs'] },
];

// Pages an Employee should NOT be able to see real data on, even via direct URL.
const EMPLOYEE_FORBIDDEN_URLS = ['/payroll', '/settings', '/employees', '/reports'];

const issues = [];
const notes = [];

async function loginAndGetNav(browser, { label, email, expectNav }) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const consoleErrors = [];
  const failedRequests = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('response', (res) => {
    if (res.url().includes('_rsc=')) return;
    if (res.url().includes('/api/v1') && res.status() >= 500) {
      failedRequests.push(`${res.status()} ${res.url()}`);
    }
  });

  try {
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle', timeout: 30000 });
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', 'Password123!');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 15000 });
    await page.waitForSelector('aside', { timeout: 10000 });

    const navText = await page.locator('aside').innerText();
    for (const item of expectNav) {
      if (!navText.includes(item)) issues.push(`${label}: missing expected nav item "${item}"`);
    }

    await page.screenshot({ path: resolve(OUT, `${label.toLowerCase()}-dashboard.png`), fullPage: true });

    if (consoleErrors.length) issues.push(`${label}: console errors on dashboard — ${consoleErrors.slice(0, 3).join(' | ')}`);
    if (failedRequests.length) issues.push(`${label}: 5xx API errors — ${failedRequests.slice(0, 3).join(' | ')}`);

    console.log(`✓ ${label} login OK — nav: ${navText.replace(/\s+/g, ' ').trim().slice(0, 120)}...`);
    return { ctx, page, navText };
  } catch (err) {
    issues.push(`${label}: login/nav failed — ${err.message}`);
    await page.screenshot({ path: resolve(OUT, `${label.toLowerCase()}-error.png`), fullPage: true });
    console.log(`✗ ${label} FAILED: ${err.message}`);
    await ctx.close();
    return null;
  }
}

async function checkEmployeeDirectUrlAccess(browser) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  try {
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle', timeout: 30000 });
    await page.fill('input[type="email"]', 'sara.ahmed@acme.com');
    await page.fill('input[type="password"]', 'Password123!');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 15000 });

    for (const url of EMPLOYEE_FORBIDDEN_URLS) {
      await page.goto(`http://localhost:3000${url}`, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
      const finalUrl = page.url();
      const bodyText = await page.locator('body').innerText().catch(() => '');
      await page.screenshot({ path: resolve(OUT, `employee-direct-${url.replace(/\//g, '')}.png`), fullPage: true });

      const wasRedirected = !finalUrl.endsWith(url);
      const looksBlocked = /forbidden|not authorized|access denied|403|unauthorized/i.test(bodyText);
      const looksBlank = bodyText.trim().length < 40;

      if (!wasRedirected && !looksBlocked && !looksBlank) {
        issues.push(
          `SECURITY/UX: Employee can directly navigate to "${url}" and the page renders content (no redirect, no "access denied" message) — API calls will 403 underneath but the UI does not guard the route. Verify no real data leaks before the demo.`,
        );
      } else {
        notes.push(`Employee → ${url}: ${wasRedirected ? `redirected to ${finalUrl}` : looksBlocked ? 'blocked message shown' : 'blank/empty state'}`);
      }
    }
  } catch (err) {
    issues.push(`Employee direct-URL check failed: ${err.message}`);
  } finally {
    await ctx.close();
  }
}

async function main() {
  console.log('MatrixHR full UI/RBAC check — http://localhost:3000\n');
  const browser = await chromium.launch({ headless: true });

  for (const user of USERS) {
    const result = await loginAndGetNav(browser, user);
    if (result) await result.ctx.close();
  }

  console.log('\nChecking Employee direct-URL access to admin-only pages...');
  await checkEmployeeDirectUrlAccess(browser);

  await browser.close();

  const report = { issues, notes, screenshots: OUT, passed: issues.length === 0 };
  writeFileSync(resolve(OUT, 'full-report.json'), JSON.stringify(report, null, 2));

  console.log('\n── Notes ──');
  for (const n of notes) console.log(`  - ${n}`);

  console.log('\n── Results ──');
  if (issues.length === 0) {
    console.log('All UI/RBAC checks passed.');
  } else {
    console.log('Issues found:');
    for (const i of issues) console.log(`  - ${i}`);
  }
  console.log(`Screenshots: ${OUT}`);
  process.exit(issues.length === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
