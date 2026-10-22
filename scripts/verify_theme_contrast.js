import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

// Isolated browser contexts use synthetic records; no native/user database is opened.
// This checks rendered solid-color text contrast, not full accessibility conformance.
const artifacts = path.resolve('test_artifacts/theme_contrast');
fs.mkdirSync(artifacts, { recursive: true });
const base = process.env.BILLZEN_THEME_TEST_URL || 'http://127.0.0.1:4187';
const checks = [];
let browser;
let server;
let page;
let prefix;

async function audit(name) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(120);
  const failures = await page.evaluate(() => {
    const rgb = value => (value.match(/[\d.]+/g) || []).map(Number);
    const composite = (foreground, background) => {
      const alpha = foreground[3] ?? 1;
      return [0, 1, 2].map(i => foreground[i] * alpha + background[i] * (1 - alpha));
    };
    function backgroundOf(element) {
      const layers = [];
      for (let e = element; e; e = e.parentElement) layers.push(getComputedStyle(e).backgroundColor);
      return layers.reverse().reduce((background, layer) => composite(rgb(layer), background), [255, 255, 255]);
    }
    const luminance = color => color.map(channel => {
      channel /= 255;
      return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
    }).reduce((sum, channel, i) => sum + channel * [.2126, .7152, .0722][i], 0);
    const contrast = (a, b) => {
      const x = luminance(a), y = luminance(b);
      return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
    };
    // Do not measure intentionally dimmed background content behind a dialog.
    const dialogs = [...document.querySelectorAll('[role=dialog]')].filter(e => e.checkVisibility());
    const root = dialogs.at(-1) || document.body;
    const result = [];
    for (const element of root.querySelectorAll('*')) {
      if (!element.checkVisibility() || element.closest('svg, [aria-hidden=true]') ||
          element.matches('option,script,style,:disabled') || element.closest('[disabled]')) continue;
      const textNodes = [...element.childNodes].filter(n => n.nodeType === Node.TEXT_NODE)
        .map(n => n.textContent.trim()).filter(Boolean).join(' ');
      const isInput = element.matches('input:not([type=checkbox]):not([type=radio]):not([type=file]),textarea,select');
      if (!textNodes && !isInput) continue;
      const style = getComputedStyle(element);
      if (style.visibility !== 'visible' || style.opacity === '0') continue;
      const background = backgroundOf(element);
      const large = parseFloat(style.fontSize) >= 24 ||
        (parseFloat(style.fontSize) >= 18.66 && parseInt(style.fontWeight) >= 700);
      const minimum = large ? 3 : 4.5;
      const text = isInput ? (element.value || element.getAttribute('placeholder') || '') : textNodes;
      const placeholder = isInput && !element.value && element.getAttribute('placeholder');
      const foreground = rgb(placeholder ? getComputedStyle(element, '::placeholder').color : style.color);
      const ratio = contrast(composite(foreground, background), background);
      if (text && ratio < minimum - .02) {
        result.push({ text: text.slice(0, 65), ratio: +ratio.toFixed(2), minimum,
          foreground, background, className: element.className, tag: element.tagName,
          placeholder: Boolean(placeholder) });
      }
    }
    return result;
  });
  const nativeControlsThemed = await page.evaluate(() =>
    getComputedStyle(document.documentElement).colorScheme ===
    (document.documentElement.classList.contains('dark') ? 'dark' : 'light'));
  const themeApplied = await page.evaluate(expected =>
    document.documentElement.classList.contains('dark') === (expected === 'dark'), prefix.split('-')[0]);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  checks.push({ name: `${prefix}-${name}`, failures, nativeControlsThemed, themeApplied, overflow });
  console.log(`${prefix}-${name}: ${failures.length} contrast failures; overflow=${overflow}`);
  for (const f of failures) console.log(`  ${f.ratio}: ${f.text}`);
  await page.screenshot({ path: path.join(artifacts, `${prefix}-${name}.png`), fullPage: true });
}

const tid = id => page.getByTestId(id);
async function openTab(tab) {
  await page.goto(`${base}/?tab=${tab}`);
  await page.locator('main').waitFor();
  await page.waitForTimeout(300);
}
async function entry(direction, amount) {
  await tid(direction === 'inflow' ? 'action-receive-money' : 'action-pay-money').click();
  await tid('select-voucher-account').selectOption('acc_cash_default');
  await tid('input-voucher-amount').fill(amount);
}
async function closeDialog() { await page.keyboard.press('Escape'); }

try {
  if (!process.env.BILLZEN_THEME_TEST_URL) {
    server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4187', '--strictPort'], { stdio: ['ignore', 'ignore', 'pipe'] });
    server.stderr.on('data', data => process.stderr.write(data));
  }
  let ready = false;
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(base)).ok) { ready = true; break; } } catch {}
    await new Promise(r => setTimeout(r, 200));
  }
  if (!ready) throw new Error('Theme test server not ready');
  browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--no-sandbox'] });
  for (const mode of (process.env.BILLZEN_THEME_MODES || 'dark,light').split(',')) {
    for (const width of [1280, 390]) {
      prefix = `${mode}-${width}`;
      const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: mode });
      await context.addInitScript(theme => {
        localStorage.setItem('billzen_appearance_pref', theme);
        localStorage.setItem('billzen_guide_status', 'completed');
      }, mode);
      page = await context.newPage();
      page.setDefaultTimeout(10000);
      await openTab('cashbook');
      await audit('cashbook-empty');
      await tid('action-manage-accounts').click(); await audit('accounts'); await closeDialog();
      await entry('inflow', '1000'); await audit('receipt-entry');
      await page.getByRole('button', { name: 'New Category' }).click(); await audit('category'); await closeDialog();
      await page.getByRole('button', { name: 'New Party' }).click(); await audit('party'); await closeDialog();
      await tid('btn-submit-voucher').click();
      await page.locator('[data-testid="btn-view-voucher"]:visible, button:has-text("View / Print"):visible').first().waitFor();
      await audit('cashbook-populated');
      await page.locator('[data-testid="btn-view-voucher"]:visible, button:has-text("View / Print"):visible').first().click(); await audit('voucher-preview'); await closeDialog();
      await entry('outflow', '2000'); await tid('btn-submit-voucher').click();
      await tid('btn-confirm-negative-balance').waitFor(); await audit('negative-payment');
      await tid('btn-cancel-negative-balance').click(); await closeDialog();
      await entry('outflow', '250'); await tid('btn-submit-voucher').click();
      await tid('input-voucher-amount').waitFor({ state: 'hidden' });
      await page.locator('[data-testid="btn-reverse-voucher"]:visible, button:text-is("Reverse"):visible').first().click(); await audit('reversal');
      await tid('btn-confirm-reversal').click();
      await tid('btn-confirm-reversal-negative-balance').waitFor(); await audit('negative-reversal');
      await tid('btn-cancel-reversal-negative-balance').click();
      await openTab('products'); await audit('products-empty');
      await tid('add-product-button').click(); await audit('product-form');
      await tid('input-product-sku').fill('THEME-001');
      await tid('input-product-name').fill('Theme audit item');
      await tid('input-product-price').fill('100');
      await tid('save-product-submit').click();
      await tid('product-modal-dialog').waitFor({ state: 'hidden' }); await audit('products-populated');
      await openTab('customers'); await audit('customers-empty');
      await tid('add-customer-button').click(); await audit('customer-form');
      await tid('input-customer-name').fill('Theme Audit Customer');
      await tid('save-customer-submit').click();
      await tid('customer-modal-dialog').waitFor({ state: 'hidden' }); await audit('customers-populated');
      await openTab('settings'); await audit('settings');
      const downloadPromise = page.waitForEvent('download');
      await tid('btn-export-backup').click();
      const download = await downloadPromise;
      const backupPath = path.join(artifacts, `${prefix}-synthetic-backup.json`);
      await download.saveAs(backupPath);
      await tid('input-restore-file').setInputFiles(backupPath);
      await tid('btn-cancel-restore').waitFor(); await audit('restore-confirmation');
      await tid('btn-cancel-restore').click();
      await tid('button-view-guide').click(); await audit('guide-1');
      await tid('guide-next-button').click(); await audit('guide-2');
      await tid('guide-next-button').click(); await audit('guide-3'); await tid('guide-close-button').click();
      // Audit onboarding independently without overwriting any existing browser profile.
      await page.evaluate(() => {
        localStorage.removeItem('billzen_browser_settings');
        localStorage.setItem('billzen_mock_fresh_user', 'true');
      });
      await page.reload();
      await tid('onboarding-next-step-1').waitFor(); await audit('setup-1');
      await tid('onboarding-next-step-1').click(); await audit('setup-2');
      for (const [id, value] of Object.entries({ 'business-name':'Theme Audit',phone:'+919876543210',address1:'Synthetic Road',city:'Kochi',state:'Kerala',postal:'682001' })) {
        await tid(`onboarding-input-${id}`).fill(value);
      }
      await tid('onboarding-next-step-2').click(); await audit('setup-3');
      await context.close();
    }
  }
  const passed = checks.every(c => c.failures.length === 0 && c.nativeControlsThemed && c.themeApplied && !c.overflow);
  fs.writeFileSync(path.join(artifacts, 'report.json'), JSON.stringify({ passed, checks }, null, 2));
  console.log(`${checks.length} theme/state checks; passed=${passed}`);
  if (!passed) process.exitCode = 1;
} catch (error) {
  fs.writeFileSync(path.join(artifacts, 'report.json'), JSON.stringify({ passed: false, error: String(error), checks }, null, 2));
  throw error;
} finally {
  await browser?.close();
  server?.kill('SIGTERM');
}
