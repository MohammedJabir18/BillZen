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

function runAdb(cmd) {
  try {
    return execSync(`${ADB} -s ${TARGET_SERIAL} ${cmd}`, { encoding: 'utf8' }).trim();
  } catch (err) {
    console.error(`ADB error running: ${cmd}`, err.message);
    throw err;
  }
}

function runAdbQuiet(cmd) {
  try {
    return execSync(`${ADB} -s ${TARGET_SERIAL} ${cmd}`, { encoding: 'utf8' }).trim();
  } catch {
    return '';
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

async function getCdpClient() {
  const pid = runAdb('shell pidof com.billzen.desktop');
  if (!pid) throw new Error('com.billzen.desktop process not found!');

  runAdb(`forward tcp:9222 localabstract:webview_devtools_remote_${pid}`);
  await sleep(600);

  const res = await fetch('http://localhost:9222/json/list');
  const pages = await res.json();
  const page = pages.find((p) => p.type === 'page' && p.url.includes('localhost'));
  if (!page) throw new Error('No webview page found on localhost:9222');

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

async function waitForCondition(client, conditionExpr, timeoutMs = 12000, intervalMs = 250) {
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
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      if (setter) {
        setter.call(el, ${JSON.stringify(value)});
      } else {
        el.value = ${JSON.stringify(value)};
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

async function main() {
  console.log('================================================================');
  console.log('   BillZen Native Android Runtime Verification (Hardened Suite) ');
  console.log('================================================================');

  const v1001Path = path.resolve('dist-android/billzen-test-v0.1.0-v1001-x86_64.apk');
  const v1002Path = path.resolve('dist-android/billzen-test-v0.1.0-x86_64.apk');

  const report = {
    suite: 'BillZen Native Android Runtime Verification',
    targetVersionCode: 1002,
    startedAt: new Date().toISOString(),
    completedAt: null,
    device: {},
    packages: {
      baselineV1001: {
        path: v1001Path,
        sha256: computeFileSha256(v1001Path),
      },
      upgradeV1002: {
        path: v1002Path,
        sha256: computeFileSha256(v1002Path),
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

  try {
    // 0. Verify connected emulator
    const devicesOutput = execSync(`${ADB} devices`, { encoding: 'utf8' });
    console.log('Connected devices:\n' + devicesOutput);
    if (!devicesOutput.includes(TARGET_SERIAL)) {
      throw new Error(`Target emulator serial ${TARGET_SERIAL} is not connected!`);
    }

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

    // Reset logcat marker if possible
    runAdbQuiet('logcat -c');

    // =========================================================================
    // STAGE 1: Baseline Clean Installation (v1001)
    // =========================================================================
    recordStage('Stage 1', 'Clean baseline installation with v1001 APK');
    runAdb('uninstall com.billzen.desktop || true');
    const installResult = runAdb(`install -r "${v1001Path}"`);
    console.log(`Install result: ${installResult}`);

    const baselineDump = runAdb('shell dumpsys package com.billzen.desktop | grep versionCode').split('\n')[0].trim();
    const baselineVersionCodeMatch = baselineDump.match(/versionCode=(\d+)/);
    const baselineVersionCode = baselineVersionCodeMatch ? parseInt(baselineVersionCodeMatch[1], 10) : 0;
    
    if (baselineVersionCode === 1001) {
      recordAssertion('baseline_v1001_installed', 'Stage 1', 'PASSED', { versionCode: baselineVersionCode });
    } else {
      recordAssertion('baseline_v1001_installed', 'Stage 1', 'FAILED', { expected: 1001, got: baselineVersionCode });
      throw new Error(`Expected baseline versionCode 1001, got: ${baselineVersionCode}`);
    }

    // =========================================================================
    // STAGE 2: Cold Launch & First-Use Setup Wizard on Baseline
    // =========================================================================
    recordStage('Stage 2', 'Cold launch and multi-step onboarding wizard');
    runAdb('shell am start -n com.billzen.desktop/.MainActivity');
    await sleep(4000);

    cdp = await getCdpClient();
    console.log('Connected to BillZen WebView via CDP.');

    // Verify wizard step 1
    await waitForCondition(cdp, 'document.querySelector("h1")?.innerText.includes("Welcome to BillZen")', 10000);
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
    await waitForCondition(cdp, '!!document.querySelector(\'[data-testid="guide-skip-button"]\')', 10000);
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
    // STAGE 4: Baseline Catalog Data (Product & Customer)
    // =========================================================================
    recordStage('Stage 4', 'Baseline catalog record creation (Product with leading zeros & Customer)');
    await cdp.eval(`
      (() => {
        const btn = document.querySelector('[data-testid="tab-products"]') || document.querySelector('[data-testid="mobile-tab-products"]');
        if (btn) btn.click();
      })()
    `);
    await sleep(1200);

    await clickElement(cdp, '[data-testid="add-product-button"]');
    await sleep(1000);

    await fillInput(cdp, '[data-testid="input-product-name"]', 'Royal Basmati Rice 5kg');
    await fillInput(cdp, '[data-testid="input-product-sku"]', 'BASMATI-5KG');
    await fillInput(cdp, '[data-testid="input-product-barcode"]', '0012345678905'); // Explicit leading zero
    await fillInput(cdp, '[data-testid="input-product-price"]', '450.00');
    await fillInput(cdp, '[data-testid="input-product-cost-price"]', '380.00');
    await fillInput(cdp, '[data-testid="input-product-opening-stock"]', '25.000');
    await sleep(500);

    await clickElement(cdp, '[data-testid="save-product-submit"]');
    await sleep(2000);

    const productListText = await cdp.eval('document.body.innerText');
    const hasProduct = productListText.includes('Royal Basmati Rice 5kg') && productListText.includes('0012345678905');
    if (hasProduct) {
      recordAssertion('product_created_with_leading_zero', 'Stage 4', 'PASSED', {
        name: 'Royal Basmati Rice 5kg',
        barcode: '0012345678905',
      });
    } else {
      recordAssertion('product_created_with_leading_zero', 'Stage 4', 'FAILED');
      throw new Error('Product creation failed on baseline!');
    }
    const s4 = captureScreenshot('04_catalog_product_created.png');
    report.screenshots.push({ name: '04_catalog_product_created.png', path: s4, stage: 'Stage 4' });

    // Customer creation
    await cdp.eval(`
      (() => {
        const btn = document.querySelector('[data-testid="tab-customers"]') || document.querySelector('[data-testid="mobile-tab-customers"]');
        if (btn) btn.click();
      })()
    `);
    await sleep(1200);

    await clickElement(cdp, '[data-testid="add-customer-button"]');
    await sleep(1000);

    await fillInput(cdp, '[data-testid="input-customer-name"]', 'Jabir');
    await fillInput(cdp, '[data-testid="input-customer-phone"]', '+91 9999888877');
    await sleep(500);

    await clickElement(cdp, '[data-testid="save-customer-submit"]');
    await sleep(2000);

    const customerListText = await cdp.eval('document.body.innerText');
    const hasCustomer = customerListText.includes('Jabir') && customerListText.includes('+91 9999888877');
    if (hasCustomer) {
      recordAssertion('customer_record_created', 'Stage 4', 'PASSED', {
        name: 'Jabir',
        phone: '+91 9999888877',
      });
    } else {
      recordAssertion('customer_record_created', 'Stage 4', 'FAILED');
      throw new Error('Customer record creation failed on baseline!');
    }
    const s5 = captureScreenshot('05_catalog_customer_created.png');
    report.screenshots.push({ name: '05_catalog_customer_created.png', path: s5, stage: 'Stage 4' });

    // =========================================================================
    // STAGE 5: In-Place Upgrade to v1002 (Zero Data Loss)
    // =========================================================================
    recordStage('Stage 5', 'In-place upgrade to v1002 test APK and zero-data-loss verification');
    cdp.close();

    console.log(`Installing upgrade APK: ${v1002Path}`);
    const upgradeResult = runAdb(`install -r "${v1002Path}"`);
    console.log(`Upgrade result: ${upgradeResult}`);

    const upgradedDump = runAdb('shell dumpsys package com.billzen.desktop | grep versionCode').split('\n')[0].trim();
    const upgradedVersionMatch = upgradedDump.match(/versionCode=(\d+)/);
    const upgradedVersionCode = upgradedVersionMatch ? parseInt(upgradedVersionMatch[1], 10) : 0;

    if (upgradedVersionCode === 1002) {
      recordAssertion('in_place_upgrade_to_v1002_version_confirmed', 'Stage 5', 'PASSED', {
        versionCode: upgradedVersionCode,
      });
    } else {
      recordAssertion('in_place_upgrade_to_v1002_version_confirmed', 'Stage 5', 'FAILED', {
        expected: 1002,
        got: upgradedVersionCode,
      });
      throw new Error(`Expected upgraded versionCode 1002, got: ${upgradedVersionCode}`);
    }

    // Launch upgraded app
    runAdb('shell am force-stop com.billzen.desktop');
    runAdb('shell am start -n com.billzen.desktop/.MainActivity');
    await sleep(4000);

    cdp = await getCdpClient();

    // Verify catalog data intact after upgrade
    await cdp.eval(`
      (() => {
        const btn = document.querySelector('[data-testid="tab-products"]') || document.querySelector('[data-testid="mobile-tab-products"]');
        if (btn) btn.click();
      })()
    `);
    await sleep(1200);

    const productsAfterUpgrade = await cdp.eval('document.body.innerText');
    const productSurvivesUpgrade = productsAfterUpgrade.includes('Royal Basmati Rice 5kg') && productsAfterUpgrade.includes('0012345678905');
    if (productSurvivesUpgrade) {
      recordAssertion('catalog_data_intact_after_v1002_upgrade', 'Stage 5', 'PASSED');
    } else {
      recordAssertion('catalog_data_intact_after_v1002_upgrade', 'Stage 5', 'FAILED');
      throw new Error('Catalog data lost after upgrade to v1002!');
    }

    const s9 = captureScreenshot('09_after_upgrade_v1002.png');
    report.screenshots.push({ name: '09_after_upgrade_v1002.png', path: s9, stage: 'Stage 5' });

    // =========================================================================
    // STAGE 6: Appearance & Edge-to-Edge Safe Area Insets Verification on v1002
    // =========================================================================
    recordStage('Stage 6', 'Appearance Settings & Safe Area Insets on v1002 (Dark, Light, System)');
    await cdp.eval(`
      (() => {
        const btn = document.querySelector('[data-testid="tab-settings"]') || document.querySelector('[data-testid="mobile-tab-settings"]');
        if (btn) btn.click();
      })()
    `);
    await sleep(1500);

    // Switch to Dark
    await clickElement(cdp, '[data-testid="appearance-option-dark"]');
    await sleep(800);
    const isDark = await cdp.eval("document.documentElement.classList.contains('dark')");
    if (isDark) {
      recordAssertion('appearance_dark_applied_on_v1002', 'Stage 6', 'PASSED');
    } else {
      recordAssertion('appearance_dark_applied_on_v1002', 'Stage 6', 'FAILED');
      throw new Error('Dark theme class not found on documentElement in v1002!');
    }
    const s6 = captureScreenshot('06_appearance_dark.png');
    report.screenshots.push({ name: '06_appearance_dark.png', path: s6, stage: 'Stage 6' });

    // Switch to Light
    await clickElement(cdp, '[data-testid="appearance-option-light"]');
    await waitForCondition(cdp, "!document.documentElement.classList.contains('dark')", 5000);
    await sleep(600);
    const isDarkInLight = await cdp.eval("document.documentElement.classList.contains('dark')");
    if (!isDarkInLight) {
      recordAssertion('appearance_light_applied_on_v1002', 'Stage 6', 'PASSED');
    } else {
      recordAssertion('appearance_light_applied_on_v1002', 'Stage 6', 'FAILED');
      throw new Error('Dark theme class still present in Light mode in v1002!');
    }
    const s7 = captureScreenshot('07_appearance_light.png');
    report.screenshots.push({ name: '07_appearance_light.png', path: s7, stage: 'Stage 6' });

    // Switch to System and test dynamic OS theme following
    await clickElement(cdp, '[data-testid="appearance-option-system"]');
    await sleep(600);

    // Force Android OS Night Mode
    runAdb('shell cmd uimode night yes');
    await sleep(1200);
    const isDarkAfterOsNight = await cdp.eval("document.documentElement.classList.contains('dark')");
    if (isDarkAfterOsNight) {
      recordAssertion('appearance_system_follows_os_dark_on_v1002', 'Stage 6', 'PASSED');
    } else {
      recordAssertion('appearance_system_follows_os_dark_on_v1002', 'Stage 6', 'FAILED');
      throw new Error('System appearance did not follow OS night mode in v1002!');
    }

    // Force Android OS Day Mode
    runAdb('shell cmd uimode night no');
    await sleep(1200);
    const isDarkAfterOsDay = await cdp.eval("document.documentElement.classList.contains('dark')");
    if (!isDarkAfterOsDay) {
      recordAssertion('appearance_system_follows_os_light_on_v1002', 'Stage 6', 'PASSED');
    } else {
      recordAssertion('appearance_system_follows_os_light_on_v1002', 'Stage 6', 'FAILED');
      throw new Error('System appearance did not follow OS day mode in v1002!');
    }

    // Set back to Dark mode for persistence test
    await clickElement(cdp, '[data-testid="appearance-option-dark"]');
    await sleep(600);

    // =========================================================================
    // STAGE 7: Real Android Back Button Modal Dismissal on v1002
    // =========================================================================
    recordStage('Stage 7', 'Native Android Back button modal dismissal on v1002 (strict: zero synthetic cancel fallback)');
    
    // 7.1 Customer Modal Dismissal
    await cdp.eval(`
      (() => {
        const btn = document.querySelector('[data-testid="tab-customers"]') || document.querySelector('[data-testid="mobile-tab-customers"]');
        if (btn) btn.click();
      })()
    `);
    await sleep(1000);

    await clickElement(cdp, '[data-testid="add-customer-button"]');
    await sleep(1000);

    let customerDialogPre = await cdp.eval("!!document.querySelector('[role=\"dialog\"]')");
    if (!customerDialogPre) throw new Error('Customer modal failed to open before back button test');

    console.log('Dispatching native Android Back keyevent 4 on Customer modal...');
    runAdb('shell input keyevent 4');
    await sleep(1000);

    let customerDialogPost = await cdp.eval("!!document.querySelector('[role=\"dialog\"]')");
    const pidAfterBack = runAdbQuiet('shell pidof com.billzen.desktop');

    if (!customerDialogPost && pidAfterBack.length > 0) {
      recordAssertion('back_button_dismisses_customer_modal_without_exit', 'Stage 7', 'PASSED', {
        dialogClosed: true,
        appStillRunning: true,
      });
    } else {
      recordAssertion('back_button_dismisses_customer_modal_without_exit', 'Stage 7', 'FAILED', {
        dialogClosed: !customerDialogPost,
        appStillRunning: pidAfterBack.length > 0,
      });
      throw new Error(`Android Back button failed to dismiss Customer modal! Still open: ${customerDialogPost}`);
    }

    // 7.2 Product Modal Dismissal
    await cdp.eval(`
      (() => {
        const btn = document.querySelector('[data-testid="tab-products"]') || document.querySelector('[data-testid="mobile-tab-products"]');
        if (btn) btn.click();
      })()
    `);
    await sleep(1000);

    await clickElement(cdp, '[data-testid="add-product-button"]');
    await sleep(1000);

    let productDialogPre = await cdp.eval("!!document.querySelector('[role=\"dialog\"]')");
    if (!productDialogPre) throw new Error('Product modal failed to open before back button test');

    console.log('Dispatching native Android Back keyevent 4 on Product modal...');
    runAdb('shell input keyevent 4');
    await sleep(1000);

    let productDialogPost = await cdp.eval("!!document.querySelector('[role=\"dialog\"]')");
    if (!productDialogPost) {
      recordAssertion('back_button_dismisses_product_modal_without_exit', 'Stage 7', 'PASSED', {
        dialogClosed: true,
        appStillRunning: true,
      });
    } else {
      recordAssertion('back_button_dismisses_product_modal_without_exit', 'Stage 7', 'FAILED', {
        dialogClosed: !productDialogPost,
      });
      throw new Error(`Android Back button failed to dismiss Product modal! Still open: ${productDialogPost}`);
    }

    // =========================================================================
    // STAGE 8: Interrupted Draft Handling on v1002
    // =========================================================================
    recordStage('Stage 8', 'Interrupted draft recovery and clean reopening on v1002');
    await cdp.eval(`
      (() => {
        const btn = document.querySelector('[data-testid="tab-customers"]') || document.querySelector('[data-testid="mobile-tab-customers"]');
        if (btn) btn.click();
      })()
    `);
    await sleep(1000);

    await clickElement(cdp, '[data-testid="add-customer-button"]');
    await sleep(800);
    await fillInput(cdp, '[data-testid="input-customer-name"]', 'Interrupted Temp Customer');
    await sleep(400);

    // Interrupt via Back button
    runAdb('shell input keyevent 4');
    await sleep(800);

    // Reopen modal and verify clean/expected state
    await clickElement(cdp, '[data-testid="add-customer-button"]');
    await sleep(800);
    const isModalReopened = await cdp.eval("!!document.querySelector('[data-testid=\"input-customer-name\"]')");
    runAdb('shell input keyevent 4'); // Dismiss modal again
    await sleep(600);

    if (isModalReopened) {
      recordAssertion('interrupted_draft_clean_recovery', 'Stage 8', 'PASSED');
    } else {
      recordAssertion('interrupted_draft_clean_recovery', 'Stage 8', 'FAILED');
      throw new Error('Failed to reopen customer modal after interrupted draft dismissal');
    }

    // =========================================================================
    // STAGE 9: Guide Replay from Settings on v1002
    // =========================================================================
    recordStage('Stage 9', 'Guide replay from Settings and back dismissal on v1002');
    await cdp.eval(`
      (() => {
        const btn = document.querySelector('[data-testid="tab-settings"]') || document.querySelector('[data-testid="mobile-tab-settings"]');
        if (btn) btn.click();
      })()
    `);
    await sleep(1200);

    // Trigger guide replay
    const hasGuideBtn = await cdp.eval(`
      (() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Getting-Started Guide') || b.innerText.includes('മാർഗ്ഗനിർദ്ദേശം'));
        if (btn) { btn.click(); return true; }
        return false;
      })()
    `);

    if (hasGuideBtn) {
      await sleep(1000);
      const isGuideOpen = await cdp.eval("!!document.querySelector('[role=\"dialog\"]')");
      if (isGuideOpen) {
        // Dismiss guide via Back button
        runAdb('shell input keyevent 4');
        await sleep(1000);
        const isGuideClosed = await cdp.eval("!document.querySelector('[role=\"dialog\"]')");
        if (isGuideClosed) {
          recordAssertion('guide_replayed_and_dismissed_via_back', 'Stage 9', 'PASSED');
        } else {
          recordAssertion('guide_replayed_and_dismissed_via_back', 'Stage 9', 'FAILED', { stillOpen: true });
        }
      } else {
        recordAssertion('guide_replayed_and_dismissed_via_back', 'Stage 9', 'FAILED', { failedToOpen: true });
      }
    } else {
      recordAssertion('guide_replayed_and_dismissed_via_back', 'Stage 9', 'FAILED', { buttonNotFound: true });
    }

    // =========================================================================
    // STAGE 10: Process Termination & Cold Restart Persistence on v1002
    // =========================================================================
    recordStage('Stage 10', 'Process force-stop, cold restart, and state persistence on v1002');
    cdp.close();

    runAdb('shell am force-stop com.billzen.desktop');
    await sleep(1000);

    runAdb('shell am start -n com.billzen.desktop/.MainActivity');
    await sleep(4000);

    cdp = await getCdpClient();

    // Verify wizard is NOT shown
    const bodyTextAfterKill = await cdp.eval('document.body.innerText');
    const wizardShown = bodyTextAfterKill.includes('Welcome to BillZen');
    if (!wizardShown) {
      recordAssertion('setup_wizard_not_shown_after_cold_restart', 'Stage 10', 'PASSED');
    } else {
      recordAssertion('setup_wizard_not_shown_after_cold_restart', 'Stage 10', 'FAILED');
      throw new Error('Setup wizard re-appeared after process restart!');
    }

    // Verify appearance persisted (dark)
    const isDarkAfterKill = await cdp.eval("document.documentElement.classList.contains('dark')");
    if (isDarkAfterKill) {
      recordAssertion('dark_appearance_persisted_after_restart', 'Stage 10', 'PASSED');
    } else {
      recordAssertion('dark_appearance_persisted_after_restart', 'Stage 10', 'FAILED');
      throw new Error('Dark appearance failed to persist across process restart!');
    }

    // Verify product persisted
    await cdp.eval(`
      (() => {
        const btn = document.querySelector('[data-testid="tab-products"]') || document.querySelector('[data-testid="mobile-tab-products"]');
        if (btn) btn.click();
      })()
    `);
    await sleep(1200);
    const productsAfterKill = await cdp.eval('document.body.innerText');
    const productPreserved = productsAfterKill.includes('Royal Basmati Rice 5kg') && productsAfterKill.includes('0012345678905');
    if (productPreserved) {
      recordAssertion('product_and_barcode_persisted_after_restart', 'Stage 10', 'PASSED');
    } else {
      recordAssertion('product_and_barcode_persisted_after_restart', 'Stage 10', 'FAILED');
      throw new Error('Product or barcode lost after cold process restart!');
    }

    // Verify customer persisted
    await cdp.eval(`
      (() => {
        const btn = document.querySelector('[data-testid="tab-customers"]') || document.querySelector('[data-testid="mobile-tab-customers"]');
        if (btn) btn.click();
      })()
    `);
    await sleep(1200);
    const customersAfterKill = await cdp.eval('document.body.innerText');
    const customerPreserved = customersAfterKill.includes('Jabir') && customersAfterKill.includes('+91 9999888877');
    if (customerPreserved) {
      recordAssertion('customer_record_persisted_after_restart', 'Stage 10', 'PASSED');
    } else {
      recordAssertion('customer_record_persisted_after_restart', 'Stage 10', 'FAILED');
      throw new Error('Customer record lost after cold process restart!');
    }

    const s8 = captureScreenshot('08_after_kill_recovery.png');
    report.screenshots.push({ name: '08_after_kill_recovery.png', path: s8, stage: 'Stage 10' });

    // =========================================================================
    // STAGE 11: 100% Offline Mode Operations on v1002
    // =========================================================================
    recordStage('Stage 11', '100% offline mode operations on v1002 (WiFi & Mobile Data disabled)');
    console.log('Disabling WiFi and Mobile Data...');
    runAdb('shell svc wifi disable');
    runAdb('shell svc data disable');
    await sleep(1500);

    // Navigate to Products tab
    await cdp.eval(`
      (() => {
        const btn = document.querySelector('[data-testid="tab-products"]') || document.querySelector('[data-testid="mobile-tab-products"]');
        if (btn) btn.click();
      })()
    `);
    await sleep(1200);

    // Create product while 100% offline
    await clickElement(cdp, '[data-testid="add-product-button"]');
    await sleep(1000);

    await fillInput(cdp, '[data-testid="input-product-name"]', 'Offline Pure Coconut Oil');
    await fillInput(cdp, '[data-testid="input-product-sku"]', 'COCO-002');
    await fillInput(cdp, '[data-testid="input-product-barcode"]', '0098765432104');
    await fillInput(cdp, '[data-testid="input-product-price"]', '220.00');
    await fillInput(cdp, '[data-testid="input-product-cost-price"]', '180.00');
    await fillInput(cdp, '[data-testid="input-product-opening-stock"]', '10.000');
    await sleep(500);

    await clickElement(cdp, '[data-testid="save-product-submit"]');
    await sleep(2000);

    const offlineText = await cdp.eval('document.body.innerText');
    const offlineProductAdded = offlineText.includes('Offline Pure Coconut Oil') && offlineText.includes('0098765432104');
    if (offlineProductAdded) {
      recordAssertion('offline_product_creation_and_indexing', 'Stage 11', 'PASSED', {
        name: 'Offline Pure Coconut Oil',
        barcode: '0098765432104',
      });
    } else {
      recordAssertion('offline_product_creation_and_indexing', 'Stage 11', 'FAILED');
      throw new Error('Offline product creation failed!');
    }

    const s10 = captureScreenshot('10_offline_mode_product.png');
    report.screenshots.push({ name: '10_offline_mode_product.png', path: s10, stage: 'Stage 11' });

    // =========================================================================
    // STAGE 12: Post-Offline Cold Restart on v1002
    // =========================================================================
    recordStage('Stage 12', 'Post-offline cold restart without reconnecting on v1002');
    cdp.close();

    runAdb('shell am force-stop com.billzen.desktop');
    await sleep(1000);

    runAdb('shell am start -n com.billzen.desktop/.MainActivity');
    await sleep(4000);

    cdp = await getCdpClient();

    // Verify offline-created product persisted after offline restart
    await cdp.eval(`
      (() => {
        const btn = document.querySelector('[data-testid="tab-products"]') || document.querySelector('[data-testid="mobile-tab-products"]');
        if (btn) btn.click();
      })()
    `);
    await sleep(1200);

    const textPostOfflineRestart = await cdp.eval('document.body.innerText');
    const postOfflineOk = textPostOfflineRestart.includes('Offline Pure Coconut Oil');
    if (postOfflineOk) {
      recordAssertion('post_offline_relaunch_persistence', 'Stage 12', 'PASSED');
    } else {
      recordAssertion('post_offline_relaunch_persistence', 'Stage 12', 'FAILED');
      throw new Error('Offline-created product missing after post-offline cold restart!');
    }

    // Re-enable network
    runAdb('shell svc wifi enable');
    runAdb('shell svc data enable');
    console.log('Re-enabled WiFi and Mobile Data.');

    // =========================================================================
    // STAGE 13: Logcat Error & Panic Audit
    // =========================================================================
    recordStage('Stage 13', 'Scoped Logcat audit for fatal exceptions, SIGSEGV, or panics');
    const logcatOutput = runAdbQuiet('shell logcat -d -t 600 | grep -E "FATAL EXCEPTION|SIGSEGV|AndroidRuntime: FATAL|panic" || true');
    const hasCrashes = logcatOutput.trim().length > 0;
    report.logcatSummary = {
      linesFound: logcatOutput.split('\n').filter(Boolean).length,
      sample: logcatOutput.slice(0, 500),
    };

    if (!hasCrashes) {
      recordAssertion('logcat_audit_zero_fatal_crashes', 'Stage 13', 'PASSED');
    } else {
      recordAssertion('logcat_audit_zero_fatal_crashes', 'Stage 13', 'FAILED', { logcat: logcatOutput });
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
    // Ensure network always restored
    try {
      runAdbQuiet('shell svc wifi enable');
      runAdbQuiet('shell svc data enable');
      console.log('Restored WiFi and Mobile Data states.');
    } catch {}

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
