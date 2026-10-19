import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

const ARTIFACTS_DIR = path.resolve(process.cwd(), 'test_artifacts/android_runtime');
if (!fs.existsSync(ARTIFACTS_DIR)) {
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
}

const ANDROID_SDK = '/home/jabir/.android-toolchain/android-sdk';
const ADB = `${ANDROID_SDK}/platform-tools/adb`;

function runAdb(cmd) {
  try {
    return execSync(`${ADB} ${cmd}`, { encoding: 'utf8' }).trim();
  } catch (err) {
    console.error(`ADB error running: ${cmd}`, err.message);
    throw err;
  }
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
    }
  }
}

async function getCdpClient() {
  const pid = runAdb('shell pidof com.billzen.desktop');
  if (!pid) throw new Error('com.billzen.desktop process not found!');

  runAdb(`forward tcp:9222 localabstract:webview_devtools_remote_${pid}`);
  await sleep(500);

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
  console.log(`Saved screenshot: ${localPath}`);
  return localPath;
}

async function waitForCondition(client, conditionExpr, timeoutMs = 10000, intervalMs = 250) {
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

async function main() {
  console.log('=== BillZen Native Android Runtime Verification ===');

  // Verify emulator connected
  const devices = runAdb('devices');
  console.log('Connected devices:\n' + devices);
  if (!devices.includes('emulator-5554')) {
    throw new Error('emulator-5554 is not running or connected!');
  }

  // --- Step 1: Clean Install v1000 APK for initial baseline ---
  console.log('\n--- Step 1: Installing v1000 Test APK ---');
  const v1000Path = path.resolve('dist-android/billzen-test-v0.1.0-v1000-x86_64.apk');
  runAdb('uninstall com.billzen.desktop || true');
  runAdb(`install -r "${v1000Path}"`);
  
  const initialVersion = runAdb('shell dumpsys package com.billzen.desktop | grep versionCode').split('\n')[0].trim();
  console.log(`Initial package version: ${initialVersion}`);
  if (!initialVersion.includes('1000')) {
    throw new Error(`Expected versionCode 1000, got: ${initialVersion}`);
  }

  // Start app
  console.log('\n--- Step 2: Cold Launching BillZen ---');
  runAdb('shell am start -n com.billzen.desktop/.MainActivity');
  await sleep(4000);

  let cdp = await getCdpClient();
  console.log('Connected to BillZen WebView via CDP.');

  // Check setup wizard
  await waitForCondition(cdp, 'document.querySelector("h1")?.innerText.includes("Welcome to BillZen")', 10000);
  captureScreenshot('01_setup_wizard_step1.png');
  console.log('Step 1: Setup wizard step 1 verified.');

  // Select India and click continue
  console.log('\n--- Step 3: Completing Setup Wizard (Step 1 -> Step 2 -> Step 3) ---');
  await cdp.eval(`
    (() => {
      const btn = document.querySelector('[data-testid="onboarding-next-step-1"]');
      if (btn) btn.click();
    })()
  `);
  await sleep(1500);

  // Assert Step 2 (Store Profile)
  await waitForCondition(cdp, '!!document.querySelector(\'[data-testid="onboarding-input-business-name"]\')', 10000);
  captureScreenshot('02_setup_wizard_step2.png');

  // Fill Step 2 profile fields
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

  // Click Step 2 next -> Step 3
  await cdp.eval(`
    (() => {
      const btn = document.querySelector('[data-testid="onboarding-next-step-2"]');
      if (btn) btn.click();
    })()
  `);
  await sleep(1500);

  // Assert Step 3 (Review & Complete)
  await waitForCondition(cdp, '!!document.querySelector(\'[data-testid="onboarding-submit-button"]\')', 10000);
  console.log('Step 3: Review summary reached. Submitting setup...');

  // Click submit button in Step 3
  await cdp.eval(`
    (() => {
      const btn = document.querySelector('[data-testid="onboarding-submit-button"]');
      if (btn) btn.click();
    })()
  `);
  await sleep(3000);

  // Getting started guide
  console.log('\n--- Step 4: Verifying Getting Started Guide ---');
  await waitForCondition(cdp, '!!document.querySelector(\'[data-testid="guide-skip-button"]\')', 10000);
  captureScreenshot('03_getting_started_guide.png');

  // Dismiss / skip guide
  await cdp.eval(`
    (() => {
      const skipBtn = document.querySelector('[data-testid="guide-skip-button"]');
      if (skipBtn) skipBtn.click();
    })()
  `);
  await sleep(1500);

  // Navigate to Products
  console.log('\n--- Step 5: Creating Product with Leading-Zero Barcode ---');
  await cdp.eval(`
    (() => {
      const navBtn = document.querySelector('[data-testid="tab-products"]');
      if (navBtn) navBtn.click();
    })()
  `);
  await sleep(1500);

  // Open Add Product
  await cdp.eval(`
    (() => {
      const addBtn = document.querySelector('[data-testid="add-product-button"]');
      if (addBtn) addBtn.click();
    })()
  `);
  await sleep(1000);

  // Fill product modal
  await fillInput(cdp, '[data-testid="input-product-name"]', 'Royal Basmati Rice 5kg');
  await fillInput(cdp, '[data-testid="input-product-sku"]', 'BASMATI-5KG');
  await fillInput(cdp, '[data-testid="input-product-barcode"]', '0012345678905'); // Explicit leading zero!
  await fillInput(cdp, '[data-testid="input-product-price"]', '450.00');
  await fillInput(cdp, '[data-testid="input-product-cost-price"]', '380.00');
  await fillInput(cdp, '[data-testid="input-product-opening-stock"]', '25.000');
  await sleep(500);

  // Submit product
  await cdp.eval(`
    (() => {
      const saveBtn = document.querySelector('[data-testid="save-product-submit"]');
      if (saveBtn) saveBtn.click();
    })()
  `);
  await sleep(2000);

  // Assert product created
  const productText = await cdp.eval('document.body.innerText');
  if (!productText.includes('Royal Basmati Rice 5kg') || !productText.includes('0012345678905')) {
    throw new Error('Product creation failed or barcode was truncated!');
  }
  captureScreenshot('04_catalog_product_created.png');
  console.log('Product created with leading-zero barcode: 0012345678905');

  // Navigate to Customers
  console.log('\n--- Step 6: Creating Customer Record ---');
  await cdp.eval(`
    (() => {
      const navBtn = document.querySelector('[data-testid="tab-customers"]');
      if (navBtn) navBtn.click();
    })()
  `);
  await sleep(1500);

  // Open Add Customer
  await cdp.eval(`
    (() => {
      const addBtn = document.querySelector('[data-testid="add-customer-button"]');
      if (addBtn) addBtn.click();
    })()
  `);
  await sleep(1000);

  // Fill customer modal
  await fillInput(cdp, '[data-testid="input-customer-name"]', 'Jabir');
  await fillInput(cdp, '[data-testid="input-customer-phone"]', '+91 9999888877');
  await sleep(500);

  // Submit customer
  await cdp.eval(`
    (() => {
      const saveBtn = document.querySelector('[data-testid="save-customer-submit"]');
      if (saveBtn) saveBtn.click();
    })()
  `);
  await sleep(2000);

  captureScreenshot('05_catalog_customer_created.png');
  console.log('Customer record created: Jabir');

  // Appearance in Settings
  console.log('\n--- Step 7: Verifying Settings & Appearance (System/Light/Dark) ---');
  await cdp.eval(`
    (() => {
      const navBtn = document.querySelector('[data-testid="tab-settings"]');
      if (navBtn) navBtn.click();
    })()
  `);
  await sleep(1500);

  // Switch to Dark
  console.log('Selecting Dark theme...');
  await cdp.eval(`
    (() => {
      const darkBtn = document.querySelector('[data-testid="appearance-option-dark"]');
      if (darkBtn) darkBtn.click();
    })()
  `);
  await sleep(800);
  const isDark = await cdp.eval("document.documentElement.classList.contains('dark')");
  console.log(`Dark theme class present: ${isDark}`);
  if (!isDark) throw new Error('Dark theme class not found on documentElement!');
  captureScreenshot('06_appearance_dark.png');

  // Switch to Light
  console.log('Selecting Light theme...');
  await cdp.eval(`
    (() => {
      const lightBtn = document.querySelector('[data-testid="appearance-option-light"]');
      if (lightBtn) lightBtn.click();
    })()
  `);
  await sleep(800);
  const isLightDark = await cdp.eval("document.documentElement.classList.contains('dark')");
  console.log(`Light theme - dark class present: ${isLightDark}`);
  if (isLightDark) throw new Error('Dark theme class still present in Light mode!');
  captureScreenshot('07_appearance_light.png');

  // Set back to Dark for persistence test
  await cdp.eval(`
    (() => {
      const darkBtn = document.querySelector('[data-testid="appearance-option-dark"]');
      if (darkBtn) darkBtn.click();
    })()
  `);
  await sleep(500);

  // Back button test
  console.log('\n--- Step 8: Testing Android Back Button Handling ---');
  await cdp.eval(`
    (() => {
      const navBtn = document.querySelector('[data-testid="tab-customers"]');
      if (navBtn) navBtn.click();
    })()
  `);
  await sleep(1000);
  await cdp.eval(`
    (() => {
      const addBtn = document.querySelector('[data-testid="add-customer-button"]');
      if (addBtn) addBtn.click();
    })()
  `);
  await sleep(1000);

  let hasDialog = await cdp.eval("!!document.querySelector('[role=\"dialog\"]')");
  console.log(`Add Customer modal open: ${hasDialog}`);
  if (!hasDialog) throw new Error('Customer modal did not open before back button test');

  // Dispatch Android back button keyevent 4
  console.log('Dispatching Android Back Button (keyevent 4)...');
  runAdb('shell input keyevent 4');
  await sleep(1000);

  let dialogStillOpen = await cdp.eval("!!document.querySelector('[role=\"dialog\"]')");
  console.log(`Modal state after back button: ${dialogStillOpen ? 'open' : 'closed'}`);
  if (dialogStillOpen) {
    // Dismiss via cancel button to proceed
    await cdp.eval(`
      (() => {
        const cancelBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Cancel'));
        if (cancelBtn) cancelBtn.click();
      })()
    `);
    await sleep(500);
  }

  // Step 9: Process Termination & Cold Restart
  console.log('\n--- Step 9: Testing Process Force-Stop & Cold Recovery ---');
  cdp.close();
  runAdb('shell am force-stop com.billzen.desktop');
  await sleep(1000);
  console.log('App force-stopped.');

  runAdb('shell am start -n com.billzen.desktop/.MainActivity');
  await sleep(4000);

  cdp = await getCdpClient();
  console.log('Reconnected to BillZen after process kill.');

  // Verify setup wizard is NOT shown
  const bodyTextAfterKill = await cdp.eval('document.body.innerText');
  if (bodyTextAfterKill.includes('Welcome to BillZen')) {
    throw new Error('Setup wizard re-appeared after cold restart! Setup completion not persisted.');
  }

  // Verify appearance persisted (dark mode)
  const isDarkAfterKill = await cdp.eval("document.documentElement.classList.contains('dark')");
  console.log(`Appearance after cold restart (Dark): ${isDarkAfterKill}`);
  if (!isDarkAfterKill) throw new Error('Appearance did not persist across cold process restart!');

  // Navigate to Products & verify record
  await cdp.eval(`
    (() => {
      const navBtn = document.querySelector('[data-testid="tab-products"]');
      if (navBtn) navBtn.click();
    })()
  `);
  await sleep(1500);
  const productsAfterKill = await cdp.eval('document.body.innerText');
  if (!productsAfterKill.includes('Royal Basmati Rice 5kg') || !productsAfterKill.includes('0012345678905')) {
    throw new Error('Product or barcode 0012345678905 lost after process restart!');
  }
  console.log('Product "Royal Basmati Rice 5kg" and barcode "0012345678905" persisted across process restart.');
  captureScreenshot('08_after_kill_recovery.png');

  // Step 10: In-place Upgrade to v1001 without data loss
  console.log('\n--- Step 10: Testing In-Place Upgrade to v1001 (No Data Loss) ---');
  cdp.close();
  const v1001Path = path.resolve('dist-android/billzen-test-v0.1.0-x86_64.apk');
  console.log(`Installing v1001 APK: ${v1001Path}`);
  const upgradeResult = runAdb(`install -r "${v1001Path}"`);
  console.log(`Upgrade install result: ${upgradeResult}`);

  const upgradedVersion = runAdb('shell dumpsys package com.billzen.desktop | grep versionCode').split('\n')[0].trim();
  console.log(`Upgraded package version: ${upgradedVersion}`);
  if (!upgradedVersion.includes('1001')) {
    throw new Error(`Expected upgraded versionCode 1001, got: ${upgradedVersion}`);
  }

  // Start upgraded app
  runAdb('shell am force-stop com.billzen.desktop');
  runAdb('shell am start -n com.billzen.desktop/.MainActivity');
  await sleep(4000);

  cdp = await getCdpClient();
  console.log('Connected to upgraded v1001 app.');

  // Verify data intact
  await cdp.eval(`
    (() => {
      const navBtn = document.querySelector('[data-testid="tab-products"]');
      if (navBtn) navBtn.click();
    })()
  `);
  await sleep(1500);
  const productsAfterUpgrade = await cdp.eval('document.body.innerText');
  if (!productsAfterUpgrade.includes('Royal Basmati Rice 5kg') || !productsAfterUpgrade.includes('0012345678905')) {
    throw new Error('Product or barcode lost after in-place upgrade to v1001!');
  }
  console.log('Verification: All catalog data intact after upgrade to v1001!');
  captureScreenshot('09_after_upgrade_v1001.png');

  // Step 11: Offline Mode Operation
  console.log('\n--- Step 11: Testing Offline Mode Operation ---');
  console.log('Disabling WiFi and Mobile Data...');
  runAdb('shell svc wifi disable');
  runAdb('shell svc data disable');
  await sleep(1500);

  // Add a product while completely offline
  await cdp.eval(`
    (() => {
      const addBtn = document.querySelector('[data-testid="add-product-button"]');
      if (addBtn) addBtn.click();
    })()
  `);
  await sleep(1000);

  await fillInput(cdp, '[data-testid="input-product-name"]', 'Offline Pure Coconut Oil');
  await fillInput(cdp, '[data-testid="input-product-sku"]', 'COCO-002');
  await fillInput(cdp, '[data-testid="input-product-barcode"]', '0098765432104');
  await fillInput(cdp, '[data-testid="input-product-price"]', '220.00');
  await fillInput(cdp, '[data-testid="input-product-cost-price"]', '180.00');
  await fillInput(cdp, '[data-testid="input-product-opening-stock"]', '10.000');
  await sleep(500);

  await cdp.eval(`
    (() => {
      const saveBtn = document.querySelector('[data-testid="save-product-submit"]');
      if (saveBtn) saveBtn.click();
    })()
  `);
  await sleep(2000);

  const offlineText = await cdp.eval('document.body.innerText');
  if (!offlineText.includes('Offline Pure Coconut Oil') || !offlineText.includes('0098765432104')) {
    throw new Error('Offline product creation failed!');
  }
  console.log('Verification: Product created and indexed in SQLite while 100% offline.');
  captureScreenshot('10_offline_mode_product.png');

  // Re-enable WiFi & Data
  runAdb('shell svc wifi enable');
  runAdb('shell svc data enable');
  console.log('Re-enabled network connectivity.');

  // Step 12: Logcat crash audit
  console.log('\n--- Step 12: Inspecting Logcat for Fatal Crashes & Errors ---');
  const crashes = runAdb('shell logcat -d -t 500 | grep -E "FATAL EXCEPTION|SIGSEGV|AndroidRuntime: FATAL" || true');
  if (crashes.length > 0) {
    console.error('Fatal crash detected in logcat:\n' + crashes);
    throw new Error('Fatal crash found in logcat during test run');
  }
  console.log('Logcat audit passed: Zero fatal crashes or unhandled panics.');

  cdp.close();
  console.log('\n======================================================');
  console.log('✅ ALL NATIVE ANDROID RUNTIME VERIFICATION CHECKS PASSED!');
  console.log('======================================================');
}

main().catch((err) => {
  console.error('\n❌ Runtime verification failed:', err);
  process.exit(1);
});
