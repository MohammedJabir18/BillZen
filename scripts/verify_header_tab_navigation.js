import { chromium } from 'playwright';
import { spawn } from 'child_process';
import path from 'path';

async function main() {
  console.log('=== Step 1: Starting Vite preview on port 4189 ===');
  const previewProcess = spawn('npx', ['vite', 'preview', '--port', '4189', '--strictPort'], {
    cwd: process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  });

  const killPreviewGroup = () => {
    if (previewProcess && previewProcess.pid) {
      try {
        process.kill(-previewProcess.pid, 'SIGTERM');
      } catch {}
    }
  };

  process.on('SIGINT', () => { killPreviewGroup(); process.exit(130); });
  process.on('SIGTERM', () => { killPreviewGroup(); process.exit(143); });
  process.on('exit', () => killPreviewGroup());

  let serverReady = false;
  previewProcess.stdout.on('data', (d) => {
    const str = d.toString();
    if (str.includes('4189')) {
      serverReady = true;
    }
  });

  for (let i = 0; i < 40; i++) {
    if (serverReady) break;
    await new Promise((r) => setTimeout(r, 200));
  }
  console.log('Vite preview is ready at http://localhost:4189');

  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--font-render-hinting=none'],
  });

  try {
    // 1. Desktop Tab navigation verification
    {
      console.log('\n--- Verifying Desktop Header Tab Navigation (1280px) ---');
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      const page = await context.newPage();
      await page.goto('http://localhost:4189');
      await page.waitForLoadState('networkidle');

      // Dismiss guide if present
      const guideSkipBtn = await page.$('[data-testid="guide-skip-button"], [data-testid="guide-close-button"]');
      if (guideSkipBtn) {
        await guideSkipBtn.click();
        await page.waitForTimeout(300);
      }

      // Tab navigation
      console.log('Tabbing through header...');
      await page.keyboard.press('Tab'); // First focusable element

      const activeTag = await page.evaluate(() => document.activeElement ? document.activeElement.tagName + '#' + (document.activeElement.id || document.activeElement.getAttribute('data-testid')) : null);
      console.log(`First tab active element: ${activeTag}`);

      // Continue tabbing until language selector is focused
      let langSelectFocused = false;
      for (let i = 0; i < 5; i++) {
        const isLang = await page.evaluate(() => {
          const el = document.activeElement;
          return el && el.getAttribute('data-testid') === 'language-select';
        });
        if (isLang) {
          langSelectFocused = true;
          break;
        }
        await page.keyboard.press('Tab');
      }

      if (!langSelectFocused) {
        throw new Error('Language selector was not reached via Tab navigation!');
      }
      console.log('PASS: Language selector reached via keyboard Tab navigation.');

      // Check visible focus indicator on language selector or parent
      const focusRingStyle = await page.evaluate(() => {
        const el = document.querySelector('[data-testid="language-select"]');
        const parent = el ? el.parentElement : null;
        if (!parent) return null;
        const comp = getComputedStyle(parent);
        return {
          boxShadow: comp.boxShadow,
          borderColor: comp.borderColor,
          outline: comp.outline,
        };
      });
      console.log('Language select focus ring styles:', JSON.stringify(focusRingStyle));
      const hasOutline = focusRingStyle.outline && focusRingStyle.outline.includes('solid') && !focusRingStyle.outline.includes('none');
      if (!hasOutline) {
        throw new Error('Language selector does not have a visible focus outline on focus-within! Got: ' + JSON.stringify(focusRingStyle));
      }
      console.log('PASS: Language selector has visible focus outline: ' + focusRingStyle.outline);

      // Continue tabbing through desktop nav tabs
      const expectedTabs = ['tab-dashboard', 'tab-cashbook', 'tab-reports', 'tab-products', 'tab-customers', 'tab-settings', 'tab-print'];
      for (const tab of expectedTabs) {
        await page.keyboard.press('Tab');
        const focusedTestId = await page.evaluate(() => document.activeElement ? document.activeElement.getAttribute('data-testid') : null);
        console.log(`Tabbed to: ${focusedTestId} (expected: ${tab})`);
        if (focusedTestId !== tab) {
          throw new Error(`Expected focus on ${tab}, but got ${focusedTestId}`);
        }
      }
      console.log('PASS: All 7 desktop navigation tabs reachable sequentially via Tab key.');
      await context.close();
    }

    // 2. Mobile Tab navigation verification
    {
      console.log('\n--- Verifying Mobile Header Tab Navigation (390px) ---');
      const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
      const page = await context.newPage();
      await page.goto('http://localhost:4189');
      await page.waitForLoadState('networkidle');

      const guideSkipBtn = await page.$('[data-testid="guide-skip-button"], [data-testid="guide-close-button"]');
      if (guideSkipBtn) {
        await guideSkipBtn.click();
        await page.waitForTimeout(300);
      }

      // Tab should reach language selector
      let langSelectFocused = false;
      for (let i = 0; i < 5; i++) {
        await page.keyboard.press('Tab');
        const isLang = await page.evaluate(() => {
          const el = document.activeElement;
          return el && el.getAttribute('data-testid') === 'language-select';
        });
        if (isLang) {
          langSelectFocused = true;
          break;
        }
      }
      if (!langSelectFocused) {
        throw new Error('Mobile: Language selector was not reached via Tab navigation!');
      }
      console.log('PASS: Mobile: Language selector reached via keyboard Tab navigation.');
      await context.close();
    }

    console.log('\n=== All Header Keyboard Tab Navigation checks PASSED! ===');
  } finally {
    await browser.close();
    killPreviewGroup();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
