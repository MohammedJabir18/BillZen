import { navigateToAppTab } from './lib/navigation.js';
import { chromium } from 'playwright';
import { spawn, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

const ARTIFACTS_DIR = path.resolve(process.cwd(), 'test_artifacts/responsive');
if (!fs.existsSync(ARTIFACTS_DIR)) {
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
}

const VIEWPORTS = [
  { name: 'phone_320_small', width: 320, height: 640, isMobile: true },
  { name: 'phone_360_standard', width: 360, height: 740, isMobile: true },
  { name: 'phone_390_iphone', width: 390, height: 844, isMobile: true },
  { name: 'phone_412_pixel', width: 412, height: 915, isMobile: true },
  { name: 'tablet_768_portrait', width: 768, height: 1024, isMobile: true },
  { name: 'desktop_1280_landscape', width: 1280, height: 800, isMobile: false },
];

async function main() {
  console.log('=== Step 1: Building production frontend with tsc && vite build ===');
  execSync('npm run build', { stdio: 'inherit' });

  console.log('\n=== Step 2: Starting Vite preview on port 4177 ===');
  const previewProcess = spawn('npx', ['vite', 'preview', '--port', '4177', '--strictPort'], {
    cwd: process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  });

  const killPreviewGroup = () => {
    if (previewProcess && previewProcess.pid) {
      try {
        process.kill(-previewProcess.pid, 'SIGTERM');
      } catch {
        // Already dead
      }
    }
  };

  process.on('SIGINT', () => { killPreviewGroup(); process.exit(130); });
  process.on('SIGTERM', () => { killPreviewGroup(); process.exit(143); });
  process.on('exit', () => killPreviewGroup());

  let serverReady = false;
  previewProcess.stdout.on('data', (d) => {
    const str = d.toString();
    if (str.includes('4177')) {
      serverReady = true;
    }
  });

  for (let i = 0; i < 40; i++) {
    if (serverReady) break;
    await new Promise((r) => setTimeout(r, 200));
  }
  console.log('Vite preview is ready at http://localhost:4177');

  let browser;
  try {
    browser = await chromium.launch({
      channel: 'chrome',
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--font-render-hinting=none'],
    });
  } catch {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--font-render-hinting=none'],
    });
  }

  const report = {
    timestamp: new Date().toISOString(),
    viewportsTested: VIEWPORTS.length,
    tests: [],
    allPassed: true,
  };

  try {
    for (const vp of VIEWPORTS) {
      console.log(`\n--- Testing Viewport: ${vp.name} (${vp.width}x${vp.height}) ---`);
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: 2,
      });

      const page = await context.newPage();
      await page.goto('http://localhost:4177', { waitUntil: 'networkidle' });
      await page.waitForTimeout(300);

      // Dismiss getting-started guide if visible
      const guideSkipBtn = await page.$('[data-testid="guide-skip-button"], [data-testid="guide-close-button"]');
      if (guideSkipBtn) {
        await guideSkipBtn.click();
        await page.waitForTimeout(300);
      }

      // 1. Verify No Horizontal Scrolling on initial load
      const hasHorizontalScrollInitial = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth;
      });
      console.log(`  Initial horizontal scroll overflow: ${hasHorizontalScrollInitial ? 'FAIL (Detected)' : 'PASS (None)'}`);

      // 2. Verify Navigation Bar Placement
      let navModeValid = false;
      if (vp.width < 1024) {
        // Mobile bottom navigation bar should be visible
        const bottomNavVisible = await page.isVisible('[data-testid="mobile-tab-dashboard"]');
        navModeValid = bottomNavVisible;
        console.log(`  Mobile bottom nav bar visible: ${bottomNavVisible}`);
      } else {
        // Desktop top header tabs should be visible
        const desktopTabVisible = await page.isVisible('[data-testid="tab-products"]');
        navModeValid = desktopTabVisible;
        console.log(`  Desktop navigation tabs visible: ${desktopTabVisible}`);
      }

      // 3. Test Add Product Modal and Form Scrollability (Navigate to Products tab first)
      await navigateToAppTab(page, 'products');
      await page.waitForTimeout(200);

      const addBtn = await page.$('[data-testid="add-product-button"], [data-testid="mobile-add-product-button"]');
      let modalOpenedCleanly = false;
      if (addBtn) {
        await addBtn.click();
        await page.waitForSelector('[data-testid="input-product-name"]');
        
        // Check for overflow while modal is open
        const modalOverflow = await page.evaluate(() => {
          return document.documentElement.scrollWidth > window.innerWidth;
        });
        modalOpenedCleanly = !modalOverflow;
        console.log(`  Modal opened without horizontal overflow: ${modalOpenedCleanly}`);

        // Close modal
        const closeBtn = await page.$('button:has-text("Cancel"), button:has-text("റദ്ദാക്കുക")');
        if (closeBtn) {
          await closeBtn.click();
          await page.waitForTimeout(200);
        }
      } else {
        modalOpenedCleanly = false; // Missing Add button must fail verification
      }

      // 4. Test Language Switcher to Arabic (RTL)
      const langSelector = await page.$('[data-testid="language-select"]');
      let rtlValid = false;
      let rtlNoOverflow = true;
      if (langSelector) {
        await langSelector.selectOption('ar');
        await page.waitForTimeout(300);
        const dir = await page.evaluate(() => document.documentElement.dir || document.body.dir || document.querySelector('div[dir="rtl"]')?.getAttribute('dir'));
        rtlValid = dir === 'rtl';
        rtlNoOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
        console.log(`  Arabic RTL direction: ${dir} (valid: ${rtlValid}, no overflow: ${rtlNoOverflow})`);

        // Switch back to English
        await langSelector.selectOption('en');
        await page.waitForTimeout(200);
      }

      // 5. Test Navigation to Customers and Settings Tabs
      await navigateToAppTab(page, 'customers');
      await page.waitForTimeout(200);
      const customerOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      console.log(`  Customers tab horizontal scroll: ${customerOverflow ? 'FAIL (Detected)' : 'PASS (None)'}`);

      await navigateToAppTab(page, 'settings');
      await page.waitForTimeout(200);
      const settingsOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      console.log(`  Settings tab horizontal scroll: ${settingsOverflow ? 'FAIL (Detected)' : 'PASS (None)'}`);

      // Return to Products tab for screenshot
      await navigateToAppTab(page, 'products');
      await page.waitForTimeout(200);

      // Save screenshot
      const screenshotPath = path.join(ARTIFACTS_DIR, `${vp.name}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`  Saved screenshot: ${screenshotPath}`);

      const passed = !hasHorizontalScrollInitial && navModeValid && modalOpenedCleanly && rtlValid && rtlNoOverflow && !customerOverflow && !settingsOverflow;
      if (!passed) report.allPassed = false;

      report.tests.push({
        viewport: vp.name,
        width: vp.width,
        height: vp.height,
        noHorizontalScroll: !hasHorizontalScrollInitial && !customerOverflow && !settingsOverflow,
        navModeValid,
        modalOpenedCleanly,
        rtlValid,
        passed,
      });

      await context.close();
    }

    const reportPath = path.join(ARTIFACTS_DIR, 'responsive_verification_report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\nResponsive verification report written to: ${reportPath}`);
    console.log(`Overall Responsive Result: ${report.allPassed ? 'ALL PASSED' : 'FAILURES DETECTED'}`);

  } finally {
    if (browser) {
      await browser.close();
    }
    killPreviewGroup();
  }

  if (!report.allPassed) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Fatal responsive test error:', err);
  process.exit(1);
});
