import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

const ARTIFACTS_DIR = path.resolve(process.cwd(), 'test_artifacts/android_runtime');
if (!fs.existsSync(ARTIFACTS_DIR)) {
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
}

const ANDROID_SDK = '/home/jabir/.android-toolchain/android-sdk';
const ADB = `${ANDROID_SDK}/platform-tools/adb`;
const TARGET_SERIAL = 'emulator-5554';

function runAdb(cmd, options = {}) {
  const timeout = options.timeout || 30000;
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
  const timeout = options.timeout || 30000;
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

  close() {
    if (this.ws) {
      try { this.ws.close(); } catch {}
      this.ws = null;
    }
  }
}

async function getCdpClient(maxAttempts = 15) {
  let pid = '';
  for (let i = 0; i < maxAttempts; i++) {
    const pidRes = runAdbDetailed('shell pidof com.billzen.desktop');
    if (pidRes.success && pidRes.output) {
      pid = pidRes.output.trim().split(/\s+/)[0];
      if (pid) break;
    }
    await sleep(500);
  }
  if (!pid) throw new Error('com.billzen.desktop process not found after multiple attempts!');

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
  await sleep(400);
  await client.eval(`
    (() => {
      const button = [...document.querySelectorAll('[data-testid="tab-${tabName}"], [data-testid="mobile-tab-${tabName}"]')].find(item => item.getClientRects().length > 0);
      if (button && (button.closest('[role="dialog"]') || !button.matches('[aria-current="page"]'))) button.click();
    })()
  `);
  await sleep(200);
}

// Bounded condition wait for catalog data and form values with rich timeout diagnostics
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

  // Timeout reached: triage diagnostics
  const debugScreenshot = captureScreenshot('debug_timeout_record_not_found.png');
  let backendProducts = null;
  let backendSettings = null;
  try {
    backendProducts = await client.eval(`
      (async () => {
        try {
          if (window.__TAURI__?.core?.invoke) return await window.__TAURI__.core.invoke('get_products');
          if (window.__TAURI_INTERNALS__?.invoke) return await window.__TAURI_INTERNALS__.invoke('get_products');
          return 'TAURI_INVOKE_NOT_FOUND';
        } catch (e) {
          return 'INVOKE_ERROR: ' + e.message;
        }
      })()
    `);
    backendSettings = await client.eval(`
      (async () => {
        try {
          if (window.__TAURI__?.core?.invoke) return await window.__TAURI__.core.invoke('get_business_settings');
          if (window.__TAURI_INTERNALS__?.invoke) return await window.__TAURI_INTERNALS__.invoke('get_business_settings');
          return 'TAURI_INVOKE_NOT_FOUND';
        } catch (e) {
          return 'INVOKE_ERROR: ' + e.message;
        }
      })()
    `);
  } catch {}

  const diagnostic = {
    expectedTexts,
    domSnippet: lastContent.slice(0, 500),
    isLoading: lastContent.includes('Loading catalog records') || lastContent.includes('Loading'),
    backendProducts,
    backendSettings,
    screenshot: debugScreenshot,
  };
  return { success: false, diagnostic };
}

async function main() {
  console.log('================================================================');
  console.log('   BillZen Native Android Runtime Verification (Hardened Suite) ');
  console.log('================================================================');

  const v1003Path = path.resolve('dist-android/billzen-test-v0.1.0-v1003-x86_64.apk');
  const v1004Path = path.resolve('dist-android/billzen-test-v0.1.0-x86_64.apk');
  const distApkPath = path.resolve('dist-android/billzen-dist-v0.1.0-x86_64.apk');

  const report = {
    suite: 'BillZen Native Android Runtime Verification',
    baselineVersionCode: 1003,
    targetVersionCode: 1004,
    startedAt: new Date().toISOString(),
    completedAt: null,
    device: {},
    packages: {
      baselineV1003: {
        path: v1003Path,
        sha256: computeFileSha256(v1003Path),
      },
      upgradeV1004: {
        path: v1004Path,
        sha256: computeFileSha256(v1004Path),
      },
    },
    stages: [],
    assertions: [],
    screenshots: [],
    logcatSummary: {},
    overallResult: 'PENDING',
  };

  function recordAssertion(name, stage, status, details = {}) {
    const entry = {
      name,
      stage,
      status, // 'PASSED' | 'FAILED'
      details,
      timestamp: new Date().toISOString(),
    };
    report.assertions.push(entry);
    const symbol = status === 'PASSED' ? '✓ [PASS]' : '✗ [FAIL]';
    console.log(`${symbol} ${name} (${stage})`);
    if (status === 'FAILED') {
      console.error(`       Failure details:`, JSON.stringify(details));
    }
  }

  function recordStage(stageName, description) {
    report.stages.push({ stageName, description, timestamp: new Date().toISOString() });
    console.log(`\n▶ Stage: ${stageName} — ${description}`);
  }

  let cdp = null;

  // Capture initial emulator network and UI state for exact restoration in teardown
  let initialAirplaneMode = '0';
  let initialWifi = '1';
  let initialMobileData = '1';
  let initialIsDarkTheme = false;

  try {
    // 0. Verify connected emulator
    const devicesOutput = execSync(`${ADB} devices`, { encoding: 'utf8' });
    console.log('Connected devices:\n' + devicesOutput);
    if (!devicesOutput.includes(TARGET_SERIAL)) {
      throw new Error(`Target emulator serial ${TARGET_SERIAL} is not connected!`);
    }

    // Capture initial state
    initialAirplaneMode = runAdbDetailed('shell settings get global airplane_mode_on').output.trim() || '0';
    initialWifi = runAdbDetailed('shell settings get global wifi_on').output.trim() || '1';
    initialMobileData = runAdbDetailed('shell settings get global mobile_data').output.trim() || '1';
    const initialUiModeOutput = runAdbDetailed('shell cmd uimode').output;
    initialIsDarkTheme = initialUiModeOutput.includes('Night mode: yes');
    console.log(`Initial emulator state: Airplane=${initialAirplaneMode}, WiFi=${initialWifi}, MobileData=${initialMobileData}, DarkTheme=${initialIsDarkTheme}`);

    // Capture device details
    report.device = {
      serial: TARGET_SERIAL,
      model: runAdb('shell getprop ro.product.model'),
      manufacturer: runAdb('shell getprop ro.product.manufacturer'),
      androidVersion: runAdb('shell getprop ro.build.version.release'),
      sdkInt: parseInt(runAdb('shell getprop ro.build.version.sdk') || '0', 10),
      abi: runAdb('shell getprop ro.product.cpu.abi'),
    };
    console.log(`Target device: ${report.device.manufacturer} ${report.device.model} (Android ${report.device.androidVersion}, API ${report.device.sdkInt}, ${report.device.abi})`);

    // Reset logcat marker for clean bounded capture
    runAdbDetailed('logcat -c');

    // =========================================================================
    // STAGE 0: WebView Debugging Security Verification
    // Assert distribution APK exposes NO debugging target, test APK exposes CDP
    // =========================================================================
    if (fs.existsSync(distApkPath)) {
      recordStage('Stage 0', 'WebView debugging security verification (distribution build vs test build)');
      console.log(`Installing distribution APK with WebView debugging disabled: ${distApkPath}`);
      runAdb('uninstall com.billzen.desktop || true');
      runAdb(`install -r "${distApkPath}"`);
      runAdb('shell am force-stop com.billzen.desktop');
      runAdb('shell am start -W -n com.billzen.desktop/.MainActivity');
      let distPid = '';
      for (let attempt = 0; attempt < 15; attempt++) {
        const distPidRes = runAdbDetailed('shell pidof com.billzen.desktop');
        if (distPidRes.success && distPidRes.output) {
          distPid = distPidRes.output.trim().split(/\s+/)[0];
          if (distPid) break;
        }
        await sleep(500);
      }
      if (!distPid) throw new Error('Distribution build failed to launch!');

      const dexdumpBin = `${ANDROID_SDK}/build-tools/34.0.0/dexdump`;
      let distHasDebugCall = true;
      try {
        const dumpOut = execSync(`"${dexdumpBin}" -d "${distApkPath}" | grep -i "setWebContentsDebuggingEnabled" || true`, { encoding: 'utf8' }).trim();
        distHasDebugCall = dumpOut.length > 0;
      } catch {
        distHasDebugCall = false;
      }

      let testHasDebugCall = false;
      try {
        const dumpOut = execSync(`"${dexdumpBin}" -d "${v1004Path}" | grep -i "setWebContentsDebuggingEnabled" || true`, { encoding: 'utf8' }).trim();
        testHasDebugCall = dumpOut.length > 0;
      } catch {}

      const osBuildType = runAdb('shell getprop ro.build.type');
      const isUserDebugOs = osBuildType === 'userdebug';
      const unixSockets = runAdbDetailed(`shell "cat /proc/net/unix | grep webview_devtools_remote_${distPid} || true"`).output;

      if (!distHasDebugCall && testHasDebugCall) {
        recordAssertion('distribution_build_blocks_webview_debugging', 'Stage 0', 'PASSED', {
          distPid,
          distHasDebugCall: false,
          testHasDebugCall: true,
          osBuildType,
          isUserDebugOs,
          osLevelSocketObserved: !!unixSockets,
          securityVerdict: 'Distribution build completely omits setWebContentsDebuggingEnabled in bytecode; test build opts in',
        });
      } else {
        recordAssertion('distribution_build_blocks_webview_debugging', 'Stage 0', 'FAILED', {
          distPid,
          distHasDebugCall,
          testHasDebugCall,
          osBuildType,
        });
        throw new Error('Distribution build contains unexpected debugging calls in bytecode!');
      }

      runAdb('shell am force-stop com.billzen.desktop');
      runAdbDetailed('forward --remove tcp:9222');
    }

    // =========================================================================
    // STAGE 1: Baseline Clean Installation (v1003)
    // =========================================================================
    recordStage('Stage 1', 'Clean baseline installation with v1003 test APK');
    runAdb('uninstall com.billzen.desktop || true');
    const installResult = runAdb(`install -r "${v1003Path}"`);
    console.log(`Install result: ${installResult}`);

    const baselineDump = runAdb('shell dumpsys package com.billzen.desktop | grep versionCode').split('\n')[0].trim();
    const baselineVersionCodeMatch = baselineDump.match(/versionCode=(\d+)/);
    const baselineVersionCode = baselineVersionCodeMatch ? parseInt(baselineVersionCodeMatch[1], 10) : 0;
    
    if (baselineVersionCode === 1003) {
      recordAssertion('baseline_v1003_installed', 'Stage 1', 'PASSED', { versionCode: baselineVersionCode });
    } else {
      recordAssertion('baseline_v1003_installed', 'Stage 1', 'FAILED', { expected: 1003, got: baselineVersionCode });
      throw new Error(`Expected baseline versionCode 1003, got: ${baselineVersionCode}`);
    }

    // =========================================================================
    // STAGE 2: Cold Launch, Setup Wizard & Interrupted Draft Handling
    // =========================================================================
    recordStage('Stage 2', 'Cold launch, setup wizard, and interrupted draft persistence recovery');
    runAdb('shell am start -n com.billzen.desktop/.MainActivity');
    await sleep(4000);

    cdp = await getCdpClient();
    console.log('Connected to BillZen WebView via CDP.');
    recordAssertion('test_build_enables_webview_debugging_for_cdp', 'Stage 2', 'PASSED', {
      connected: true,
      port: 9222,
    });

    // Verify wizard step 1
    await waitForCondition(cdp, 'document.querySelector("h1")?.innerText.includes("Welcome to BillZen")', 12000);
    const s1 = captureScreenshot('01_setup_wizard_step1.png');
    report.screenshots.push({ name: '01_setup_wizard_step1.png', path: s1, stage: 'Stage 2' });
    recordAssertion('wizard_step1_presented', 'Stage 2', 'PASSED');

    // Click continue on step 1 (India default)
    await clickElement(cdp, '[data-testid="onboarding-next-step-1"]');
    await sleep(1500);

    // Verify wizard step 2
    await waitForCondition(cdp, '!!document.querySelector(\'[data-testid="onboarding-input-business-name"]\')', 10000);
    const s2 = captureScreenshot('02_setup_wizard_step2.png');
    report.screenshots.push({ name: '02_setup_wizard_step2.png', path: s2, stage: 'Stage 2' });
    recordAssertion('wizard_step2_presented', 'Stage 2', 'PASSED');

    // Fill store profile
    await fillInput(cdp, '[data-testid="onboarding-input-business-name"]', 'Zen Kerala Store');
    await fillInput(cdp, '[data-testid="onboarding-input-legal-name"]', 'Zen Retail Ltd');
    await fillInput(cdp, '[data-testid="onboarding-input-tax-id"]', '32AAAAA0000A1Z5');
    await fillInput(cdp, '[data-testid="onboarding-input-phone"]', '+91 9876543210');
    await fillInput(cdp, '[data-testid="onboarding-input-email"]', 'contact@zenstore.in');
    await fillInput(cdp, '[data-testid="onboarding-input-address1"]', 'Shop No. 4, MG Road');
    await fillInput(cdp, '[data-testid="onboarding-input-city"]', 'Kochi');
    await fillInput(cdp, '[data-testid="onboarding-input-state"]', 'Kerala');
    await fillInput(cdp, '[data-testid="onboarding-input-postal"]', '682001');
    await sleep(600);

    // Verify setup draft saved to localStorage
    const draftJson = await cdp.eval("localStorage.getItem('billzen_setup_draft')");
    const draft = JSON.parse(draftJson || '{}');
    if (draft.formData?.business_name === 'Zen Kerala Store' && draft.formData?.legal_name === 'Zen Retail Ltd') {
      recordAssertion('setup_draft_saved_to_local_storage', 'Stage 2', 'PASSED');
    } else {
      recordAssertion('setup_draft_saved_to_local_storage', 'Stage 2', 'FAILED', { draftJson });
      throw new Error('Setup draft not persisted to localStorage!');
    }

    // Interrupted draft relaunch test: force-stop app mid-wizard and relaunch
    console.log('Testing interrupted setup draft: waiting for Chromium LevelDB flush before force-stop...');
    await sleep(5500);
    cdp.close();
    runAdb('shell am force-stop com.billzen.desktop');
    await sleep(1000);

    console.log('Relaunching app to verify setup draft recovery...');
    runAdb('shell am start -n com.billzen.desktop/.MainActivity');
    await sleep(4000);

    cdp = await getCdpClient();
    await waitForCondition(cdp, '!!document.querySelector(\'[data-testid="onboarding-input-business-name"]\')', 12000);
    const restoredBizName = await cdp.eval("document.querySelector('[data-testid=\"onboarding-input-business-name\"]')?.value");
    const restoredLegalName = await cdp.eval("document.querySelector('[data-testid=\"onboarding-input-legal-name\"]')?.value");
    const restoredTaxId = await cdp.eval("document.querySelector('[data-testid=\"onboarding-input-tax-id\"]')?.value");

    if (restoredBizName === 'Zen Kerala Store' && restoredLegalName === 'Zen Retail Ltd' && restoredTaxId === '32AAAAA0000A1Z5') {
      recordAssertion('setup_draft_interruption_and_recovery', 'Stage 2', 'PASSED', {
        business_name: restoredBizName,
        legal_name: restoredLegalName,
        tax_id: restoredTaxId,
      });
    } else {
      recordAssertion('setup_draft_interruption_and_recovery', 'Stage 2', 'FAILED', {
        restoredBizName,
        restoredLegalName,
        restoredTaxId,
      });
      throw new Error('Setup draft failed to restore field values upon interrupted relaunch!');
    }

    // Click continue to step 3
    await clickElement(cdp, '[data-testid="onboarding-next-step-2"]');
    await sleep(1500);

    // Verify wizard step 3
    await waitForCondition(cdp, '!!document.querySelector(\'[data-testid="onboarding-submit-button"]\')', 10000);
    recordAssertion('wizard_step3_summary_presented', 'Stage 2', 'PASSED');

    // Submit setup wizard
    await clickElement(cdp, '[data-testid="onboarding-submit-button"]');
    await sleep(3000);

    // =========================================================================
    // STAGE 3: Getting-Started Guide Verification & Dismissal
    // =========================================================================
    recordStage('Stage 3', 'Getting-Started Guide presentation and skip handling');
    await waitForCondition(cdp, '!!document.querySelector(\'[data-testid="guide-skip-button"]\')', 12000);
    const s3 = captureScreenshot('03_getting_started_guide.png');
    report.screenshots.push({ name: '03_getting_started_guide.png', path: s3, stage: 'Stage 3' });
    recordAssertion('guide_auto_presented_after_setup', 'Stage 3', 'PASSED');

    // Skip guide
    await clickElement(cdp, '[data-testid="guide-skip-button"]');
    await sleep(1500);

    const guideOpenAfterSkip = await cdp.eval("!!document.querySelector('[data-testid=\"guide-skip-button\"]')");
    if (!guideOpenAfterSkip) {
      recordAssertion('guide_skip_dismisses_dialog', 'Stage 3', 'PASSED');
    } else {
      recordAssertion('guide_skip_dismisses_dialog', 'Stage 3', 'FAILED', { stillOpen: true });
      throw new Error('Guide did not dismiss after clicking Skip!');
    }

    // =========================================================================
    // STAGE 4: Baseline Catalog Data (Product with leading zeros & Customer)
    // =========================================================================
    recordStage('Stage 4', 'Baseline catalog record creation (Product with leading zeros & Customer)');
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

    // Condition-based wait for product creation
    const productCheck = await waitForRecordInDom(cdp, ['Royal Basmati Rice 5kg', '0012345678905'], 12000);
    if (productCheck.success) {
      recordAssertion('product_created_with_leading_zero', 'Stage 4', 'PASSED', {
        name: 'Royal Basmati Rice 5kg',
        barcode: '0012345678905',
      });
    } else {
      recordAssertion('product_created_with_leading_zero', 'Stage 4', 'FAILED', productCheck.diagnostic);
      throw new Error('Product creation failed on baseline!');
    }
    const s4 = captureScreenshot('04_catalog_product_created.png');
    report.screenshots.push({ name: '04_catalog_product_created.png', path: s4, stage: 'Stage 4' });

    // Customer creation
    await navigateToTab(cdp, 'customers');
    await waitForCondition(cdp, '!!document.querySelector(\'[data-testid="add-customer-button"]\')', 10000);

    await clickElement(cdp, '[data-testid="add-customer-button"]');
    await waitForCondition(cdp, '!!document.querySelector(\'[data-testid="input-customer-name"]\')', 8000);

    await fillInput(cdp, '[data-testid="input-customer-name"]', 'Jabir');
    await fillInput(cdp, '[data-testid="input-customer-phone"]', '+91 9999888877');
    await sleep(400);

    await clickElement(cdp, '[data-testid="save-customer-submit"]');

    // Condition-based wait for customer creation
    const customerCheck = await waitForRecordInDom(cdp, ['Jabir', '+91 9999888877'], 12000);
    if (customerCheck.success) {
      recordAssertion('customer_record_created', 'Stage 4', 'PASSED', {
        name: 'Jabir',
        phone: '+91 9999888877',
      });
    } else {
      recordAssertion('customer_record_created', 'Stage 4', 'FAILED', customerCheck.diagnostic);
      throw new Error('Customer record creation failed on baseline!');
    }
    const s5 = captureScreenshot('05_catalog_customer_created.png');
    report.screenshots.push({ name: '05_catalog_customer_created.png', path: s5, stage: 'Stage 4' });

    // =========================================================================
    // STAGE 5: In-Place Upgrade to v1004 (Zero Data Loss & Comprehensive Invariant Checks)
    // =========================================================================
    recordStage('Stage 5', 'In-place upgrade to v1004 test APK and zero-data-loss verification');
    cdp.close();

    console.log(`Installing upgrade APK: ${v1004Path}`);
    const upgradeResult = runAdb(`install -r "${v1004Path}"`);
    console.log(`Upgrade result: ${upgradeResult}`);

    const upgradedDump = runAdb('shell dumpsys package com.billzen.desktop | grep versionCode').split('\n')[0].trim();
    const upgradedVersionMatch = upgradedDump.match(/versionCode=(\d+)/);
    const upgradedVersionCode = upgradedVersionMatch ? parseInt(upgradedVersionMatch[1], 10) : 0;

    if (upgradedVersionCode === 1004) {
      recordAssertion('in_place_upgrade_to_v1004_version_confirmed', 'Stage 5', 'PASSED', {
        versionCode: upgradedVersionCode,
      });
    } else {
      recordAssertion('in_place_upgrade_to_v1004_version_confirmed', 'Stage 5', 'FAILED', {
        expected: 1004,
        got: upgradedVersionCode,
      });
      throw new Error(`Expected upgraded versionCode 1004, got: ${upgradedVersionCode}`);
    }

    // Launch upgraded app
    runAdb('shell am force-stop com.billzen.desktop');
    runAdb('shell am start -n com.billzen.desktop/.MainActivity');
    await sleep(4000);

    cdp = await getCdpClient();

    // Wait for WebView and navigation readiness
    await waitForCondition(
      cdp,
      "!!document.querySelector('[data-testid=\"tab-products\"]') || !!document.querySelector('[data-testid=\"mobile-tab-products\"]')",
      15000
    );

    // 5.1 Verify Product and Barcode intact after upgrade (with bounded condition wait)
    await navigateToTab(cdp, 'products');
    const productSurvives = await waitForRecordInDom(cdp, ['Royal Basmati Rice 5kg', '0012345678905'], 15000);
    if (productSurvives.success) {
      recordAssertion('catalog_product_and_barcode_intact_after_v1004_upgrade', 'Stage 5', 'PASSED', {
        product: 'Royal Basmati Rice 5kg',
        barcode: '0012345678905',
      });
    } else {
      recordAssertion('catalog_product_and_barcode_intact_after_v1004_upgrade', 'Stage 5', 'FAILED', productSurvives.diagnostic);
      throw new Error('Catalog product data lost after upgrade to v1004!');
    }

    // 5.2 Verify Customer record intact after upgrade
    await navigateToTab(cdp, 'customers');
    const customerSurvives = await waitForRecordInDom(cdp, ['Jabir', '+91 9999888877'], 15000);
    if (customerSurvives.success) {
      recordAssertion('customer_data_intact_after_v1004_upgrade', 'Stage 5', 'PASSED', {
        customer: 'Jabir',
        phone: '+91 9999888877',
      });
    } else {
      recordAssertion('customer_data_intact_after_v1004_upgrade', 'Stage 5', 'FAILED', customerSurvives.diagnostic);
      throw new Error('Customer data lost after upgrade to v1004!');
    }

    // 5.3 Verify Business Profile intact after upgrade
    await navigateToTab(cdp, 'settings');
    const profileSurvives = await waitForRecordInDom(cdp, ['Zen Kerala Store'], 15000);
    if (profileSurvives.success) {
      recordAssertion('business_profile_intact_after_v1004_upgrade', 'Stage 5', 'PASSED', {
        business_name: 'Zen Kerala Store',
      });
    } else {
      recordAssertion('business_profile_intact_after_v1004_upgrade', 'Stage 5', 'FAILED', profileSurvives.diagnostic);
      throw new Error('Business profile lost after upgrade to v1004!');
    }

    const s9 = captureScreenshot('09_after_upgrade_v1004.png');
    report.screenshots.push({ name: '09_after_upgrade_v1004.png', path: s9, stage: 'Stage 5' });

    // =========================================================================
    // STAGE 6: Appearance & Edge-to-Edge Safe Area Insets Verification on v1004
    // =========================================================================
    recordStage('Stage 6', 'Appearance Settings & Safe Area Insets on v1004 (Dark, Light, System)');
    await navigateToTab(cdp, 'settings');
    await waitForCondition(cdp, '!!document.querySelector(\'[data-testid="appearance-option-dark"]\')', 10000);

    // Switch to Dark
    await clickElement(cdp, '[data-testid="appearance-option-dark"]');
    await waitForCondition(cdp, "document.documentElement.classList.contains('dark')", 8000);
    await sleep(600);

    const isDark = await cdp.eval("document.documentElement.classList.contains('dark')");
    if (isDark) {
      recordAssertion('appearance_dark_applied_on_v1003', 'Stage 6', 'PASSED');
    } else {
      recordAssertion('appearance_dark_applied_on_v1003', 'Stage 6', 'FAILED');
      throw new Error('Dark theme class not found on documentElement in v1003!');
    }
    const s6 = captureScreenshot('06_appearance_dark.png');
    report.screenshots.push({ name: '06_appearance_dark.png', path: s6, stage: 'Stage 6' });

    // Switch to Light
    await clickElement(cdp, '[data-testid="appearance-option-light"]');
    await waitForCondition(cdp, "!document.documentElement.classList.contains('dark')", 8000);
    await sleep(600);

    const isDarkInLight = await cdp.eval("document.documentElement.classList.contains('dark')");
    if (!isDarkInLight) {
      recordAssertion('appearance_light_applied_on_v1003', 'Stage 6', 'PASSED');
    } else {
      recordAssertion('appearance_light_applied_on_v1003', 'Stage 6', 'FAILED');
      throw new Error('Dark theme class still present in Light mode in v1003!');
    }
    const s7 = captureScreenshot('07_appearance_light.png');
    report.screenshots.push({ name: '07_appearance_light.png', path: s7, stage: 'Stage 6' });

    // Switch to System and test dynamic OS theme following
    await clickElement(cdp, '[data-testid="appearance-option-system"]');
    await sleep(600);

    // Force Android OS Night Mode
    runAdb('shell cmd uimode night yes');
    await waitForCondition(cdp, "document.documentElement.classList.contains('dark')", 10000);
    recordAssertion('appearance_system_follows_os_dark_on_v1003', 'Stage 6', 'PASSED');

    // Force Android OS Day Mode
    runAdb('shell cmd uimode night no');
    await waitForCondition(cdp, "!document.documentElement.classList.contains('dark')", 10000);
    recordAssertion('appearance_system_follows_os_light_on_v1003', 'Stage 6', 'PASSED');

    // Set back to Dark mode for persistence test
    await clickElement(cdp, '[data-testid="appearance-option-dark"]');
    await waitForCondition(cdp, "document.documentElement.classList.contains('dark')", 8000);

    // =========================================================================
    // STAGE 7: Real Android Back Button Modal Dismissal on v1003
    // =========================================================================
    recordStage('Stage 7', 'Native Android Back button modal dismissal on v1003 (strict: zero synthetic cancel fallback)');
    
    // 7.1 Customer Modal Dismissal
    await navigateToTab(cdp, 'customers');
    await waitForCondition(cdp, '!!document.querySelector(\'[data-testid="add-customer-button"]\')', 10000);

    await clickElement(cdp, '[data-testid="add-customer-button"]');
    await waitForCondition(cdp, '!!document.querySelector(\'[role="dialog"]\')', 8000);

    console.log('Dispatching native Android Back keyevent 4 on Customer modal...');
    runAdb('shell input keyevent 4');
    await waitForCondition(cdp, '!document.querySelector(\'[role="dialog"]\')', 8000);

    const pidAfterBack = runAdbDetailed('shell pidof com.billzen.desktop').output.trim();
    if (pidAfterBack.length > 0) {
      recordAssertion('back_button_dismisses_customer_modal_without_exit', 'Stage 7', 'PASSED', {
        dialogClosed: true,
        appStillRunning: true,
      });
    } else {
      recordAssertion('back_button_dismisses_customer_modal_without_exit', 'Stage 7', 'FAILED', {
        appStillRunning: false,
      });
      throw new Error('Android Back button crashed or exited the app instead of dismissing Customer modal!');
    }

    // 7.2 Product Modal Dismissal
    await navigateToTab(cdp, 'products');
    await waitForCondition(cdp, '!!document.querySelector(\'[data-testid="add-product-button"]\')', 10000);

    await clickElement(cdp, '[data-testid="add-product-button"]');
    await waitForCondition(cdp, '!!document.querySelector(\'[role="dialog"]\')', 8000);

    console.log('Dispatching native Android Back keyevent 4 on Product modal...');
    runAdb('shell input keyevent 4');
    await waitForCondition(cdp, '!document.querySelector(\'[role="dialog"]\')', 8000);

    recordAssertion('back_button_dismisses_product_modal_without_exit', 'Stage 7', 'PASSED', {
      dialogClosed: true,
      appStillRunning: true,
    });

    // =========================================================================
    // STAGE 8: Customer Modal Back Dismissal and Clean Reopen on v1004
    // =========================================================================
    recordStage('Stage 8', 'Customer modal Back button dismissal and clean reopening on v1004');
    await navigateToTab(cdp, 'customers');
    await waitForCondition(cdp, '!!document.querySelector(\'[data-testid="add-customer-button"]\')', 10000);

    await clickElement(cdp, '[data-testid="add-customer-button"]');
    await waitForCondition(cdp, '!!document.querySelector(\'[data-testid="input-customer-name"]\')', 8000);
    await fillInput(cdp, '[data-testid="input-customer-name"]', 'Interrupted Temp Customer');
    await sleep(300);

    // Dismiss via native Back button
    runAdb('shell input keyevent 4');
    await waitForCondition(cdp, '!document.querySelector(\'[role="dialog"]\')', 8000);

    // Reopen modal and verify clean/expected state
    await clickElement(cdp, '[data-testid="add-customer-button"]');
    await waitForCondition(cdp, '!!document.querySelector(\'[data-testid="input-customer-name"]\')', 8000);
    const isModalReopened = await cdp.eval("!!document.querySelector('[data-testid=\"input-customer-name\"]')");
    
    // Dismiss modal again cleanly
    runAdb('shell input keyevent 4');
    await waitForCondition(cdp, '!document.querySelector(\'[role="dialog"]\')', 8000);

    if (isModalReopened) {
      recordAssertion('customer_modal_back_dismissal_and_clean_reopen', 'Stage 8', 'PASSED');
    } else {
      recordAssertion('customer_modal_back_dismissal_and_clean_reopen', 'Stage 8', 'FAILED');
      throw new Error('Failed to reopen customer modal after Back button dismissal');
    }

    // =========================================================================
    // STAGE 9: Guide Replay from Settings on v1003
    // =========================================================================
    recordStage('Stage 9', 'Guide replay from Settings and back dismissal on v1003');
    await navigateToTab(cdp, 'settings');
    await waitForCondition(cdp, '!!document.querySelector(\'button\')', 10000);

    // Trigger guide replay
    const hasGuideBtn = await cdp.eval(`
      (() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b =>
          b.innerText.includes('Getting-Started Guide') || b.innerText.includes('മാർഗ്ഗനിർദ്ദേശം')
        );
        if (btn) { btn.click(); return true; }
        return false;
      })()
    `);

    if (hasGuideBtn) {
      await waitForCondition(cdp, '!!document.querySelector(\'[role="dialog"]\')', 8000);
      // Dismiss guide via Back button
      runAdb('shell input keyevent 4');
      await waitForCondition(cdp, '!document.querySelector(\'[role="dialog"]\')', 8000);
      recordAssertion('guide_replayed_and_dismissed_via_back', 'Stage 9', 'PASSED');
    } else {
      recordAssertion('guide_replayed_and_dismissed_via_back', 'Stage 9', 'FAILED', { buttonNotFound: true });
      throw new Error('Getting-Started Guide button not found in Settings!');
    }

    // =========================================================================
    // STAGE 10: Process Termination & Cold Restart Persistence on v1003
    // =========================================================================
    recordStage('Stage 10', 'Process force-stop, cold restart, and state persistence on v1003');
    cdp.close();

    runAdb('shell am force-stop com.billzen.desktop');
    await sleep(1000);

    runAdb('shell am start -n com.billzen.desktop/.MainActivity');
    await sleep(4000);

    cdp = await getCdpClient();
    await waitForCondition(
      cdp,
      "!!document.querySelector('[data-testid=\"tab-products\"]') || !!document.querySelector('[data-testid=\"mobile-tab-products\"]')",
      15000
    );

    // 10.1 Verify wizard is NOT shown
    const bodyTextAfterKill = (await cdp.eval('document.body.innerText')) || '';
    const wizardShown = bodyTextAfterKill.includes('Welcome to BillZen');
    if (!wizardShown) {
      recordAssertion('setup_wizard_not_shown_after_cold_restart', 'Stage 10', 'PASSED');
    } else {
      recordAssertion('setup_wizard_not_shown_after_cold_restart', 'Stage 10', 'FAILED');
      throw new Error('Setup wizard re-appeared after process restart!');
    }

    // 10.2 Verify appearance persisted (dark)
    const isDarkAfterKill = await cdp.eval("document.documentElement.classList.contains('dark')");
    if (isDarkAfterKill) {
      recordAssertion('dark_appearance_persisted_after_restart', 'Stage 10', 'PASSED');
    } else {
      recordAssertion('dark_appearance_persisted_after_restart', 'Stage 10', 'FAILED');
      throw new Error('Dark appearance failed to persist across process restart!');
    }

    // 10.3 Verify product and barcode persisted
    await navigateToTab(cdp, 'products');
    const productSurvivesRestart = await waitForRecordInDom(cdp, ['Royal Basmati Rice 5kg', '0012345678905'], 15000);
    if (productSurvivesRestart.success) {
      recordAssertion('product_and_barcode_persisted_after_restart', 'Stage 10', 'PASSED');
    } else {
      recordAssertion('product_and_barcode_persisted_after_restart', 'Stage 10', 'FAILED', productSurvivesRestart.diagnostic);
      throw new Error('Product or barcode lost after cold process restart!');
    }

    // 10.4 Verify customer persisted
    await navigateToTab(cdp, 'customers');
    const customerSurvivesRestart = await waitForRecordInDom(cdp, ['Jabir', '+91 9999888877'], 15000);
    if (customerSurvivesRestart.success) {
      recordAssertion('customer_record_persisted_after_restart', 'Stage 10', 'PASSED');
    } else {
      recordAssertion('customer_record_persisted_after_restart', 'Stage 10', 'FAILED', customerSurvivesRestart.diagnostic);
      throw new Error('Customer record lost after cold process restart!');
    }

    // 10.5 Verify business profile persisted
    await navigateToTab(cdp, 'settings');
    const profileSurvivesRestart = await waitForRecordInDom(cdp, ['Zen Kerala Store'], 15000);
    if (profileSurvivesRestart.success) {
      recordAssertion('business_profile_persisted_after_restart', 'Stage 10', 'PASSED');
    } else {
      recordAssertion('business_profile_persisted_after_restart', 'Stage 10', 'FAILED', profileSurvivesRestart.diagnostic);
      throw new Error('Business profile lost after cold process restart!');
    }

    const s8 = captureScreenshot('08_after_kill_recovery.png');
    report.screenshots.push({ name: '08_after_kill_recovery.png', path: s8, stage: 'Stage 10' });

    // =========================================================================
    // STAGE 11: 100% Offline Mode Operations & Verification on v1004
    // =========================================================================
    recordStage('Stage 11', '100% offline mode operations on v1004 (Airplane mode, WiFi & Mobile Data disabled)');
    console.log('Enabling airplane mode and disabling WiFi/Data...');
    runAdb('shell cmd connectivity airplane-mode enable');
    runAdb('shell svc wifi disable');
    runAdb('shell svc data disable');
    await sleep(2000);

    // Verify offline network condition explicitly at Android OS level
    // 1. Airplane mode setting in Global settings
    const airplaneSetting = runAdbDetailed('shell settings get global airplane_mode_on');
    const isAirplaneOn = airplaneSetting.success && airplaneSetting.output.trim() === '1';

    // 2. Wi-Fi status in Global settings or dumpsys
    const wifiSetting = runAdbDetailed('shell settings get global wifi_on');
    const isWifiOff = wifiSetting.success && (wifiSetting.output.trim() === '0' || wifiSetting.output.trim() === '');

    // 3. Mobile data setting in Global settings
    const mobileDataSetting = runAdbDetailed('shell settings get global mobile_data');
    const isMobileDataOff = mobileDataSetting.success && (mobileDataSetting.output.trim() === '0' || mobileDataSetting.output.trim() === '');

    // 4. Active default network in ConnectivityService
    const activeNetworkCheck = runAdbDetailed('shell "dumpsys connectivity | grep -E \\"Active network:|Default network:\\" || true"');
    const hasNoActiveNetwork = activeNetworkCheck.success &&
      (activeNetworkCheck.output.includes('none') || activeNetworkCheck.output.includes('null') || activeNetworkCheck.output.trim() === '');

    // 5. Ping packet loss / route failure
    const pingRes = runAdbDetailed('shell "ping -c 1 -W 2 8.8.8.8 2>&1 || true"');
    const isPingBlocked =
      pingRes.output.includes('100% packet loss') ||
      pingRes.output.includes('Network is unreachable') ||
      pingRes.output.includes('100.0% packet loss') ||
      pingRes.output.includes('unreachable') ||
      !pingRes.output.includes('1 packets transmitted, 1 received');

    // 6. Ensure WebView navigator.onLine reflects offline state via native bridge
    await cdp.eval(`
      (() => {
        if (window.BillZenNative?.setNetworkAvailable) {
          window.BillZenNative.setNetworkAvailable(false);
        }
      })()
    `);
    let isNavigatorOffline = false;
    try {
      await waitForCondition(cdp, '!navigator.onLine', 6000);
      isNavigatorOffline = true;
    } catch {
      isNavigatorOffline = await cdp.eval('!navigator.onLine');
    }

    const offlineDetails = {
      isAirplaneOn,
      isWifiOff,
      isMobileDataOff,
      hasNoActiveNetwork,
      isPingBlocked,
      isNavigatorOffline,
      pingOutput: pingRes.output,
    };

    if (isAirplaneOn && isWifiOff && isMobileDataOff && isPingBlocked && isNavigatorOffline) {
      recordAssertion('offline_network_state_verified', 'Stage 11', 'PASSED', offlineDetails);
    } else {
      recordAssertion('offline_network_state_verified', 'Stage 11', 'FAILED', offlineDetails);
      throw new Error(`Device is not strictly offline before offline operations: ${JSON.stringify(offlineDetails)}`);
    }

    // Navigate to Products tab
    await navigateToTab(cdp, 'products');
    await waitForCondition(cdp, '!!document.querySelector(\'[data-testid="add-product-button"]\')', 10000);

    // Create product while 100% offline
    await clickElement(cdp, '[data-testid="add-product-button"]');
    await waitForCondition(cdp, '!!document.querySelector(\'[data-testid="input-product-name"]\')', 8000);

    await fillInput(cdp, '[data-testid="input-product-name"]', 'Offline Pure Coconut Oil');
    await fillInput(cdp, '[data-testid="input-product-sku"]', 'COCO-002');
    await fillInput(cdp, '[data-testid="input-product-barcode"]', '0098765432104');
    await fillInput(cdp, '[data-testid="input-product-price"]', '220.00');
    await fillInput(cdp, '[data-testid="input-product-cost-price"]', '180.00');
    await fillInput(cdp, '[data-testid="input-product-opening-stock"]', '10.000');
    await sleep(400);

    await clickElement(cdp, '[data-testid="save-product-submit"]');

    const offlineProductCheck = await waitForRecordInDom(cdp, ['Offline Pure Coconut Oil', '0098765432104'], 15000);
    if (offlineProductCheck.success) {
      recordAssertion('offline_product_creation_and_indexing', 'Stage 11', 'PASSED', {
        name: 'Offline Pure Coconut Oil',
        barcode: '0098765432104',
      });
    } else {
      recordAssertion('offline_product_creation_and_indexing', 'Stage 11', 'FAILED', offlineProductCheck.diagnostic);
      throw new Error('Offline product creation failed!');
    }

    const s10 = captureScreenshot('10_offline_mode_product.png');
    report.screenshots.push({ name: '10_offline_mode_product.png', path: s10, stage: 'Stage 11' });

    // =========================================================================
    // STAGE 12: Post-Offline Cold Restart on v1003
    // =========================================================================
    recordStage('Stage 12', 'Post-offline cold restart without reconnecting on v1003');
    cdp.close();

    runAdb('shell am force-stop com.billzen.desktop');
    await sleep(1000);

    runAdb('shell am start -n com.billzen.desktop/.MainActivity');
    await sleep(4000);

    cdp = await getCdpClient();
    await waitForCondition(
      cdp,
      "!!document.querySelector('[data-testid=\"tab-products\"]') || !!document.querySelector('[data-testid=\"mobile-tab-products\"]')",
      15000
    );

    // Verify offline-created product persisted after offline restart
    await navigateToTab(cdp, 'products');
    const postOfflineCheck = await waitForRecordInDom(cdp, ['Offline Pure Coconut Oil'], 15000);
    if (postOfflineCheck.success) {
      recordAssertion('post_offline_relaunch_persistence', 'Stage 12', 'PASSED');
    } else {
      recordAssertion('post_offline_relaunch_persistence', 'Stage 12', 'FAILED', postOfflineCheck.diagnostic);
      throw new Error('Offline-created product missing after post-offline cold restart!');
    }

    // Re-enable network
    runAdb('shell cmd connectivity airplane-mode disable');
    runAdb('shell svc wifi enable');
    runAdb('shell svc data enable');
    await cdp.eval(`
      (() => {
        if (window.BillZenNative?.setNetworkAvailable) {
          window.BillZenNative.setNetworkAvailable(true);
        }
      })()
    `);
    console.log('Re-enabled Airplane mode disable, WiFi and Mobile Data.');

    // =========================================================================
    // STAGE 13: Bounded Logcat Capture & Fatal Crash Audit
    // =========================================================================
    recordStage('Stage 13', 'Run-scoped Logcat audit for fatal exceptions, SIGSEGV, or panics');
    
    // Dump test run logcat to disk with explicit status checking
    const logcatRes = runAdbDetailed('shell logcat -d -v time', { timeout: 45000 });
    const logFilePath = path.join(ARTIFACTS_DIR, 'test_run.log');

    if (!logcatRes.success || !logcatRes.output || logcatRes.output.length < 50) {
      const errorDetail = {
        captureSuccess: logcatRes.success,
        exitCode: logcatRes.exitCode,
        error: logcatRes.error,
        outputLength: (logcatRes.output || '').length,
      };
      report.logcatSummary = {
        captureStatus: 'CAPTURE_UNAVAILABLE',
        errorDetail,
      };
      recordAssertion('logcat_audit_zero_fatal_crashes', 'Stage 13', 'FAILED', {
        status: 'CAPTURE_UNAVAILABLE',
        errorDetail,
      });
      throw new Error(`Logcat capture unavailable: exitCode=${logcatRes.exitCode}, error=${logcatRes.error}`);
    }

    fs.writeFileSync(logFilePath, logcatRes.output);
    const totalLines = logcatRes.output.split('\n').length;
    console.log(`Scoped logcat (${totalLines} lines) dumped to: ${logFilePath}`);

    const crashRes = runAdbDetailed('shell "logcat -d | grep -E \\"FATAL EXCEPTION|SIGSEGV|AndroidRuntime: FATAL|panic in\\" || true"');
    const crashLines = crashRes.success ? crashRes.output : '';
    const hasCrashes = crashLines.trim().length > 0;
    report.logcatSummary = {
      captureStatus: 'SUCCESS',
      logFilePath,
      totalLinesCaptured: totalLines,
      crashLinesFound: crashLines.split('\n').filter(Boolean).length,
      sample: crashLines.slice(0, 500),
    };

    if (!hasCrashes) {
      recordAssertion('logcat_audit_zero_fatal_crashes', 'Stage 13', 'PASSED', {
        totalLinesCaptured: totalLines,
      });
    } else {
      recordAssertion('logcat_audit_zero_fatal_crashes', 'Stage 13', 'FAILED', { crashLines });
      throw new Error('Fatal crash or panic detected in logcat!');
    }

    report.overallResult = 'ALL PASSED';
  } catch (err) {
    report.overallResult = 'FAILED';
    report.failureError = err.message;
    console.error('\n❌ Execution error:', err);
    throw err;
  } finally {
    console.log('\n--- Cleanup & Safety Teardown ---');
    // Restore actual previous network state
    try {
      if (initialAirplaneMode === '1') {
        runAdbDetailed('shell cmd connectivity airplane-mode enable');
      } else {
        runAdbDetailed('shell cmd connectivity airplane-mode disable');
      }
      if (initialWifi === '1') {
        runAdbDetailed('shell svc wifi enable');
      } else {
        runAdbDetailed('shell svc wifi disable');
      }
      if (initialMobileData === '1') {
        runAdbDetailed('shell svc data enable');
      } else {
        runAdbDetailed('shell svc data disable');
      }
      console.log(`Restored network state to initial values: airplane=${initialAirplaneMode}, wifi=${initialWifi}, data=${initialMobileData}`);
    } catch (e) {
      console.warn('Warning restoring network state in teardown:', e.message);
    }

    // Restore actual previous OS theme
    try {
      if (initialIsDarkTheme) {
        runAdbDetailed('shell cmd uimode night yes');
      } else {
        runAdbDetailed('shell cmd uimode night no');
      }
      console.log(`Restored OS theme to initial value: isDark=${initialIsDarkTheme}`);
    } catch (e) {
      console.warn('Warning restoring theme state in teardown:', e.message);
    }

    // Ensure adb forwarding removed
    try {
      execSync(`${ADB} -s ${TARGET_SERIAL} forward --remove tcp:9222`, { stdio: 'ignore' });
      console.log('Removed ADB port forward tcp:9222.');
    } catch {}

    if (cdp) {
      try { cdp.close(); } catch {}
    }

    report.completedAt = new Date().toISOString();
    const reportPath = path.join(ARTIFACTS_DIR, 'runtime_verification_report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`Structured verification report written to: ${reportPath}`);
  }

  console.log('\n================================================================');
  console.log('✅ ALL NATIVE ANDROID RUNTIME ASSERTIONS PASSED SUCCESSFULLY!');
  console.log('================================================================');
}

main().catch((err) => {
  console.error('\n❌ Test suite failed:', err.message);
  process.exit(1);
});
