import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';

const ARTIFACTS_DIR = path.resolve('test_artifacts/catalog');
fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });

const REPORT_PATH = path.join(ARTIFACTS_DIR, 'catalog_verification_report.json');

async function waitForServer(url, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {
      await new Promise((r) => setTimeout(r, 300));
    }
  }
  throw new Error(`Server at ${url} failed to become ready within ${timeoutMs}ms`);
}

async function runCatalogVerification() {
  console.log('=== Starting Milestone 3 Catalog Playwright Verification ===');

  const PORT = 4175;
  const BASE_URL = `http://localhost:${PORT}`;

  console.log(`Starting Vite preview on port ${PORT}...`);
  const server = spawn('npx', ['vite', 'preview', '--port', String(PORT)], {
    stdio: 'inherit',
    env: { ...process.env, PORT: String(PORT) },
    detached: true,
  });

  const killServerGroup = () => {
    if (server && server.pid) {
      try {
        process.kill(-server.pid, 'SIGTERM');
      } catch {
        // Already dead
      }
    }
  };

  process.on('SIGINT', () => { killServerGroup(); process.exit(130); });
  process.on('SIGTERM', () => { killServerGroup(); process.exit(143); });
  process.on('exit', () => killServerGroup());

  const report = {
    timestamp: new Date().toISOString(),
    tests: [],
    allPassed: false,
  };

  try {
    await waitForServer(BASE_URL, 15000);
    console.log(`Server is ready at ${BASE_URL}`);

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

    const page = await browser.newPage({
      viewport: { width: 1280, height: 900 },
    });

    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !msg.text().includes('favicon')) {
        consoleErrors.push(msg.text());
      }
    });

    // 1. Initial Load
    console.log('\nStep 1: Navigating to Product Catalog...');
    await page.goto(`${BASE_URL}/?tab=products`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);

    const productsHeader = await page.textContent('main h1');
    console.log(`Header found: "${productsHeader?.trim()}"`);

    // Dismiss getting-started guide if visible
    const guideSkipBtn = await page.$('[data-testid="guide-skip-button"], [data-testid="guide-close-button"]');
    if (guideSkipBtn) {
      await guideSkipBtn.click();
      await page.waitForTimeout(300);
    }

    report.tests.push({
      step: 'initial_load_products_tab',
      passed: productsHeader?.includes('Products') ?? false,
    });

    // 2. Add New Product
    console.log('\nStep 2: Adding a new product with leading-zero barcode...');
    await page.click('[data-testid="add-product-button"]');
    await page.waitForSelector('[data-testid="input-product-sku"]');

    await page.fill('[data-testid="input-product-sku"]', 'BASMATI-5KG');
    await page.fill('[data-testid="input-product-barcode"]', '0012345678905');
    await page.fill('[data-testid="input-product-name"]', 'Royal Basmati Rice 5kg');
    await page.fill('[data-testid="input-product-price"]', '450.00');
    await page.fill('[data-testid="input-product-cost-price"]', '380.00');
    await page.fill('[data-testid="input-product-opening-stock"]', '20.500');

    await page.click('[data-testid="save-product-submit"]');
    await page.waitForSelector('[data-testid="product-row-BASMATI-5KG"]');

    const createdRowText = await page.textContent('[data-testid="product-row-BASMATI-5KG"]');
    console.log(`Created row contains: ${createdRowText?.replace(/\s+/g, ' ').trim()}`);

    const barcodePreserved = createdRowText?.includes('0012345678905');
    const skuPreserved = createdRowText?.includes('BASMATI-5KG');

    report.tests.push({
      step: 'create_product_with_leading_zero_barcode',
      passed: Boolean(barcodePreserved && skuPreserved),
      details: { barcodePreserved, skuPreserved },
    });

    // 3. Barcode Scanner Keyboard-Wedge Simulation
    console.log('\nStep 3: Simulating barcode keyboard-wedge input + Enter key...');
    await page.fill('[data-testid="product-search-input"]', '0012345678905');
    await page.press('[data-testid="product-search-input"]', 'Enter');
    await page.waitForTimeout(500);

    const scannerBannerVisible = await page.isVisible('text=Barcode Scanned via Keyboard-Wedge!');
    console.log(`Scanner confirmation banner visible: ${scannerBannerVisible}`);

    report.tests.push({
      step: 'keyboard_wedge_scanner_enter_recognition',
      passed: scannerBannerVisible,
    });

    // Screenshot Products
    const productsScreenshot = path.join(ARTIFACTS_DIR, 'catalog_products.png');
    await page.screenshot({ path: productsScreenshot, fullPage: true });
    console.log(`Saved screenshot: ${productsScreenshot}`);

    // Clear search
    await page.fill('[data-testid="product-search-input"]', '');
    await page.waitForTimeout(300);

    // 4. Navigate to Customers Tab & Create Customer
    console.log('\nStep 4: Navigating to Customers and creating international customer...');
    await page.click('[data-testid="tab-customers"]');
    await page.waitForSelector('[data-testid="add-customer-button"]');

    await page.click('[data-testid="add-customer-button"]');
    await page.waitForSelector('[data-testid="input-customer-name"]');

    await page.fill('[data-testid="input-customer-name"]', 'Al-Nuaimi Trading LLC');
    await page.fill('[data-testid="input-customer-phone"]', '+971 50 123 4567');
    await page.fill('[data-testid="input-customer-email"]', 'orders@nuaimi.ae');
    await page.fill('[data-testid="input-customer-tax-id"]', '100200300400003');

    await page.click('[data-testid="save-customer-submit"]');
    await page.waitForSelector('[data-testid="customer-row-Al-Nuaimi Trading LLC"]');

    const customerRowText = await page.textContent('[data-testid="customer-row-Al-Nuaimi Trading LLC"]');
    console.log(`Customer row: ${customerRowText?.replace(/\s+/g, ' ').trim()}`);

    const phonePreserved = customerRowText?.includes('+971 50 123 4567');
    const taxIdPreserved = customerRowText?.includes('100200300400003');

    report.tests.push({
      step: 'create_customer_phone_and_tax_id_preservation',
      passed: Boolean(phonePreserved && taxIdPreserved),
      details: { phonePreserved, taxIdPreserved },
    });

    const customersScreenshot = path.join(ARTIFACTS_DIR, 'catalog_customers.png');
    await page.screenshot({ path: customersScreenshot, fullPage: true });
    console.log(`Saved screenshot: ${customersScreenshot}`);

    // 5. Test Malayalam Localization
    console.log('\nStep 5: Testing Malayalam localization...');
    await page.selectOption('[data-testid="language-select"]', 'ml');
    await page.waitForTimeout(500);

    const mlTabProducts = await page.textContent('[data-testid="tab-products"]');
    const mlTabCustomers = await page.textContent('[data-testid="tab-customers"]');
    console.log(`Malayalam tabs: "${mlTabProducts?.trim()}", "${mlTabCustomers?.trim()}"`);

    const mlPassed = mlTabProducts?.includes('ഉൽപന്നങ്ങൾ') && mlTabCustomers?.includes('ഉപഭോക്താക്കൾ');
    report.tests.push({
      step: 'malayalam_localization_rendering',
      passed: Boolean(mlPassed),
    });

    const mlScreenshot = path.join(ARTIFACTS_DIR, 'catalog_malayalam.png');
    await page.screenshot({ path: mlScreenshot, fullPage: true });

    // 6. Test Arabic RTL Localization
    console.log('\nStep 6: Testing Arabic RTL localization...');
    await page.selectOption('[data-testid="language-select"]', 'ar');
    await page.waitForTimeout(500);

    const arDir = await page.getAttribute('div.min-h-screen', 'dir');
    const arTabProducts = await page.textContent('[data-testid="tab-products"]');
    console.log(`Arabic dir: "${arDir}", Tab: "${arTabProducts?.trim()}"`);

    const arPassed = arDir === 'rtl' && arTabProducts?.includes('المنتجات');
    report.tests.push({
      step: 'arabic_rtl_localization_rendering',
      passed: Boolean(arPassed),
      details: { dir: arDir, tab: arTabProducts },
    });

    const arScreenshot = path.join(ARTIFACTS_DIR, 'catalog_arabic_rtl.png');
    await page.screenshot({ path: arScreenshot, fullPage: true });

    await browser.close();

    report.consoleErrors = consoleErrors;
    report.allPassed = report.tests.every((t) => t.passed) && consoleErrors.length === 0;

    fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
    console.log(`\nReport written to: ${REPORT_PATH}`);
    console.log(`All Tests Passed: ${report.allPassed}`);

    if (!report.allPassed) {
      throw new Error('One or more catalog tests failed. See report.');
    }
  } finally {
    killServerGroup();
  }
}

runCatalogVerification().catch((err) => {
  console.error('Fatal error during catalog verification:', err);
  process.exit(1);
});
