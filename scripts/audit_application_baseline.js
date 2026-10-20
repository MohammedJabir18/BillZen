import { spawn, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';

const ARTIFACTS_DIR = path.resolve('test_artifacts/audit');
if (!fs.existsSync(ARTIFACTS_DIR)) {
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
}

async function waitForServer(url, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  throw new Error(`Server at ${url} failed to respond within ${timeoutMs}ms`);
}

async function runAudit() {
  console.log('=== Step 1: Building production frontend for audit ===');
  execSync('npm run build', { stdio: 'inherit' });

  const PORT = 4192;
  const BASE_URL = `http://localhost:${PORT}`;

  console.log(`\n=== Step 2: Starting Vite preview server on port ${PORT} ===`);
  const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
    stdio: 'ignore',
    env: { ...process.env, PORT: String(PORT) },
    detached: true,
  });

  const killServer = () => {
    if (server && server.pid) {
      try {
        process.kill(-server.pid, 'SIGTERM');
      } catch {}
    }
  };

  process.on('SIGINT', () => { killServer(); process.exit(130); });
  process.on('SIGTERM', () => { killServer(); process.exit(143); });
  process.on('exit', () => killServer());

  await waitForServer(BASE_URL);
  console.log(`Server ready at ${BASE_URL}`);

  let browser;
  try {
    browser = await chromium.launch({
      channel: 'chrome',
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--font-render-hinting=none'],
    });
  } catch (e) {
    console.error('Failed to launch browser with channel chrome:', e);
    killServer();
    process.exit(1);
  }

  const screenshots = [];

  try {
    // -------------------------------------------------------------
    // Context 1: First-Run Desktop for Setup Wizard & Guide (1280x800)
    // -------------------------------------------------------------
    console.log('\n--- Auditing Onboarding & First-Run Desktop (1280x800) ---');
    const firstRunContext = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });
    const firstRunPage = await firstRunContext.newPage();

    await firstRunPage.goto(`${BASE_URL}/?tab=dashboard`);
    await firstRunPage.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('billzen_mock_fresh_user', 'true');
      localStorage.removeItem('billzen_browser_settings');
    });
    await firstRunPage.reload();
    await firstRunPage.waitForLoadState('networkidle');

    // 1. Setup Wizard
    await firstRunPage.waitForSelector('text=Welcome to BillZen', { timeout: 6000 });
    await firstRunPage.waitForSelector('[data-testid="onboarding-next-step-1"]', { timeout: 6000 });
    let p = path.join(ARTIFACTS_DIR, '01_desktop_onboarding_wizard.png');
    await firstRunPage.screenshot({ path: p });
    screenshots.push({
      id: '01',
      screen: 'Onboarding',
      state: 'Setup Wizard Initial Gate',
      viewport: { width: 1280, height: 800 },
      language: 'en',
      theme: 'light',
      path: 'test_artifacts/audit/01_desktop_onboarding_wizard.png',
      timestamp: new Date().toISOString()
    });
    await firstRunContext.close();

    // 2. Getting Started Guide Dialog Context (Triggered via Settings view-guide)
    console.log('\n--- Auditing Getting Started Guide Dialog (1280x800) ---');
    const guideContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const guidePage = await guideContext.newPage();
    await guidePage.addInitScript(() => {
      localStorage.removeItem('billzen_mock_fresh_user');
      localStorage.setItem('billzen_theme_preference', 'light');
      localStorage.setItem('billzen_ui_language', 'en');
      localStorage.setItem('billzen_browser_settings', JSON.stringify({
        id: 'default',
        business_name: 'Apex Store',
        legal_name: null,
        tax_identifier: '32AAAAA0000A1Z5',
        phone: '+91 9876543210',
        email: 'store@billzen.local',
        address_line1: '123 Market Road',
        address_line2: null,
        city: 'Kochi',
        state: 'Kerala',
        postal_code: '682001',
        country: 'IND',
        currency_code: 'INR',
        currency_symbol: '₹',
        currency_exponent: 2,
        locale: 'en-IN',
        timezone: 'Asia/Kolkata',
        invoice_prefix: 'INV',
        terms_and_conditions: 'Thank you for your business!',
        is_setup_completed: true,
        appearance_preference: 'light',
        guide_status: 'completed',
        guide_version: 1,
        created_at: Date.now(),
        updated_at: Date.now(),
      }));
    });
    await guidePage.goto(`${BASE_URL}/?tab=settings`);
    await guidePage.waitForLoadState('networkidle');
    const viewGuideBtn = await guidePage.waitForSelector('[data-testid="button-view-guide"]');
    await viewGuideBtn.click();
    await guidePage.waitForSelector('[data-testid="guide-close-button"]', { timeout: 6000 });
    p = path.join(ARTIFACTS_DIR, '02_desktop_getting_started_guide.png');
    await guidePage.screenshot({ path: p });
    screenshots.push({
      id: '02',
      screen: 'Onboarding',
      state: 'Getting Started Guide Dialog',
      viewport: { width: 1280, height: 800 },
      language: 'en',
      theme: 'light',
      path: 'test_artifacts/audit/02_desktop_getting_started_guide.png',
      timestamp: new Date().toISOString()
    });
    await guideContext.close();

    // -------------------------------------------------------------
    // Context 2: Desktop Operational (1280x800)
    // -------------------------------------------------------------
    console.log('\n--- Auditing Operational Desktop Views (1280x800) ---');
    const desktopContext = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });
    const desktopPage = await desktopContext.newPage();
    await desktopPage.addInitScript(() => {
      localStorage.removeItem('billzen_mock_fresh_user');
      localStorage.setItem('billzen_theme_preference', 'light');
      localStorage.setItem('billzen_ui_language', 'en');
      localStorage.setItem('billzen_browser_settings', JSON.stringify({
        id: 'default',
        business_name: 'Apex Store (Operational)',
        legal_name: null,
        tax_identifier: '32AAAAA0000A1Z5',
        phone: '+91 9876543210',
        email: 'store@billzen.local',
        address_line1: '123 Market Road',
        address_line2: null,
        city: 'Kochi',
        state: 'Kerala',
        postal_code: '682001',
        country: 'IND',
        currency_code: 'INR',
        currency_symbol: '₹',
        currency_exponent: 2,
        locale: 'en-IN',
        timezone: 'Asia/Kolkata',
        invoice_prefix: 'INV',
        terms_and_conditions: 'Thank you for your business!',
        is_setup_completed: true,
        appearance_preference: 'light',
        guide_status: 'completed',
        guide_version: 1,
        created_at: Date.now(),
        updated_at: Date.now(),
      }));
    });

    // 3. Dashboard - Simple View (Light)
    await desktopPage.goto(`${BASE_URL}/?tab=dashboard`);
    await desktopPage.waitForLoadState('networkidle');
    await desktopPage.waitForSelector('[data-testid="dashboard-view"]');
    await desktopPage.waitForSelector('[data-testid="tab-simple"]');
    p = path.join(ARTIFACTS_DIR, '03_desktop_dashboard_simple_light.png');
    await desktopPage.screenshot({ path: p });
    screenshots.push({
      id: '03',
      screen: 'Dashboard',
      state: 'Simple View (Today)',
      viewport: { width: 1280, height: 800 },
      language: 'en',
      theme: 'light',
      path: 'test_artifacts/audit/03_desktop_dashboard_simple_light.png',
      timestamp: new Date().toISOString()
    });

    // 4. Dashboard - Analytics View (Light)
    const analyticsTab = await desktopPage.waitForSelector('[data-testid="tab-analytics"]');
    await analyticsTab.click();
    await desktopPage.waitForSelector('[data-testid="analytics-bars-container"]');
    await desktopPage.waitForTimeout(300);
    p = path.join(ARTIFACTS_DIR, '04_desktop_dashboard_analytics_light.png');
    await desktopPage.screenshot({ path: p });
    screenshots.push({
      id: '04',
      screen: 'Dashboard',
      state: 'Analytics View with Multi-Bar Chart',
      viewport: { width: 1280, height: 800 },
      language: 'en',
      theme: 'light',
      path: 'test_artifacts/audit/04_desktop_dashboard_analytics_light.png',
      timestamp: new Date().toISOString()
    });

    // Return to simple view
    const simpleTab = await desktopPage.waitForSelector('[data-testid="tab-simple"]');
    await simpleTab.click();

    // 5. Cashbook View (Light)
    await desktopPage.goto(`${BASE_URL}/?tab=cashbook`);
    await desktopPage.waitForLoadState('networkidle');
    await desktopPage.waitForSelector('[data-testid="action-receive-money"]');
    p = path.join(ARTIFACTS_DIR, '05_desktop_cashbook_light.png');
    await desktopPage.screenshot({ path: p });
    screenshots.push({
      id: '05',
      screen: 'Cashbook',
      state: 'Cashbook Ledger Table (Light)',
      viewport: { width: 1280, height: 800 },
      language: 'en',
      theme: 'light',
      path: 'test_artifacts/audit/05_desktop_cashbook_light.png',
      timestamp: new Date().toISOString()
    });

    // 6. Cashbook - Receive Money Modal
    const receiveBtn = await desktopPage.waitForSelector('[data-testid="action-receive-money"]');
    await receiveBtn.click();
    await desktopPage.waitForSelector('[data-testid="input-voucher-amount"]');
    await desktopPage.waitForTimeout(300);
    p = path.join(ARTIFACTS_DIR, '06_desktop_cashbook_receive_modal.png');
    await desktopPage.screenshot({ path: p });
    screenshots.push({
      id: '06',
      screen: 'Cashbook',
      state: 'Receive Voucher Modal Dialog',
      viewport: { width: 1280, height: 800 },
      language: 'en',
      theme: 'light',
      path: 'test_artifacts/audit/06_desktop_cashbook_receive_modal.png',
      timestamp: new Date().toISOString()
    });

    const cancelVoucher1 = await desktopPage.waitForSelector('[data-testid="btn-cancel-voucher-entry"]');
    await cancelVoucher1.click();
    await desktopPage.waitForTimeout(300);

    // 7. Cashbook - Pay Money Modal
    const payBtn = await desktopPage.waitForSelector('[data-testid="action-pay-money"]');
    await payBtn.click();
    await desktopPage.waitForSelector('[data-testid="input-voucher-amount"]');
    await desktopPage.waitForTimeout(300);
    p = path.join(ARTIFACTS_DIR, '07_desktop_cashbook_pay_modal.png');
    await desktopPage.screenshot({ path: p });
    screenshots.push({
      id: '07',
      screen: 'Cashbook',
      state: 'Pay Voucher Modal Dialog',
      viewport: { width: 1280, height: 800 },
      language: 'en',
      theme: 'light',
      path: 'test_artifacts/audit/07_desktop_cashbook_pay_modal.png',
      timestamp: new Date().toISOString()
    });

    const cancelVoucher2 = await desktopPage.waitForSelector('[data-testid="btn-cancel-voucher-entry"]');
    await cancelVoucher2.click();
    await desktopPage.waitForTimeout(300);

    // 8. Reports View (Light)
    await desktopPage.goto(`${BASE_URL}/?tab=reports`);
    await desktopPage.waitForLoadState('networkidle');
    await desktopPage.waitForSelector('[data-testid="report-period-today"]');
    p = path.join(ARTIFACTS_DIR, '08_desktop_reports_light.png');
    await desktopPage.screenshot({ path: p });
    screenshots.push({
      id: '08',
      screen: 'Reports',
      state: 'Reports & Period Analysis (Light)',
      viewport: { width: 1280, height: 800 },
      language: 'en',
      theme: 'light',
      path: 'test_artifacts/audit/08_desktop_reports_light.png',
      timestamp: new Date().toISOString()
    });

    // 9. Products Catalog
    await desktopPage.goto(`${BASE_URL}/?tab=products`);
    await desktopPage.waitForLoadState('networkidle');
    await desktopPage.waitForSelector('[data-testid="add-product-button"]');
    p = path.join(ARTIFACTS_DIR, '09_desktop_products_catalog.png');
    await desktopPage.screenshot({ path: p });
    screenshots.push({
      id: '09',
      screen: 'Products',
      state: 'Product Catalog & Inventory',
      viewport: { width: 1280, height: 800 },
      language: 'en',
      theme: 'light',
      path: 'test_artifacts/audit/09_desktop_products_catalog.png',
      timestamp: new Date().toISOString()
    });

    // 10. Customers Catalog
    await desktopPage.goto(`${BASE_URL}/?tab=customers`);
    await desktopPage.waitForLoadState('networkidle');
    await desktopPage.waitForSelector('[data-testid="add-customer-button"]');
    p = path.join(ARTIFACTS_DIR, '10_desktop_customers_catalog.png');
    await desktopPage.screenshot({ path: p });
    screenshots.push({
      id: '10',
      screen: 'Customers',
      state: 'Customers & Debtor Accounts',
      viewport: { width: 1280, height: 800 },
      language: 'en',
      theme: 'light',
      path: 'test_artifacts/audit/10_desktop_customers_catalog.png',
      timestamp: new Date().toISOString()
    });

    // 11. Settings View (Light)
    await desktopPage.goto(`${BASE_URL}/?tab=settings`);
    await desktopPage.waitForLoadState('networkidle');
    await desktopPage.waitForSelector('[data-testid="appearance-option-light"]');
    p = path.join(ARTIFACTS_DIR, '11_desktop_settings_light.png');
    await desktopPage.screenshot({ path: p });
    screenshots.push({
      id: '11',
      screen: 'Settings',
      state: 'Business & Appearance Settings (Light)',
      viewport: { width: 1280, height: 800 },
      language: 'en',
      theme: 'light',
      path: 'test_artifacts/audit/11_desktop_settings_light.png',
      timestamp: new Date().toISOString()
    });

    // Switch to Dark Theme
    const darkRadio = await desktopPage.waitForSelector('[data-testid="appearance-option-dark"]');
    await darkRadio.click();
    await desktopPage.waitForTimeout(400);

    // 12. Settings View (Dark)
    p = path.join(ARTIFACTS_DIR, '12_desktop_settings_dark.png');
    await desktopPage.screenshot({ path: p });
    screenshots.push({
      id: '12',
      screen: 'Settings',
      state: 'Business & Appearance Settings (Dark)',
      viewport: { width: 1280, height: 800 },
      language: 'en',
      theme: 'dark',
      path: 'test_artifacts/audit/12_desktop_settings_dark.png',
      timestamp: new Date().toISOString()
    });

    // 13. Dashboard (Dark)
    await desktopPage.goto(`${BASE_URL}/?tab=dashboard`);
    await desktopPage.waitForLoadState('networkidle');
    await desktopPage.waitForSelector('[data-testid="dashboard-view"]');
    await desktopPage.waitForTimeout(300);
    p = path.join(ARTIFACTS_DIR, '13_desktop_dashboard_dark.png');
    await desktopPage.screenshot({ path: p });
    screenshots.push({
      id: '13',
      screen: 'Dashboard',
      state: 'Today Dashboard (Dark)',
      viewport: { width: 1280, height: 800 },
      language: 'en',
      theme: 'dark',
      path: 'test_artifacts/audit/13_desktop_dashboard_dark.png',
      timestamp: new Date().toISOString()
    });

    // 14. Cashbook (Dark)
    await desktopPage.goto(`${BASE_URL}/?tab=cashbook`);
    await desktopPage.waitForLoadState('networkidle');
    await desktopPage.waitForSelector('[data-testid="action-receive-money"]');
    await desktopPage.waitForTimeout(300);
    p = path.join(ARTIFACTS_DIR, '14_desktop_cashbook_dark.png');
    await desktopPage.screenshot({ path: p });
    screenshots.push({
      id: '14',
      screen: 'Cashbook',
      state: 'Cashbook Ledger (Dark)',
      viewport: { width: 1280, height: 800 },
      language: 'en',
      theme: 'dark',
      path: 'test_artifacts/audit/14_desktop_cashbook_dark.png',
      timestamp: new Date().toISOString()
    });

    // 15. Reports (Dark)
    await desktopPage.goto(`${BASE_URL}/?tab=reports`);
    await desktopPage.waitForLoadState('networkidle');
    await desktopPage.waitForSelector('[data-testid="report-period-today"]');
    await desktopPage.waitForTimeout(300);
    p = path.join(ARTIFACTS_DIR, '15_desktop_reports_dark.png');
    await desktopPage.screenshot({ path: p });
    screenshots.push({
      id: '15',
      screen: 'Reports',
      state: 'Reports Screen (Dark)',
      viewport: { width: 1280, height: 800 },
      language: 'en',
      theme: 'dark',
      path: 'test_artifacts/audit/15_desktop_reports_dark.png',
      timestamp: new Date().toISOString()
    });

    // 16. Arabic RTL (Dark)
    await desktopPage.goto(`${BASE_URL}/?tab=settings`, { waitUntil: 'networkidle' });
    const langSelect = desktopPage.locator('[data-testid="language-select"]');
    await langSelect.selectOption('ar');
    await desktopPage.waitForTimeout(400);
    await desktopPage.goto(`${BASE_URL}/?tab=dashboard`);
    await desktopPage.waitForLoadState('networkidle');
    await desktopPage.waitForSelector('[data-testid="dashboard-view"]');
    await desktopPage.waitForTimeout(400);
    p = path.join(ARTIFACTS_DIR, '16_desktop_dashboard_arabic_rtl_dark.png');
    await desktopPage.screenshot({ path: p });
    screenshots.push({
      id: '16',
      screen: 'Dashboard',
      state: 'Arabic RTL Dashboard (Dark)',
      viewport: { width: 1280, height: 800 },
      language: 'ar',
      theme: 'dark',
      path: 'test_artifacts/audit/16_desktop_dashboard_arabic_rtl_dark.png',
      timestamp: new Date().toISOString()
    });

    // 17. Malayalam (Dark)
    await desktopPage.goto(`${BASE_URL}/?tab=settings`, { waitUntil: 'networkidle' });
    await langSelect.selectOption('ml');
    await desktopPage.waitForTimeout(400);
    await desktopPage.goto(`${BASE_URL}/?tab=dashboard`);
    await desktopPage.waitForLoadState('networkidle');
    await desktopPage.waitForSelector('[data-testid="dashboard-view"]');
    await desktopPage.waitForTimeout(400);
    p = path.join(ARTIFACTS_DIR, '17_desktop_dashboard_malayalam_dark.png');
    await desktopPage.screenshot({ path: p });
    screenshots.push({
      id: '17',
      screen: 'Dashboard',
      state: 'Malayalam Dashboard (Dark)',
      viewport: { width: 1280, height: 800 },
      language: 'ml',
      theme: 'dark',
      path: 'test_artifacts/audit/17_desktop_dashboard_malayalam_dark.png',
      timestamp: new Date().toISOString()
    });

    await desktopContext.close();

    // -------------------------------------------------------------
    // Context 3: Mobile Viewport (390x844 - iPhone standard)
    // -------------------------------------------------------------
    console.log('\n--- Auditing Mobile Viewport (390x844) ---');
    const mobileContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    const mobilePage = await mobileContext.newPage();
    await mobilePage.addInitScript(() => {
      localStorage.removeItem('billzen_mock_fresh_user');
      localStorage.setItem('billzen_theme_preference', 'light');
      localStorage.setItem('billzen_ui_language', 'en');
      localStorage.setItem('billzen_browser_settings', JSON.stringify({
        id: 'default',
        business_name: 'Apex Store (Mobile)',
        legal_name: null,
        tax_identifier: '32AAAAA0000A1Z5',
        phone: '+91 9876543210',
        email: 'store@billzen.local',
        address_line1: '123 Market Road',
        address_line2: null,
        city: 'Kochi',
        state: 'Kerala',
        postal_code: '682001',
        country: 'IND',
        currency_code: 'INR',
        currency_symbol: '₹',
        currency_exponent: 2,
        locale: 'en-IN',
        timezone: 'Asia/Kolkata',
        invoice_prefix: 'INV',
        terms_and_conditions: 'Thank you for your business!',
        is_setup_completed: true,
        appearance_preference: 'light',
        guide_status: 'completed',
        guide_version: 1,
        created_at: Date.now(),
        updated_at: Date.now(),
      }));
    });

    // 18. Mobile Dashboard (Light)
    await mobilePage.goto(`${BASE_URL}/?tab=dashboard`);
    await mobilePage.waitForLoadState('networkidle');
    await mobilePage.waitForSelector('[data-testid="tab-simple"]');
    p = path.join(ARTIFACTS_DIR, '18_mobile_dashboard_light.png');
    await mobilePage.screenshot({ path: p });
    screenshots.push({
      id: '18',
      screen: 'Dashboard',
      state: 'Mobile Dashboard Simple View',
      viewport: { width: 390, height: 844 },
      language: 'en',
      theme: 'light',
      path: 'test_artifacts/audit/18_mobile_dashboard_light.png',
      timestamp: new Date().toISOString()
    });

    // 19. Mobile Dashboard Analytics View
    const mobileAnalytics = await mobilePage.waitForSelector('[data-testid="tab-analytics"]');
    await mobileAnalytics.click();
    await mobilePage.waitForSelector('[data-testid="analytics-bars-container"]');
    await mobilePage.waitForTimeout(300);
    p = path.join(ARTIFACTS_DIR, '19_mobile_dashboard_analytics_light.png');
    await mobilePage.screenshot({ path: p });
    screenshots.push({
      id: '19',
      screen: 'Dashboard',
      state: 'Mobile Dashboard Analytics View',
      viewport: { width: 390, height: 844 },
      language: 'en',
      theme: 'light',
      path: 'test_artifacts/audit/19_mobile_dashboard_analytics_light.png',
      timestamp: new Date().toISOString()
    });

    // 20. Mobile Cashbook
    const mobileCashTab = await mobilePage.waitForSelector('[data-testid="mobile-tab-cashbook"]');
    await mobileCashTab.click();
    await mobilePage.waitForSelector('[data-testid="action-receive-money"]');
    await mobilePage.waitForTimeout(300);
    p = path.join(ARTIFACTS_DIR, '20_mobile_cashbook_light.png');
    await mobilePage.screenshot({ path: p });
    screenshots.push({
      id: '20',
      screen: 'Cashbook',
      state: 'Mobile Cashbook Ledger',
      viewport: { width: 390, height: 844 },
      language: 'en',
      theme: 'light',
      path: 'test_artifacts/audit/20_mobile_cashbook_light.png',
      timestamp: new Date().toISOString()
    });

    // 21. Mobile Cashbook Receive Modal
    const mobReceiveBtn = await mobilePage.waitForSelector('[data-testid="action-receive-money"]');
    await mobReceiveBtn.click();
    await mobilePage.waitForSelector('[data-testid="input-voucher-amount"]');
    await mobilePage.waitForTimeout(300);
    p = path.join(ARTIFACTS_DIR, '21_mobile_cashbook_receive_modal.png');
    await mobilePage.screenshot({ path: p });
    screenshots.push({
      id: '21',
      screen: 'Cashbook',
      state: 'Mobile Receive Modal',
      viewport: { width: 390, height: 844 },
      language: 'en',
      theme: 'light',
      path: 'test_artifacts/audit/21_mobile_cashbook_receive_modal.png',
      timestamp: new Date().toISOString()
    });

    const mobCancelVoucher = await mobilePage.waitForSelector('[data-testid="btn-cancel-voucher-entry"]');
    await mobCancelVoucher.click();
    await mobilePage.waitForTimeout(300);

    // 22. Mobile Reports
    const mobileRepTab = await mobilePage.waitForSelector('[data-testid="mobile-tab-reports"]');
    await mobileRepTab.click();
    await mobilePage.waitForSelector('[data-testid="report-period-today"]');
    await mobilePage.waitForTimeout(300);
    p = path.join(ARTIFACTS_DIR, '22_mobile_reports_light.png');
    await mobilePage.screenshot({ path: p });
    screenshots.push({
      id: '22',
      screen: 'Reports',
      state: 'Mobile Reports View',
      viewport: { width: 390, height: 844 },
      language: 'en',
      theme: 'light',
      path: 'test_artifacts/audit/22_mobile_reports_light.png',
      timestamp: new Date().toISOString()
    });

    // 23. Mobile More Sheet
    const mobileMoreBtn = await mobilePage.waitForSelector('[data-testid="mobile-nav-more"]');
    await mobileMoreBtn.click();
    await mobilePage.waitForSelector('#mobile-more-navigation');
    await mobilePage.waitForTimeout(300);
    p = path.join(ARTIFACTS_DIR, '23_mobile_more_sheet.png');
    await mobilePage.screenshot({ path: p });
    screenshots.push({
      id: '23',
      screen: 'Navigation',
      state: 'Mobile More Navigation Sheet',
      viewport: { width: 390, height: 844 },
      language: 'en',
      theme: 'light',
      path: 'test_artifacts/audit/23_mobile_more_sheet.png',
      timestamp: new Date().toISOString()
    });

    // Close More sheet with Escape
    await mobilePage.keyboard.press('Escape');
    await mobilePage.waitForTimeout(300);

    // 24. Mobile 360px Compact View (Small Android)
    await mobilePage.setViewportSize({ width: 360, height: 740 });
    const mobileDashTab = await mobilePage.waitForSelector('[data-testid="mobile-tab-dashboard"]');
    await mobileDashTab.click();
    await mobilePage.waitForSelector('[data-testid="tab-simple"]');
    await mobilePage.waitForTimeout(300);
    p = path.join(ARTIFACTS_DIR, '24_mobile_360_dashboard.png');
    await mobilePage.screenshot({ path: p });
    screenshots.push({
      id: '24',
      screen: 'Dashboard',
      state: 'Compact Android 360px Dashboard',
      viewport: { width: 360, height: 740 },
      language: 'en',
      theme: 'light',
      path: 'test_artifacts/audit/24_mobile_360_dashboard.png',
      timestamp: new Date().toISOString()
    });

    await mobileContext.close();

    console.log(`\n=== Verification Complete: All ${screenshots.length} mandatory screenshots captured! ===`);
    fs.writeFileSync(
      path.join(ARTIFACTS_DIR, 'audit_manifest.json'),
      JSON.stringify({ timestamp: new Date().toISOString(), totalScreenshots: screenshots.length, screenshots }, null, 2)
    );
  } finally {
    if (browser) await browser.close();
    killServer();
  }
}

runAudit().catch((err) => {
  console.error('Audit script failed:', err);
  process.exit(1);
});
