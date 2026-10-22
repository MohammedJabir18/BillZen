import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

// Isolated synthetic browser contexts only. No native or real business database is opened.
const output = path.resolve('test_artifacts/layout');
fs.mkdirSync(output, { recursive: true });
const base = process.env.BILLZEN_LAYOUT_TEST_URL || 'http://127.0.0.1:4193';
const quick = process.env.BILLZEN_LAYOUT_QUICK === '1';
const widths = process.env.BILLZEN_LAYOUT_WIDTHS ? process.env.BILLZEN_LAYOUT_WIDTHS.split(',').map(Number) : quick ? [320, 568, 1024] : [320, 360, 390, 412, 568, 768, 1023, 1024, 1280, 1536];
const variants = quick ? [['en', 'light'], ['ml', 'dark']] : [['en', 'light'], ['en', 'dark'], ['ml', 'light'], ['ml', 'dark'], ['ar', 'light'], ['ar', 'dark']];
const tabs = ['dashboard', 'reports', 'cashbook', 'products', 'customers', 'settings'];
const results = [];
let server, browser;
let completed = false;

async function navigate(page, tab) {
  const desktop = page.getByTestId('tab-' + tab);
  if (await desktop.isVisible()) return desktop.click();
  let mobile = page.getByTestId('mobile-tab-' + tab);
  if (!await mobile.isVisible()) {
    const more = page.getByTestId('mobile-nav-more');
    if (await more.isVisible()) await more.click();
  }
  await mobile.click();
}

async function audit(page, name, width, language, theme) {
  const failures = await page.evaluate(() => {
    const errors = [];
    const viewport = document.documentElement.clientWidth;
    const visible = e => e.checkVisibility() && e.getBoundingClientRect().width > 0;
    if (document.documentElement.scrollWidth > innerWidth + 1) errors.push('Document overflows horizontally');
    const header = document.querySelector('header');
    const headerRow = header?.firstElementChild;
    if (headerRow) {
      const groups = [...headerRow.children].filter(visible);
      for (let i = 1; i < groups.length; i++) {
        const a = groups[i - 1].getBoundingClientRect(), b = groups[i].getBoundingClientRect();
        if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 2 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 2) errors.push('Header groups overlap');
      }
    }
    for (const nav of document.querySelectorAll('nav')) {
      if (!visible(nav)) continue;
      const buttons = [...nav.querySelectorAll('button')].filter(visible);
      if (nav.getAttribute('aria-label') === 'Mobile Navigation' && buttons.length > 5) errors.push('Mobile navigation has more than five primary actions');
      for (const button of buttons) {
        const r = button.getBoundingClientRect();
        if (r.left < -1 || r.right > viewport + 1) errors.push('Navigation action is outside viewport: ' + button.textContent.trim());
        if (r.width < 43 || r.height < 43) errors.push('Navigation touch target below 44px: ' + button.textContent.trim());
      }
    }
    // Detect clipped controls inside overflow-hidden containers, not just body overflow.
    for (const element of document.querySelectorAll('main button,main input:not([type="checkbox"]):not([type="radio"]),main select')) {
      if (!visible(element)) continue;
      const r = element.getBoundingClientRect();
      if (r.left < -1 || r.right > viewport + 1) {
        const scroller = element.closest('.overflow-x-auto');
        if (!scroller) errors.push('Content control outside viewport: ' + (element.getAttribute('data-testid') || element.getAttribute('aria-label') || element.tagName));
      }
      for (let parent = element.parentElement; parent && parent.tagName !== 'MAIN'; parent = parent.parentElement) {
        if (!['hidden', 'clip'].includes(getComputedStyle(parent).overflowX)) continue;
        const clip = parent.getBoundingClientRect();
        if (r.left < clip.left - 1 || r.right > clip.right + 1) {
          errors.push('Content control clipped by container: ' + (element.getAttribute('data-testid') || element.getAttribute('aria-label') || element.tagName));
          break;
        }
      }
    }
    for (const card of document.querySelectorAll('[data-testid^="card-"], [data-testid^="report-"][data-testid$="balance"], [data-testid="report-period-inflows"], [data-testid="report-period-outflows"]')) {
      if (visible(card) && card.scrollWidth > card.clientWidth + 2) errors.push('Summary card clips its content: ' + card.dataset.testid);
    }
    for (const dialog of [...document.querySelectorAll('[role="dialog"]')].filter(visible)) {
      const r = dialog.getBoundingClientRect();
      if (r.left < -1 || r.right > viewport + 1) errors.push('Dialog outside viewport');
      const panel = dialog === document.querySelector('#mobile-more-navigation') ? dialog : dialog.firstElementChild;
      if (panel) {
        const p = panel.getBoundingClientRect();
        if (p.top < -1 || p.bottom > innerHeight + 1) errors.push('Dialog panel exceeds viewport height');
      }
    }
    return [...new Set(errors)];
  });
  results.push({ name, width, language, theme, failures });
  if (width === 320 && language === 'en' && theme === 'light' && ['dashboard', 'more-menu', 'guide', 'reports-custom'].includes(name)) await page.screenshot({ path: path.join(output, `fixed-${name}.png`), fullPage: true });
  if (failures.length) console.log(`${language}/${theme}/${width}/${name}: ${failures.join('; ')}`);
  if (failures.length && results.filter(r => r.failures.length).length <= 10) await page.screenshot({ path: path.join(output, `${language}-${theme}-${width}-${name}.png`), fullPage: true });
}

try {
  if (!process.env.BILLZEN_LAYOUT_TEST_URL) {
    server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4193', '--strictPort'], { stdio: 'ignore' });
  }
  let ready = false;
  for (let i = 0; i < 75; i++) {
    try { if ((await fetch(base)).ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  if (!ready) throw new Error('Layout test server did not start');
  browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--no-sandbox'] });
  for (const [language, theme] of variants) for (const width of widths) {
    const context = await browser.newContext({ viewport: { width, height: width === 568 ? 320 : 900 }, colorScheme: theme });
    await context.addInitScript(({ language, theme }) => {
      localStorage.setItem('billzen_guide_status', 'completed');
      localStorage.setItem('billzen_ui_language', language);
      localStorage.setItem('billzen_appearance_pref', theme);
    }, { language, theme });
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.goto(base);
    await page.locator('main').waitFor();
    await page.evaluate(() => document.fonts.ready);
    if (width < 1024) {
      await page.getByTestId('mobile-nav-more').click();
      await page.evaluate(() => window.dispatchEvent(new Event('billzen-back-button', { cancelable: true })));
      await page.getByRole('dialog').waitFor({ state: 'hidden' });
      await page.waitForTimeout(50);
      if (await page.evaluate(() => localStorage.getItem('billzen_guide_status') !== 'completed')) throw new Error('Closed guide changed its saved status when dismissing More');
    }
    for (const tab of tabs) {
      await navigate(page, tab);
      await page.waitForTimeout(90);
      await audit(page, tab, width, language, theme);
      if (tab === 'dashboard' || tab === 'reports') {
        // Layout-only stress: large amounts must reflow without hiding digits.
        const selector = tab === 'dashboard' ? '[data-testid^="card-"] .tabular-nums' : '[data-testid^="report-"][data-testid$="balance"], [data-testid="report-period-inflows"], [data-testid="report-period-outflows"]';
        const original = await page.locator(selector).allTextContents();
        const account = tab === 'dashboard' ? page.getByRole('combobox', { name: 'Filter Account' }) : page.getByTestId('report-account-select');
        const accountText = await account.locator('option:checked').textContent();
        await account.locator('option:checked').evaluate(e => { e.textContent = 'Company Account With A Very Long Name For Regional Branch Operations'; });
        await page.locator(selector).evaluateAll(elements => elements.forEach(e => { e.textContent = 'KWD 999,999,999.999'; }));
        await audit(page, tab + '-large-amounts', width, language, theme);
        await account.locator('option:checked').evaluate((e, value) => { e.textContent = value; }, accountText);
        await page.locator(selector).evaluateAll((elements, texts) => elements.forEach((e, i) => { e.textContent = texts[i]; }), original);
      }
      if (tab === 'dashboard') {
        await page.getByTestId('period-custom').click();
        await audit(page, 'dashboard-custom', width, language, theme);
        await page.getByTestId('tab-analytics').click();
        await audit(page, 'dashboard-analytics', width, language, theme);
      }
      if (tab === 'reports') {
        await page.getByTestId('report-period-custom').click();
        await audit(page, 'reports-custom', width, language, theme);
      }
    }
    if (width === 320 || width === 568) {
      for (const [tab, openId, closeId, name] of [
        ['cashbook', 'action-receive-money', 'btn-cancel-voucher-entry', 'receipt-form'],
        ['cashbook', 'action-manage-accounts', 'btn-close-account-modal', 'account-form'],
        ['customers', 'add-customer-button', 'close-customer-modal', 'customer-form'],
        ['settings', 'button-view-guide', 'guide-close-button', 'guide'],
      ]) {
        await navigate(page, tab);
        const trigger = page.getByTestId(openId);
        if (!await trigger.isVisible() && tab === 'customers') await page.getByTestId('mobile-add-customer-button').click();
        else await trigger.click();
        await page.getByTestId(closeId).waitFor();
        await audit(page, name, width, language, theme);
        await page.getByTestId(closeId).click();
      }
      await navigate(page, 'settings');
      const downloadPromise = page.waitForEvent('download');
      await page.getByTestId('btn-export-backup').click();
      const download = await downloadPromise;
      const backupPath = path.join(output, `${language}-${theme}-${width}-synthetic-backup.json`);
      await download.saveAs(backupPath);
      await page.getByTestId('input-restore-file').setInputFiles(backupPath);
      await page.getByTestId('btn-cancel-restore').waitFor();
      await audit(page, 'restore-confirmation', width, language, theme);
      await page.getByTestId('btn-cancel-restore').click();
      await navigate(page, 'cashbook');
      await page.getByTestId('action-pay-money').click();
      await page.getByTestId('input-voucher-amount').fill('100');
      await page.getByTestId('select-voucher-account').selectOption('acc_cash_default');
      await page.getByTestId('btn-submit-voucher').click();
      await page.getByTestId('btn-cancel-negative-balance').waitFor();
      await audit(page, 'negative-balance-confirmation', width, language, theme);
      await page.getByTestId('btn-cancel-negative-balance').click();
      await page.getByTestId('btn-cancel-voucher-entry').click();
    }
    if (width < 1024) {
      await page.getByTestId('mobile-nav-more').click();
      await audit(page, 'more-menu', width, language, theme);
      await page.keyboard.press('Escape');
      if (await page.getByRole('dialog').isVisible()) throw new Error('More menu did not close with Escape');
      if (!await page.getByTestId('mobile-nav-more').evaluate(e => e === document.activeElement)) throw new Error('More menu did not restore keyboard focus');
      await page.getByTestId('mobile-nav-more').click();
      const consumed = await page.evaluate(() => !window.dispatchEvent(new Event('billzen-back-button', { cancelable: true })));
      if (!consumed) throw new Error('More menu did not consume Android back event');
      await page.getByRole('dialog').waitFor({ state: 'hidden' });
      await page.getByTestId('mobile-nav-more').click();
      await page.setViewportSize({ width: 1024, height: 900 });
      await page.getByRole('dialog').waitFor({ state: 'hidden' });
      await page.waitForFunction(() => document.body.style.overflow !== 'hidden');
      await page.setViewportSize({ width, height: width === 568 ? 320 : 900 });
    }
    if (width <= 390) {
      await navigate(page, 'products');
      await page.locator('[data-testid="add-product-button"], [data-testid="mobile-add-product-button"]').filter({ visible: true }).first().click();
      await page.getByTestId('input-product-name').waitFor();
      await audit(page, 'product-form', width, language, theme);
      await page.keyboard.press('Escape');
    }
    if (width === 320 || width === 568) {
      await page.evaluate(() => localStorage.setItem('billzen_mock_fresh_user', 'true'));
      await page.reload();
      await page.getByTestId('onboarding-next-step-1').waitFor();
      await audit(page, 'setup-step-1', width, language, theme);
      await page.getByTestId('onboarding-next-step-1').click();
      await audit(page, 'setup-step-2', width, language, theme);
    }
    if (pageErrors.length) throw new Error(`Uncaught browser errors: ${pageErrors.join('; ')}`);
    await context.close();
    console.log(`Checked ${language}/${theme}/${width}`);
  }
  completed = true;
} finally {
  await browser?.close(); server?.kill();
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify({ results, passed: completed && results.length > 0 && results.every(r => !r.failures.length) }, null, 2));
}
const failed = results.filter(r => r.failures.length);
console.log(`${results.length} layout states checked; ${failed.length} failed`);
if (failed.length) process.exitCode = 1;
