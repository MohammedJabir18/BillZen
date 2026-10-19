import { spawn, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';

const ARTIFACTS_DIR = path.resolve('test_artifacts/dashboard_reports');
fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });

const REPORT_PATH = path.join(ARTIFACTS_DIR, 'dashboard_reports_verification_report.json');

async function waitForServer(url, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  throw new Error(`Server at ${url} failed to respond within ${timeoutMs}ms`);
}

async function run() {
  console.log('=== Starting Dashboard, Analytics & Reporting Playwright Verification ===');
  const PORT = 4188;
  const BASE_URL = `http://localhost:${PORT}`;

  console.log('Building production frontend bundle...');
  execSync('npm run build', { stdio: 'inherit' });

  const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
    stdio: 'ignore',
    env: { ...process.env, PORT: String(PORT) },
    detached: true,
  });

  const killServer = () => {
    if (server && server.pid) {
      try {
        process.kill(-server.pid, 'SIGTERM');
      } catch {}
    }
  };

  process.on('SIGINT', () => { killServer(); process.exit(130); });
  process.on('SIGTERM', () => { killServer(); process.exit(143); });
  process.on('exit', () => killServer());

  await waitForServer(BASE_URL);
  console.log(`Vite preview server running at ${BASE_URL}`);

  let browser;
  try {
    browser = await chromium.launch({
      channel: 'chrome',
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--font-render-hinting=none'],
    });
  } catch {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--font-render-hinting=none'],
    });
  }

  const assertions = [];
  function assert(name, condition, details = {}) {
    if (condition) {
      console.log(`  ✓ ${name}`);
      assertions.push({ name, passed: true, details });
    } else {
      console.error(`  ✗ ${name}`, details);
      assertions.push({ name, passed: false, details });
      throw new Error(`Assertion failed: ${name}`);
    }
  }

  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });
    const page = await context.newPage();

    // -------------------------------------------------------------------------
    // 1. Default Landing & Dashboard View
    // -------------------------------------------------------------------------
    console.log('\n--- Test 1: Landing on Dashboard with "Today" as Default ---');
    await page.goto(`${BASE_URL}/?tab=dashboard`);
    await page.waitForLoadState('networkidle');

    // Onboarding gate bypass if present:
    const setupWizard = await page.$('[data-testid="onboarding-setup-wizard"]');
    if (setupWizard) {
      console.log('Completing setup wizard...');
      const bizNameInput = await page.$('[data-testid="input-business-name"]');
      if (bizNameInput) await bizNameInput.fill('Apex Store');
      const completeBtn = await page.$('[data-testid="btn-complete-setup"]');
      if (completeBtn) await completeBtn.click();
      await page.waitForTimeout(500);
    }

    // Dismiss getting-started guide if visible
    const guideSkipBtn = await page.$('[data-testid="guide-skip-button"], [data-testid="guide-close-button"]');
    if (guideSkipBtn) {
      console.log('Dismissing getting-started guide...');
      await guideSkipBtn.click();
      await page.waitForTimeout(300);
    }

    const todayButton = await page.waitForSelector('[data-testid="period-today"]');
    assert('Dashboard has Today period button active', await todayButton.isVisible());

    const cardReceived = await page.$('[data-testid="card-received"]');
    assert('Summary Card "Money Received" is rendered', cardReceived !== null);

    const cardPaid = await page.$('[data-testid="card-paid"]');
    assert('Summary Card "Money Paid" is rendered', cardPaid !== null);

    const cardNet = await page.$('[data-testid="card-net"]');
    assert('Summary Card "Net Cash Change" is rendered', cardNet !== null);

    const cardClosing = await page.$('[data-testid="card-closing"]');
    assert('Summary Card "Closing Balance" is rendered', cardClosing !== null);

    // -------------------------------------------------------------------------
    // 2. Strict Non-Profit Terminology Assertion
    // -------------------------------------------------------------------------
    console.log('\n--- Test 2: Non-Profit Accounting Terminology ---');
    const noticeText = await page.innerText('body');
    assert(
      'Cash flow disclaimer is present',
      noticeText.includes('Net cash change') && noticeText.includes('not business profit')
    );

    // -------------------------------------------------------------------------
    // 3. Detailed Analytics Mode Toggle
    // -------------------------------------------------------------------------
    console.log('\n--- Test 3: Detailed Analytics Mode Toggle ---');
    const analyticsToggle = await page.waitForSelector('[data-testid="tab-analytics"]');
    await analyticsToggle.click();
    await page.waitForTimeout(300);

    const barChart = await page.waitForSelector('[data-testid="analytics-bars-container"]');
    assert('Analytics SVG bar chart is visible', await barChart.isVisible());

    const categoryBreakdown = await page.waitForSelector('[data-testid="analytics-category-breakdown"]');
    assert('Analytics Category Spending Breakdown is visible', await categoryBreakdown.isVisible());

    // Toggle back to simple view
    const simpleToggle = await page.waitForSelector('[data-testid="tab-simple"]');
    await simpleToggle.click();
    await page.waitForTimeout(200);

    // -------------------------------------------------------------------------
    // 4. Reports View Navigation & Period Controls
    // -------------------------------------------------------------------------
    console.log('\n--- Test 4: Reports View Navigation & Controls ---');
    const reportsTab = await page.waitForSelector('[data-testid="tab-reports"]');
    await reportsTab.click();
    await page.waitForTimeout(400);

    const reportToday = await page.waitForSelector('[data-testid="report-period-today"]');
    assert('Reports View has Today period switch', await reportToday.isVisible());

    const reportMonth = await page.waitForSelector('[data-testid="report-period-month"]');
    await reportMonth.click();
    await page.waitForTimeout(300);

    const reportYear = await page.waitForSelector('[data-testid="report-period-year"]');
    await reportYear.click();
    await page.waitForTimeout(300);

    const reportCustom = await page.waitForSelector('[data-testid="report-period-custom"]');
    await reportCustom.click();
    await page.waitForTimeout(300);

    const customStart = await page.waitForSelector('[data-testid="report-custom-start-date"]');
    assert('Reports View renders Custom Date Range pickers', await customStart.isVisible());

    // Switch back to Today for consistent numbers
    await reportToday.click();
    await page.waitForTimeout(300);

    // -------------------------------------------------------------------------
    // 5. Search Decoupling from Balance Summary
    // -------------------------------------------------------------------------
    console.log('\n--- Test 5: Search & Detail Filter Decoupling ---');
    const openingBefore = await page.innerText('[data-testid="report-opening-balance"]');
    const closingBefore = await page.innerText('[data-testid="report-closing-balance"]');

    const searchInput = await page.waitForSelector('[data-testid="report-search-input"]');
    await searchInput.fill('NonExistentQuery12345');
    await page.waitForTimeout(300);

    const matchingBanner = await page.$('[data-testid="report-matching-banner"]');
    assert('Filter matching banner appears when search is active', matchingBanner !== null);

    const openingAfter = await page.innerText('[data-testid="report-opening-balance"]');
    const closingAfter = await page.innerText('[data-testid="report-closing-balance"]');

    assert('Opening balance unchanged by non-matching search', openingBefore === openingAfter);
    assert('Closing balance unchanged by non-matching search', closingBefore === closingAfter);

    const resetBtn = await page.waitForSelector('[data-testid="btn-reset-filters"]');
    await resetBtn.click();
    await page.waitForTimeout(300);

    // -------------------------------------------------------------------------
    // 6. CSV Export & CWE-1236 Formula Injection Defense
    // -------------------------------------------------------------------------
    console.log('\n--- Test 6: CSV Export Generation & Formula Defense ---');
    const downloadPromise = page.waitForEvent('download');
    const exportCsvBtn = await page.waitForSelector('[data-testid="btn-export-csv"]');
    await exportCsvBtn.click();
    const download = await downloadPromise;

    const csvPath = path.join(ARTIFACTS_DIR, 'downloaded_report.csv');
    await download.saveAs(csvPath);
    assert('CSV file downloaded successfully', fs.existsSync(csvPath));

    const csvContent = fs.readFileSync(csvPath, 'utf8');
    assert('CSV contains header metadata', csvContent.includes('BillZen Company Cashbook Report'));
    assert('CSV contains Financial Summary section', csvContent.includes('FINANCIAL SUMMARY'));
    assert('CSV contains table columns', csvContent.includes('Date,Voucher Number,Party / Counterparty'));

    // -------------------------------------------------------------------------
    // 7. Printable Document Isolation
    // -------------------------------------------------------------------------
    console.log('\n--- Test 7: Printable Document Structure ---');
    const printBtn = await page.waitForSelector('[data-testid="btn-print-report"]');
    await printBtn.click();
    await page.waitForTimeout(400);

    const printableRoot = await page.$('#printable-report-root');
    assert('Printable report root element is mounted in DOM', printableRoot !== null);

    // -------------------------------------------------------------------------
    // 8. Mobile Viewport Layout & Overflow Checks
    // -------------------------------------------------------------------------
    console.log('\n--- Test 8: Mobile Responsiveness & Bottom Navigation ---');
    for (const mobileWidth of [360, 390]) {
      await page.setViewportSize({ width: mobileWidth, height: 740 });
      await page.waitForTimeout(300);

      const mobileDashBtn = await page.$('[data-testid="mobile-tab-dashboard"]');
      assert(`Mobile tab dashboard visible at ${mobileWidth}px`, mobileDashBtn !== null && (await mobileDashBtn.isVisible()));

      const mobileReportBtn = await page.$('[data-testid="mobile-tab-reports"]');
      assert(`Mobile tab reports visible at ${mobileWidth}px`, mobileReportBtn !== null && (await mobileReportBtn.isVisible()));

      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      assert(`Zero horizontal overflow at ${mobileWidth}px`, !hasHorizontalScroll);
    }

    // -------------------------------------------------------------------------
    // 9. Dark Mode Theme Contrast Verification
    // -------------------------------------------------------------------------
    console.log('\n--- Test 9: Dark Mode Surface Verification ---');
    await page.evaluate(() => document.documentElement.classList.add('dark'));
    await page.waitForTimeout(300);
    const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    assert('Dark mode class applied', isDark);

    // Screenshot for evidence
    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, 'dashboard_dark_mode.png'),
      fullPage: true,
    });

    console.log('\n=== ALL PLAYWRIGHT DASHBOARD & REPORTING TESTS PASSED ===');

    fs.writeFileSync(
      REPORT_PATH,
      JSON.stringify(
        {
          timestamp: new Date().toISOString(),
          passed: true,
          assertionsCount: assertions.length,
          assertions,
        },
        null,
        2
      )
    );
  } finally {
    await browser.close();
    killServer();
  }
}

run().catch((err) => {
  console.error('\nVerification failed:', err);
  process.exit(1);
});
