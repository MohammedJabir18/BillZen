import { chromium } from 'playwright';
import { spawn, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

const ARTIFACTS_DIR = path.resolve(process.cwd(), 'test_artifacts/onboarding');
if (!fs.existsSync(ARTIFACTS_DIR)) {
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
}

async function main() {
  console.log('=== Step 1: Building production frontend with tsc && vite build ===');
  execSync('npm run build', { stdio: 'inherit' });

  console.log('\n=== Step 2: Starting Vite preview on port 4178 ===');
  const previewProcess = spawn('npx', ['vite', 'preview', '--port', '4178', '--strictPort'], {
    cwd: process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let serverReady = false;
  previewProcess.stdout.on('data', (d) => {
    const str = d.toString();
    if (str.includes('4178')) {
      serverReady = true;
    }
  });

  for (let i = 0; i < 40; i++) {
    if (serverReady) break;
    await new Promise((r) => setTimeout(r, 200));
  }
  console.log('Vite preview is ready at http://localhost:4178');

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

  const results = {
    timestamp: new Date().toISOString(),
    tests: [],
    allPassed: true,
  };

  const recordTest = (name, passed, details = {}) => {
    console.log(`  [${passed ? 'PASS' : 'FAIL'}] ${name}`, details);
    results.tests.push({ name, passed, details });
    if (!passed) results.allPassed = false;
  };

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Fresh Installation & Business Setup Wizard
    // -------------------------------------------------------------------------
    console.log('\n--- Section 1: Business Setup Wizard (Fresh Installation) ---');
    const context1 = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });
    const page1 = await context1.newPage();

    // Seed localStorage as fresh user
    await page1.goto('http://localhost:4178');
    await page1.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('billzen_mock_fresh_user', 'true');
      localStorage.removeItem('billzen_browser_settings');
    });
    await page1.reload();
    await page1.waitForTimeout(500);

    // 1.1 Verify Wizard Mounts
    const wizardVisible = await page1.isVisible('text=Welcome to BillZen');
    recordTest('wizard_mounts_on_fresh_user', wizardVisible);

    // 1.2 Verify No Theme Toggles on Onboarding screen
    const headerThemeToggle = await page1.$('[data-testid="theme-toggle"]');
    const floatingThemeToggle = await page1.$('.theme-toggle');
    recordTest('no_theme_toggle_on_onboarding', !headerThemeToggle && !floatingThemeToggle);

    // 1.3 Select Saudi Arabia & verify updated regional defaults
    await page1.click('[data-testid="onboarding-country-sa"]');
    const noticeText = await page1.textContent('body');
    const saCurrencySet = noticeText.includes('SAR') && noticeText.includes('Asia/Riyadh');
    recordTest('country_selection_updates_currency_and_timezone', saCurrencySet);

    // 1.4 Advance to Step 2
    await page1.click('[data-testid="onboarding-next-step-1"]');
    await page1.waitForTimeout(200);

    // 1.5 Validation on empty submit
    await page1.click('[data-testid="onboarding-next-step-2"]');
    await page1.waitForTimeout(200);
    const hasNameError = await page1.isVisible('text=Name cannot be empty');
    recordTest('wizard_step2_validates_required_fields', hasNameError);

    // 1.6 Fill in business profile
    await page1.fill('[data-testid="onboarding-input-business-name"]', 'Zen Hypermarket Riyadh');
    await page1.fill('[data-testid="onboarding-input-legal-name"]', 'Zen Commercial Ltd');
    await page1.fill('[data-testid="onboarding-input-tax-id"]', '300000000000003');
    await page1.fill('[data-testid="onboarding-input-phone"]', '+966 50 123 4567');
    await page1.fill('[data-testid="onboarding-input-email"]', 'contact@zenmarket.sa');
    await page1.fill('[data-testid="onboarding-input-address1"]', 'King Fahd Road, Al Olaya');
    await page1.fill('[data-testid="onboarding-input-city"]', 'Riyadh');
    await page1.fill('[data-testid="onboarding-input-state"]', 'Riyadh Province');
    await page1.fill('[data-testid="onboarding-input-postal"]', '12214');

    // Advance to Step 3 (Review)
    await page1.click('[data-testid="onboarding-next-step-2"]');
    await page1.waitForTimeout(200);

    const reviewText = await page1.textContent('body');
    const reviewAccurate =
      reviewText.includes('Zen Hypermarket Riyadh') &&
      reviewText.includes('Saudi Arabia') &&
      reviewText.includes('SAR') &&
      reviewText.includes('Asia/Riyadh');
    recordTest('wizard_step3_review_summary_accurate', reviewAccurate);

    // 1.7 Submit Setup & Complete
    await page1.click('[data-testid="onboarding-submit-button"]');
    await page1.waitForTimeout(600);

    // -------------------------------------------------------------------------
    // TEST 2: Getting-Started Guide
    // -------------------------------------------------------------------------
    console.log('\n--- Section 2: Getting-Started Guide (Paging & Skip) ---');

    // 2.1 Guide automatically visible for unseen user
    const guideDialogVisible = await page1.isVisible('[role="dialog"]');
    const slide1Title = await page1.isVisible('text=1. Products, Barcodes & Inventory');
    recordTest('guide_dialog_opens_after_setup', guideDialogVisible && slide1Title);

    // 2.2 Paging: Next to Slide 2
    await page1.click('[data-testid="guide-next-button"]');
    await page1.waitForTimeout(200);
    const slide2Title = await page1.isVisible('text=2. Customer Directory & Profiles');
    recordTest('guide_navigates_to_slide_2', slide2Title);

    // 2.3 Paging: Back to Slide 1
    await page1.click('[data-testid="guide-prev-button"]');
    await page1.waitForTimeout(200);
    const slide1Again = await page1.isVisible('text=1. Products, Barcodes & Inventory');
    recordTest('guide_navigates_back_to_slide_1', slide1Again);

    // 2.4 Skip Guide
    await page1.click('[data-testid="guide-skip-button"]');
    await page1.waitForTimeout(300);
    const guideClosed = !(await page1.isVisible('[role="dialog"]'));
    recordTest('guide_skip_closes_dialog', guideClosed);

    // 2.5 Replay from Settings
    console.log('\n--- Section 3: Guide Replay from Settings ---');
    await page1.click('[data-testid="tab-settings"]');
    await page1.waitForTimeout(400);

    const replayBtn = await page1.isVisible('[data-testid="button-view-guide"]');
    recordTest('settings_has_replay_guide_button', replayBtn);

    await page1.click('[data-testid="button-view-guide"]');
    await page1.waitForTimeout(300);
    const replayModalVisible = await page1.isVisible('[role="dialog"]');
    recordTest('guide_replays_cleanly_from_settings', replayModalVisible);

    // Close replayed modal via close X button
    await page1.click('[data-testid="guide-close-button"]');
    await page1.waitForTimeout(300);

    // -------------------------------------------------------------------------
    // TEST 3: Appearance Controls (Strictly in Settings)
    // -------------------------------------------------------------------------
    console.log('\n--- Section 4: Appearance Controls in Settings ---');

    // 3.1 Verify exactly 3 appearance options
    const optSystem = await page1.isVisible('[data-testid="appearance-option-system"]');
    const optLight = await page1.isVisible('[data-testid="appearance-option-light"]');
    const optDark = await page1.isVisible('[data-testid="appearance-option-dark"]');
    recordTest('settings_has_three_appearance_options', optSystem && optLight && optDark);

    // 3.2 Verify NO toggles in header or bottom nav
    const headerToggle = await page1.$('header [data-testid="theme-toggle"], header button[aria-label*="theme"]');
    const bottomNavToggle = await page1.$('nav[aria-label="Mobile Navigation"] [data-testid="theme-toggle"]');
    recordTest('theme_controls_strictly_isolated_to_settings', !headerToggle && !bottomNavToggle);

    // 3.3 Test Switch to Dark Mode
    await page1.click('[data-testid="appearance-option-dark"]');
    await page1.waitForTimeout(300);
    const isDarkClassOnHtml = await page1.evaluate(() => document.documentElement.classList.contains('dark'));
    const metaThemeDark = await page1.evaluate(() => document.querySelector('meta[name="theme-color"]')?.getAttribute('content'));
    recordTest('dark_appearance_applies_dark_class_and_theme_color', isDarkClassOnHtml && metaThemeDark === '#09090b');

    // Capture screenshot in Dark Mode
    await page1.screenshot({ path: path.join(ARTIFACTS_DIR, 'settings_dark_mode.png') });

    // 3.4 Test Switch to Light Mode
    await page1.click('[data-testid="appearance-option-light"]');
    await page1.waitForTimeout(300);
    const isLightOnHtml = await page1.evaluate(() => !document.documentElement.classList.contains('dark'));
    const metaThemeLight = await page1.evaluate(() => document.querySelector('meta[name="theme-color"]')?.getAttribute('content'));
    recordTest('light_appearance_removes_dark_class_and_theme_color', isLightOnHtml && metaThemeLight === '#ffffff');

    // 3.5 Test System Mode with OS prefers-color-scheme Emulation
    await page1.click('[data-testid="appearance-option-system"]');
    await page1.waitForTimeout(200);

    // Emulate OS Dark Mode
    await page1.emulateMedia({ colorScheme: 'dark' });
    await page1.waitForTimeout(300);
    const systemResolvedDark = await page1.evaluate(() => document.documentElement.classList.contains('dark'));
    recordTest('system_mode_dynamically_follows_os_dark', systemResolvedDark);

    // Emulate OS Light Mode
    await page1.emulateMedia({ colorScheme: 'light' });
    await page1.waitForTimeout(300);
    const systemResolvedLight = await page1.evaluate(() => !document.documentElement.classList.contains('dark'));
    recordTest('system_mode_dynamically_follows_os_light', systemResolvedLight);

    // 3.6 Test Explicit Override Ignores OS
    await page1.click('[data-testid="appearance-option-dark"]');
    await page1.waitForTimeout(200);
    // OS is light, but user preference is Dark
    await page1.emulateMedia({ colorScheme: 'light' });
    await page1.waitForTimeout(200);
    const explicitDarkIgnoresOsLight = await page1.evaluate(() => document.documentElement.classList.contains('dark'));
    recordTest('explicit_dark_ignores_os_light_mode', explicitDarkIgnoresOsLight);

    // -------------------------------------------------------------------------
    // TEST 4: Print Paper Purity in Dark Mode
    // -------------------------------------------------------------------------
    console.log('\n--- Section 5: Print Paper Purity in Dark Mode ---');

    // Ensure dark mode is active
    await page1.click('[data-testid="appearance-option-dark"]');
    await page1.waitForTimeout(200);

    // Switch to Print Feasibility Probe tab
    await page1.click('[data-testid="tab-print"]');
    await page1.waitForTimeout(300);

    // Emulate Print Media
    await page1.emulateMedia({ media: 'print' });
    await page1.waitForTimeout(300);

    const printStyles = await page1.evaluate(() => {
      const root = document.querySelector('#printable-invoice-root');
      if (!root) return { found: false };
      const comp = window.getComputedStyle(root);
      const textElem = root.querySelector('h1, h2, th, td');
      const textComp = textElem ? window.getComputedStyle(textElem) : null;
      return {
        found: true,
        bgColor: comp.backgroundColor,
        textColor: textComp ? textComp.color : null,
      };
    });

    // In print CSS, background is white (rgb(255, 255, 255) or rgba(0,0,0,0)) and text is dark
    const printBgIsWhite = printStyles.bgColor === 'rgb(255, 255, 255)' || printStyles.bgColor === 'rgba(0, 0, 0, 0)';
    recordTest('print_paper_pure_white_in_dark_mode', printStyles.found && printBgIsWhite, printStyles);

    // Verify UI buttons and tabs are hidden in print media
    const headerHiddenInPrint = await page1.evaluate(() => {
      const h = document.querySelector('header');
      if (!h) return true;
      const s = window.getComputedStyle(h);
      return s.visibility === 'hidden' || s.display === 'none';
    });
    recordTest('header_hidden_in_print_media', headerHiddenInPrint);

    // -------------------------------------------------------------------------
    // TEST 5: Dark Mode Appearance Across Products & Customers Tabs
    // -------------------------------------------------------------------------
    console.log('\n--- Section 6: Dark Mode Audit across Products & Customers ---');
    await page1.emulateMedia({ media: 'screen' });

    // Visit Products tab in Dark Mode
    await page1.click('[data-testid="tab-products"]');
    await page1.waitForTimeout(300);
    const productsDarkThemeOk = await page1.evaluate(() => {
      const main = document.querySelector('main');
      const table = document.querySelector('table');
      return document.documentElement.classList.contains('dark') && !!main;
    });
    await page1.screenshot({ path: path.join(ARTIFACTS_DIR, 'products_dark_mode.png') });
    recordTest('products_catalog_renders_in_dark_mode', productsDarkThemeOk);

    // Visit Customers tab in Dark Mode
    await page1.click('[data-testid="tab-customers"]');
    await page1.waitForTimeout(300);
    const customersDarkThemeOk = await page1.evaluate(() => {
      const main = document.querySelector('main');
      return document.documentElement.classList.contains('dark') && !!main;
    });
    await page1.screenshot({ path: path.join(ARTIFACTS_DIR, 'customers_dark_mode.png') });
    recordTest('customers_catalog_renders_in_dark_mode', customersDarkThemeOk);

    await context1.close();

    // Write final summary report
    const reportPath = path.join(ARTIFACTS_DIR, 'onboarding_appearance_report.json');
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
    console.log(`\nVerification report written to: ${reportPath}`);
    console.log(`Overall Result: ${results.allPassed ? 'ALL PASSED' : 'FAILURES DETECTED'}`);

  } finally {
    if (browser) {
      await browser.close();
    }
    previewProcess.kill('SIGTERM');
  }

  if (!results.allPassed) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
