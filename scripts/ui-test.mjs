/**
 * MatrixHR UI smoke test — login + role nav checks
 * Usage: node scripts/ui-test.mjs
 */
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '../.ui-test');
mkdirSync(OUT, { recursive: true });

const USERS = [
  { label: 'Admin', email: 'admin@acme.com', expectNav: ['Employees', 'Settings'] },
  { label: 'Manager', email: 'ali.khan@acme.com', expectNav: ['My Team', 'Approvals'] },
  { label: 'Employee', email: 'sara.ahmed@acme.com', expectNav: ['My Info', 'Pay Stubs'] },
];

const issues = [];

async function testUser(browser, { label, email, expectNav }) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const consoleErrors = [];
  const failedRequests = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('requestfailed', (req) => {
    if (req.url().includes('_rsc=')) return;
    failedRequests.push(`${req.method()} ${req.url()} — ${req.failure()?.errorText}`);
  });
  page.on('response', (res) => {
    if (res.url().includes('_rsc=')) return;
    if (res.url().includes('/api/v1') && res.status() >= 400) {
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
      if (!navText.includes(item)) {
        issues.push(`${label}: missing nav item "${item}"`);
      }
    }

    await page.screenshot({ path: resolve(OUT, `${label.toLowerCase()}-dashboard.png`), fullPage: true });

    // Spot-check a page
    if (label === 'Employee') {
      await page.locator('aside a[href="/my-profile"]').click();
      await page.waitForSelector('h1:has-text("My Info")', { timeout: 10000 });
      await page.screenshot({ path: resolve(OUT, 'employee-my-profile.png'), fullPage: true });
    }
    if (label === 'Manager') {
      await page.locator('aside a[href="/approvals"]').click();
      await page.waitForSelector('h1:has-text("Approvals")', { timeout: 10000 });
      await page.screenshot({ path: resolve(OUT, 'manager-approvals.png'), fullPage: true });
    }

    if (consoleErrors.length) {
      issues.push(`${label}: console errors — ${consoleErrors.slice(0, 3).join(' | ')}`);
    }
    if (failedRequests.length) {
      issues.push(`${label}: failed API — ${failedRequests.slice(0, 3).join(' | ')}`);
    }

    console.log(`✓ ${label} login + nav OK`);
  } catch (err) {
    issues.push(`${label}: ${err.message}`);
    await page.screenshot({ path: resolve(OUT, `${label.toLowerCase()}-error.png`), fullPage: true });
    console.log(`✗ ${label} FAILED: ${err.message}`);
  } finally {
    await ctx.close();
  }
}

async function main() {
  console.log('MatrixHR UI test — http://localhost:3000\n');
  const browser = await chromium.launch({ headless: true });
  for (const user of USERS) {
    await testUser(browser, user);
  }
  await browser.close();

  const report = { issues, screenshots: OUT, passed: issues.length === 0 };
  writeFileSync(resolve(OUT, 'report.json'), JSON.stringify(report, null, 2));

  console.log('\n── Results ──');
  if (issues.length === 0) {
    console.log('All UI checks passed.');
    console.log(`Screenshots: ${OUT}`);
    process.exit(0);
  } else {
    console.log('Issues found:');
    for (const i of issues) console.log(`  - ${i}`);
    console.log(`Screenshots: ${OUT}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
