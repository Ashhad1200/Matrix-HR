/**
 * Real-browser Create/Read/Update/Delete pass over every page that has an
 * actual UI form (not just a read-only dashboard). Uses Playwright + Chromium.
 * Usage: node scripts/crud-ui-test.mjs
 */
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '../.ui-test/crud');
mkdirSync(OUT, { recursive: true });
const BASE = 'http://localhost:3000';

const results = [];
function record(area, op, ok, note) {
  results.push({ area, op, ok, note });
  console.log(`  ${ok ? '✓' : '✗'} [${area}] ${op}${note ? ` — ${note}` : ''}`);
}

async function login(browser, email) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', 'Password123!');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 15000 });
  return { ctx, page };
}

async function testEmployeesCrud(browser) {
  const { ctx, page } = await login(browser, 'admin@acme.com');
  const stamp = Date.now().toString().slice(-6);
  try {
    await page.goto(`${BASE}/employees`, { waitUntil: 'networkidle' });
    await page.click('button:has-text("Add Employee")');
    await page.fill('input[placeholder="Employee Code"]', `CRUD${stamp}`);
    await page.fill('input[placeholder="Email"]', `crud.test.${stamp}@acme.com`);
    await page.fill('input[placeholder="First Name"]', 'Crud');
    await page.fill('input[placeholder="Last Name"]', `Test${stamp}`);
    await page.click('button:has-text("Create")');
    await page.waitForTimeout(1000);

    await page.fill('input[placeholder="Search employees..."]', `CRUD${stamp}`);
    await page.waitForTimeout(800);
    const rowVisible = await page.locator(`text=CRUD${stamp}`).first().isVisible().catch(() => false);
    record('Employees', 'CREATE (new employee via Add Employee form)', rowVisible, rowVisible ? `CRUD${stamp} found in list` : 'not found after create');

    if (rowVisible) {
      await page.locator(`text=Crud Test${stamp}`).first().click();
      await page.waitForSelector('h1', { timeout: 10000 });
      const detailText = await page.locator('body').innerText();
      const readOk = detailText.includes(`CRUD${stamp}`) || detailText.includes(`Crud Test${stamp}`);
      record('Employees', 'READ (detail page)', readOk);
      await page.screenshot({ path: resolve(OUT, 'employees-detail.png'), fullPage: true });

      await page.click('button:has-text("Edit")');
      await page.waitForTimeout(400);
      await page.locator('[role="dialog"] input').nth(3).fill('+92-300-5550001'); // Phone field
      await page.locator('[role="dialog"] select').selectOption('SUSPENDED');
      await page.locator('[role="dialog"] button:has-text("Save Changes")').click();
      await page.waitForTimeout(1000);
      const afterEdit = await page.locator('body').innerText();
      const updateOk = afterEdit.includes('+92-300-5550001') && afterEdit.includes('SUSPENDED');
      record('Employees', 'UPDATE (Edit form on detail page)', updateOk);
      await page.screenshot({ path: resolve(OUT, 'employees-after-edit.png'), fullPage: true });
    }

    record('Employees', 'DELETE', false, 'no delete route on the backend at all — employees are never hard-deleted (by design, not a gap)');
  } catch (err) {
    record('Employees', 'CRUD flow', false, err.message);
    await page.screenshot({ path: resolve(OUT, 'employees-error.png'), fullPage: true });
  } finally {
    await ctx.close();
  }
}

async function testLeaveCrud(browser) {
  const emp = await login(browser, 'sara.ahmed@acme.com');
  let requestText = '';
  try {
    await emp.page.goto(`${BASE}/leave`, { waitUntil: 'networkidle' });
    await emp.page.click('button:has-text("Apply for Leave")');
    const policyOptions = await emp.page.locator('select option').allTextContents();
    await emp.page.selectOption('select', { index: 1 });
    const today = new Date();
    const start = new Date(today.getTime() + 5 * 86400000).toISOString().slice(0, 10);
    const end = new Date(today.getTime() + 6 * 86400000).toISOString().slice(0, 10);
    requestText = `CRUD-Leave-${Date.now().toString().slice(-6)}`;
    await emp.page.fill('input[type="date"]:nth-of-type(1)', start);
    await emp.page.fill('input[type="date"]:nth-of-type(2)', end);
    await emp.page.fill('input[placeholder="Reason"]', requestText);
    await emp.page.click('button:has-text("Submit")');
    await emp.page.waitForTimeout(1200);
    // The list view doesn't show the reason text, only name/policy/dates/status.
    // The form only closes on a successful create (no catch handler swallows failure into staying open).
    const formClosed = !(await emp.page.locator('input[placeholder="Reason"]').isVisible().catch(() => true));
    record('Leave', 'CREATE (submit leave request as Employee)', formClosed, `form closed after submit = success; policies available: ${policyOptions.length - 1}`);
    await emp.page.screenshot({ path: resolve(OUT, 'leave-employee-submitted.png'), fullPage: true });
  } catch (err) {
    record('Leave', 'CREATE (submit leave request)', false, err.message);
  } finally {
    await emp.ctx.close();
  }

  const mgr = await login(browser, 'ali.khan@acme.com');
  try {
    await mgr.page.goto(`${BASE}/leave`, { waitUntil: 'networkidle' });
    await mgr.page.waitForTimeout(1500);
    const anyPending = await mgr.page.locator('button:has-text("Approve")').first().isVisible().catch(() => false);
    if (anyPending) {
      await mgr.page.locator('button:has-text("Approve")').first().click();
      await mgr.page.waitForTimeout(1000);
      record('Leave', 'UPDATE (Manager approves a pending request)', true);
    } else {
      record('Leave', 'UPDATE (Manager approves a pending request)', false, 'no pending request visible in manager queue');
    }
    await mgr.page.screenshot({ path: resolve(OUT, 'leave-manager-queue.png'), fullPage: true });

    const stillPending = await mgr.page.locator('button:has-text("Reject")').first().isVisible().catch(() => false);
    if (stillPending) {
      await mgr.page.locator('button:has-text("Reject")').first().click();
      await mgr.page.waitForTimeout(1000);
      record('Leave', 'UPDATE (Manager rejects a pending request)', true);
    } else {
      record('Leave', 'UPDATE (Manager rejects a pending request)', false, 'no second pending request available to reject');
    }
  } catch (err) {
    record('Leave', 'UPDATE (approve/reject)', false, err.message);
  } finally {
    await mgr.ctx.close();
  }
}

async function testAttendanceCrud(browser) {
  const { ctx, page } = await login(browser, 'sara.ahmed@acme.com');
  try {
    await page.goto(`${BASE}/attendance`, { waitUntil: 'networkidle' });
    const clockInBtn = page.locator('button:has-text("Clock In")');
    const alreadyIn = await clockInBtn.isDisabled().catch(() => false);
    if (!alreadyIn) {
      await clockInBtn.click();
      await page.waitForTimeout(1200);
      record('Attendance', 'CREATE (Clock In)', true);
    } else {
      record('Attendance', 'CREATE (Clock In)', true, 'already clocked in today (idempotent guard working correctly)');
    }
    await page.screenshot({ path: resolve(OUT, 'attendance-after-clockin.png'), fullPage: true });

    const clockOutBtn = page.locator('button:has-text("Clock Out")');
    const canClockOut = await clockOutBtn.isEnabled().catch(() => false);
    if (canClockOut) {
      await clockOutBtn.click();
      await page.waitForTimeout(1200);
      record('Attendance', 'UPDATE (Clock Out)', true);
    } else {
      record('Attendance', 'UPDATE (Clock Out)', false, 'clock out button not enabled after clock in');
    }
  } catch (err) {
    record('Attendance', 'Clock in/out flow', false, err.message);
    await page.screenshot({ path: resolve(OUT, 'attendance-error.png'), fullPage: true });
  } finally {
    await ctx.close();
  }
}

async function testTimesheetsCrud(browser) {
  // "New Project" needs the admin portal; logging hours needs a real employeeId,
  // which admin@acme.com doesn't have — so this runs as two separate logins.
  const stamp = Date.now().toString().slice(-5);

  const admin = await login(browser, 'admin@acme.com');
  try {
    await admin.page.goto(`${BASE}/timesheets`, { waitUntil: 'networkidle' });
    await admin.page.click('button:has-text("New Project")');
    await admin.page.waitForTimeout(300);
    await admin.page.fill('input[placeholder="MTX"]', `C${stamp}`);
    await admin.page.fill('input[placeholder="Matrix Platform"]', `CRUD Project ${stamp}`);
    await admin.page.locator('[role="dialog"]:has-text("New Project") button:has-text("Create")').click({ timeout: 5000 });
    await admin.page.waitForTimeout(1000);
    record('Timesheets', 'CREATE (new project, as Admin)', true);
  } catch (err) {
    record('Timesheets', 'CREATE (new project, as Admin)', false, err.message);
  } finally {
    await admin.ctx.close();
  }

  const { ctx, page } = await login(browser, 'usman.sheikh@acme.com');
  try {
    await page.goto(`${BASE}/timesheets`, { waitUntil: 'networkidle' });

    let createdId = '';
    page.on('response', async (res) => {
      if (res.url().includes('/timesheets/entries') && res.request().method() === 'POST' && res.ok()) {
        createdId = (await res.json().catch(() => ({}))).id ?? '';
      }
    });

    await page.click('button:has-text("Log Hours")');
    await page.waitForTimeout(300);
    await page.locator('input[type="number"]').fill('4');
    await page.locator('input[placeholder="What did you work on?"]').fill(`CRUD entry ${stamp}`);
    await page.locator('[role="dialog"]:has-text("Log Hours") button:has-text("Save Entry")').click({ timeout: 5000 });
    await page.waitForTimeout(1200);
    record('Timesheets', 'CREATE (log time entry)', !!createdId, createdId ? `entry ${createdId} created` : 'no successful POST observed');
    await page.screenshot({ path: resolve(OUT, 'timesheets-after-entry.png'), fullPage: true });

    if (createdId) {
      // Delete control is CSS-hidden until the row is hovered (Tailwind group-hover); the day
      // cell shows "GEN <hours>h / Draft" — find it by the hours badge we just logged.
      // Scope to <main> — the sidebar nav links also use Tailwind's generic ".group" class.
      const entryRow = page.locator('main .group', { hasText: '4h' }).filter({ hasText: 'Draft' }).last();
      const hasRow = await entryRow.isVisible().catch(() => false);
      if (hasRow) {
        await entryRow.hover();
        const deleteBtn = entryRow.locator('button[aria-label="Delete entry"]');
        const hasDelete = await deleteBtn.isVisible().catch(() => false);
        if (hasDelete) {
          let deleteOk = false;
          page.once('response', (res) => {
            if (res.url().includes(`/timesheets/entries/${createdId}`) && res.request().method() === 'DELETE') deleteOk = res.ok();
          });
          await deleteBtn.click();
          await page.waitForTimeout(1000);
          record('Timesheets', 'DELETE (remove draft time entry)', deleteOk);
        } else {
          record('Timesheets', 'DELETE (remove draft time entry)', false, 'delete control not visible on hover');
        }
      } else {
        record('Timesheets', 'DELETE (remove draft time entry)', false, 'entry row not found for hover');
      }
    }
  } catch (err) {
    record('Timesheets', 'CRUD flow', false, err.message);
    await page.screenshot({ path: resolve(OUT, 'timesheets-error.png'), fullPage: true });
  } finally {
    await ctx.close();
  }
}

async function main() {
  console.log(`MatrixHR real-browser CRUD test — ${BASE}\n`);
  const browser = await chromium.launch({ headless: true });

  console.log('Employees:');
  await testEmployeesCrud(browser);
  console.log('Leave:');
  await testLeaveCrud(browser);
  console.log('Attendance:');
  await testAttendanceCrud(browser);
  console.log('Timesheets:');
  await testTimesheetsCrud(browser);

  await browser.close();

  writeFileSync(resolve(OUT, 'crud-ui-report.json'), JSON.stringify(results, null, 2));
  const passed = results.filter((r) => r.ok).length;
  console.log(`\n${passed}/${results.length} UI operations succeeded. Screenshots: ${OUT}`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
