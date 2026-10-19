import { spawn, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';

const ARTIFACTS_DIR = path.resolve('test_artifacts/pdf');
fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });

const REPORT_PATH = path.join(ARTIFACTS_DIR, 'matrix_verification_report.json');

async function waitForServer(url, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {
      // Wait before retrying
      await new Promise((r) => setTimeout(r, 300));
    }
  }
  throw new Error(`Server at ${url} failed to become ready within ${timeoutMs}ms`);
}

async function verifyScenario(page, scenario) {
  console.log(`\n--- Running Scenario: ${scenario.name} ---`);
  const pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !msg.text().includes('favicon')) {
      pageErrors.push(`Console error: ${msg.text()}`);
    }
  });

  await page.goto(scenario.url, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500); // Allow fonts and styles to fully settle

  if (pageErrors.length > 0) {
    throw new Error(`Page encountered errors during load: ${pageErrors.join('; ')}`);
  }

  const pdfPath = path.join(ARTIFACTS_DIR, `${scenario.id}.pdf`);
  const pngPrefix = path.join(ARTIFACTS_DIR, `${scenario.id}_page`);

  // Generate A4 PDF with exact print CSS and zero browser headers/footers
  await page.pdf({
    path: pdfPath,
    format: 'A4',
    preferCSSPageSize: true,
    printBackground: true,
    displayHeaderFooter: false,
    margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' },
  });

  console.log(`Saved PDF to ${pdfPath}`);

  // Inspect with pdfinfo
  const pdfinfoOut = execSync(`pdfinfo "${pdfPath}"`).toString();
  const pagesMatch = pdfinfoOut.match(/Pages:\s+(\d+)/);
  const pages = pagesMatch ? parseInt(pagesMatch[1], 10) : 0;
  const sizeMatch = pdfinfoOut.match(/Page size:\s+([0-9.]+)\s+x\s+([0-9.]+)/);
  const width = sizeMatch ? parseFloat(sizeMatch[1]) : 0;
  const height = sizeMatch ? parseFloat(sizeMatch[2]) : 0;

  console.log(`PDF Info: ${width} x ${height} pts, ${pages} page(s)`);

  const isA4Width = Math.abs(width - 595.28) < 3 || Math.abs(width - 594.96) < 3;
  const isA4Height = Math.abs(height - 841.89) < 3 || Math.abs(height - 841.92) < 3;

  if (!isA4Width || !isA4Height) {
    throw new Error(`Scenario ${scenario.id} did not produce A4 dimensions: got ${width}x${height}`);
  }

  if (scenario.expectedPages && pages !== scenario.expectedPages) {
    throw new Error(`Scenario ${scenario.id} expected ${scenario.expectedPages} pages, got ${pages}`);
  }
  if (scenario.minPages && pages < scenario.minPages) {
    throw new Error(`Scenario ${scenario.id} expected at least ${scenario.minPages} pages, got ${pages}`);
  }

  // Extract text with pdftotext
  const textOut = execSync(`pdftotext "${pdfPath}" -`).toString();

  // Whitespace-normalized text comparison to handle cross-platform line-wrapping while strictly
  // preserving word sequence, numerical amounts, and preventing text omission.
  const normalizeWs = (s) => s.replace(/\s+/g, ' ').trim();
  const normalizedTextOut = normalizeWs(textOut);

  // Validate required strings
  for (const req of scenario.requiredStrings) {
    const normalizedReq = normalizeWs(req);
    if (!normalizedTextOut.includes(normalizedReq)) {
      throw new Error(`Scenario ${scenario.id} missing required string: "${req}"`);
    }
  }

  // Validate forbidden strings
  const defaultForbidden = [
    'Trigger window.print()',
    'Stage 1: Invocation',
    'Platform Print Diagnostic',
    'Did the native operating system',
    'Store Settings',
    'UNVERIFIED: Awaiting Test',
    'http://localhost',
  ];
  const allForbidden = [...defaultForbidden, ...(scenario.forbiddenStrings || [])];
  for (const forb of allForbidden) {
    const normalizedForb = normalizeWs(forb);
    if (normalizedTextOut.includes(normalizedForb)) {
      throw new Error(`Scenario ${scenario.id} leaked forbidden UI/browser text: "${forb}"`);
    }
  }

  // Render PNG images for every page
  execSync(`pdftoppm -png -r 150 "${pdfPath}" "${pngPrefix}"`);
  console.log(`Rendered PNG pages for ${scenario.id}`);

  return {
    scenario: scenario.id,
    name: scenario.name,
    pdfPath,
    pageCount: pages,
    dimensions: { width, height },
    isA4: isA4Width && isA4Height,
    status: 'PASSED',
  };
}

async function run() {
  console.log('=== Step 1: Building production frontend with tsc && vite build ===');
  execSync('npm run build', { stdio: 'inherit' });

  console.log('=== Step 2: Starting Vite preview server on port 4173 ===');
  const preview = spawn('npx', ['vite', 'preview', '--port', '4173'], {
    stdio: 'ignore',
    detached: true,
  });

  const killPreviewGroup = () => {
    if (preview && preview.pid) {
      try {
        process.kill(-preview.pid, 'SIGTERM');
      } catch {
        // Already dead
      }
    }
  };

  process.on('SIGINT', () => { killPreviewGroup(); process.exit(130); });
  process.on('SIGTERM', () => { killPreviewGroup(); process.exit(143); });
  process.on('exit', () => killPreviewGroup());

  try {
    await waitForServer('http://localhost:4173/');
    console.log('Vite preview server is live and responsive at http://localhost:4173/');

    console.log('=== Step 3: Launching Playwright Chrome ===');
    const browser = await chromium.launch({
      channel: 'chrome',
      headless: true,
      args: ['--no-sandbox', '--disable-gpu'],
    });

    const context = await browser.newContext();
    const page = await context.newPage();

    const scenarios = [
      {
        id: 'scenario_short_oracle',
        name: 'Short 2-Line Sample Invoice (INR with Malayalam & Arabic)',
        url: 'http://localhost:4173/?scenario=short',
        expectedPages: 1,
        requiredStrings: [
          'TAX INVOICE',
          'SAMPLE / DRAFT TAX INVOICE',
          'BillZen Retail & Wholesale Store',
          'INV-2026-0001',
          'Organic Basmati Rice 1kg',
          'ഓർഗാനിക് ബസുമതി അരി',
          'أرز بسمتي عضوي',
          'Fresh Roasted Arabica Coffee Beans',
          'ഫ്രഷ് അറബിക്ക കാപ്പിപ്പൊടി',
          'حبوب بن أرابيكا محمصة طازجة',
          '₹537.56', // Subtotal Gross
          '₹522.56', // Taxable Subtotal
          '₹50.83',  // Total Tax
          '-₹15.00', // Total Discounts
          '₹573.39', // Exact Grand Total Oracle!
          '₹224.20', // Item 1 total
          '₹349.19', // Item 2 total
          'GST / Tax ID',
          'Total Tax (CGST + SGST)',
        ],
        forbiddenStrings: ['₹573.40', 'Total VAT / Tax'],
      },
      {
        id: 'scenario_multipage',
        name: 'Multi-Page Wholesale Invoice (22 Items spanning pages)',
        url: 'http://localhost:4173/?scenario=multipage',
        minPages: 2,
        requiredStrings: [
          'BillZen Wholesale Distribution Centre',
          'INV-2026-MULTI',
          'Wholesale Commodity Batch #1',
          'Wholesale Commodity Batch #22',
          'മൊത്തവ്യാപാര ചരക്ക് ബാച്ച് #1',
          'മൊത്തവ്യാപാര ചരക്ക് ബാച്ച് #22',
          'St. George Supermarket',
        ],
      },
      {
        id: 'scenario_kwd_3decimal',
        name: 'Kuwait 3-Decimal GCC Invoice (KWD with VAT)',
        url: 'http://localhost:4173/?scenario=kwd_3decimal',
        expectedPages: 1,
        requiredStrings: [
          'Kuwait Central General Trading & Contracting',
          'INV-KW-2026-001',
          'Cardamom Extra Bold Grade A',
          'ഹരിത ഏലം',
          'هيل ممتاز',
          'KD 3.375', // Gross
          'KD 3.125', // Taxable
          'KD 0.156', // VAT
          '-KD 0.250',// Discount
          'KD 3.281', // Grand Total
          'VAT / Tax ID',
          'Total VAT / Tax',
          'TAX (KD )',
        ],
        forbiddenStrings: ['₹', 'GST / Tax ID', 'CGST', 'SGST'],
      },
      {
        id: 'scenario_long_text',
        name: 'Long Text Stress Test (Multi-line Names & Addresses)',
        url: 'http://localhost:4173/?scenario=long_text',
        requiredStrings: [
          'International Trading & Commercial Corporation',
          'Technopark Phase III Campus',
          'South Asian Trans-Regional Infrastructure',
          'Development Corporation',
          'High-Precision Automated Digital Multimeter',
          'Integrated Thermal Imaging',
          'തെർമൽ ഇമേജിംഗും ബ്ലൂടൂത്ത് ഡാറ്റാ ലോഗിംഗും ഉൾക്കൊള്ളുന്ന',
          'جهاز قياس متعدد رقمي عالي الدقة',
          '₹14632.00',
          '₹12400.00',
        ],
      },
    ];

    const results = [];
    for (const scenario of scenarios) {
      const result = await verifyScenario(page, scenario);
      results.push(result);
    }

    await browser.close();

    const summary = {
      timestamp: new Date().toISOString(),
      allPassed: results.every((r) => r.status === 'PASSED'),
      results,
    };

    fs.writeFileSync(REPORT_PATH, JSON.stringify(summary, null, 2));
    console.log(`\n=== ALL SCENARIOS PASSED SUCCESSFULLY ===`);
    console.log(`Summary report written to ${REPORT_PATH}`);
  } finally {
    killPreviewGroup();
  }
}

run().catch((e) => {
  console.error('\nPlaywright Matrix Verification FAILED:', e);
  process.exit(1);
});
