import { spawn, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';

const ARTIFACTS_DIR = path.resolve('test_artifacts/pdf_cashbook');
fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });

const VOUCHER_A4_PDF = path.join(ARTIFACTS_DIR, 'voucher_a4.pdf');
const VOUCHER_80MM_PDF = path.join(ARTIFACTS_DIR, 'voucher_80mm.pdf');
const INVOICE_A4_PDF = path.join(ARTIFACTS_DIR, 'invoice_a4.pdf');
const REPORT_PATH = path.join(ARTIFACTS_DIR, 'cashbook_pdf_report.json');

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
  throw new Error(`Server at ${url} failed to respond within ${timeoutMs}ms`);
}

function inspectPdf(pdfPath) {
  const pdfinfoOut = execSync(`pdfinfo "${pdfPath}"`).toString();
  const pagesMatch = pdfinfoOut.match(/Pages:\s+(\d+)/);
  const pages = pagesMatch ? parseInt(pagesMatch[1], 10) : 0;

  const sizeMatch = pdfinfoOut.match(/Page size:\s+([0-9.]+)\s+x\s+([0-9.]+)/);
  const width = sizeMatch ? parseFloat(sizeMatch[1]) : 0;
  const height = sizeMatch ? parseFloat(sizeMatch[2]) : 0;

  const textOut = execSync(`pdftotext "${pdfPath}" -`).toString();

  return { pages, width, height, text: textOut, pdfinfoOut };
}

async function run() {
  console.log('=== Starting Cashbook & Invoice PDF Isolation Suite ===');
  const PORT = 4179;
  const BASE_URL = `http://localhost:${PORT}`;

  const server = spawn('npx', ['vite', 'preview', '--port', String(PORT)], {
    stdio: 'ignore',
    env: { ...process.env, PORT: String(PORT) },
    detached: true,
  });

  const killServer = () => {
    if (server && server.pid) {
      try { process.kill(-server.pid, 'SIGTERM'); } catch {}
    }
  };

  process.on('SIGINT', () => { killServer(); process.exit(130); });
  process.on('SIGTERM', () => { killServer(); process.exit(143); });
  process.on('exit', () => killServer());

  const results = {
    timestamp: new Date().toISOString(),
    scenarios: [],
    allPassed: false,
  };

  let browser;
  try {
    await waitForServer(BASE_URL, 15000);
    console.log(`Vite preview server listening at ${BASE_URL}`);

    browser = await chromium.launch({
      channel: 'chrome',
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--font-render-hinting=none'],
    });

    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    // PDF isolation is independent of guide timing; onboarding has its own suite.
    await page.addInitScript(() => localStorage.setItem('billzen_guide_status', 'completed'));

    // -------------------------------------------------------------------------
    // Scenario 1: Post Voucher and Generate A4 Voucher PDF
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 1: A4 Voucher PDF Generation & Text Isolation ---');
    await page.goto(`${BASE_URL}/?tab=cashbook`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);

    // Dismiss guide if open
    const guideBtn = await page.$('[data-testid="guide-skip-button"], [data-testid="guide-close-button"]');
    if (guideBtn) { await guideBtn.click(); await page.waitForTimeout(300); }

    // Open Receive Money modal
    await page.click('[data-testid="action-receive-money"]');
    await page.waitForSelector('[data-testid="input-voucher-amount"]');
    await page.fill('[data-testid="input-voucher-amount"]', '7500.00');

    // Create a new party for clear identification in PDF text
    await page.click('text=New Party');
    await page.waitForSelector('input[placeholder*="John Doe"]');
    await page.fill('input[placeholder*="John Doe"]', 'Malabar Spices Trading');
    await page.click('button:has-text("Create")');
    await page.waitForTimeout(300);

    await page.click('[data-testid="btn-submit-voucher"]');
    await page.waitForSelector('text=posted successfully', { timeout: 8000 });
    await page.waitForTimeout(400);

    // Open View / Print dialog for the posted voucher
    await page.click('[data-testid="btn-view-voucher"]');
    await page.waitForSelector('[role="dialog"]');
    await page.click('button:has-text("A4 Voucher")');
    await page.waitForTimeout(400);

    // Emulate print media & export PDF using preferCSSPageSize
    await page.emulateMedia({ media: 'print' });
    await page.pdf({
      path: VOUCHER_A4_PDF,
      preferCSSPageSize: true,
      printBackground: true,
    });
    await page.emulateMedia({ media: 'screen' });

    const a4Info = inspectPdf(VOUCHER_A4_PDF);
    console.log(`Voucher A4 PDF: ${a4Info.pages} page(s), ${a4Info.width} x ${a4Info.height} pts`);

    // Verify A4 dimensions (594.96 x 841.92 pt ± 2)
    const isA4Dim = Math.abs(a4Info.width - 594.96) < 3 && Math.abs(a4Info.height - 841.92) < 3;
    const isSinglePageA4 = a4Info.pages === 1;
    const hasVoucherTextA4 = a4Info.text.includes('RECEIPT VOUCHER') &&
      a4Info.text.includes('Malabar Spices Trading') &&
      a4Info.text.includes('7500.00') &&
      a4Info.text.includes('Seven Thousand Five Hundred');
    // Ensure TOTAL ABSENCE of invoice text
    const hasZeroInvoiceTextA4 = !a4Info.text.includes('TAX INVOICE') &&
      !a4Info.text.includes('SAMPLE / DRAFT TAX INVOICE') &&
      !a4Info.text.includes('Organic Basmati Rice');

    console.log(`  - Single page: ${isSinglePageA4 ? 'PASS' : 'FAIL'}`);
    console.log(`  - A4 dimensions (~595 x 842 pt): ${isA4Dim ? 'PASS' : 'FAIL'}`);
    console.log(`  - Contains voucher particulars: ${hasVoucherTextA4 ? 'PASS' : 'FAIL'}`);
    console.log(`  - Total absence of sample invoice text: ${hasZeroInvoiceTextA4 ? 'PASS' : 'FAIL'}`);

    const scenario1Passed = isSinglePageA4 && isA4Dim && hasVoucherTextA4 && hasZeroInvoiceTextA4;
    results.scenarios.push({
      name: 'Voucher A4 PDF',
      passed: scenario1Passed,
      pages: a4Info.pages,
      width: a4Info.width,
      height: a4Info.height,
      hasVoucherText: hasVoucherTextA4,
      hasZeroInvoiceText: hasZeroInvoiceTextA4,
    });

    // -------------------------------------------------------------------------
    // Scenario 2: Generate 80mm Thermal Voucher PDF
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 2: 80mm Thermal Receipt PDF Generation & Geometry ---');
    await page.click('button:has-text("80mm Thermal")');
    await page.waitForTimeout(400);

    await page.emulateMedia({ media: 'print' });
    await page.pdf({
      path: VOUCHER_80MM_PDF,
      preferCSSPageSize: true,
      printBackground: true,
    });
    await page.emulateMedia({ media: 'screen' });

    const thermalInfo = inspectPdf(VOUCHER_80MM_PDF);
    console.log(`Voucher 80mm PDF: ${thermalInfo.pages} page(s), ${thermalInfo.width} x ${thermalInfo.height} pts`);

    // 80mm width in points is ~226.77 pt (227.04 in Chromium Skia)
    const is80mmWidth = Math.abs(thermalInfo.width - 227.04) < 3;
    const isSinglePageThermal = thermalInfo.pages === 1;
    const hasThermalVoucherText = thermalInfo.text.includes('RECEIPT') &&
      thermalInfo.text.includes('7500.00') &&
      thermalInfo.text.includes('Seven Thousand Five Hundred');
    const hasZeroInvoiceTextThermal = !thermalInfo.text.includes('TAX INVOICE') &&
      !thermalInfo.text.includes('Organic Basmati Rice');

    console.log(`  - Single page: ${isSinglePageThermal ? 'PASS' : 'FAIL'}`);
    console.log(`  - 80mm width (~227 pt): ${is80mmWidth ? 'PASS' : 'FAIL'}`);
    console.log(`  - Contains receipt particulars: ${hasThermalVoucherText ? 'PASS' : 'FAIL'}`);
    console.log(`  - Total absence of invoice text: ${hasZeroInvoiceTextThermal ? 'PASS' : 'FAIL'}`);

    const scenario2Passed = isSinglePageThermal && is80mmWidth && hasThermalVoucherText && hasZeroInvoiceTextThermal;
    results.scenarios.push({
      name: 'Voucher 80mm Thermal PDF',
      passed: scenario2Passed,
      pages: thermalInfo.pages,
      width: thermalInfo.width,
      height: thermalInfo.height,
      hasThermalVoucherText,
      hasZeroInvoiceText: hasZeroInvoiceTextThermal,
    });

    // Close voucher modal
    await page.click('[data-testid="btn-close-voucher-dialog"]');
    await page.waitForTimeout(300);

    // -------------------------------------------------------------------------
    // Scenario 3: Load explicit synthetic invoice fixture and generate A4 PDF
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 3: Invoice A4 PDF & Absence of Cashbook Voucher Text ---');
    await page.goto(`${BASE_URL}/?scenario=short`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);

    await page.emulateMedia({ media: 'print' });
    await page.pdf({
      path: INVOICE_A4_PDF,
      preferCSSPageSize: true,
      printBackground: true,
    });
    await page.emulateMedia({ media: 'screen' });

    const invoiceInfo = inspectPdf(INVOICE_A4_PDF);
    console.log(`Invoice A4 PDF: ${invoiceInfo.pages} page(s), ${invoiceInfo.width} x ${invoiceInfo.height} pts`);

    const isInvoiceA4Dim = Math.abs(invoiceInfo.width - 594.96) < 3 && Math.abs(invoiceInfo.height - 841.92) < 3;
    const isSinglePageInvoice = invoiceInfo.pages === 1;
    const hasInvoiceText = invoiceInfo.text.includes('TAX INVOICE') &&
      invoiceInfo.text.includes('Organic Basmati Rice');
    // Ensure TOTAL ABSENCE of voucher text
    const hasZeroVoucherText = !invoiceInfo.text.includes('RECEIPT VOUCHER') &&
      !invoiceInfo.text.includes('Malabar Spices Trading') &&
      !invoiceInfo.text.includes('Company Cashbook');

    console.log(`  - Single page: ${isSinglePageInvoice ? 'PASS' : 'FAIL'}`);
    console.log(`  - A4 dimensions: ${isInvoiceA4Dim ? 'PASS' : 'FAIL'}`);
    console.log(`  - Contains invoice particulars: ${hasInvoiceText ? 'PASS' : 'FAIL'}`);
    console.log(`  - Total absence of voucher text: ${hasZeroVoucherText ? 'PASS' : 'FAIL'}`);

    const scenario3Passed = isSinglePageInvoice && isInvoiceA4Dim && hasInvoiceText && hasZeroVoucherText;
    results.scenarios.push({
      name: 'Invoice A4 PDF',
      passed: scenario3Passed,
      pages: invoiceInfo.pages,
      width: invoiceInfo.width,
      height: invoiceInfo.height,
      hasInvoiceText,
      hasZeroVoucherText,
    });

    await browser.close();

    results.allPassed = scenario1Passed && scenario2Passed && scenario3Passed;
    fs.writeFileSync(REPORT_PATH, JSON.stringify(results, null, 2));

    console.log(`\n=== PDF Verification Summary: ${results.allPassed ? 'ALL PASSED' : 'FAILURES DETECTED'} ===`);
    if (!results.allPassed) {
      process.exitCode = 1;
    }
  } catch (err) {
    console.error('Fatal error during PDF verification:', err);
    process.exitCode = 1;
  } finally {
    await browser?.close();
    killServer();
  }
}

run();
