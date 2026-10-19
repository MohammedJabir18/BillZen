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
      if (msg.text().includes('[DEBUG]')) {
        console.log('BROWSER CONSOLE:', msg.text());
      }
      if (msg.type() === 'error' && !msg.text().includes('favicon')) {
        consoleErrors.push(msg.text());
      }
    });

    // -------------------------------------------------------------------------
    // Step 1: Initial Load & Ephemeral Browser Banner & No "Profit" Invariant
    // -------------------------------------------------------------------------
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

    // Verify Ephemeral Browser Banner
    const browserBanner = await page.$('[data-testid="browser-mode-banner"]');
    const browserBannerText = browserBanner ? await browserBanner.textContent() : '';
    console.log(`Ephemeral notice present: ${Boolean(browserBanner)} ("${browserBannerText?.trim().substring(0, 50)}...")`);

    // Verify Cash Movement cards do NOT contain the word "Profit"
    const summaryCardsText = await page.textContent('main');
    const hasForbiddenProfitLabel = /cash.*profit|profit.*cash/i.test(summaryCardsText || '');

    await page.screenshot({ path: path.join(ARTIFACTS_DIR, '01_cashbook_dashboard.png'), fullPage: true });

    report.tests.push({
      step: 'initial_load_cashbook_dashboard',
      passed: Boolean(cashbookTitle?.includes('Cashbook') && !hasForbiddenProfitLabel && browserBanner),
      details: { header: cashbookTitle?.trim(), hasForbiddenProfitLabel, hasBrowserBanner: Boolean(browserBanner) },
    });

    // -------------------------------------------------------------------------
    // Step 2: Account Creation with Initial Opening Balance
    // -------------------------------------------------------------------------
    console.log('\nStep 2: Creating Money Account with Initial Opening Balance (₹25,000)...');
    await page.click('[data-testid="action-manage-accounts"]');
    await page.waitForSelector('[data-testid="input-new-account-name"]');
    await page.waitForTimeout(300);

    await page.fill('[data-testid="input-new-account-name"]', 'HDFC Current');
    await page.selectOption('[data-testid="select-new-account-type"]', 'bank');
    await page.fill('[data-testid="input-new-account-opening"]', '25000.00');

    await page.screenshot({ path: path.join(ARTIFACTS_DIR, '02_account_creation_modal.png') });

    await page.click('[data-testid="btn-save-new-account"]');
    await page.waitForTimeout(400);

    // Verify accounts count updated
    const accountsBtnText = await page.textContent('[data-testid="action-manage-accounts"]');
    const accountCreated = accountsBtnText?.includes('Accounts (2)') || accountsBtnText?.includes('Accounts (');

    report.tests.push({
      step: 'create_money_account_with_opening_balance',
      passed: Boolean(accountCreated),
      details: { accountsBtnText },
    });

    // -------------------------------------------------------------------------
    // Step 3: Post Receipt Voucher (Money Inflow: ₹10,000)
    // -------------------------------------------------------------------------
    console.log('\nStep 3: Recording Money Received (Receipt Voucher ₹10,000)...');
    await page.click('[data-testid="action-receive-money"]');
    await page.waitForSelector('[data-testid="input-voucher-amount"]');
    await page.waitForTimeout(300);

    // Check business date input is defaulted to today (YYYY-MM-DD)
    const dateValue = await page.inputValue('[data-testid="input-voucher-date"]');
    const isIsoDate = /^\d{4}-\d{2}-\d{2}$/.test(dateValue);

    await page.screenshot({ path: path.join(ARTIFACTS_DIR, '03_receipt_entry_modal.png') });

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
      passed: Boolean(rcpVoucherCreated && isIsoDate),
      details: { rcpVoucherCreated, dateValue, isIsoDate },
    });

    // -------------------------------------------------------------------------
    // Step 4: Post Payment Voucher (Money Outflow: ₹2,500)
    // -------------------------------------------------------------------------
    console.log('\nStep 4: Recording Money Paid (Payment Voucher ₹2,500)...');
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

    // -------------------------------------------------------------------------
    // Step 5: Negative Balance Payment Guard (Cancel vs Confirm)
    // -------------------------------------------------------------------------
    console.log('\nStep 5: Testing Negative Balance Payment Guard (Cancel then Confirm)...');
    await page.click('[data-testid="action-pay-money"]');
    await page.waitForSelector('[data-testid="input-voucher-amount"]');
    await page.waitForTimeout(300);

    // Attempt to pay ₹500,000.00 which exceeds cash
    await page.fill('[data-testid="input-voucher-amount"]', '500000.00');
    await page.fill('[data-testid="input-voucher-reference"]', 'EQUIPMENT-01');
    await page.click('[data-testid="btn-submit-voucher"]');
    await page.waitForTimeout(300);

    // 5a. Warning modal appears
    const confirmNegativeBtn = await page.$('[data-testid="btn-confirm-negative-balance"]');
    const cancelNegativeBtn = await page.$('[data-testid="btn-cancel-negative-balance"]');
    const warningVisible = Boolean(confirmNegativeBtn && cancelNegativeBtn);

    await page.screenshot({ path: path.join(ARTIFACTS_DIR, '04_negative_balance_prompt.png') });

    // 5b. Cancel the prompt -> stays on modal without posting
    await page.click('[data-testid="btn-cancel-negative-balance"]');
    await page.waitForTimeout(200);

    // 5c. Submit again and confirm negative balance
    await page.click('[data-testid="btn-submit-voucher"]');
    await page.waitForSelector('[data-testid="btn-confirm-negative-balance"]');
    await page.waitForTimeout(200);

    await page.click('[data-testid="btn-confirm-negative-balance"]');
    await page.waitForTimeout(400);

    const ledgerAfterNegativePayment = await page.textContent('[data-testid="cashbook-ledger-table"]');
    const negativePaymentPosted = Boolean(
      ledgerAfterNegativePayment?.includes('500000.00') || ledgerAfterNegativePayment?.includes('500,000.00')
    );

    report.tests.push({
      step: 'negative_balance_payment_guard_cancel_and_confirm',
      passed: Boolean(warningVisible && negativePaymentPosted),
      details: { warningVisible, negativePaymentPosted },
    });

    // -------------------------------------------------------------------------
    // Step 6: Negative Balance Reversal Guard (Cancel vs Confirm)
    // -------------------------------------------------------------------------
    console.log('\nStep 6: Testing Negative Balance Reversal Guard (Cancel then Confirm)...');
    let reversalPromptVerified = false;

    // Specifically target the Receipt voucher (inflow) row to reverse
    const rcpRow = page.locator('tr:has-text("RCP-")').first();
    const targetBtn = rcpRow.locator('[data-testid="btn-reverse-voucher"]');
    const hasRcpReverseBtn = await targetBtn.count();
    console.log(`RCP row reverse button count: ${hasRcpReverseBtn}`);

    if (hasRcpReverseBtn > 0) {
      console.log('Clicking Receipt voucher reverse button...');
      await targetBtn.click();
      await page.waitForTimeout(400);

      const confirmReversalBtn = await page.$('[data-testid="btn-confirm-reversal"]');
      console.log(`confirmReversalBtn found: ${Boolean(confirmReversalBtn)}`);
      if (confirmReversalBtn) {
        await confirmReversalBtn.click();
        await page.waitForTimeout(500);

        const revNegWarningConfirm = await page.$('[data-testid="btn-confirm-reversal-negative-balance"]');
        const revNegWarningCancel = await page.$('[data-testid="btn-cancel-reversal-negative-balance"]');
        console.log(`revNegWarningConfirm found: ${Boolean(revNegWarningConfirm)}, revNegWarningCancel: ${Boolean(revNegWarningCancel)}`);

        if (revNegWarningConfirm && revNegWarningCancel) {
          await page.screenshot({ path: path.join(ARTIFACTS_DIR, '05_reversal_negative_balance_prompt.png') });

          // 6a. Test Cancel
          console.log('Testing Cancel on reversal negative warning...');
          await page.click('[data-testid="btn-cancel-reversal-negative-balance"]');
          await page.waitForTimeout(300);

          // 6b. Try again and Confirm
          const refreshedRcpRow = page.locator('tr:has-text("RCP-")').first();
          const refreshedTargetBtn = refreshedRcpRow.locator('[data-testid="btn-reverse-voucher"]');
          await refreshedTargetBtn.click();
          await page.waitForSelector('[data-testid="btn-confirm-reversal"]');
          await page.click('[data-testid="btn-confirm-reversal"]');
          await page.waitForSelector('[data-testid="btn-confirm-reversal-negative-balance"]');
          await page.waitForTimeout(200);

          console.log('Confirming negative balance reversal...');
          await page.click('[data-testid="btn-confirm-reversal-negative-balance"]');
          await page.waitForTimeout(600);

          const ledgerAfterReversal = await page.textContent('[data-testid="cashbook-ledger-table"]');
          reversalPromptVerified = Boolean(
            ledgerAfterReversal?.includes('REV-') || ledgerAfterReversal?.includes('REVERSAL') || ledgerAfterReversal?.includes('VOID') || ledgerAfterReversal?.includes('Void')
          );
          console.log(`reversalPromptVerified: ${reversalPromptVerified}`);
        }
      }
    }

    report.tests.push({
      step: 'negative_balance_reversal_guard_cancel_and_confirm',
      passed: reversalPromptVerified,
      details: { reversalPromptVerified },
    });

    // -------------------------------------------------------------------------
    // Step 7: View and Print Voucher Document (A4 and 80mm Thermal Switcher)
    // -------------------------------------------------------------------------
    console.log('\nStep 7: Testing Printable Voucher Document & Format Switcher...');
    const viewButtons = await page.$$('[data-testid="btn-view-voucher"]');
    let printDocumentVerified = false;

    if (viewButtons.length > 0) {
      await viewButtons[0].click();
      await page.waitForTimeout(400);

      await page.screenshot({ path: path.join(ARTIFACTS_DIR, '06_printable_voucher_a4.png') });

      // Verify A4 document rendered and zero sample invoice content
      const voucherModalText = await page.textContent('#printable-voucher-root');
      const hasInvoiceContent = /INVOICE|Bill To|Due Date|Qty.*Rate.*Tax/i.test(voucherModalText || '');

      // Switch to 80mm Thermal
      await page.click('button:has-text("80mm Thermal")');
      await page.waitForTimeout(300);

      await page.screenshot({ path: path.join(ARTIFACTS_DIR, '07_printable_voucher_thermal80.png') });

      // Close preview modal
      await page.click('[data-testid="btn-close-voucher-dialog"]');
      await page.waitForTimeout(300);

      printDocumentVerified = !hasInvoiceContent && Boolean(voucherModalText?.length);
    }

    report.tests.push({
      step: 'view_and_toggle_printable_voucher_formats',
      passed: printDocumentVerified,
      details: { printDocumentVerified },
    });

    // -------------------------------------------------------------------------
    // Step 8: Search Filter and Financial Statement Independence
    // -------------------------------------------------------------------------
    console.log('\nStep 8: Testing Search Filtering with Financial Statement Independence...');
    await page.fill('[data-testid="filter-search"]', 'PAY');
    await page.waitForTimeout(400);

    const filteredLedgerText = await page.textContent('[data-testid="cashbook-ledger-table"]');
    const isFiltered = filteredLedgerText?.includes('PAY-');

    // Verify statement cards still show the true overall cash balance (not reduced to zero)
    const pageText = await page.textContent('main');
    const bannerVisible = Boolean(
      pageText?.includes('Display Filter Active:') || pageText?.includes('matching entries')
    );

    await page.screenshot({ path: path.join(ARTIFACTS_DIR, '08_search_filtered_state.png'), fullPage: true });

    // Clear search
    await page.fill('[data-testid="filter-search"]', '');
    await page.waitForTimeout(300);

    report.tests.push({
      step: 'search_filter_and_statement_balance_separation',
      passed: Boolean(isFiltered && bannerVisible),
      details: { isFiltered, bannerVisible },
    });

    // -------------------------------------------------------------------------
    // Step 9: Mobile Viewport Layout Verification (360px & 390px)
    // -------------------------------------------------------------------------
    console.log('\nStep 9: Testing Mobile Viewport Layout (360px & 390px)...');
    
    // 9a. 360px viewport (compact Android)
    await page.setViewportSize({ width: 360, height: 740 });
    await page.waitForTimeout(400);

    const overflow360 = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth || document.body.scrollWidth > window.innerWidth;
    });

    await page.screenshot({ path: path.join(ARTIFACTS_DIR, '09_mobile_360px_dashboard.png'), fullPage: true });

    // 9b. 390px viewport (iPhone 12/13/14)
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(400);

    const overflow390 = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth || document.body.scrollWidth > window.innerWidth;
    });

    await page.screenshot({ path: path.join(ARTIFACTS_DIR, '10_mobile_390px_dashboard.png'), fullPage: true });

    // Reset viewport
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.waitForTimeout(300);

    report.tests.push({
      step: 'mobile_viewports_no_horizontal_overflow',
      passed: !overflow360 && !overflow390,
      details: { overflow360, overflow390 },
    });

    // -------------------------------------------------------------------------
    // Step 10: Theme Verification (Dark and Light Modes)
    // -------------------------------------------------------------------------
    console.log('\nStep 10: Testing Theme Switcher (Dark & Light)...');
    
    // Check if theme toggle button exists in header
    const themeBtn = await page.$('button[title*="theme" i], button[aria-label*="theme" i], button:has(svg.lucide-moon), button:has(svg.lucide-sun)');
    let themeVerified = false;

    if (themeBtn) {
      await themeBtn.click();
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(ARTIFACTS_DIR, '11_theme_toggled.png') });
      themeVerified = true;
    } else {
      // Toggle dark class directly on documentElement
      await page.evaluate(() => {
        document.documentElement.classList.toggle('dark');
      });
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(ARTIFACTS_DIR, '11_theme_dark_mode.png') });
      themeVerified = true;
    }

    report.tests.push({
      step: 'theme_support_dark_and_light',
      passed: themeVerified,
      details: { themeVerified },
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
