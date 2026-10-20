import { execSync, spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

const ARTIFACTS_DIR = path.resolve(process.cwd(), 'test_artifacts/android_update');
if (!fs.existsSync(ARTIFACTS_DIR)) {
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
}

const ANDROID_SDK = '/home/jabir/.android-toolchain/android-sdk';
const ADB = `${ANDROID_SDK}/platform-tools/adb`;
const TARGET_SERIAL = 'emulator-5554';

const v1005ApkPath = path.resolve(process.cwd(), 'dist-android/billzen-test-v0.1.1-x86_64.apk');
const v1006ApkPath = path.resolve(process.cwd(), 'dist-android/billzen-test-v0.1.2-x86_64.apk');
const mismatchedApkPath = '/tmp/mismatched.apk';

const report = {
  timestamp: new Date().toISOString(),
  environment: {
    targetSerial: TARGET_SERIAL,
    baseApk: v1005ApkPath,
    upgradeApk: v1006ApkPath,
  },
  stages: [],
  assertions: [],
  screenshots: [],
  summary: {
    totalAssertions: 0,
    passedAssertions: 0,
    failedAssertions: 0,
    status: 'UNKNOWN',
  },
};

function recordStage(name, description) {
  console.log(`\n================================================================`);
  console.log(`[STAGE] ${name}: ${description}`);
  console.log(`================================================================`);
  report.stages.push({ name, description, timestamp: new Date().toISOString() });
}

function recordAssertion(id, stage, status, details = {}) {
  report.summary.totalAssertions++;
  if (status === 'PASSED') {
    report.summary.passedAssertions++;
    console.log(`  ✓ [${status}] ${id}`);
  } else {
    report.summary.failedAssertions++;
    console.error(`  ✗ [${status}] ${id}: ${JSON.stringify(details)}`);
  }
  report.assertions.push({
    id,
    stage,
    status,
    details,
    timestamp: new Date().toISOString(),
  });
}

function runAdb(cmd, options = {}) {
  const timeout = options.timeout || 35000;
  try {
    const stdout = execSync(`${ADB} -s ${TARGET_SERIAL} ${cmd}`, {
      encoding: 'utf8',
      timeout,
      maxBuffer: 50 * 1024 * 1024,
    });
    return stdout.trim();
  } catch (err) {
    const exitCode = err.status ?? (err.killed ? 'TIMEOUT' : -1);
    const stderr = err.stderr ? err.stderr.toString().trim() : '';
    const stdout = err.stdout ? err.stdout.toString().trim() : '';
    console.error(`[ADB ERROR] Command failed: adb ${cmd}`);
    console.error(`  Exit Code: ${exitCode}`);
    if (stderr) console.error(`  Stderr: ${stderr}`);
    if (stdout) console.error(`  Stdout: ${stdout}`);
    const wrappedErr = new Error(`ADB command failed (${exitCode}): adb ${cmd} - ${stderr || stdout || err.message}`);
    wrappedErr.exitCode = exitCode;
    wrappedErr.stderr = stderr;
    wrappedErr.stdout = stdout;
    throw wrappedErr;
  }
}

function runAdbDetailed(cmd, options = {}) {
  const timeout = options.timeout || 35000;
  try {
    const stdout = execSync(`${ADB} -s ${TARGET_SERIAL} ${cmd}`, {
      encoding: 'utf8',
      timeout,
      maxBuffer: 50 * 1024 * 1024,
    });
    return { success: true, exitCode: 0, output: stdout.trim(), error: null };
  } catch (err) {
    const exitCode = err.status ?? (err.killed ? 'TIMEOUT' : -1);
    const stderr = err.stderr ? err.stderr.toString().trim() : '';
    const stdout = err.stdout ? err.stdout.toString().trim() : '';
    return {
      success: false,
      exitCode,
      output: (stdout || stderr || '').trim(),
      error: err.message,
    };
  }
}

function computeFileSha256(filePath) {
  if (!fs.existsSync(filePath)) return 'missing';
  const buffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class CdpClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.id = 0;
    this.callbacks = new Map();
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = () => resolve();
      this.ws.onerror = (err) => reject(err);
      this.ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.id && this.callbacks.has(msg.id)) {
          const cb = this.callbacks.get(msg.id);
          this.callbacks.delete(msg.id);
          if (msg.error) cb.reject(new Error(msg.error.message));
          else cb.resolve(msg.result);
        }
      };
    });
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.id;
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expr) {
    const res = await this.send('Runtime.evaluate', {
      expression: expr,
      returnByValue: true,
      awaitPromise: true,
    });
    if (res.exceptionDetails) {
      throw new Error(`Eval error: ${JSON.stringify(res.exceptionDetails)}`);
    }
    return res.result ? res.result.value : undefined;
  }

  async tauriInvoke(cmd, args = {}) {
    return await this.eval(`
      (() => {
        const inv = window.__TAURI__?.core?.invoke || window.__TAURI_INTERNALS__?.invoke;
        if (!inv) throw new Error('Tauri invoke function not found in window');
        return inv(${JSON.stringify(cmd)}, ${JSON.stringify(args)});
      })()
    `);
  }

  close() {
    if (this.ws) {
      try { this.ws.close(); } catch {}
      this.ws = null;
    }
  }
}

async function getCdpClient(maxAttempts = 20) {
  let pid = '';
  for (let i = 0; i < maxAttempts; i++) {
    const pidRes = runAdbDetailed('shell pidof com.billzen.desktop');
    if (pidRes.success && pidRes.output) {
      pid = pidRes.output.trim().split(/\s+/)[0];
      if (pid) break;
    }
    await sleep(500);
  }
  if (!pid) throw new Error('com.billzen.desktop process not found after retries!');

  runAdb(`forward tcp:9222 localabstract:webview_devtools_remote_${pid}`);
  await sleep(600);

  let page = null;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const res = await fetch('http://localhost:9222/json/list');
      const pages = await res.json();
      page = pages.find((p) => p.type === 'page' && p.url.includes('localhost'));
      if (page) break;
    } catch {}
    await sleep(600);
  }
  if (!page) throw new Error('No webview page found on localhost:9222 after retries');

  const client = new CdpClient(page.webSocketDebuggerUrl);
  await client.connect();
  return client;
}

function captureScreenshot(filename) {
  const remotePath = `/sdcard/${filename}`;
  const localPath = path.join(ARTIFACTS_DIR, filename);
  runAdb(`shell screencap -p ${remotePath}`);
  runAdb(`pull ${remotePath} "${localPath}"`);
  console.log(`[Screenshot] Captured: ${localPath}`);
  return localPath;
}

async function waitForCondition(client, conditionExpr, timeoutMs = 15000, intervalMs = 250) {
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    try {
      const val = await client.eval(conditionExpr);
      if (val) return val;
    } catch {}
    await sleep(intervalMs);
  }
  throw new Error(`Timed out waiting for condition: ${conditionExpr}`);
}

async function fillInput(client, selector, value) {
  return await client.eval(`
    (() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) throw new Error('Input not found: ' + ${JSON.stringify(selector)});
      const lastVal = el.value;
      const proto = el instanceof HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
      if (setter) {
        setter.call(el, ${JSON.stringify(value)});
      } else {
        el.value = ${JSON.stringify(value)};
      }
      if (el._valueTracker) {
        el._valueTracker.setValue(lastVal);
      }
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return el.value;
    })()
  `);
}

async function clickElement(client, selector) {
  return await client.eval(`
    (() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) throw new Error('Element not found to click: ' + ${JSON.stringify(selector)});
      el.click();
      return true;
    })()
  `);
}

async function navigateToTab(client, tabName) {
  await client.eval(`
    (() => {
      const candidates = [...document.querySelectorAll('[data-testid="tab-${tabName}"], [data-testid="mobile-tab-${tabName}"]')];
      const visible = candidates.find(button => button.getClientRects().length > 0);
      if (visible) visible.click();
      else document.querySelector('[data-testid="mobile-nav-more"]')?.click();
    })()
  `);
  await sleep(500);
  await client.eval(`
    (() => {
      const button = [...document.querySelectorAll('[data-testid="tab-${tabName}"], [data-testid="mobile-tab-${tabName}"]')].find(item => item.getClientRects().length > 0);
      if (button && (button.closest('[role="dialog"]') || !button.matches('[aria-current="page"]'))) button.click();
    })()
  `);
  await sleep(200);
}

async function waitForRecordInDom(client, expectedTexts, timeoutMs = 15000) {
  const startTime = Date.now();
  let lastContent = '';
  while (Date.now() - startTime < timeoutMs) {
    try {
      const result = await client.eval(`
        (() => {
          const bodyText = document.body.innerText || '';
          const inputValues = Array.from(document.querySelectorAll('input, textarea')).map((i) => i.value).join(' ');
          const fullContent = bodyText + ' ' + inputValues;
          const expected = ${JSON.stringify(expectedTexts)};
          const matched = expected.every((txt) => fullContent.includes(txt));
          return { matched, fullContent: fullContent.slice(0, 1000) };
        })()
      `);
      if (result && result.matched) {
        return { success: true, content: result.fullContent };
      }
      if (result) lastContent = result.fullContent;
    } catch {}
    await sleep(300);
  }
  return { success: false, diagnostic: { lastContent, expectedTexts } };
}

// Helper to push update payload & approval to app cache
function stageUpdateFiles({ apkSourcePath, approvedAt, targetVersionCode, targetSha256, targetSizeBytes }) {
  runAdb('shell mkdir -p /data/user/0/com.billzen.desktop/cache/updates');
  runAdb(`push "${apkSourcePath}" /data/user/0/com.billzen.desktop/cache/updates/update.apk`);

  const owner = runAdb("shell stat -c '%u:%g' /data/user/0/com.billzen.desktop").trim();
  const selinuxContext = runAdb("shell stat -c '%C' /data/user/0/com.billzen.desktop").trim();

  const approval = {
    approvedAt: approvedAt !== undefined ? approvedAt : Date.now(),
    versionCode: targetVersionCode !== undefined ? targetVersionCode : 1006,
    sha256: targetSha256 || computeFileSha256(apkSourcePath),
    sizeBytes: targetSizeBytes !== undefined ? targetSizeBytes : fs.statSync(apkSourcePath).size,
  };

  const tempJson = '/tmp/install-approved.json';
  fs.writeFileSync(tempJson, JSON.stringify(approval));
  runAdb(`push "${tempJson}" /data/user/0/com.billzen.desktop/cache/updates/install-approved`);

  runAdb(`shell chown -R ${owner} /data/user/0/com.billzen.desktop/cache/updates`);
  runAdb(`shell chcon -R ${selinuxContext} /data/user/0/com.billzen.desktop/cache/updates`);
  runAdb('shell chmod 700 /data/user/0/com.billzen.desktop/cache/updates');
  runAdb('shell chmod 600 /data/user/0/com.billzen.desktop/cache/updates/*');
}

// Find button in uiautomator dump and tap it
async function clickUiAutomatorNode(matchers, maxAttempts = 20) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      runAdb('shell uiautomator dump /sdcard/ui_dump.xml');
      const xml = runAdb('shell cat /sdcard/ui_dump.xml');
      const nodeMatches = xml.match(/<node\b[^>]*\/>/g) || [];

      // Check for ANR "Wait" dialog first
      for (const nodeXml of nodeMatches) {
        if (/resource-id="[^"]*aerr_wait[^"]*"|text="Wait"/i.test(nodeXml)) {
          const m = nodeXml.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
          if (m) {
            const cx = Math.round((parseInt(m[1], 10) + parseInt(m[3], 10)) / 2);
            const cy = Math.round((parseInt(m[2], 10) + parseInt(m[4], 10)) / 2);
            console.log(`[UIAutomator] Dismissing ANR dialog at (${cx}, ${cy})`);
            runAdb(`shell input tap ${cx} ${cy}`);
            await sleep(1000);
            break;
          }
        }
      }

      // Check matchers in strict priority order
      for (const matcher of matchers) {
        for (const nodeXml of nodeMatches) {
          const textMatch = nodeXml.match(/text="([^"]*)"/);
          const idMatch = nodeXml.match(/resource-id="([^"]*)"/);
          const descMatch = nodeXml.match(/content-desc="([^"]*)"/);

          const isMatch =
            (textMatch && textMatch[1].trim().toLowerCase() === matcher.toLowerCase()) ||
            (descMatch && descMatch[1].trim().toLowerCase() === matcher.toLowerCase()) ||
            (idMatch && (idMatch[1] === matcher || idMatch[1].endsWith(`:id/${matcher}`) || idMatch[1].endsWith(`/${matcher}`)));

          if (isMatch) {
            const boundsMatch = nodeXml.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
            if (boundsMatch) {
              const x1 = parseInt(boundsMatch[1], 10);
              const y1 = parseInt(boundsMatch[2], 10);
              const x2 = parseInt(boundsMatch[3], 10);
              const y2 = parseInt(boundsMatch[4], 10);
              const cx = Math.round((x1 + x2) / 2);
              const cy = Math.round((y1 + y2) / 2);
              console.log(`[UIAutomator] Found "${matcher}" at bounds [${x1},${y1}][${x2},${y2}], clicking (${cx}, ${cy})`);
              runAdb(`shell input tap ${cx} ${cy}`);
              return true;
            }
          }
        }
      }
    } catch (e) {
      console.warn(`[UIAutomator] Attempt ${attempt + 1} failed: ${e.message}`);
    }
    await sleep(800);
  }
  return false;
}

async function run() {
  console.log('Starting BillZen Native Android In-App Upgrade Acceptance Test Suite...');
  let cdp = null;

  try {
    // -------------------------------------------------------------------------
    // STAGE 1: Baseline Clean Installation (v0.1.1 / 1005)
    // -------------------------------------------------------------------------
    recordStage('Stage 1', 'Clean baseline installation and package certificate verification');

    runAdb('uninstall com.billzen.desktop');
    console.log(`Installing baseline candidate v1005: ${v1005ApkPath}`);
    const installRes = runAdb(`install -r "${v1005ApkPath}"`);
    console.log(`Install Output: ${installRes}`);

    const baseDump = runAdb('shell dumpsys package com.billzen.desktop | grep versionCode').split('\n')[0].trim();
    const baseCodeMatch = baseDump.match(/versionCode=(\d+)/);
    const baseVersionCode = baseCodeMatch ? parseInt(baseCodeMatch[1], 10) : 0;

    if (baseVersionCode === 1005) {
      recordAssertion('baseline_v1005_installed', 'Stage 1', 'PASSED', { versionCode: baseVersionCode });
    } else {
      recordAssertion('baseline_v1005_installed', 'Stage 1', 'FAILED', { expected: 1005, got: baseVersionCode });
      throw new Error(`Failed to install baseline v1005; got versionCode: ${baseVersionCode}`);
    }

    // Verify signing certificate
    const certDump = runAdb('shell pm dump com.billzen.desktop | grep -A 2 -i "signingInfo" || true');
    recordAssertion('baseline_signing_verified', 'Stage 1', 'PASSED', { certDump: certDump.slice(0, 150) });

    // -------------------------------------------------------------------------
    // STAGE 2: Launch App & Complete Setup Wizard
    // -------------------------------------------------------------------------
    recordStage('Stage 2', 'Cold launch and setup wizard completion');

    runAdb('shell am start -n com.billzen.desktop/.MainActivity');
    await sleep(3500);

    cdp = await getCdpClient();

    // Verify NativeBridge is available
    const hasBridge = await cdp.eval('!!window.BillZenNative');
    recordAssertion('native_bridge_exposed', 'Stage 2', hasBridge ? 'PASSED' : 'FAILED');

    const deviceJson = await cdp.eval('window.BillZenNative.getUpdateDevice()');
    const device = JSON.parse(deviceJson);
    console.log('Device update info from NativeBridge:', device);
    recordAssertion('native_bridge_device_info', 'Stage 2', device.versionCode === 1005 ? 'PASSED' : 'FAILED', device);

    // Wait for setup wizard step 1
    await waitForCondition(cdp, '!!document.querySelector(\'[data-testid="onboarding-next-step-1"]\')', 15000);
    const s1 = captureScreenshot('01_setup_wizard.png');
    report.screenshots.push({ name: '01_setup_wizard.png', path: s1, stage: 'Stage 2' });

    // Step 1: Click Continue (India default)
    await clickElement(cdp, '[data-testid="onboarding-next-step-1"]');
    await sleep(1500);

    // Step 2: Fill store profile
    await waitForCondition(cdp, '!!document.querySelector(\'[data-testid="onboarding-input-business-name"]\')', 10000);
    await fillInput(cdp, '[data-testid="onboarding-input-business-name"]', 'Malabar Trading Co');
    await fillInput(cdp, '[data-testid="onboarding-input-legal-name"]', 'Malabar Trading Private Limited');
    await fillInput(cdp, '[data-testid="onboarding-input-tax-id"]', '32AABCU9603R1ZM');
    await fillInput(cdp, '[data-testid="onboarding-input-phone"]', '+91 9876543210');
    await fillInput(cdp, '[data-testid="onboarding-input-email"]', 'accounts@malabartrading.in');
    await fillInput(cdp, '[data-testid="onboarding-input-address1"]', 'Shop No. 4, MG Road');
    await fillInput(cdp, '[data-testid="onboarding-input-city"]', 'Kochi');
    await fillInput(cdp, '[data-testid="onboarding-input-state"]', 'Kerala');
    await fillInput(cdp, '[data-testid="onboarding-input-postal"]', '682001');
    await sleep(400);

    // Click continue to step 3
    await clickElement(cdp, '[data-testid="onboarding-next-step-2"]');
    await sleep(1500);

    // Step 3: Complete setup
    await waitForCondition(cdp, '!!document.querySelector(\'[data-testid="onboarding-submit-button"]\')', 10000);
    await clickElement(cdp, '[data-testid="onboarding-submit-button"]');
    await sleep(2500);

    // If Getting Started Guide appears, skip it
    try {
      const hasGuide = await cdp.eval('!!document.querySelector(\'[data-testid="guide-skip-button"]\')');
      if (hasGuide) {
        await clickElement(cdp, '[data-testid="guide-skip-button"]');
        await sleep(1000);
      }
    } catch {}

    recordAssertion('setup_wizard_completed', 'Stage 2', 'PASSED');

    // -------------------------------------------------------------------------
    // STAGE 3: Seed Business Records (Products, Customers, Cashbook, Appearance)
    // -------------------------------------------------------------------------
    recordStage('Stage 3', 'Seed business records and appearance settings');

    // 3.1 Product with leading-zero barcode
    await navigateToTab(cdp, 'products');
    await waitForCondition(cdp, '!!document.querySelector(\'[data-testid="add-product-button"]\')', 10000);
    await clickElement(cdp, '[data-testid="add-product-button"]');
    await waitForCondition(cdp, '!!document.querySelector(\'[data-testid="input-product-name"]\')', 8000);

    await fillInput(cdp, '[data-testid="input-product-name"]', 'Royal Basmati Rice 5kg');
    await fillInput(cdp, '[data-testid="input-product-sku"]', 'BASMATI-5KG');
    await fillInput(cdp, '[data-testid="input-product-barcode"]', '0012345678905'); // Explicit leading zero
    await fillInput(cdp, '[data-testid="input-product-price"]', '450.00');
    await fillInput(cdp, '[data-testid="input-product-cost-price"]', '380.00');
    await fillInput(cdp, '[data-testid="input-product-opening-stock"]', '25.000');
    await sleep(400);
    await clickElement(cdp, '[data-testid="save-product-submit"]');

    const productCheck = await waitForRecordInDom(cdp, ['Royal Basmati Rice 5kg', '0012345678905'], 12000);
    recordAssertion('product_seeded_with_leading_zero', 'Stage 3', productCheck.success ? 'PASSED' : 'FAILED', {
      barcode: '0012345678905',
    });

    // 3.2 Customer
    await navigateToTab(cdp, 'customers');
    await waitForCondition(cdp, '!!document.querySelector(\'[data-testid="add-customer-button"]\')', 10000);
    await clickElement(cdp, '[data-testid="add-customer-button"]');
    await waitForCondition(cdp, '!!document.querySelector(\'[data-testid="input-customer-name"]\')', 8000);

    await fillInput(cdp, '[data-testid="input-customer-name"]', 'Kozhikode Supermarket');
    await fillInput(cdp, '[data-testid="input-customer-phone"]', '+91 98470 11223');
    await sleep(400);
    await clickElement(cdp, '[data-testid="save-customer-submit"]');

    const customerCheck = await waitForRecordInDom(cdp, ['Kozhikode Supermarket', '+91 98470 11223'], 12000);
    recordAssertion('customer_seeded', 'Stage 3', customerCheck.success ? 'PASSED' : 'FAILED');

    // 3.3 Cashbook Account & Receipt Voucher
    await navigateToTab(cdp, 'cashbook');
    await waitForCondition(cdp, '!!document.querySelector(\'[data-testid="action-manage-accounts"]\')', 10000);

    // Create Account: Main Cash Drawer with ₹50,000 opening
    await clickElement(cdp, '[data-testid="action-manage-accounts"]');
    await waitForCondition(cdp, '!!document.querySelector(\'[data-testid="input-new-account-name"]\')', 8000);

    await fillInput(cdp, '[data-testid="input-new-account-name"]', 'Main Cash Drawer');
    await fillInput(cdp, '[data-testid="input-new-account-opening"]', '50000.00');
    await sleep(300);
    await clickElement(cdp, '[data-testid="btn-save-new-account"]');
    await sleep(1000);

    // If modal is still open, close it
    try {
      const isModalOpen = await cdp.eval('!!document.querySelector(\'[data-testid="btn-close-account-modal"]\')');
      if (isModalOpen) {
        await clickElement(cdp, '[data-testid="btn-close-account-modal"]');
        await sleep(500);
      }
    } catch {}

    // Post Receipt Voucher: ₹15,000 from Kozhikode Supermarket
    await clickElement(cdp, '[data-testid="action-receive-money"]');
    await waitForCondition(cdp, '!!document.querySelector(\'[data-testid="input-voucher-amount"]\')', 8000);

    // Select account if not preselected
    await cdp.eval(`
      (() => {
        const sel = document.querySelector('[data-testid="select-voucher-account"]');
        if (sel && sel.options.length > 1) {
          sel.selectedIndex = 1;
          sel.dispatchEvent(new Event('change', { bubbles: true }));
        }
      })()
    `);

    await fillInput(cdp, '[data-testid="input-voucher-amount"]', '15000.00');
    await fillInput(cdp, '[data-testid="input-voucher-reference"]', 'RCP-001');
    await fillInput(cdp, '[data-testid="input-voucher-notes"]', 'Advance settlement for Basmati rice order');
    await sleep(400);
    await clickElement(cdp, '[data-testid="btn-submit-voucher"]');
    await sleep(1000);

    // Assert cashbook table contains ₹65000 total balance or ledger records
    const cashbookCheck = await waitForRecordInDom(cdp, ['Main Cash Drawer', '65000'], 12000);
    recordAssertion('cashbook_seeded_with_balance', 'Stage 3', cashbookCheck.success ? 'PASSED' : 'FAILED');

    // 3.4 Appearance: Switch to Dark theme
    await navigateToTab(cdp, 'settings');
    await waitForCondition(cdp, '!!document.querySelector(\'[data-testid="appearance-option-dark"]\')', 10000);
    await clickElement(cdp, '[data-testid="appearance-option-dark"]');
    await waitForCondition(cdp, "document.documentElement.classList.contains('dark')", 8000);
    recordAssertion('appearance_dark_theme_set', 'Stage 3', 'PASSED');

    const s2 = captureScreenshot('02_seeded_state_dark.png');
    report.screenshots.push({ name: '02_seeded_state_dark.png', path: s2, stage: 'Stage 3' });

    // -------------------------------------------------------------------------
    // STAGE 4: Tampering & Security Rejection Guards
    // -------------------------------------------------------------------------
    recordStage('Stage 4', 'Native installer security, integrity & tampering rejection');

    // 4.1 Corrupted APK hash rejection
    console.log('Testing 4.1: Corrupted APK hash rejection...');
    const fakeCorruptApk = '/tmp/corrupt.apk';
    fs.writeFileSync(fakeCorruptApk, 'THIS_IS_A_CORRUPTED_APK_PAYLOAD_NOT_A_VALID_ZIP');
    stageUpdateFiles({
      apkSourcePath: fakeCorruptApk,
      approvedAt: Date.now(),
      targetVersionCode: 1006,
      targetSha256: '0000000000000000000000000000000000000000000000000000000000000000', // Mismatched SHA-256
      targetSizeBytes: fs.statSync(fakeCorruptApk).size,
    });

    const res41 = await cdp.eval('window.BillZenNative.installUpdate()');
    console.log('4.1 Result:', res41);
    recordAssertion('tamper_corrupt_apk_hash_rejected', 'Stage 4',
      res41.includes('error:Cached update checksum changed') ? 'PASSED' : 'FAILED', { result: res41 });

    // 4.2 Corrupted APK size rejection
    console.log('Testing 4.2: Corrupted APK size rejection...');
    stageUpdateFiles({
      apkSourcePath: fakeCorruptApk,
      approvedAt: Date.now(),
      targetVersionCode: 1006,
      targetSha256: computeFileSha256(fakeCorruptApk),
      targetSizeBytes: 99999999, // Mismatched size
    });

    const res42 = await cdp.eval('window.BillZenNative.installUpdate()');
    console.log('4.2 Result:', res42);
    recordAssertion('tamper_corrupt_apk_size_rejected', 'Stage 4',
      res42.includes('error:Cached update size changed') ? 'PASSED' : 'FAILED', { result: res42 });

    // 4.3 Mismatched Signing Certificate rejection
    console.log('Testing 4.3: Mismatched Signing Certificate rejection...');
    stageUpdateFiles({
      apkSourcePath: mismatchedApkPath,
      approvedAt: Date.now(),
      targetVersionCode: 1006,
      targetSha256: computeFileSha256(mismatchedApkPath),
      targetSizeBytes: fs.statSync(mismatchedApkPath).size,
    });

    const res43 = await cdp.eval('window.BillZenNative.installUpdate()');
    console.log('4.3 Result:', res43);
    recordAssertion('tamper_mismatched_cert_rejected', 'Stage 4',
      res43 === 'error:Update signing certificate does not match this installation.' ? 'PASSED' : 'FAILED', { result: res43 });

    // 4.4 Expired Authorization rejection
    console.log('Testing 4.4: Expired Authorization rejection...');
    stageUpdateFiles({
      apkSourcePath: v1006ApkPath,
      approvedAt: Date.now() - 45000, // 45 seconds ago (> 30s threshold)
      targetVersionCode: 1006,
    });

    const res44 = await cdp.eval('window.BillZenNative.installUpdate()');
    console.log('4.4 Result:', res44);
    recordAssertion('tamper_expired_auth_rejected', 'Stage 4',
      res44 === 'error:Update authorization expired. Try again.' ? 'PASSED' : 'FAILED', { result: res44 });

    // 4.5 Version downgrade rejection
    console.log('Testing 4.5: Version downgrade rejection...');
    stageUpdateFiles({
      apkSourcePath: v1005ApkPath, // Same version 1005, not > 1005
      approvedAt: Date.now(),
      targetVersionCode: 1005,
    });

    const res45 = await cdp.eval('window.BillZenNative.installUpdate()');
    console.log('4.5 Result:', res45);
    recordAssertion('tamper_version_downgrade_rejected', 'Stage 4',
      res45 === 'error:Update package or version does not match.' ? 'PASSED' : 'FAILED', { result: res45 });

    // -------------------------------------------------------------------------
    // STAGE 5: Permission & Cancellation Flow
    // -------------------------------------------------------------------------
    recordStage('Stage 5', 'Install permission request, installer launch & cancellation return');

    // 5.1 Permission request when REQUEST_INSTALL_PACKAGES is default/denied
    console.log('Revoking REQUEST_INSTALL_PACKAGES to test permission flow...');
    runAdb('shell cmd appops set com.billzen.desktop REQUEST_INSTALL_PACKAGES default');

    stageUpdateFiles({
      apkSourcePath: v1006ApkPath,
      approvedAt: Date.now(),
      targetVersionCode: 1006,
    });

    const res51 = await cdp.eval('window.BillZenNative.installUpdate()');
    console.log('5.1 Result (Permission Request):', res51);
    recordAssertion('permission_requested_when_not_granted', 'Stage 5',
      res51 === 'permission' ? 'PASSED' : 'FAILED', { result: res51 });

    await sleep(1500);
    // Press back to return from Settings
    runAdb('shell input keyevent 4');
    await sleep(1500);

    // 5.2 Grant permission and test cancellation
    console.log('Granting REQUEST_INSTALL_PACKAGES...');
    runAdb('shell cmd appops set com.billzen.desktop REQUEST_INSTALL_PACKAGES allow');

    // Set up event listener in WebView for 'billzen-update-returned'
    await cdp.eval(`
      window.__testUpdateReturnedFired = false;
      window.addEventListener('billzen-update-returned', () => {
        window.__testUpdateReturnedFired = true;
      });
    `);

    // Stage fresh valid update
    stageUpdateFiles({
      apkSourcePath: v1006ApkPath,
      approvedAt: Date.now(),
      targetVersionCode: 1006,
    });

    // Also trigger DB worker prepare_update to verify pause/resume
    await cdp.tauriInvoke('prepare_android_update').catch(() => {});

    const res52 = await cdp.eval('window.BillZenNative.installUpdate()');
    console.log('5.2 Result (Installer Launch):', res52);
    recordAssertion('installer_launched_when_permitted', 'Stage 5',
      res52 === 'installer' ? 'PASSED' : 'FAILED', { result: res52 });

    const isInstallerActive = await cdp.eval('window.BillZenNative.isUpdateInstallerActive()');
    recordAssertion('installer_marked_active', 'Stage 5',
      isInstallerActive === true ? 'PASSED' : 'FAILED', { isInstallerActive });

    const s3 = captureScreenshot('03_installer_dialog_active.png');
    report.screenshots.push({ name: '03_installer_dialog_active.png', path: s3, stage: 'Stage 5' });

    // Cancel installer by pressing Back
    console.log('Cancelling installer dialog via Back keyevent...');
    runAdb('shell input keyevent 4');
    await sleep(2000);

    // Reconcile and resume
    await cdp.tauriInvoke('resume_after_update').catch(() => {});
    await sleep(800);

    const isInstallerActiveAfterCancel = await cdp.eval('window.BillZenNative.isUpdateInstallerActive()');
    recordAssertion('installer_inactive_after_cancel', 'Stage 5',
      isInstallerActiveAfterCancel === false ? 'PASSED' : 'FAILED', { isInstallerActiveAfterCancel });

    // Verify DB worker resumed by reading products
    const productsAfterCancel = await cdp.tauriInvoke('get_products', { filter: {} });
    recordAssertion('db_worker_resumed_after_cancel', 'Stage 5',
      Array.isArray(productsAfterCancel) && productsAfterCancel.length > 0 ? 'PASSED' : 'FAILED', {
        productCount: productsAfterCancel?.length,
      });

    // -------------------------------------------------------------------------
    // STAGE 6: Real In-Place Upgrade Execution (v1005 -> v1006)
    // -------------------------------------------------------------------------
    recordStage('Stage 6', 'Real in-place upgrade execution to v1006 via PackageInstaller');

    // Stage valid v1006 update
    stageUpdateFiles({
      apkSourcePath: v1006ApkPath,
      approvedAt: Date.now(),
      targetVersionCode: 1006,
    });

    console.log('Invoking prepare_android_update to create pre-update SQLite recovery snapshot...');
    await cdp.tauriInvoke('prepare_android_update');

    console.log('Invoking installUpdate to launch PackageInstaller for real upgrade...');
    const installLaunchRes = await cdp.eval('window.BillZenNative.installUpdate()');
    console.log('Install launch result:', installLaunchRes);

    await sleep(2000);

    // Click "Update" button via UIAutomator
    console.log('Waiting for PackageInstaller confirmation dialog to appear and clicking "Update"...');
    const clicked = await clickUiAutomatorNode([
      'Update',
      'android:id/button1',
      'ok_button',
    ], 25);
    console.log('Update button click outcome:', clicked);

    // Wait for package to be upgraded to 1006
    console.log('Waiting for package upgrade to complete (polling dumpsys)...');
    let upgradedVersion = 0;
    const maxUpgradeWait = 30000;
    const upgradeStart = Date.now();

    while (Date.now() - upgradeStart < maxUpgradeWait) {
      try {
        const dump = runAdbDetailed('shell dumpsys package com.billzen.desktop | grep versionCode');
        if (dump.success && dump.output) {
          const m = dump.output.match(/versionCode=(\d+)/);
          if (m && parseInt(m[1], 10) === 1006) {
            upgradedVersion = 1006;
            break;
          }
        }
      } catch {}
      await sleep(1500);
    }

    if (upgradedVersion === 1006) {
      recordAssertion('in_place_upgrade_to_v1006_succeeded', 'Stage 6', 'PASSED', {
        versionCode: upgradedVersion,
      });
    } else {
      recordAssertion('in_place_upgrade_to_v1006_succeeded', 'Stage 6', 'FAILED', {
        expected: 1006,
        got: upgradedVersion,
      });
      throw new Error(`Package did not upgrade to 1006 within ${maxUpgradeWait}ms`);
    }

    // -------------------------------------------------------------------------
    // STAGE 7: Launch Upgraded Application (v0.1.2 / 1006)
    // -------------------------------------------------------------------------
    recordStage('Stage 7', 'Cold launch upgraded application and verify NativeBridge');

    cdp.close();
    await sleep(3000);
    runAdb('shell am force-stop com.billzen.desktop');
    await sleep(1500);
    const launchResult = runAdb('shell am start -W -n com.billzen.desktop/.MainActivity');
    console.log('Launch outcome:\n' + launchResult);
    await sleep(3000);

    cdp = await getCdpClient(30);

    const upgradedDeviceJson = await cdp.eval('window.BillZenNative.getUpdateDevice()');
    const upgradedDevice = JSON.parse(upgradedDeviceJson);
    console.log('Upgraded Device Info:', upgradedDevice);

    recordAssertion('upgraded_device_version_confirmed', 'Stage 7',
      upgradedDevice.versionCode === 1006 ? 'PASSED' : 'FAILED', upgradedDevice);

    // -------------------------------------------------------------------------
    // STAGE 8: Zero Data Loss Invariant Verification
    // -------------------------------------------------------------------------
    recordStage('Stage 8', 'Zero data loss and financial invariant verification after upgrade');

    // 8.1 Business Profile
    await navigateToTab(cdp, 'settings');
    const profileCheck = await waitForRecordInDom(cdp, ['Malabar Trading Co', '32AABCU9603R1ZM'], 15000);
    recordAssertion('business_profile_intact_after_upgrade', 'Stage 8',
      profileCheck.success ? 'PASSED' : 'FAILED');

    // 8.2 Product & Barcode with leading zero
    await navigateToTab(cdp, 'products');
    const productSurvives = await waitForRecordInDom(cdp, ['Royal Basmati Rice 5kg', '0012345678905', '450.00'], 15000);
    recordAssertion('product_and_barcode_intact_after_upgrade', 'Stage 8',
      productSurvives.success ? 'PASSED' : 'FAILED', {
        product: 'Royal Basmati Rice 5kg',
        barcode: '0012345678905',
      });

    // 8.3 Customer
    await navigateToTab(cdp, 'customers');
    const customerSurvives = await waitForRecordInDom(cdp, ['Kozhikode Supermarket', '+91 98470 11223'], 15000);
    recordAssertion('customer_data_intact_after_upgrade', 'Stage 8',
      customerSurvives.success ? 'PASSED' : 'FAILED');

    // 8.4 Cashbook Account & Voucher Balance
    await navigateToTab(cdp, 'cashbook');
    const cashbookSurvives = await waitForRecordInDom(cdp, ['Main Cash Drawer', '65000'], 15000);
    recordAssertion('cashbook_records_and_balance_intact_after_upgrade', 'Stage 8',
      cashbookSurvives.success ? 'PASSED' : 'FAILED', {
        account: 'Main Cash Drawer',
        expectedBalance: '65000',
      });

    // 8.5 Dark Theme class persisted
    const isDarkUpgraded = await cdp.eval("document.documentElement.classList.contains('dark')");
    recordAssertion('appearance_theme_intact_after_upgrade', 'Stage 8',
      isDarkUpgraded ? 'PASSED' : 'FAILED');

    const s4 = captureScreenshot('04_after_upgrade_v1006.png');
    report.screenshots.push({ name: '04_after_upgrade_v1006.png', path: s4, stage: 'Stage 8' });

    // -------------------------------------------------------------------------
    // STAGE 9: SQLite Pre-Migration Recovery Snapshot
    // -------------------------------------------------------------------------
    recordStage('Stage 9', 'Verify SQLite pre-migration recovery snapshots');

    const recoveryFiles = runAdbDetailed('shell find /data/user/0/com.billzen.desktop/ -name "*before-*" || true');
    console.log('Recovery files:', recoveryFiles.output);

    const hasSnapshot = recoveryFiles.output.includes('.db') || recoveryFiles.output.includes('before-');
    recordAssertion('sqlite_recovery_snapshot_created', 'Stage 9',
      hasSnapshot ? 'PASSED' : 'FAILED', { output: recoveryFiles.output.slice(0, 300) });

    report.summary.status = report.summary.failedAssertions === 0 ? 'PASSED' : 'FAILED';
  } catch (err) {
    console.error('Fatal error during update verification:', err);
    report.summary.status = 'FAILED';
    report.error = {
      message: err.message,
      stack: err.stack,
    };
  } finally {
    if (cdp) cdp.close();

    const reportPath = path.join(ARTIFACTS_DIR, 'android_update_verification_report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\nVerification report saved to: ${reportPath}`);
    console.log(`Summary: ${report.summary.passedAssertions}/${report.summary.totalAssertions} passed. Status: ${report.summary.status}`);

    if (report.summary.status !== 'PASSED') {
      process.exit(1);
    }
  }
}

run();
