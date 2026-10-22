import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { chromium } from 'playwright';
import { navigateToAppTab } from './lib/navigation.js';

const output = 'test_artifacts/cashbook-ui3';
fs.mkdirSync(output, { recursive: true });
const server = spawn('node_modules/.bin/vite', ['preview', '--host', '127.0.0.1', '--port', '4189', '--strictPort'], { stdio: 'pipe' });
const url = 'http://127.0.0.1:4189/?tab=cashbook';
let browser;
const passed = [];
const check = (name, condition) => { assert.ok(condition, name); passed.push(name); };
try {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.exitCode !== null) throw new Error('Preview server exited early');
    try { if ((await fetch(url)).ok) break; } catch { /* wait for preview */ }
    if (attempt === 99) throw new Error('Preview did not start');
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  try { browser = await chromium.launch({ channel: 'chrome', headless: true }); }
  catch { browser = await chromium.launch({ headless: true }); }
  for (const language of ['en', 'ml', 'ar']) {
    const context = await browser.newContext({ viewport: { width: 320, height: 740 }, reducedMotion: 'reduce', colorScheme: 'dark' });
    await context.addInitScript(language => {
      localStorage.setItem('billzen_guide_status', 'completed');
      localStorage.setItem('billzen_ui_language', language);
      localStorage.setItem('billzen_appearance_pref', 'dark');
      if (language === 'ar') localStorage.setItem('billzen_browser_settings', JSON.stringify({
        id: 'default', business_name: 'UI-3 Synthetic GCC Business', legal_name: null,
        tax_identifier: null, phone: '', email: null, address_line1: '', address_line2: null,
        city: '', state: '', postal_code: '', country: 'KWT', currency_code: 'KWD',
        currency_symbol: 'KWD', currency_exponent: 3, locale: 'ar-KW', timezone: 'Asia/Kuwait',
        invoice_prefix: 'INV', terms_and_conditions: '', is_setup_completed: true,
        appearance_preference: 'dark', guide_status: 'completed', guide_version: 1,
        created_at: 0, updated_at: 0,
      }));
    }, language);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.getByTestId('action-receive-money').click();
    check(`${language}: entry dialog has accessible name`, await page.getByRole('dialog').getAttribute('aria-label'));
    check(`${language}: optional selectors have associated labels`, await page.getByTestId('select-voucher-category').evaluate(el => el.labels.length === 1) && await page.getByTestId('select-voucher-party').evaluate(el => el.labels.length === 1));
    check(`${language}: initial focus enters dialog`, await page.getByRole('dialog').evaluate(el => el.contains(document.activeElement)));
    await page.getByTestId('input-voucher-amount').fill('0');
    await page.getByTestId('btn-submit-voucher').click();
    await page.getByRole('dialog').getByRole('alert').waitFor({state:'visible'});
    check(`${language}: invalid amount stays visible inside entry dialog`, await page.getByRole('dialog').getByRole('alert').isVisible());
    // A new category must trap focus above its still-open receipt form.
    await page.getByTestId('action-new-category').click();
    await page.getByRole('dialog', { name: { en: 'Add Cashbook Category', ml: 'ക്യാഷ്ബുക്ക് വിഭാഗം ചേർക്കുക', ar: 'إضافة فئة لدفتر النقدية' }[language], exact: true }).waitFor();
    await page.waitForFunction(() => [...document.querySelectorAll('[role=dialog]')].filter(el => !el.closest('[inert]')).length === 1);
    check(`${language}: only top dialog is exposed to assistive technology`, await page.getByRole('dialog').count() === 1);
    check(`${language}: child dialog receives focus`, await page.getByRole('dialog').last().evaluate(el => el.contains(document.activeElement)));
    for (const key of ['Tab', 'Shift+Tab']) for (let i = 0; i < 12; i++) {
      await page.keyboard.press(key);
      assert.ok(await page.getByRole('dialog').last().evaluate(el => el.contains(document.activeElement)), `${language}: focus escaped on ${key}`);
    }
    check(`${language}: keyboard stays in child dialog`, await page.getByRole('dialog').last().evaluate(el => el.contains(document.activeElement)));
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.querySelectorAll('[role="dialog"]').length === 1);
    check(`${language}: child dismissal restores trigger`, await page.getByTestId('action-new-category').evaluate(el => el === document.activeElement));
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.querySelectorAll('[role="dialog"]').length === 0);
    check(`${language}: entry dismissal restores receive action`, await page.getByTestId('action-receive-money').evaluate(el => el === document.activeElement));
    check(`${language}: background accessibility restored`, await page.getByRole('button', { name: { en: 'Receive Money', ml: 'പണം സ്വീകരിക്കുക', ar: 'استلام مبلغ' }[language], exact: true }).count() > 0);
    check(`${language}: scroll lock restored`, await page.evaluate(() => document.body.style.overflow !== 'hidden'));

    await page.getByTestId('action-manage-accounts').click();
    await page.getByTestId('input-new-account-name').fill('UI-3 Test Account');
    await page.getByTestId('input-new-account-opening').fill('9876543210.12');
    await page.getByTestId('btn-save-new-account').click();
    await page.waitForFunction(() => document.querySelectorAll('[role="dialog"]').length === 0);
    await page.getByTestId('action-receive-money').click();
    const account = await page.getByTestId('select-voucher-account').locator('option').filter({ hasText: 'UI-3 Test Account' }).getAttribute('value');
    await page.getByTestId('select-voucher-account').selectOption(account);
    const receiptAmount = language === 'ar' ? '123.456' : '123.45';
    await page.getByTestId('input-voucher-amount').fill(receiptAmount);
    await page.getByTestId('btn-submit-voucher').click();
    await page.waitForFunction(() => document.querySelectorAll('[role="dialog"]').length === 0);
    await page.waitForFunction(amount => document.querySelector('main').innerText.includes(amount), receiptAmount);
    check(`${language}: receipt updates populated ledger`, await page.locator('main').innerText().then(text => text.includes(receiptAmount)));
    if (language === 'ar') check('ar: three-decimal KWD amounts retain every digit', (await page.getByTestId('cashbook-summary').innerText()).includes('123.456'));
    const expected = { en: 'Company Cashbook', ml: 'കമ്പനി ക്യാഷ്ബുക്ക്', ar: 'دفتر نقدية الشركة' };
    check(`${language}: localized Cashbook heading`, (await page.locator('main h1').innerText()).includes(expected[language]));
    check(`${language}: no page overflow with large real balances`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    check(`${language}: summary amounts fully visible`, await page.getByTestId('cashbook-summary').evaluate(el => [...el.querySelectorAll('[data-cashbook-amount]')].every(amount => amount.scrollWidth <= amount.clientWidth + 1)));
    check(`${language}: no browser errors`, errors.length === 0);
    // Submission verifies actual form state; the DOM select alone can mask stale classification.
    await navigateToAppTab(page, 'dashboard');
    await page.getByTestId('dashboard-add-payment').click();
    await page.getByTestId('input-voucher-amount').waitFor();
    check(`${language}: dashboard payment initializes an account`, await page.getByTestId('select-voucher-account').inputValue() !== '');
    await page.getByTestId('select-voucher-account').selectOption(account);
    const paymentAmount = language === 'ar' ? '12.345' : '12.34';
    await page.getByTestId('input-voucher-amount').fill(paymentAmount);
    await page.getByTestId('btn-submit-voucher').click();
    await page.waitForFunction(() => document.querySelectorAll('[role="dialog"]').length === 0);
    await page.waitForFunction(amount => document.querySelector('main').innerText.includes(amount) && document.querySelector('main').innerText.includes('PAY-'), paymentAmount);
    check(`${language}: dashboard payment posts compatible expense`, (await page.locator('main').innerText()).includes(paymentAmount));
    await page.screenshot({ path: `${output}/${language}-320-dark.png`, fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.screenshot({ path: `${output}/${language}-1440-dark.png`, fullPage: true });
    await context.close();
  }
  console.log(`PASS: ${passed.length} Cashbook UI-3 assertions`);
} finally {
  fs.writeFileSync(`${output}/report.json`, JSON.stringify({ passed, count: passed.length }, null, 2));
  await browser?.close();
  server.kill('SIGTERM');
}
