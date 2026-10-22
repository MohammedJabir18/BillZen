import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

// Run after npm run build. Only isolated browser-site data, never native SQLite.
const output = path.resolve('test_artifacts/motion');
fs.mkdirSync(output, { recursive: true });
const base = 'http://127.0.0.1:4208';
const results = [];
let browser;
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4208', '--strictPort'], { stdio: 'ignore' });
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
// Media events and computed styles become observable on rendering frames, not
// on an arbitrary automation timer under CI load. Require the settled state
// after two frames, well before an ordinary entry tween would finish.
const afterMediaPaint = page => page.evaluate(() => new Promise(resolve =>
  requestAnimationFrame(() => requestAnimationFrame(resolve))));

async function check(name, run) {
  try { await run(); results.push({ name, passed: true }); console.log('PASS:', name); }
  catch (error) { results.push({ name, passed: false, error: error.message }); console.error('FAIL:', name, error.message); }
}

async function capsule(page, mobile = false) {
  return page.locator(`nav[aria-label="${mobile ? 'Mobile Navigation' : 'Main Navigation'}"]`).evaluate(nav => {
    const pill = nav.querySelector('[data-nav-capsule], [style*="pointer-events"]');
    const button = nav.querySelector('[aria-current="page"]');
    const bounds = e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; };
    let painted = bounds(pill);
    // A clipped full-size layer paints only the inset rectangle.
    const clip = getComputedStyle(pill).clipPath;
    if (clip.startsWith('inset(')) {
      const parts = clip.slice(6).split(' round ')[0].replace(')', '').trim().split(/\s+/).map(parseFloat);
      const [top, right = top, bottom = top, left = right] = parts;
      painted = { x: painted.x + left, y: painted.y + top, width: painted.width - left - right, height: painted.height - top - bottom };
    }
    const label = button.querySelector('span');
    const labelRect = label.getBoundingClientRect();
    const stack = document.elementsFromPoint(labelRect.x + labelRect.width / 2, labelRect.y + labelRect.height / 2);
    return { pill: painted, target: bounds(button), position: getComputedStyle(nav).position,
      nav: bounds(nav), labelAbove: Number(getComputedStyle(button).zIndex) > Number(getComputedStyle(pill).zIndex),
      labelHit: stack.some(e => e === label), clip };
  });
}
function aligned(state) {
  assert.ok(Math.abs(state.pill.x - state.target.x) < 1.5 && Math.abs(state.pill.width - state.target.width) < 1.5,
    JSON.stringify(state));
}
async function settledCards(page) {
  const cards = await page.locator('.summary-card').evaluateAll(elements => elements.map(e => {
    const s = getComputedStyle(e), m = s.transform === 'none' ? new DOMMatrix() : new DOMMatrix(s.transform);
    return { opacity: Number(s.opacity), y: m.m42, inline: e.style.transform,
      reduced: matchMedia('(prefers-reduced-motion: reduce)').matches, transition: s.transitionDuration };
  }));
  assert.equal(cards.length, 4);
  assert.ok(cards.every(c => c.opacity > .999 && Math.abs(c.y) < .1), JSON.stringify(cards));
}
async function panelState(panel) {
  return panel.evaluate(e => {
    const s = getComputedStyle(e), matrix = new DOMMatrix(s.transform === 'none' ? undefined : s.transform);
    return { y: matrix.m42, opacity: Number(s.opacity), reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
      label: e.closest('[role="dialog"]')?.getAttribute('aria-label'), inline: e.style.transform };
  });
}
async function settledPanel(panel) {
  const state = await panelState(panel);
  assert.ok(Math.abs(state.y) < .1 && state.opacity > .999, JSON.stringify(state));
}
async function tracePanelOpening(page, selector) {
  await page.evaluate(selector => {
    window.__billzenPanelTrace?.observer.disconnect();
    const frames = [];
    // Observe inside the browser during opening, before a slow automation
    // round-trip could miss the entire short entry animation.
    const observer = new MutationObserver(() => {
      const panel = document.querySelector(selector);
      if (!panel) return;
      const style = getComputedStyle(panel);
      const matrix = new DOMMatrix(style.transform === 'none' ? undefined : style.transform);
      frames.push({ y: matrix.m42, opacity: Number(style.opacity) });
    });
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['style'] });
    window.__billzenPanelTrace = { observer, frames };
  }, selector);
}
async function openingFrames(page) {
  return page.evaluate(() => {
    const trace = window.__billzenPanelTrace;
    trace.observer.disconnect(); delete window.__billzenPanelTrace;
    return trace.frames;
  });
}

try {
  let ready = false;
  for (let i = 0; i < 100; i++) { try { if ((await fetch(base)).ok) { ready = true; break; } } catch {} await pause(100); }
  assert.ok(ready, 'Preview did not start');
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(() => localStorage.setItem('billzen_guide_status', 'completed'));
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForTimeout(650);
  await check('Mobile navigation stays fixed and active label paints above decoration', async () => {
    const s = await capsule(page, true);
    assert.equal(s.position, 'fixed'); assert.ok(s.nav.y + s.nav.height <= 845);
    assert.ok(s.labelAbove && s.labelHit, 'Active label is below the decorative capsule'); aligned(s);
    await page.evaluate(() => scrollTo(0, document.body.scrollHeight)); aligned(await capsule(page, true));
  });
  await check('Hidden desktop navigation realigns on breakpoint and resize', async () => {
    for (const width of [1280, 1100]) { await page.setViewportSize({ width, height: 800 }); await page.waitForTimeout(650); aligned(await capsule(page)); }
  });
  await check('Long pointer press does not leave capsule measured at compressed size', async () => {
    const target = await page.getByTestId('tab-cashbook').boundingBox();
    await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2);
    await page.mouse.down(); await page.waitForTimeout(220); await page.mouse.up();
    await page.waitForTimeout(700); aligned(await capsule(page));
  });
  await check('Enabling reduced motion cancels an in-flight navigation tween', async () => {
    await page.getByTestId('tab-reports').click(); await page.waitForTimeout(40);
    await page.emulateMedia({ reducedMotion: 'reduce' }); await afterMediaPaint(page);
    aligned(await capsule(page)); await page.waitForTimeout(130); aligned(await capsule(page));
  });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.getByTestId('tab-dashboard').click(); await page.waitForTimeout(650);
  await check('Enabling reduced motion settles summary cards immediately', async () => {
    await page.getByTestId('period-month').click();
    await page.emulateMedia({ reducedMotion: 'reduce' }); await afterMediaPaint(page);
    await settledCards(page);
  });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await check('Rapid date filters leave every financial summary visible', async () => {
    await tracePanelOpening(page, '.summary-card');
    await page.evaluate(async () => { for (const period of ['year', 'today', 'month', 'today']) {
      document.querySelector(`[data-testid="period-${period}"]`).click(); await new Promise(r => setTimeout(r, 45));
    } });
    await page.waitForTimeout(700); await settledCards(page);
    const frames = await openingFrames(page);
    assert.ok(frames.every(f => Math.abs(f.y) < .1 && f.opacity > .999), 'Filters restart a summary entrance: ' + JSON.stringify(frames.slice(0, 5)));
  });
  await check('Asynchronous nonempty analytics settle on live reduced motion', async () => {
    await page.getByTestId('tab-cashbook').click();
    await page.getByTestId('action-receive-money').click();
    await page.getByTestId('input-voucher-amount').fill('125.50');
    await page.getByTestId('btn-submit-voucher').click();
    await page.waitForFunction(() => document.querySelectorAll('[role="dialog"]').length === 0);
    await page.getByTestId('tab-dashboard').click();
    await page.evaluate(() => {
      window.__barFrames = [];
      const observer = new MutationObserver(() => {
        for (const e of document.querySelectorAll('.analytics-bar')) {
          const s = getComputedStyle(e);
          const inline = new DOMMatrix(e.style.transform || undefined).m22;
          const actual = new DOMMatrix(s.transform === 'none' ? undefined : s.transform).m22;
          window.__barFrames.push({ inline, actual, transition: s.transitionProperty, origin: s.transformOrigin,
            bottom: e.getBoundingClientRect().bottom, height: e.offsetHeight });
        }
      });
      observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['style'] });
      window.__barObserver = observer;
    });
    await page.getByTestId('tab-analytics').click();
    await page.locator('.analytics-bar').first().waitFor({ state: 'attached' });
    await page.waitForTimeout(550);
    await page.emulateMedia({ reducedMotion: 'reduce' }); await afterMediaPaint(page);
    const bars = await page.locator('.analytics-bar').evaluateAll(els => els.map(e => {
      const s = getComputedStyle(e); return { scale: new DOMMatrix(s.transform === 'none' ? undefined : s.transform).m22, height: e.getBoundingClientRect().height };
    }));
    assert.ok(bars.length >= 2 && bars.every(b => Math.abs(b.scale - 1) < .001), JSON.stringify(bars));
    assert.ok(bars[0].height > 0 && bars[1].height === 0, 'Only the positive inflow bar should have height');
    assert.ok((await page.getByTestId('card-received').innerText()).includes('125.50'));
    await page.screenshot({ path: path.join(output, 'analytics.png') });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
  });
  await check('Chart has one animation owner and grows from its bottom baseline', async () => {
    const frames = await page.evaluate(() => { window.__barObserver.disconnect(); return window.__barFrames; });
    assert.ok(frames.length > 0);
    assert.ok(frames.every(f => !['all', 'transform', 'height'].some(p => f.transition.split(',').map(s => s.trim()).includes(p))),
      'CSS transitions compete with GSAP: ' + JSON.stringify(frames.slice(0, 3)));
    assert.ok(frames.every(f => Math.abs(f.inline - f.actual) < .035), 'Computed bar scale lags behind GSAP');
    const positive = frames.filter(f => f.height > 0);
    assert.ok(positive.some(f => f.actual < .05) && positive.some(f => f.actual > .1 && f.actual < .95), 'Missing baseline-to-height progression');
    assert.ok(positive.every(f => Math.abs(parseFloat(f.origin.split(' ')[1]) - f.height) < 1), 'Transform origin must remain at the bottom');
    assert.ok(Math.max(...positive.map(f => f.bottom)) - Math.min(...positive.map(f => f.bottom)) < 1, 'Bar baseline moves during growth');
  });
  await check('New chart groups enter after period changes; existing summaries stay settled', async () => {
    for (const period of ['month', 'year']) {
      await tracePanelOpening(page, '.analytics-bar');
      await page.getByTestId('period-' + period).click();
      await page.waitForTimeout(650);
      const frames = await openingFrames(page);
      assert.ok(frames.some(f => f.opacity === 1), 'No chart data observed for ' + period);
      const scales = await page.locator('.analytics-bar').evaluateAll(els => els.map(e => {
        const s = getComputedStyle(e);
        return { scale: new DOMMatrix(s.transform === 'none' ? undefined : s.transform).m22, origin: s.transformOrigin, height: e.offsetHeight };
      }));
      assert.ok(scales.length >= 2 && scales.every(f => Math.abs(f.scale - 1) < .001 && Math.abs(parseFloat(f.origin.split(' ')[1]) - f.height) < 1), JSON.stringify(scales));
      await settledCards(page);
    }
  });
  await check('Reports, products, customers and settings have scoped entry motion', async () => {
    for (const tab of ['reports', 'products', 'customers', 'settings']) {
      await tracePanelOpening(page, '[data-screen-entry]');
      await page.getByTestId('tab-' + tab).click();
      await page.waitForTimeout(600);
      const frames = await openingFrames(page);
      assert.ok(frames.some(f => f.y > 0 && f.opacity < 1), tab + ' has no screen entrance: ' + JSON.stringify(frames.slice(0, 5)));
      await settledPanel(page.locator('[data-screen-entry]').first());
    }
  });
  await check('Rapid route changes settle the final active capsule', async () => {
    await page.evaluate(async () => { for (const tab of ['reports', 'cashbook', 'dashboard', 'reports']) {
      document.querySelector(`[data-testid="tab-${tab}"]`).click(); await new Promise(r => setTimeout(r, 35));
    } });
    await page.waitForTimeout(700); aligned(await capsule(page));
  });
  await check('Keyboard navigation settles without decorative travel', async () => {
    await page.getByTestId('tab-cashbook').focus(); await page.keyboard.press('Enter'); await page.waitForTimeout(30);
    aligned(await capsule(page));
  });
  await check('Cashbook cards settle immediately on a live reduced-motion change', async () => {
    await page.getByTestId('tab-reports').click(); await page.waitForTimeout(500);
    await page.getByTestId('tab-cashbook').click(); await page.emulateMedia({ reducedMotion: 'reduce' });
    await afterMediaPaint(page); await settledCards(page);
  });
  await check('Mobile secondary destination marks More', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByTestId('mobile-nav-more').click(); await page.getByTestId('mobile-tab-settings').click();
    await page.waitForTimeout(120); aligned(await capsule(page, true));
    await page.screenshot({ path: path.join(output, 'mobile-settings.png') });
  });
  await check('Keyboard selection inside More settles the More capsule immediately', async () => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.getByTestId('mobile-tab-reports').click(); await page.waitForTimeout(650);
    await page.getByTestId('mobile-nav-more').focus(); await page.keyboard.press('Enter');
    await page.getByTestId('mobile-tab-customers').focus(); await page.keyboard.press('Enter');
    await page.waitForTimeout(35); aligned(await capsule(page, true));
  });
  await check('Pointer opens More with a short entry and Escape closes without waiting', async () => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await tracePanelOpening(page, '#mobile-more-navigation');
    await page.getByTestId('mobile-nav-more').click();
    const drawer = page.locator('#mobile-more-navigation');
    const frames = await openingFrames(page);
    assert.ok(await drawer.evaluate(e => e.contains(document.activeElement)), 'Focus enters immediately');
    await page.waitForTimeout(300); await settledPanel(drawer);
    await page.screenshot({ path: path.join(output, 'drawer-open.png') });
    await page.keyboard.press('Escape'); assert.equal(await drawer.count(), 0);
    assert.ok(await page.getByTestId('mobile-nav-more').evaluate(e => e === document.activeElement));
    assert.ok(frames.some(s => s.y > 0 && s.y <= 16 && s.opacity < 1), 'No drawer entry motion: ' + JSON.stringify(frames));
  });
  await check('Drawer reduced-motion change settles live; rapid reopen leaves no stale motion', async () => {
    await page.getByTestId('mobile-nav-more').click();
    await page.emulateMedia({ reducedMotion: 'reduce' }); await afterMediaPaint(page);
    await settledPanel(page.locator('#mobile-more-navigation'));
    await page.keyboard.press('Escape');
    await page.getByTestId('mobile-nav-more').focus(); await page.keyboard.press('Enter');
    await settledPanel(page.locator('#mobile-more-navigation')); await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => document.body.style.overflow), '');
  });
  await check('Pointer receipt dialog enters and remains immediately usable', async () => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.getByTestId('mobile-tab-cashbook').click();
    await tracePanelOpening(page, '.cashbook-screen [role="dialog"] > div');
    await page.getByTestId('action-receive-money').click();
    const dialog = page.getByRole('dialog'); const panel = dialog.locator(':scope > div').first();
    const frames = await openingFrames(page);
    assert.ok(await dialog.evaluate(e => e.contains(document.activeElement)));
    await page.getByTestId('input-voucher-amount').fill('25.50');
    assert.equal(await page.getByTestId('input-voucher-amount').inputValue(), '25.50');
    await page.waitForTimeout(300); await settledPanel(panel);
    await page.screenshot({ path: path.join(output, 'receipt-dialog.png') });
    await page.keyboard.press('Escape'); assert.equal(await page.getByRole('dialog').count(), 0);
    assert.ok(frames.some(s => s.y > 0 && s.y <= 12 && s.opacity < 1), 'No dialog entry motion: ' + JSON.stringify(frames));
  });
  await check('Dialog live reduced motion, nested focus and immediate dismissal remain correct', async () => {
    await page.getByTestId('action-receive-money').click();
    await page.emulateMedia({ reducedMotion: 'reduce' }); await afterMediaPaint(page);
    await settledPanel(page.getByRole('dialog').locator(':scope > div').first());
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.getByTestId('action-new-category').focus(); await page.keyboard.press('Enter');
    const child = page.getByRole('dialog'); assert.equal(await child.count(), 1);
    await settledPanel(child.locator(':scope > div').first());
    for (let i = 0; i < 8; i++) { await page.keyboard.press('Tab'); assert.ok(await child.evaluate(e => e.contains(document.activeElement))); }
    await page.keyboard.press('Escape'); assert.equal(await page.getByRole('dialog').count(), 1);
    assert.ok(await page.getByTestId('action-new-category').evaluate(e => e === document.activeElement));
    assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden');
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => document.body.style.overflow), '');
  });
  await check('Android Back bridge event dismisses a dialog during entry', async () => {
    await page.getByTestId('action-receive-money').click();
    await page.evaluate(() => window.dispatchEvent(new Event('billzen-back-button')));
    await page.waitForFunction(() => !document.querySelector('.cashbook-screen [role="dialog"]'));
    assert.equal(await page.evaluate(() => document.body.style.overflow), '');
    assert.ok(await page.getByTestId('action-receive-money').evaluate(e => e === document.activeElement));
  });
  await check('RTL capsule and selected text remain aligned in both themes', async () => {
    for (const theme of ['light', 'dark']) {
      const rtl = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'no-preference', colorScheme: theme });
      await rtl.addInitScript(mode => {
        localStorage.setItem('billzen_guide_status', 'completed'); localStorage.setItem('billzen_ui_language', 'ar');
        localStorage.setItem('billzen_appearance_pref', mode);
      }, theme);
      const p = await rtl.newPage(); await p.goto(base, { waitUntil: 'networkidle' });
      assert.equal(await p.locator('html').getAttribute('dir'), 'rtl');
      for (const tab of ['cashbook', 'reports', 'dashboard']) { await p.getByTestId('tab-' + tab).click(); await p.waitForTimeout(650); aligned(await capsule(p)); }
      await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(100); aligned(await capsule(p, true));
      assert.ok((await capsule(p, true)).labelAbove);
      await p.screenshot({ path: path.join(output, `rtl-${theme}.png`) }); await rtl.close();
    }
  });
  await check('No browser runtime exceptions', () => assert.deepEqual(errors, []));
} finally {
  fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(results, null, 2));
  await browser?.close(); server.kill('SIGTERM');
}
const failures = results.filter(r => !r.passed);
console.log(`${results.length - failures.length}/${results.length} motion scenarios passed`);
if (failures.length) process.exitCode = 1;
