import crypto from 'node:crypto';
import { execSync, execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ARTIFACTS_DIR = path.resolve('test_artifacts/native_cashbook');
fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
const REPORT_PATH = path.join(ARTIFACTS_DIR, 'native_cashbook_verification_report.json');

const BINARY_PATH = path.resolve(process.env.BILLZEN_NATIVE_BINARY || 'src-tauri/target/release/billzen');
// Set explicitly for an extracted AppRun with APPIMAGE supplied by the launcher.
const EXPECT_APPIMAGE = process.env.BILLZEN_NATIVE_EXPECT_APPIMAGE === '1'
  || /\.appimage$/i.test(BINARY_PATH)
  || Boolean(process.env.APPIMAGE);


function getFileSha256(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

function getGitCommitHash() {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

function captureRealDbFingerprints() {
  const dir = path.join(os.homedir(), '.local/share/billzen');
  if (!fs.existsSync(dir)) return { exists: false, dir };
  const targetFiles = ['billzen.db', 'billzen.db-wal', 'billzen.db-shm', 'billzen.lock'];
  const files = {};
  for (const f of targetFiles) {
    const full = path.join(dir, f);
    if (fs.existsSync(full)) {
      const stat = fs.statSync(full);
      files[f] = {
        size: stat.size,
        mtimeMs: stat.mtimeMs,
        sha256: getFileSha256(full),
      };
    }
  }
  return { exists: true, dir, files };
}

function stopProcess(proc, timeoutMs = 5000) {
  return new Promise((resolve) => {
    if (!proc || proc.exitCode !== null || proc.killed) {
      return resolve();
    }
    let done = false;
    const cleanup = () => {
      if (!done) {
        done = true;
        resolve();
      }
    };
    proc.once('exit', cleanup);
    try {
      proc.kill('SIGTERM');
    } catch {
      cleanup();
    }
    setTimeout(() => {
      if (!done) {
        try {
          proc.kill('SIGKILL');
        } catch {}
        cleanup();
      }
    }, timeoutMs);
  });
}

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

async function startNativeInstance(dataDir, port) {
  const INSPECTOR_URL = `http://127.0.0.1:${port}/`;
  const WS_URL = `ws://127.0.0.1:${port}/socket/1/1/WebPage`;

  let appExited = false;
  let exitError = null;

  const appProcess = spawn(BINARY_PATH, [], {
    env: {
      ...process.env,
      BILLZEN_DATA_DIR: dataDir,
      WEBKIT_INSPECTOR_HTTP_SERVER: `127.0.0.1:${port}`,
      RUST_BACKTRACE: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  appProcess.on('exit', (code, signal) => {
    appExited = true;
    if (code !== 0 && code !== null && signal !== 'SIGTERM' && signal !== 'SIGKILL') {
      exitError = new Error(`Application process terminated unexpectedly with code ${code}`);
    }
  });

  appProcess.stderr.on('data', (d) => {
    const s = d.toString();
    if (!s.includes('Glycin') && !s.includes('sandbox')) {
      // console.log('[Native Stderr]:', s.trim());
    }
  });

  // Wait for WebKit HTTP inspector server
  await waitForHttp(INSPECTOR_URL, 15000);
  await new Promise((r) => setTimeout(r, 400));

  const ws = new WebSocket(WS_URL);

  let targetId = null;
  let msgCounter = 100;
  const pendingRequests = new Map();

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.method === 'Target.targetCreated' && msg.params?.targetInfo?.type === 'page') {
        targetId = msg.params.targetInfo.targetId;
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
            const val =
              inner.result?.result?.value !== undefined
                ? inner.result.result.value
                : inner.result?.result?.description === 'true'
                ? true
                : inner.result?.result?.description === 'false'
                ? false
                : inner.result?.result;
            resolve(val);
          }
        }
      }
    } catch (err) {
      console.warn('Error parsing WS message:', err);
    }
  };

  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = (e) => reject(new Error('WebSocket connection failed: ' + e.message));
    setTimeout(() => reject(new Error('WebSocket connection timed out')), 10000);
  });

  // Wait until targetId is assigned
  const startWait = Date.now();
  while (!targetId && Date.now() - startWait < 15000) {
    if (appExited) throw exitError || new Error('App process exited before target acquisition');
    await new Promise((r) => setTimeout(r, 100));
  }

  if (!targetId) {
    throw new Error('Failed to acquire page targetId from WebKit inspector within 15s');
  }

  function evalInApp(expression) {
    return new Promise((resolve, reject) => {
      if (appExited) return reject(exitError || new Error('App process already exited'));
      const reqId = ++msgCounter;
      pendingRequests.set(reqId, { resolve, reject });
      ws.send(
        JSON.stringify({
          id: ++msgCounter,
          method: 'Target.sendMessageToTarget',
          params: {
            targetId,
            message: JSON.stringify({
              id: reqId,
              method: 'Runtime.evaluate',
              params: {
                expression,
                returnByValue: true,
                awaitPromise: true,
              },
            }),
          },
        })
      );
    });
  }

  async function waitForCondition(fnExpr, timeoutMs = 12000, intervalMs = 250) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (appExited) throw exitError || new Error('App process exited while waiting for condition');
      try {
        const res = await evalInApp(fnExpr);
        if (res) return res;
      } catch {}
      await new Promise((r) => setTimeout(r, intervalMs));
    }
    throw new Error(`Condition "${fnExpr}" not met within ${timeoutMs}ms`);
  }

  // Bounded readiness check: wait until URL starts with tauri:// and __TAURI_INTERNALS__ is ready
  const startReady = Date.now();
  let isReady = false;
  while (Date.now() - startReady < 15000) {
    if (appExited) throw exitError || new Error('App process exited during readiness check');
    try {
      const readyCheck = await evalInApp(`
        Boolean(
          typeof window !== 'undefined' &&
          window.location.href.startsWith('tauri://') &&
          typeof window.__TAURI_INTERNALS__ !== 'undefined'
        )
      `);
      if (readyCheck === true) {
        isReady = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }

  if (!isReady) {
    ws.close();
    await stopProcess(appProcess);
    throw new Error('Application failed bounded readiness check (tauri:// URL and __TAURI_INTERNALS__) within 15s');
  }

  async function invokeInApp(cmd, args = {}, timeoutMs = 10000) {
    const nonce = `__ipc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    await evalInApp(`
      (() => {
        window['${nonce}'] = { done: false, result: null, error: null };
        window.__TAURI_INTERNALS__.invoke('${cmd}', ${JSON.stringify(args)})
          .then(res => { window['${nonce}'] = { done: true, result: res }; })
          .catch(err => { window['${nonce}'] = { done: true, error: String(err) }; });
      })()
    `);
    await waitForCondition(`Boolean(window['${nonce}']?.done)`, timeoutMs);
    const jsonStr = await evalInApp(`JSON.stringify(window['${nonce}'])`);
    await evalInApp(`delete window['${nonce}']`);
    const parsed = JSON.parse(jsonStr);
    if (parsed.error) {
      throw new Error(parsed.error);
    }
    return parsed.result;
  }

  return {
    appProcess,
    ws,
    evalInApp,
    waitForCondition,
    invokeInApp,
    terminate: () => {
      try { ws.close(); } catch {}
      return stopProcess(appProcess);
    },
  };
}

async function runNativeVerification() {
  console.log('=== BillZen Native Desktop Cashbook Automated Verification ===');

  // 1. Verify binary provenance (existence, size, SHA-256, Git commit revision)
  if (!fs.existsSync(BINARY_PATH)) {
    throw new Error(`Native binary not found at ${BINARY_PATH}`);
  }
  const stat = fs.statSync(BINARY_PATH);
  const binarySha256 = getFileSha256(BINARY_PATH);
  const gitRevision = getGitCommitHash();

  console.log(`Binary: ${BINARY_PATH}`);
  console.log(`Binary size: ${(stat.size / (1024 * 1024)).toFixed(2)} MB (${stat.size} bytes)`);
  console.log(`Binary SHA-256: ${binarySha256}`);
  console.log(`Source Git Revision: ${gitRevision}`);
  console.log(`Binary mtime: ${stat.mtime.toISOString()}`);

  // 2. Check and fingerprint user real business data path to ensure it is protected
  const preTestPrints = captureRealDbFingerprints();
  if (preTestPrints.exists) {
    console.log(`Real user business directory found at: ${preTestPrints.dir}`);
    console.log(`Monitored files: ${Object.keys(preTestPrints.files).join(', ')}`);
  } else {
    console.log(`Real user business directory does not exist yet at ${preTestPrints.dir}.`);
  }

  // 3. Create isolated temporary directory for test database
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'billzen-native-cashbook-'));
  console.log(`Isolated test data directory: ${tempDir}`);

  const PORT = 9235;
  const report = {
    timestamp: new Date().toISOString(),
    binary: {
      path: BINARY_PATH,
      sizeBytes: stat.size,
      mtime: stat.mtime.toISOString(),
      sha256: binarySha256,
      gitRevision,
    },
    isolatedDataDir: tempDir,
    tests: [],
    assertionsCount: 0,
    allPassed: false,
  };

  const assert = (condition, description, details = {}) => {
    report.assertionsCount++;
    if (!condition) {
      throw new Error(`Assertion failed: ${description} — Details: ${JSON.stringify(details)}`);
    }
  };

  const recordTest = (step, passed, details = {}) => {
    console.log(`  [${passed ? 'PASS' : 'FAIL'}] ${step}`, details);
    report.tests.push({ step, passed, details });
  };

  let activeInstance = null;

  try {
    // =========================================================================
    // PHASE 1: Initial Launch, Onboarding, and Financial Voucher Mutations
    // =========================================================================
    console.log('\n--- Phase 1: Initial Clean Launch & Financial Workflows ---');
    activeInstance = await startNativeInstance(tempDir, PORT);
    const { evalInApp, waitForCondition } = activeInstance;

    // Step 1: Verify Native App Environment
    console.log('\nStep 1: Verifying native Tauri environment & environment isolation...');
    const envInfoStr = await evalInApp(`
      JSON.stringify({
        title: document.title,
        url: window.location.href,
        hasTauriInternals: typeof window.__TAURI_INTERNALS__ !== 'undefined',
        isTauri: typeof window.__TAURI_INTERNALS__ !== 'undefined',
      })
    `);
    const parsedEnv = JSON.parse(envInfoStr);
    assert(parsedEnv.hasTauriInternals === true, 'Window has __TAURI_INTERNALS__');
    assert(parsedEnv.url.startsWith('tauri://'), 'Window URL protocol is tauri://');
    recordTest('native_tauri_runtime_environment', true, parsedEnv);

    // Native updater safety checks use only the isolated workspace and never download/install.
    console.log('\nChecking native updater guards without downloading an artifact...');
    const updaterInitial = await activeInstance.invokeInApp('get_desktop_update_status');
    assert(updaterInitial.status === 'idle', 'Desktop updater starts idle', updaterInitial);
    assert(updaterInitial.downloadedBytes === 0 && updaterInitial.totalBytes === 0,
      'Desktop updater has no downloaded payload at startup', updaterInitial);
    const expectNativeRejection = async (command, expectedText) => {
      let rejection = '';
      try { await activeInstance.invokeInApp(command); }
      catch (error) { rejection = String(error); }
      assert(rejection.includes(expectedText), `${command} rejects with its native safety guard`, { rejection });
    };
    await expectNativeRejection('download_desktop_update', 'Check for an update first');
    await expectNativeRejection('install_desktop_update', 'Download and verify the update');
    await expectNativeRejection('prepare_android_update', 'unavailable on desktop');
    await expectNativeRejection('resume_after_update', 'unavailable on desktop');
    const cancelledUpdate = await activeInstance.invokeInApp('cancel_desktop_update');
    assert(cancelledUpdate.status === 'cancelled' && cancelledUpdate.downloadedBytes === 0,
      'Desktop cancel clears pending payload state', cancelledUpdate);
    const validateCheckResult = (info, description) => {
      if (EXPECT_APPIMAGE) {
        assert(['available', 'current', 'error'].includes(info.status),
          `${description}: AppImage reaches the configured feed`, info);
      } else {
        assert(info.status === 'unavailable' && /AppImage/.test(info.message),
          `${description}: standalone Linux runtime explains AppImage requirement`, info);
      }
    };
    const checkedUpdate = await activeInstance.invokeInApp('check_desktop_update', {}, 45000);
    validateCheckResult(checkedUpdate, 'Check after cancellation');
    await activeInstance.invokeInApp('cancel_desktop_update');
    await expectNativeRejection('install_desktop_update', 'Download and verify the update');
    const retriedUpdate = await activeInstance.invokeInApp('check_desktop_update', {}, 45000);
    validateCheckResult(retriedUpdate, 'Retry after cancellation');
    const settingsAfterUpdateCheck = await activeInstance.invokeInApp('get_business_settings');
    await activeInstance.invokeInApp('update_appearance_preference', {
      preference: settingsAfterUpdateCheck.appearance_preference,
    });
    const settingsAfterUpdateWrite = await activeInstance.invokeInApp('get_business_settings');
    assert(settingsAfterUpdateWrite.appearance_preference === settingsAfterUpdateCheck.appearance_preference,
      'Update rejection/check/cancel leaves the isolated database writable');
    await activeInstance.invokeInApp('cancel_desktop_update');
    recordTest('native_desktop_updater_guards_cancel_retry_and_database_writes', true, {
      expectAppImage: EXPECT_APPIMAGE,
      firstCheckStatus: checkedUpdate.status,
      retryStatus: retriedUpdate.status,
      downloadedOrInstalled: false,
    });

    // Step 2: Handle Initial Onboarding / Setup Wizard
    console.log('\nStep 2: Completing onboarding setup wizard on clean database...');
    await new Promise((r) => setTimeout(r, 1200));

    // Wait for the actual wizard rather than assuming IPC and WebKit render within 1.2s.
    // Stable IDs also work when a saved UI language changes the visible welcome text.
    await waitForCondition(`Boolean(document.querySelector('[data-testid="onboarding-next-step-1"]'))`, 15000);
    const isOnboarding = await evalInApp(`Boolean(document.querySelector('[data-testid="onboarding-next-step-1"]'))`);
    assert(isOnboarding === true, 'Fresh isolated database presents Onboarding Wizard');

    // 2a. Select India (INR) and advance to business profile
    await evalInApp(`
      (() => {
        const btn = document.querySelector('[data-testid="onboarding-next-step-1"]');
        if (btn) btn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 500));

    // 2b. Fill required profile fields using prototype value setters for React 19 synchronization
    await evalInApp(`
      (() => {
        const setVal = (tid, val) => {
          const el = document.querySelector('[data-testid="' + tid + '"]');
          if (el) {
            const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
            if (setter) setter.call(el, val);
            else el.value = val;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
          }
        };
        setVal('onboarding-input-business-name', 'BillZen Native Retail');
        setVal('onboarding-input-phone', '+91 9447001122');
        setVal('onboarding-input-address1', '123 Market Road');
        setVal('onboarding-input-city', 'Kochi');
        setVal('onboarding-input-state', 'Kerala');
        setVal('onboarding-input-postal', '682001');
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

    // Explicitly assert onboarding completion via native SQLite settings
    const savedSettings = await activeInstance.invokeInApp('get_business_settings');
    assert(savedSettings.is_setup_completed === true, 'Saved settings indicate setup completed');
    assert(savedSettings.business_name === 'BillZen Native Retail', 'Saved business name matches input');
    recordTest('onboarding_setup_wizard_completion', true, {
      businessName: savedSettings.business_name,
      currency: savedSettings.currency_code,
      isSetupCompleted: savedSettings.is_setup_completed,
    });

    // Step 3: Verify Cashbook Dashboard & Native Invariants
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
    assert(Boolean(parsedDashboard.header), 'Header shows Cashbook');
    assert(!parsedDashboard.hasBrowserBanner, 'Native Tauri mode does NOT have browser preview banner');
    assert(!parsedDashboard.hasForbiddenProfitLabel, 'Forbidden word "Profit" is absent from Cashbook');
    recordTest('native_cashbook_dashboard_invariants', true, parsedDashboard);

    // Step 4: Create Money Account with Opening Balance via Native IPC
    console.log('\nStep 4: Creating Money Account with Opening Balance (₹20,000) via native SQLite...');
    await evalInApp(`document.querySelector('[data-testid="action-manage-accounts"]').click()`);
    await waitForCondition(`Boolean(document.querySelector('[data-testid="input-new-account-name"]'))`, 5000);

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

    const accountsText = await evalInApp(`document.querySelector('[data-testid="action-manage-accounts"]')?.textContent?.trim()`);
    assert(Boolean(accountsText?.includes('Accounts (1)')), 'Accounts count updated to 1');
    recordTest('native_create_money_account', true, { accountsText });

    // Step 5: Post Receipt Voucher (Money Inflow: ₹15,000)
    console.log('\nStep 5: Posting Receipt Voucher (₹15,000) into native SQLite...');
    await evalInApp(`document.querySelector('[data-testid="action-receive-money"]').click()`);
    await waitForCondition(`Boolean(document.querySelector('[data-testid="input-voucher-amount"]'))`, 5000);

    const rcpIdempotencyKey = 'idem-native-rcp-001';
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
    assert(ledgerTextAfterRcp?.includes('RCP-202610-00001'), 'Ledger contains RCP-202610-00001');
    assert(ledgerTextAfterRcp?.includes('35000.00') || ledgerTextAfterRcp?.includes('35,000.00'), 'Running balance is 35,000.00');
    recordTest('native_post_receipt_voucher', true, { rcpPosted: true });

    // Step 6: Post Payment Voucher (Money Outflow: ₹4,000)
    console.log('\nStep 6: Posting Payment Voucher (₹4,000) into native SQLite...');
    await evalInApp(`document.querySelector('[data-testid="action-pay-money"]').click()`);
    await waitForCondition(`Boolean(document.querySelector('[data-testid="input-voucher-amount"]'))`, 5000);

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
    assert(ledgerTextAfterPay?.includes('PAY-202610-00001'), 'Ledger contains PAY-202610-00001');
    assert(ledgerTextAfterPay?.includes('31000.00') || ledgerTextAfterPay?.includes('31,000.00'), 'Running balance is 31,000.00');
    recordTest('native_post_payment_voucher', true, { payPosted: true });

    // Step 7: Negative Balance Payment Guard (Cancel then Confirm)
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
    assert(ledgerAfterNegPay?.includes('PAY-202610-00002'), 'Ledger contains PAY-202610-00002');
    assert(ledgerAfterNegPay?.includes('-69000.00') || ledgerAfterNegPay?.includes('-69,000.00'), 'Running balance is -69,000.00');
    recordTest('native_negative_balance_guard_cancel_and_confirm', true, { negPayPosted: true });

    // Step 8: Reverse Receipt Voucher with Negative Balance Warning
    console.log('\nStep 8: Reversing Receipt Voucher in native SQLite backend...');
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
    assert(rcpReverseBtnExists === true, 'Receipt voucher row reverse button clicked');

    await waitForCondition(`Boolean(document.querySelector('[data-testid="btn-confirm-reversal"]'))`, 5000);
    await evalInApp(`document.querySelector('[data-testid="btn-confirm-reversal"]').click()`);
    await new Promise((r) => setTimeout(r, 600));

    const hasReversalWarning = await evalInApp(`Boolean(document.querySelector('[data-testid="btn-confirm-reversal-negative-balance"]'))`);
    if (hasReversalWarning) {
      await evalInApp(`document.querySelector('[data-testid="btn-confirm-reversal-negative-balance"]').click()`);
      await new Promise((r) => setTimeout(r, 1200));
    }

    const ledgerAfterReversal = await evalInApp(`document.querySelector('[data-testid="cashbook-ledger-table"]')?.textContent`);
    assert(ledgerAfterReversal?.includes('RCP-REV-202610-00001'), 'Reversal voucher RCP-REV-202610-00001 posted');
    assert(ledgerAfterReversal?.includes('VOID'), 'Original voucher marked VOID');
    assert(ledgerAfterReversal?.includes('-84000.00') || ledgerAfterReversal?.includes('-84,000.00'), 'Projected closing balance is -84,000.00');
    recordTest('native_voucher_reversal_workflow', true, { reversalCompleted: true });

    // Step 9: View and Verify Printable Voucher Document in Native Mode
    console.log('\nStep 9: Testing Printable Voucher Document preview in native WebKit DOM...');
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
    assert(printViewExists === true, 'View voucher preview button clicked');

    await waitForCondition(`Boolean(document.querySelector('#printable-voucher-root'))`, 5000);
    const voucherText = await evalInApp(`document.querySelector('#printable-voucher-root')?.textContent`);
    const hasInvoiceData = /INVOICE|Bill To|Due Date|Qty.*Rate.*Tax/i.test(voucherText || '');
    assert(!hasInvoiceData, 'Printable voucher has zero invoice data contamination');
    assert(voucherText?.includes('Fifteen Thousand Rupees Only'), 'Amount in words rendered correctly');

    await evalInApp(`document.querySelector('[data-testid="btn-close-voucher-dialog"]')?.click()`);
    await new Promise((r) => setTimeout(r, 400));
    recordTest('native_voucher_preview_dom_isolation', true, {
      distinction: 'Simulated/inspected via native WebKit preview DOM; physical printer dialog uninvoked',
      voucherTextLength: voucherText?.length,
    });

    // Exercise actual WebKitGTK theme resolution, including native controls and
    // the normal Reports heading after removing the developer diagnostic screen.
    for (const theme of ['dark', 'light']) {
      await evalInApp(`document.querySelector('[data-testid="tab-settings"]').click()`);
      await waitForCondition(`Boolean(document.querySelector('[data-testid="appearance-option-${theme}"]'))`);
      await evalInApp(`document.querySelector('[data-testid="appearance-option-${theme}"]').click()`);
      await waitForCondition(`document.documentElement.classList.contains('dark') === ${theme === 'dark'}`);
      await evalInApp(`document.querySelector('[data-testid="tab-reports"]').click()`);
      await waitForCondition(`Boolean(document.querySelector('main h1'))`);
      const themeEvidence = JSON.parse(await evalInApp(`JSON.stringify((() => {
        const rgb = s => s.match(/[\\d.]+/g).slice(0, 3).map(Number);
        const lum = c => c.map(v => {
          v /= 255;
          return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4;
        }).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
        const foreground = lum(rgb(getComputedStyle(document.querySelector('main h1')).color));
        const background = lum(rgb(getComputedStyle(document.body).backgroundColor));
        return {
          colorScheme: getComputedStyle(document.documentElement).colorScheme,
          headingContrast: (Math.max(foreground, background) + .05) / (Math.min(foreground, background) + .05),
        };
      })())`));
      assert(themeEvidence.colorScheme === theme, `Native ${theme} controls use matching color-scheme`);
      assert(themeEvidence.headingContrast >= 4.5, `Native ${theme} Reports heading remains readable`, themeEvidence);
    }
    recordTest('native_dark_light_reports_visibility', true);
    await evalInApp(`document.querySelector('[data-testid="tab-cashbook"]').click()`);
    await waitForCondition(`document.body.innerText.includes('Company Cashbook')`);

    // Verify the real Tauri IPC customer bridge in this isolated workspace.
    const linkedCustomer = await activeInstance.invokeInApp('create_customer', { dto: {
      name: 'Native linked customer', phone: null, email: null, address_line1: null,
      address_line2: null, city: null, state: null, postal_code: null, country: 'IND', tax_identifier: null,
    }});
    const linkedParty = await activeInstance.invokeInApp('ensure_customer_cashbook_party', { input: { customer_id: linkedCustomer.id } });
    const sameLinkedParty = await activeInstance.invokeInApp('ensure_customer_cashbook_party', { input: { customer_id: linkedCustomer.id } });
    assert(linkedParty.id === sameLinkedParty.id, 'Native customer bridge is idempotent');
    const linkedAccount = await activeInstance.invokeInApp('create_money_account', { dto: {
      account_name: 'Native customer test', account_type: 'cash', opening_balance_minor: 0,
      allow_negative_balance: false, currency_code: 'INR', currency_exponent: 2,
    }});
    await activeInstance.invokeInApp('post_cashbook_voucher', { input: {
      idempotency_key: 'native-linked-receipt', account_id: linkedAccount.id, party_id: linkedParty.id,
      amount_minor: 1500, direction: 'inflow', classification: 'operating_income', payment_method: 'cash',
      business_date: '2026-10-23', confirmed_negative_balance: false,
    }});
    const linkedHistory = await activeInstance.invokeInApp('get_customer_cash_history', { filter: { customer_id: linkedCustomer.id } });
    assert(linkedHistory.received_minor === 1500 && linkedHistory.net_movement_minor === 1500, 'Native customer history receives one linked receipt');
    const linkedReport = await activeInstance.invokeInApp('get_cashbook_ledger', { filter: { party_id: linkedParty.id } });
    assert(linkedReport[0].length === 1 && linkedReport[1].matching_inflows_minor === 1500, 'Native party report agrees with customer history');
    await activeInstance.invokeInApp('reverse_cashbook_voucher', { voucherId: linkedHistory.entries[0].voucher.id, confirmedNegativeBalance: false });
    const reversedHistory = await activeInstance.invokeInApp('get_customer_cash_history', { filter: { customer_id: linkedCustomer.id } });
    assert(reversedHistory.entries.length === 2 && reversedHistory.net_movement_minor === 0, 'Native reversed receipt retains evidence and cancels cash effect');
    recordTest('native_customer_cashbook_integration', true);

    // Capture pre-restart accounts & ledger summary
    const preRestartSummary = await activeInstance.invokeInApp('get_cashbook_ledger', { filter: {} });

    // Gracefully terminate the first instance and wait for process exit
    console.log('\nGracefully terminating native app process before cold restart...');
    await activeInstance.terminate();
    activeInstance = null;
    console.log('Instance 1 cleanly terminated.');

    // =========================================================================
    // PHASE 2: Native Cold Restart & Persistence Verification
    // =========================================================================
    console.log('\n--- Phase 2: Native Cold Restart on the Same Isolated Database ---');
    activeInstance = await startNativeInstance(tempDir, PORT);
    const inst2Eval = activeInstance.evalInApp;
    const inst2Wait = activeInstance.waitForCondition;

    // Step 10: Cold Restart State & Onboarding Bypass Verification
    console.log('\nStep 10: Verifying cold restart opens the Today dashboard and preserves Cashbook...');
    await inst2Wait(`Boolean(document.querySelector('[data-testid="dashboard-view"]'))`, 12000);
    assert(await inst2Eval(`Boolean(document.querySelector('[data-testid="dashboard-view"]'))`), 'Today dashboard is the approved cold-start destination');
    assert(!await inst2Eval(`Boolean(document.querySelector('[data-testid="onboarding-next-step-1"]'))`), 'Onboarding wizard is NOT shown after restart');
    await inst2Eval(`(() => {
      const button = [...document.querySelectorAll('[data-testid="tab-cashbook"], [data-testid="mobile-tab-cashbook"]')].find(element => element.getClientRects().length);
      if (button) button.click();
    })()`);
    await inst2Wait(`Boolean(document.body.innerText.includes('Company Cashbook'))`, 12000);
    assert(await inst2Eval(`document.body.innerText.includes('Company Cashbook')`), 'Cashbook opens from the dashboard after cold restart');

    const postRestartSummary = await activeInstance.invokeInApp('get_cashbook_ledger', { filter: {} });

    assert(
      postRestartSummary[1].total_cash_minor === preRestartSummary[1].total_cash_minor,
      'Total cash minor matches pre-restart value exactly',
      { pre: preRestartSummary[1].total_cash_minor, post: postRestartSummary[1].total_cash_minor }
    );
    assert(
      postRestartSummary[0].length === preRestartSummary[0].length,
      'Ledger entries count matches pre-restart value exactly (4 entries)',
      { count: postRestartSummary[0].length }
    );
    recordTest('native_cold_restart_persistence_and_balances', true, {
      totalCashMinor: postRestartSummary[1].total_cash_minor,
      entriesCount: postRestartSummary[0].length,
      closingBalanceFormatted: '-₹ 84000.00',
    });

    // Step 11: Native Idempotent Retry and Conflict Checks in Native SQLite
    console.log('\nStep 11: Testing Native Idempotent Retry and Payload Conflict Handling...');
    const originalVoucher = postRestartSummary[0].find((e) => e.voucher.voucher_number === 'RCP-202610-00001')?.voucher;
    assert(Boolean(originalVoucher), 'Original receipt voucher found');

    // 11a. Re-post with original payload and key
    const replayRes = await activeInstance.invokeInApp('post_cashbook_voucher', {
      input: {
        account_id: originalVoucher.account_id,
        direction: 'inflow',
        classification: 'operating_income',
        payment_method: 'cash',
        amount_minor: 1500000,
        business_date: originalVoucher.business_date,
        party_id: null,
        category_id: null,
        reference_note: 'RCP-NATIVE-001',
        notes: 'Counter cash sale',
        idempotency_key: originalVoucher.idempotency_key,
        confirmed_negative_balance: false,
      },
    });
    assert(replayRes.voucher_number === 'RCP-202610-00001', 'Idempotent replay returns original voucher number');
    assert(replayRes.id === originalVoucher.id, 'Idempotent replay returns original voucher ID');

    // 11b. Re-post with conflicting payload (altered amount 9999.00)
    let conflictError = null;
    try {
      await activeInstance.invokeInApp('post_cashbook_voucher', {
        input: {
          account_id: originalVoucher.account_id,
          direction: 'inflow',
          classification: 'operating_income',
          payment_method: 'cash',
          amount_minor: 999900,
          business_date: originalVoucher.business_date,
          party_id: null,
          category_id: null,
          reference_note: 'RCP-NATIVE-001',
          notes: 'Counter cash sale',
          idempotency_key: originalVoucher.idempotency_key,
          confirmed_negative_balance: false,
        },
      });
    } catch (err) {
      conflictError = String(err);
    }
    assert(Boolean(conflictError), 'Conflicting idempotency key payload returns error');
    assert(
      conflictError.includes('IdempotencyConflict') || conflictError.includes('conflict'),
      'Error message identifies idempotency conflict',
      { conflictError }
    );
    recordTest('native_idempotent_retry_and_conflict_rejection', true, {
      replaySuccess: replayRes.voucher_number === 'RCP-202610-00001',
      conflictRejected: Boolean(conflictError),
    });

    // Dedicated T1 IPC acceptance in the isolated workspace only.
    const transferAccounts=[];
    for(const [name,opening,type] of [['T1 Cash',500000,'cash'],['T1 Bank',100000,'bank']]) {
      const a=await activeInstance.invokeInApp('create_money_account',{dto:{account_name:name,account_type:type,opening_balance_minor:opening,allow_negative_balance:false}});
      transferAccounts.push(a.id);
    }
    const transferInput={idempotency_key:'native-transfer-retry',from_account_id:transferAccounts[0],to_account_id:transferAccounts[1],amount_minor:200000,business_date:'2026-10-23',confirmed_negative_balance:false};
    const postedTransfer=await activeInstance.invokeInApp('post_cashbook_transfer',{input:transferInput});
    assert(postedTransfer.status==='posted','Native IPC posts complete transfer');
    const retryTransfer=await activeInstance.invokeInApp('post_cashbook_transfer',{input:transferInput});
    assert(retryTransfer.transfer.id===postedTransfer.transfer.id,'Native transfer retry preserves identity');
    const transferBalances=await activeInstance.invokeInApp('get_money_accounts',{});
    assert(transferAccounts.every(id=>transferBalances.find(a=>a.id===id).current_balance_minor===300000),'Native paired balances are3000/3000');
    const transferLedger=await activeInstance.invokeInApp('get_cashbook_ledger',{filter:{account_id:transferAccounts[0],classification:'transfer'}});
    assert(transferLedger[1].period_inflows_minor===0&&transferLedger[1].period_outflows_minor===0&&transferLedger[1].closing_balance_minor===300000,'Native transfer metrics exclude receipts/payments but retain balances');
    let halfBlocked=false;
    try{await activeInstance.invokeInApp('reverse_cashbook_voucher',{voucherId:postedTransfer.transfer.out_voucher_id,confirmedNegativeBalance:false});}catch{halfBlocked=true;}
    assert(halfBlocked,'Native IPC blocks ordinary half reversal');
    const sql=(statement)=>execFileSync('python3',['-c',"import sqlite3,sys; c=sqlite3.connect(sys.argv[1]); c.executescript(sys.argv[2]); c.close()",path.join(tempDir,'billzen.db'),statement]);
    sql("CREATE TRIGGER test_t1_abort BEFORE INSERT ON cashbook_movements WHEN NEW.amount_minor>0 BEGIN SELECT RAISE(ABORT,'injected second transfer leg'); END;");
    let rollbackRejected=false;
    try{await activeInstance.invokeInApp('post_cashbook_transfer',{input:{...transferInput,idempotency_key:'native-aborted-transfer'}});}catch{rollbackRejected=true;}finally{sql('DROP TRIGGER test_t1_abort;');}
    const afterAbort=await activeInstance.invokeInApp('get_cashbook_transfers',{filter:{account_id:transferAccounts[0]}});
    const afterAbortBalances=await activeInstance.invokeInApp('get_money_accounts',{});
    assert(rollbackRejected&&afterAbort.length===1&&transferAccounts.every(id=>afterAbortBalances.find(a=>a.id===id).current_balance_minor===300000),'Native second-leg abort rolls back pair and balances');
    const reversedTransfer=await activeInstance.invokeInApp('reverse_cashbook_transfer',{input:{transfer_id:postedTransfer.transfer.id,confirmed_negative_balance:false}});
    const reversedAgain=await activeInstance.invokeInApp('reverse_cashbook_transfer',{input:{transfer_id:postedTransfer.transfer.id,confirmed_negative_balance:false}});
    assert(reversedTransfer.status==='posted'&&reversedAgain.transfer.id===reversedTransfer.transfer.id,'Native paired reversal is idempotent');
    const stockProduct=await activeInstance.invokeInApp('create_product',{dto:{sku:'NATIVE-STOCK',name:'Native stock test',unit_price_minor:100,is_stock_tracked:true,opening_stock_scaled:50000}});
    const stockInput={id:crypto.randomUUID(),product_id:stockProduct.id,quantity_delta_scaled:20000,business_date:'2026-10-23',reason:'Native delivery'};
    const stockPosted=await activeInstance.invokeInApp('post_stock_adjustment',{input:stockInput});
    const stockRetry=await activeInstance.invokeInApp('post_stock_adjustment',{input:stockInput});
    assert(stockPosted.resulting_stock_scaled===70000&&stockRetry.id===stockPosted.id,'Native stock adjustment and retry retain one movement');
    await activeInstance.invokeInApp('post_stock_adjustment',{input:{...stockInput,id:crypto.randomUUID(),quantity_delta_scaled:-2000,reason:'Damage'}});
    let stockRejected=false;try{await activeInstance.invokeInApp('post_stock_adjustment',{input:{...stockInput,id:crypto.randomUUID(),quantity_delta_scaled:-69000}});}catch(error){stockRejected=String(error).includes('STOCK_REJECTED:');}
    assert(stockRejected,'Native insufficient stock rejects as known-unwritten');
    const stockCorrection=await activeInstance.invokeInApp('post_stock_adjustment',{input:{...stockInput,id:crypto.randomUUID(),quantity_delta_scaled:-20000,reason:'Correction',reversal_of:stockPosted.id}});
    assert(stockCorrection.resulting_stock_scaled===48000,'Native stock correction preserves balance');
    const stockHistory=await activeInstance.invokeInApp('get_stock_history',{productId:stockProduct.id});
    assert(stockHistory.length===4&&stockHistory.some(m=>m.reference_id===stockPosted.id),'Native stock history retains opening and correction');
    const portable=await activeInstance.invokeInApp('export_workspace_backup',{});
    assert(portable.format_version==='1.1'&&portable.cashbook_transfers.length===2,'Native IPC backup1.1 retains both headers');
    recordTest('native_transfer_ipc_atomic_retry_reversal_and_backup',true,{number:postedTransfer.transfer.transfer_number});

    // Gracefully terminate instance 2
    console.log('\nGracefully terminating instance 2...');
    await activeInstance.terminate();
    activeInstance = null;
    console.log('Instance 2 cleanly terminated.');
    activeInstance=await startNativeInstance(tempDir,PORT);
    const coldStock=await activeInstance.invokeInApp('get_stock_history',{productId:stockProduct.id});
    assert(coldStock.length===4,'Native stock history survives cold restart');
    const coldHeaders=await activeInstance.invokeInApp('get_cashbook_transfers',{filter:{account_id:transferAccounts[0]}});
    assert(coldHeaders.length===2&&coldHeaders.find(h=>h.id===postedTransfer.transfer.id)?.is_reversed,'Native cold restart preserves paired reversal');
    await activeInstance.terminate();activeInstance=null;

    // =========================================================================
    // PHASE 3: Database Isolation & Real User Business Data Verification
    // =========================================================================
    console.log('\n--- Phase 3: Database Isolation & Real Data Protection ---');
    const tempDbPath = path.join(tempDir, 'billzen.db');
    const tempDbExists = fs.existsSync(tempDbPath);
    const tempDbStat = tempDbExists ? fs.statSync(tempDbPath) : null;
    assert(tempDbExists === true, 'Isolated database billzen.db exists in temp directory');
    assert((tempDbStat?.size || 0) > 0, 'Isolated database size is greater than 0');

    // Verify real user directory is 100% untouched
    const postTestPrints = captureRealDbFingerprints();
    let realDataUntouched = true;
    if (preTestPrints.exists && postTestPrints.exists) {
      for (const [fname, before] of Object.entries(preTestPrints.files)) {
        const after = postTestPrints.files[fname];
        if (!after || after.sha256 !== before.sha256 || after.size !== before.size) {
          realDataUntouched = false;
          console.error(`DATA CORRUPTION DETECTED in real file ${fname}!`);
        }
      }
    }
    assert(realDataUntouched === true, 'Real user database files remain 100% untouched');

    recordTest('database_isolation_and_real_data_protected', true, {
      tempDbExists,
      tempDbSize: tempDbStat?.size,
      realDataUntouched,
      realDir: preTestPrints.dir,
      monitoredFiles: preTestPrints.exists ? Object.keys(preTestPrints.files) : [],
    });

    report.allPassed = report.tests.every((t) => t.passed);
  } catch (err) {
    console.error('Fatal native verification error:', err);
    report.error = String(err);
    report.allPassed = false;
  } finally {
    if (activeInstance) {
      try {
        await activeInstance.terminate();
      } catch {}
    }

    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
        console.log(`Cleaned up temporary isolated directory: ${tempDir}`);
      }
    } catch (e) {
      console.warn('Failed to remove temp dir:', e);
    }

    fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));

    console.log('\n=== Native Desktop Cashbook Verification Summary ===');
    console.log(`Total Assertions Evaluated: ${report.assertionsCount}`);
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
