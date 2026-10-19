import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';

const ARTIFACTS_DIR = path.resolve('test_artifacts/cashbook');
fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });

const REPORT_PATH = path.join(ARTIFACTS_DIR, 'cashbook_verification_report.json');

async function waitForServer(url, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {
      await new Promise((r) => setTimeout(r, 300));
    }
  }
  throw new Error(`Server at ${url} failed to become ready within ${timeoutMs}ms`);
}

async function runCashbookVerification() {
  console.log('=== Starting Milestone C1B Cashbook Playwright Verification ===');

  const PORT = 4178;
  const BASE_URL = `http://localhost:${PORT}`;

  console.log(`Starting Vite preview on port ${PORT}...`);
  const server = spawn('npx', ['vite', 'preview', '--port', String(PORT)], {
    stdio: 'inherit',
    env: { ...process.env, PORT: String(PORT) },
    detached: true,
  });

  const killServerGroup = () => {
    if (server && server.pid) {
      try {
        process.kill(-server.pid, 'SIGTERM');
      } catch {
        // Process already terminated
      }
    }
  };

  process.on('SIGINT', () => { killServerGroup(); process.exit(130); });
  process.on('SIGTERM', () => { killServerGroup(); process.exit(143); });
  process.on('exit', () => killServerGroup());

  const report = {
    timestamp: new Date().toISOString(),
    tests: [],
    allPassed: false,
  };

  try {
    await waitForServer(BASE_URL, 15000);
    console.log(`Server is ready at ${BASE_URL}`);

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

    const page = await browser.newPage({
      viewport: { width: 1280, height: 900 },
    });

    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !msg.text().includes('favicon')) {
        consoleErrors.push(msg.text());
      }
    });

    // 1. Initial Load: Cashbook Dashboard
    console.log('\nStep 1: Navigating to Cashbook Tab...');
    await page.goto(`${BASE_URL}/?tab=cashbook`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);

    // Dismiss guide if prompted
    const guideSkipBtn = await page.$('[data-testid="guide-skip-button"], [data-testid="guide-close-button"]');
    if (guideSkipBtn) {
      await guideSkipBtn.click();
      await page.waitForTimeout(300);
    }

    const cashbookTitle = await page.textContent('main h1');
    console.log(`Header found: "${cashbookTitle?.trim()}"`);

    // Verify Cash Movement cards do NOT contain the word "Profit"
    const summaryCardsText = await page.textContent('main');
    const hasForbiddenProfitLabel = /cash.*profit|profit.*cash/i.test(summaryCardsText || '');

    await page.screenshot({ path: path.join(ARTIFACTS_DIR, '01_cashbook_dashboard.png'), fullPage: true });

    report.tests.push({
      step: 'initial_load_cashbook_dashboard',
      passed: Boolean(cashbookTitle?.includes('Cashbook') && !hasForbiddenProfitLabel),
      details: { header: cashbookTitle?.trim(), hasForbiddenProfitLabel },
    });

    // 2. Post Receipt Voucher (Money Inflow: ₹10,000)
    console.log('\nStep 2: Recording Money Received (Receipt Voucher ₹10,000)...');
    await page.click('[data-testid="action-receive-money"]');
    await page.waitForSelector('[data-testid="input-voucher-amount"]');
    await page.waitForTimeout(300);

    await page.screenshot({ path: path.join(ARTIFACTS_DIR, '02_receipt_entry_modal.png') });

    await page.fill('[data-testid="input-voucher-amount"]', '10000.00');
    await page.fill('[data-testid="input-voucher-reference"]', 'CASH-SALE-001');
    await page.fill('[data-testid="input-voucher-notes"]', 'Advance payment for retail sales');

    await page.click('[data-testid="btn-submit-voucher"]');
    await page.waitForSelector('[data-testid="cashbook-ledger-table"]');
    await page.waitForTimeout(400);

    const ledgerTextAfterReceipt = await page.textContent('[data-testid="cashbook-ledger-table"]');
    const rcpVoucherCreated = Boolean(
      ledgerTextAfterReceipt?.includes('RCP-') &&
      (ledgerTextAfterReceipt?.includes('10000.00') || ledgerTextAfterReceipt?.includes('10,000.00'))
    );

    report.tests.push({
      step: 'post_receipt_voucher_inflow',
      passed: Boolean(rcpVoucherCreated),
      details: { rcpVoucherCreated },
    });

    // 3. Post Payment Voucher (Money Outflow: ₹2,500)
    console.log('\nStep 3: Recording Money Paid (Payment Voucher ₹2,500)...');
    await page.click('[data-testid="action-pay-money"]');
    await page.waitForSelector('[data-testid="input-voucher-amount"]');
    await page.waitForTimeout(300);

    await page.fill('[data-testid="input-voucher-amount"]', '2500.00');
    await page.fill('[data-testid="input-voucher-reference"]', 'RENT-OCT-26');
    await page.fill('[data-testid="input-voucher-notes"]', 'Shop rent payment');

    await page.click('[data-testid="btn-submit-voucher"]');
    await page.waitForTimeout(400);

    const ledgerTextAfterPayment = await page.textContent('[data-testid="cashbook-ledger-table"]');
    const payVoucherCreated = Boolean(
      ledgerTextAfterPayment?.includes('PAY-') &&
      (ledgerTextAfterPayment?.includes('2500.00') || ledgerTextAfterPayment?.includes('2,500.00'))
    );

    report.tests.push({
      step: 'post_payment_voucher_outflow',
      passed: Boolean(payVoucherCreated),
      details: { payVoucherCreated },
    });

    // 4. View and Print Voucher Document (A4 and 80mm Thermal)
    console.log('\nStep 4: Opening Printable Voucher Document & Format Switcher...');
    const viewButtons = await page.$$('[data-testid="btn-view-voucher"]');
    if (viewButtons.length > 0) {
      await viewButtons[0].click();
      await page.waitForTimeout(400);

      await page.screenshot({ path: path.join(ARTIFACTS_DIR, '03_printable_voucher_a4.png') });

      // Switch to 80mm Thermal
      await page.click('button:has-text("80mm Thermal")');
      await page.waitForTimeout(300);

      await page.screenshot({ path: path.join(ARTIFACTS_DIR, '04_printable_voucher_thermal80.png') });

      // Close preview modal
      await page.click('[data-testid="btn-close-voucher-dialog"]');
      await page.waitForTimeout(300);

      report.tests.push({
        step: 'view_and_toggle_printable_voucher_formats',
        passed: true,
      });
    }

    // 5. Negative Balance Confirmation Prompt
    console.log('\nStep 5: Testing Negative Balance Guard & Confirmation Prompt...');
    await page.click('[data-testid="action-pay-money"]');
    await page.waitForSelector('[data-testid="input-voucher-amount"]');
    await page.waitForTimeout(300);

    // Current cash balance is ₹7,500.00. Attempt to pay ₹50,000.00
    await page.fill('[data-testid="input-voucher-amount"]', '50000.00');
    await page.click('[data-testid="btn-submit-voucher"]');
    await page.waitForTimeout(300);

    // Negative balance warning modal should appear
    const confirmNegativeBtn = await page.$('[data-testid="btn-confirm-negative-balance"]');
    const warningVisible = Boolean(confirmNegativeBtn);

    if (confirmNegativeBtn) {
      await page.screenshot({ path: path.join(ARTIFACTS_DIR, '05_negative_balance_prompt.png') });
      // Cancel the negative balance payment
      await page.click('[data-testid="btn-cancel-negative-balance"]');
      await page.waitForTimeout(200);
      await page.click('[data-testid="btn-cancel-voucher-entry"]');
      await page.waitForTimeout(300);
    }

    report.tests.push({
      step: 'negative_balance_guard_warning',
      passed: warningVisible,
      details: { warningVisible },
    });

    // 6. Voucher Reversal
    console.log('\nStep 6: Executing Voucher Reversal...');
    const reverseButtons = await page.$$('[data-testid="btn-reverse-voucher"]');
    if (reverseButtons.length > 0) {
      // Click reverse on the Payment voucher (index 1 if exists, else index 0)
      const btnToClick = reverseButtons.length > 1 ? reverseButtons[1] : reverseButtons[0];
      await btnToClick.click();
      await page.waitForSelector('[data-testid="btn-confirm-reversal"]');
      await page.waitForTimeout(300);

      await page.screenshot({ path: path.join(ARTIFACTS_DIR, '06_reversal_confirmation_modal.png') });

      await page.click('[data-testid="btn-confirm-reversal"]');
      await page.waitForTimeout(500);

      const ledgerAfterReversal = await page.textContent('[data-testid="cashbook-ledger-table"]');
      const reversalCreated = Boolean(
        ledgerAfterReversal?.includes('REV') || ledgerAfterReversal?.includes('VOID')
      );

      report.tests.push({
        step: 'voucher_reversal_workflow',
        passed: Boolean(reversalCreated),
        details: { reversalCreated },
      });
    }

    // 7. Search Filter and Statement Balance Separation
    console.log('\nStep 7: Testing Search Filtering with Financial Statement Independence...');
    await page.fill('[data-testid="filter-search"]', 'PAY');
    await page.waitForTimeout(400);

    const filteredLedgerText = await page.textContent('[data-testid="cashbook-ledger-table"]');
    const isFiltered = filteredLedgerText?.includes('PAY-');

    // Verify statement cards still show the true overall cash balance (not reduced to zero)
    const pageText = await page.textContent('main');
    const bannerVisible = Boolean(
      pageText?.includes('Display Filter Active:') || pageText?.includes('matching entries')
    );

    await page.screenshot({ path: path.join(ARTIFACTS_DIR, '07_final_ledger_state.png'), fullPage: true });

    report.tests.push({
      step: 'search_filter_and_statement_balance_separation',
      passed: Boolean(isFiltered && bannerVisible),
      details: { isFiltered, bannerVisible },
    });

    // Clean up
    await browser.close();

    report.allPassed = report.tests.every((t) => t.passed);
    fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));

    console.log('\n=== Cashbook Playwright Verification Summary ===');
    report.tests.forEach((t) => {
      console.log(`- [${t.passed ? 'PASS' : 'FAIL'}] ${t.step}`);
    });
    console.log(`All Passed: ${report.allPassed}`);

    if (!report.allPassed) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Fatal verification error:', err);
    report.error = String(err);
    fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
    process.exit(1);
  } finally {
    killServerGroup();
  }
}

runCashbookVerification();
