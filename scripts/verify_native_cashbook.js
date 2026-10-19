import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ARTIFACTS_DIR = path.resolve('test_artifacts/native_cashbook');
fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
const REPORT_PATH = path.join(ARTIFACTS_DIR, 'native_cashbook_verification_report.json');

const BINARY_PATH = path.resolve('src-tauri/target/release/billzen');

async function waitForHttp(url, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  throw new Error(`Server at ${url} failed to respond within ${timeoutMs}ms`);
}

async function runNativeVerification() {
  console.log('=== BillZen Native Desktop Cashbook Automated Verification ===');

  // 1. Verify binary exists and is fresh
  if (!fs.existsSync(BINARY_PATH)) {
    throw new Error(`Native binary not found at ${BINARY_PATH}`);
  }
  const stat = fs.statSync(BINARY_PATH);
  const ageSeconds = (Date.now() - stat.mtimeMs) / 1000;
  console.log(`Binary: ${BINARY_PATH}`);
  console.log(`Binary size: ${(stat.size / (1024 * 1024)).toFixed(2)} MB`);
  console.log(`Binary age: ${ageSeconds.toFixed(1)} seconds ago`);

  if (ageSeconds > 3600) {
    throw new Error(`Binary is older than 1 hour (${ageSeconds}s). Fresh build required.`);
  }

  // 2. Check user real business data path to ensure it is protected
  const userRealDir = path.join(os.homedir(), '.local/share/billzen');
  let realDirInitialMtime = null;
  if (fs.existsSync(userRealDir)) {
    realDirInitialMtime = fs.statSync(userRealDir).mtimeMs;
    console.log(`Real user business directory found at: ${userRealDir} (mtime: ${new Date(realDirInitialMtime).toISOString()})`);
  } else {
    console.log(`Real user business directory does not exist yet at ${userRealDir}.`);
  }

  // 3. Create isolated temporary directory for test database
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'billzen-native-cashbook-'));
  console.log(`Isolated test data directory: ${tempDir}`);

  const PORT = 9235;
  const INSPECTOR_URL = `http://127.0.0.1:${PORT}/`;
  const WS_URL = `ws://127.0.0.1:${PORT}/socket/1/1/WebPage`;

  console.log(`Launching native release binary with isolated BILLZEN_DATA_DIR...`);
  const appProcess = spawn(BINARY_PATH, [], {
    env: {
      ...process.env,
      BILLZEN_DATA_DIR: tempDir,
      WEBKIT_INSPECTOR_HTTP_SERVER: `127.0.0.1:${PORT}`,
      RUST_BACKTRACE: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const killApp = () => {
    if (appProcess && appProcess.pid) {
      try {
        appProcess.kill('SIGTERM');
      } catch {}
    }
  };

  process.on('SIGINT', () => { killApp(); process.exit(130); });
  process.on('SIGTERM', () => { killApp(); process.exit(143); });
  process.on('exit', () => killApp());

  appProcess.stderr.on('data', (d) => {
    const s = d.toString();
    if (!s.includes('Glycin') && !s.includes('sandbox')) {
      console.log('[Native App Stderr]:', s.trim());
    }
  });

  const report = {
    timestamp: new Date().toISOString(),
    binary: {
      path: BINARY_PATH,
      sizeBytes: stat.size,
      mtime: stat.mtime.toISOString(),
    },
    isolatedDataDir: tempDir,
    tests: [],
    allPassed: false,
  };

  const recordTest = (step, passed, details = {}) => {
    console.log(`  [${passed ? 'PASS' : 'FAIL'}] ${step}`, details);
    report.tests.push({ step, passed, details });
  };

  try {
    // Wait for inspector to start
    console.log(`Waiting for WebKit inspector at ${INSPECTOR_URL}...`);
    await waitForHttp(INSPECTOR_URL, 15000);
    console.log('WebKit Inspector is responding. Pausing 500ms before connecting WebSocket...');
    await new Promise((r) => setTimeout(r, 500));

    // Connect to WebSocket
    const ws = new WebSocket(WS_URL);

    let targetId = null;
    let msgCounter = 100;
    const pendingRequests = new Map();

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.method === 'Target.targetCreated' && msg.params?.targetInfo?.type === 'page') {
          targetId = msg.params.targetInfo.targetId;
          console.log(`[Inspector] Target created: ${targetId}`);
        } else if (msg.method === 'Target.dispatchMessageFromTarget') {
          const inner = JSON.parse(msg.params.message);
          if (inner.id && pendingRequests.has(inner.id)) {
            const { resolve, reject } = pendingRequests.get(inner.id);
            pendingRequests.delete(inner.id);
            if (inner.error) {
              reject(new Error(inner.error.message || JSON.stringify(inner.error)));
            } else if (inner.result?.wasThrown) {
              reject(new Error(inner.result.result?.value || JSON.stringify(inner.result)));
            } else {
              // WebKit Inspector may return value in inner.result.result.value or inner.result.value
              const val = inner.result?.result?.value !== undefined 
                ? inner.result.result.value 
                : (inner.result?.result?.description === 'true' ? true : (inner.result?.result?.description === 'false' ? false : inner.result?.result));
              resolve(val);
            }
          }
        }
      } catch (err) {
        console.warn('Error parsing WS message:', err);
      }
    };

    await new Promise((resolve, reject) => {
      ws.onopen = () => {
        console.log('[Inspector] WebSocket opened successfully.');
        resolve();
      };
      ws.onerror = (e) => reject(new Error('WebSocket connection failed: ' + e.message));
      setTimeout(() => reject(new Error('WebSocket connection timed out')), 10000);
    });

    // Wait until targetId is assigned
    const startWait = Date.now();
    while (!targetId && Date.now() - startWait < 15000) {
      await new Promise((r) => setTimeout(r, 100));
    }

    if (!targetId) {
      throw new Error('Failed to acquire page targetId from WebKit inspector within 15s');
    }
    console.log(`Connected to native page target: ${targetId}`);

    // Helper to evaluate JavaScript in the live Tauri window
    function evalInApp(expression) {
      return new Promise((resolve, reject) => {
        const reqId = ++msgCounter;
        pendingRequests.set(reqId, { resolve, reject });
        ws.send(
          JSON.stringify({
            id: ++msgCounter,
            method: 'Target.sendMessageToTarget',
            params: {
              targetId: targetId,
              message: JSON.stringify({
                id: reqId,
                method: 'Runtime.evaluate',
                params: {
                  expression,
                  returnByValue: true,
                },
              }),
            },
          })
        );
      });
    }

    // Helper to poll for a condition
    async function waitForCondition(fnExpr, timeoutMs = 10000, intervalMs = 200) {
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        try {
          const res = await evalInApp(fnExpr);
          if (res) return res;
        } catch {}
        await new Promise((r) => setTimeout(r, intervalMs));
      }
      throw new Error(`Condition "${fnExpr}" not met within ${timeoutMs}ms`);
    }

    // -------------------------------------------------------------------------
    // Step 1: Verify Native App Environment
    // -------------------------------------------------------------------------
    console.log('\nStep 1: Verifying native Tauri environment & environment isolation...');
    const envInfo = await evalInApp(`
      JSON.stringify({
        title: document.title,
        url: window.location.href,
        hasTauriInternals: typeof window.__TAURI_INTERNALS__ !== 'undefined',
        isTauri: typeof window.__TAURI_INTERNALS__ !== 'undefined',
      })
    `);
    const parsedEnv = JSON.parse(envInfo);
    const isNativeTauri = parsedEnv.hasTauriInternals && parsedEnv.url.startsWith('tauri://');
    recordTest('native_tauri_runtime_environment', isNativeTauri, parsedEnv);

    // -------------------------------------------------------------------------
    // Step 2: Handle Initial Onboarding / Setup if presented
    // -------------------------------------------------------------------------
    console.log('\nStep 2: Checking onboarding setup wizard state...');
    // Wait for business_settings query to resolve from SQLite worker
    await new Promise((r) => setTimeout(r, 1200));

    let bodyText = await evalInApp(`document.body.innerText`);
    let isOnboarding = bodyText.includes('Welcome to BillZen') || bodyText.includes('Language & Regional Presets');

    if (isOnboarding) {
      console.log('Fresh database detected. Completing initial setup wizard via UI...');
      // 2a. Select India (default INR) and advance
      await evalInApp(`
        (() => {
          const btn = document.querySelector('[data-testid="onboarding-next-step-1"]');
          if (btn) btn.click();
        })()
      `);
      await new Promise((r) => setTimeout(r, 500));

      // 2b. Fill in required business profile fields using native property setter
      await evalInApp(`
        (() => {
          const setField = (tid, val) => {
            const el = document.querySelector('[data-testid="' + tid + '"]');
            if (el) {
              const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
              if (setter) setter.call(el, val);
              else el.value = val;
              el.dispatchEvent(new Event('input', { bubbles: true }));
              el.dispatchEvent(new Event('change', { bubbles: true }));
            }
          };
          setField('onboarding-input-business-name', 'BillZen Native Retail');
          setField('onboarding-input-phone', '+91 9447001122');
          setField('onboarding-input-address1', '123 Market Road');
          setField('onboarding-input-city', 'Kochi');
          setField('onboarding-input-state', 'Kerala');
          setField('onboarding-input-postal', '682001');
        })()
      `);
      await new Promise((r) => setTimeout(r, 500));

      // 2c. Advance to Step 3
      await evalInApp(`
        (() => {
          const btn = document.querySelector('[data-testid="onboarding-next-step-2"]');
          if (btn) btn.click();
        })()
      `);
      await new Promise((r) => setTimeout(r, 600));

      // 2d. Submit Setup
      await evalInApp(`
        (() => {
          const submitBtn = document.querySelector('[data-testid="onboarding-submit-button"]');
          if (submitBtn) submitBtn.click();
        })()
      `);
      await new Promise((r) => setTimeout(r, 1200));
    }

    // Dismiss getting-started guide if open
    await evalInApp(`
      (() => {
        const guideBtn = document.querySelector('[data-testid="guide-skip-button"], [data-testid="guide-close-button"]');
        if (guideBtn) guideBtn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 500));

    // Ensure we are on Cashbook Tab
    await evalInApp(`
      (() => {
        const cashbookNav = document.querySelector('[data-testid="tab-cashbook"], [data-testid="mobile-tab-cashbook"]');
        if (cashbookNav) cashbookNav.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 500));

    // -------------------------------------------------------------------------
    // Step 3: Verify Cashbook Dashboard & Native Invariants
    // -------------------------------------------------------------------------
    console.log('\nStep 3: Verifying Cashbook Dashboard mounts in native Tauri...');
    await waitForCondition(`Boolean(document.body.innerText.includes('Company Cashbook'))`, 10000);

    const dashboardCheck = await evalInApp(`
      JSON.stringify({
        header: document.querySelector('main h1')?.textContent?.trim() || document.body.innerText.includes('Company Cashbook'),
        hasBrowserBanner: Boolean(document.querySelector('[data-testid="browser-mode-banner"]')),
        hasForbiddenProfitLabel: /cash.*profit|profit.*cash/i.test(document.querySelector('main')?.textContent || ''),
        accountsCount: document.querySelector('[data-testid="action-manage-accounts"]')?.textContent?.trim(),
      })
    `);
    const parsedDashboard = JSON.parse(dashboardCheck);
    
    // In native Tauri, the ephemeral browser mode banner must NOT exist!
    const dashboardValid =
      Boolean(parsedDashboard.header) &&
      !parsedDashboard.hasBrowserBanner &&
      !parsedDashboard.hasForbiddenProfitLabel;

    recordTest('native_cashbook_dashboard_invariants', dashboardValid, parsedDashboard);

    // -------------------------------------------------------------------------
    // Step 4: Create Money Account with Opening Balance via Native IPC
    // -------------------------------------------------------------------------
    console.log('\nStep 4: Creating Money Account with Opening Balance (₹20,000) via native SQLite...');
    // Click Manage Accounts
    await evalInApp(`document.querySelector('[data-testid="action-manage-accounts"]').click()`);
    await waitForCondition(`Boolean(document.querySelector('[data-testid="input-new-account-name"]'))`, 5000);

    // Fill form: Petty Cash, Cash Drawer, ₹20,000.00
    await evalInApp(`
      (() => {
        const setVal = (el, val) => {
          if (!el) return;
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
          if (setter) setter.call(el, val);
          else el.value = val;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        };

        setVal(document.querySelector('[data-testid="input-new-account-name"]'), 'Petty Cash Desk');

        const typeSel = document.querySelector('[data-testid="select-new-account-type"]');
        if (typeSel) {
          typeSel.value = 'cash';
          typeSel.dispatchEvent(new Event('change', { bubbles: true }));
        }

        setVal(document.querySelector('[data-testid="input-new-account-opening"]'), '20000.00');

        document.querySelector('[data-testid="btn-save-new-account"]').click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 1000));

    // Verify accounts button updated
    const accountsText = await evalInApp(`document.querySelector('[data-testid="action-manage-accounts"]')?.textContent?.trim()`);
    const accountCreated = Boolean(
      accountsText?.includes('Accounts (1)') ||
      accountsText?.includes('Accounts (2)') ||
      accountsText?.includes('Accounts (3)')
    );
    recordTest('native_create_money_account', accountCreated, { accountsText });

    // -------------------------------------------------------------------------
    // Step 5: Post Receipt Voucher (Money Inflow: ₹15,000)
    // -------------------------------------------------------------------------
    console.log('\nStep 5: Posting Receipt Voucher (₹15,000) into native SQLite...');
    await evalInApp(`document.querySelector('[data-testid="action-receive-money"]').click()`);
    await waitForCondition(`Boolean(document.querySelector('[data-testid="input-voucher-amount"]'))`, 5000);

    // Fill Receipt form
    await evalInApp(`
      (() => {
        const setVal = (el, val) => {
          if (!el) return;
          const proto = el instanceof HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
          const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
          if (setter) setter.call(el, val);
          else el.value = val;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        };

        setVal(document.querySelector('[data-testid="input-voucher-amount"]'), '15000.00');
        setVal(document.querySelector('[data-testid="input-voucher-reference"]'), 'RCP-NATIVE-001');
        setVal(document.querySelector('[data-testid="input-voucher-notes"]'), 'Counter cash sale');

        // Select account if needed
        const accSel = document.querySelector('[data-testid="select-voucher-account"]');
        if (accSel && accSel.value === '' && accSel.options.length > 1) {
          accSel.selectedIndex = 1;
          accSel.dispatchEvent(new Event('change', { bubbles: true }));
        }

        document.querySelector('[data-testid="btn-submit-voucher"]').click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 1200));

    const ledgerTextAfterRcp = await evalInApp(`document.querySelector('[data-testid="cashbook-ledger-table"]')?.textContent`);
    const rcpPosted = Boolean(ledgerTextAfterRcp?.includes('RCP-') && (ledgerTextAfterRcp?.includes('15000.00') || ledgerTextAfterRcp?.includes('15,000.00')));
    recordTest('native_post_receipt_voucher', rcpPosted, { rcpPosted });

    // -------------------------------------------------------------------------
    // Step 6: Post Payment Voucher (Money Outflow: ₹4,000)
    // -------------------------------------------------------------------------
    console.log('\nStep 6: Posting Payment Voucher (₹4,000) into native SQLite...');
    await evalInApp(`document.querySelector('[data-testid="action-pay-money"]').click()`);
    await waitForCondition(`Boolean(document.querySelector('[data-testid="input-voucher-amount"]'))`, 5000);

    // Fill Payment form
    await evalInApp(`
      (() => {
        const setVal = (el, val) => {
          if (!el) return;
          const proto = el instanceof HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
          const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
          if (setter) setter.call(el, val);
          else el.value = val;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        };

        setVal(document.querySelector('[data-testid="input-voucher-amount"]'), '4000.00');
        setVal(document.querySelector('[data-testid="input-voucher-reference"]'), 'EXP-OFFICE-01');

        const accSel = document.querySelector('[data-testid="select-voucher-account"]');
        if (accSel && accSel.value === '' && accSel.options.length > 1) {
          accSel.selectedIndex = 1;
          accSel.dispatchEvent(new Event('change', { bubbles: true }));
        }

        document.querySelector('[data-testid="btn-submit-voucher"]').click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 1200));

    const ledgerTextAfterPay = await evalInApp(`document.querySelector('[data-testid="cashbook-ledger-table"]')?.textContent`);
    const payPosted = Boolean(ledgerTextAfterPay?.includes('PAY-') && (ledgerTextAfterPay?.includes('4000.00') || ledgerTextAfterPay?.includes('4,000.00')));
    recordTest('native_post_payment_voucher', payPosted, { payPosted });

    // -------------------------------------------------------------------------
    // Step 7: Negative Balance Payment Guard (Cancel then Confirm)
    // -------------------------------------------------------------------------
    console.log('\nStep 7: Testing Negative Balance Payment Guard in native Rust backend...');
    await evalInApp(`document.querySelector('[data-testid="action-pay-money"]').click()`);
    await waitForCondition(`Boolean(document.querySelector('[data-testid="input-voucher-amount"]'))`, 5000);

    // Attempt to pay ₹100,000.00 (which exceeds cash balance)
    await evalInApp(`
      (() => {
        const setVal = (el, val) => {
          if (!el) return;
          const proto = el instanceof HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
          const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
          if (setter) setter.call(el, val);
          else el.value = val;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        };

        setVal(document.querySelector('[data-testid="input-voucher-amount"]'), '100000.00');

        const accSel = document.querySelector('[data-testid="select-voucher-account"]');
        if (accSel && accSel.value === '' && accSel.options.length > 1) {
          accSel.selectedIndex = 1;
          accSel.dispatchEvent(new Event('change', { bubbles: true }));
        }

        document.querySelector('[data-testid="btn-submit-voucher"]').click();
      })()
    `);
    await waitForCondition(`Boolean(document.querySelector('[data-testid="btn-confirm-negative-balance"]'))`, 5000);

    // Cancel negative balance
    await evalInApp(`document.querySelector('[data-testid="btn-cancel-negative-balance"]').click()`);
    await new Promise((r) => setTimeout(r, 400));

    // Submit again and Confirm
    await evalInApp(`document.querySelector('[data-testid="btn-submit-voucher"]').click()`);
    await waitForCondition(`Boolean(document.querySelector('[data-testid="btn-confirm-negative-balance"]'))`, 5000);
    await evalInApp(`document.querySelector('[data-testid="btn-confirm-negative-balance"]').click()`);
    await new Promise((r) => setTimeout(r, 1200));

    const ledgerAfterNegPay = await evalInApp(`document.querySelector('[data-testid="cashbook-ledger-table"]')?.textContent`);
    const negPayPosted = Boolean(ledgerAfterNegPay?.includes('100000.00') || ledgerAfterNegPay?.includes('100,000.00'));
    recordTest('native_negative_balance_guard_cancel_and_confirm', negPayPosted, { negPayPosted });

    // -------------------------------------------------------------------------
    // Step 8: Reverse Receipt Voucher with Negative Balance Warning
    // -------------------------------------------------------------------------
    console.log('\nStep 8: Reversing Receipt Voucher in native SQLite backend...');
    // Cash balance is negative. Reversing the Receipt of ₹15,000 will deduct funds, triggering negative balance reversal prompt
    const rcpReverseBtnExists = await evalInApp(`
      (() => {
        const row = Array.from(document.querySelectorAll('tbody tr')).find(r => r.textContent.includes('RCP-'));
        if (!row) return false;
        const btn = row.querySelector('[data-testid="btn-reverse-voucher"]');
        if (btn) {
          btn.click();
          return true;
        }
        return false;
      })()
    `);

    let reversalCompleted = false;
    if (rcpReverseBtnExists) {
      await waitForCondition(`Boolean(document.querySelector('[data-testid="btn-confirm-reversal"]'))`, 5000);
      await evalInApp(`document.querySelector('[data-testid="btn-confirm-reversal"]').click()`);
      await new Promise((r) => setTimeout(r, 600));

      // Wait if reversal negative balance warning appears
      const hasReversalWarning = await evalInApp(`Boolean(document.querySelector('[data-testid="btn-confirm-reversal-negative-balance"]'))`);
      if (hasReversalWarning) {
        await evalInApp(`document.querySelector('[data-testid="btn-confirm-reversal-negative-balance"]').click()`);
        await new Promise((r) => setTimeout(r, 1200));
      }

      const ledgerAfterReversal = await evalInApp(`document.querySelector('[data-testid="cashbook-ledger-table"]')?.textContent`);
      reversalCompleted = Boolean(ledgerAfterReversal?.includes('REV') || ledgerAfterReversal?.includes('VOID') || ledgerAfterReversal?.includes('Void'));
    }

    recordTest('native_voucher_reversal_workflow', reversalCompleted, { reversalCompleted });

    // -------------------------------------------------------------------------
    // Step 9: View and Verify Printable Voucher Document in Native Mode
    // -------------------------------------------------------------------------
    console.log('\nStep 9: Testing Printable Voucher Document view in native WebKit...');
    const printViewExists = await evalInApp(`
      (() => {
        const viewBtn = document.querySelector('[data-testid="btn-view-voucher"]');
        if (viewBtn) {
          viewBtn.click();
          return true;
        }
        return false;
      })()
    `);

    let printableVerified = false;
    if (printViewExists) {
      await waitForCondition(`Boolean(document.querySelector('#printable-voucher-root'))`, 5000);
      const voucherText = await evalInApp(`document.querySelector('#printable-voucher-root')?.textContent`);
      const hasInvoiceData = /INVOICE|Bill To|Due Date|Qty.*Rate.*Tax/i.test(voucherText || '');
      
      // Close preview modal
      await evalInApp(`document.querySelector('[data-testid="btn-close-voucher-dialog"]')?.click()`);
      await new Promise((r) => setTimeout(r, 400));

      printableVerified = !hasInvoiceData && Boolean(voucherText?.length);
    }
    recordTest('native_printable_voucher_isolation', printableVerified, { printableVerified });

    // -------------------------------------------------------------------------
    // Step 10: Verify Database Isolation & Protection of Real Business Data
    // -------------------------------------------------------------------------
    console.log('\nStep 10: Verifying isolated test database files and user data protection...');
    const tempDbPath = path.join(tempDir, 'billzen.db');
    const tempDbExists = fs.existsSync(tempDbPath);
    const tempDbStat = tempDbExists ? fs.statSync(tempDbPath) : null;

    let realDataUntouched = true;
    if (realDirInitialMtime !== null) {
      const currentRealMtime = fs.statSync(userRealDir).mtimeMs;
      realDataUntouched = currentRealMtime === realDirInitialMtime;
    }

    const isolationVerified = tempDbExists && realDataUntouched;
    recordTest('database_isolation_and_real_data_protected', isolationVerified, {
      tempDbExists,
      tempDbSize: tempDbStat?.size,
      realDataUntouched,
      realDir: userRealDir,
    });

    ws.close();
    report.allPassed = report.tests.every((t) => t.passed);
  } catch (err) {
    console.error('Fatal native verification error:', err);
    report.error = String(err);
    report.allPassed = false;
  } finally {
    killApp();
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
        console.log(`Cleaned up temporary isolated directory: ${tempDir}`);
      }
    } catch {}

    fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));

    console.log('\n=== Native Desktop Cashbook Verification Summary ===');
    report.tests.forEach((t) => {
      console.log(`- [${t.passed ? 'PASS' : 'FAIL'}] ${t.step}`);
    });
    console.log(`All Passed: ${report.allPassed}`);

    if (!report.allPassed) {
      process.exit(1);
    }
  }
}

runNativeVerification();
