import { spawn, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const ARTIFACTS_DIR = path.resolve('test_artifacts/pdf');
fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });

const PDF_PATH = path.join(ARTIFACTS_DIR, 'invoice_a4.pdf');
const PNG_PREFIX = path.join(ARTIFACTS_DIR, 'invoice_page');
const REPORT_PATH = path.join(ARTIFACTS_DIR, 'pdf_verification_report.json');

async function run() {
  console.log('=== Step 1: Starting Vite preview server on port 4173 ===');
  const preview = spawn('npx', ['vite', 'preview', '--port', '4173'], {
    stdio: 'ignore',
  });

  // Give preview server 2 seconds to bind
  await new Promise((r) => setTimeout(r, 2000));

  try {
    console.log('=== Step 2: Generating A4 PDF via headless Chrome ===');
    execSync(
      `google-chrome --headless=new --disable-gpu --no-sandbox ` +
      `--run-all-compositor-stages-before-draw ` +
      `--print-to-pdf="${PDF_PATH}" http://localhost:4173/?scenario=short`,
      { stdio: 'inherit' }
    );

    console.log('=== Step 3: Inspecting PDF with pdfinfo ===');
    const pdfinfoOut = execSync(`pdfinfo "${PDF_PATH}"`).toString();
    console.log(pdfinfoOut);

    const pagesMatch = pdfinfoOut.match(/Pages:\s+(\d+)/);
    const pages = pagesMatch ? parseInt(pagesMatch[1], 10) : 0;

    const sizeMatch = pdfinfoOut.match(/Page size:\s+([0-9.]+)\s+x\s+([0-9.]+)/);
    const width = sizeMatch ? parseFloat(sizeMatch[1]) : 0;
    const height = sizeMatch ? parseFloat(sizeMatch[2]) : 0;

    console.log(`Parsed Dimensions: ${width} x ${height} pts, Pages: ${pages}`);

    console.log('=== Step 4: Extracting Text with pdftotext ===');
    const textOut = execSync(`pdftotext "${PDF_PATH}" -`).toString();

    // Required assertions
    const requiredStrings = [
      'TAX INVOICE',
      'SAMPLE / DRAFT TAX INVOICE',
      'BillZen Retail & Wholesale Store',
      'INV-2026-0001',
      'Organic Basmati Rice',
      'ഓർഗാനിക് ബസുമതി അരി',
      'Fresh Roasted Arabica Coffee Beans',
      '₹573.40',
    ];

    const forbiddenStrings = [
      'Trigger window.print()',
      'Stage 1: Invocation',
      'Platform Print Diagnostic',
      'Did the native operating system',
      'Store Settings',
      'Print & Layout Probe',
      'UNVERIFIED: Awaiting Test',
    ];

    const assertionResults = {
      required: {},
      forbidden: {},
    };

    let allRequiredPassed = true;
    for (const req of requiredStrings) {
      const found = textOut.includes(req);
      assertionResults.required[req] = found;
      if (!found) {
        console.error(`FAILED: Expected string not found in PDF: "${req}"`);
        allRequiredPassed = false;
      }
    }

    let allForbiddenPassed = true;
    for (const forb of forbiddenStrings) {
      const found = textOut.includes(forb);
      assertionResults.forbidden[forb] = !found; // true means correctly absent
      if (found) {
        console.error(`FAILED: Forbidden UI string leaked into PDF: "${forb}"`);
        allForbiddenPassed = false;
      }
    }

    // A4 dimensions verification: 594.96 x 841.92 ± 2 points
    const isA4Width = Math.abs(width - 595.28) < 2 || Math.abs(width - 594.96) < 2;
    const isA4Height = Math.abs(height - 841.89) < 2 || Math.abs(height - 841.92) < 2;
    const isSinglePage = pages === 1;

    console.log('=== Step 5: Rendering Page Images with pdftoppm ===');
    execSync(`pdftoppm -png -r 150 "${PDF_PATH}" "${PNG_PREFIX}"`);

    const report = {
      timestamp: new Date().toISOString(),
      pdfPath: PDF_PATH,
      pageCount: pages,
      dimensions: { width, height },
      isA4Dimensions: isA4Width && isA4Height,
      isSinglePage,
      allRequiredStringsPresent: allRequiredPassed,
      allForbiddenStringsAbsent: allForbiddenPassed,
      assertionResults,
      status:
        isA4Width &&
        isA4Height &&
        isSinglePage &&
        allRequiredPassed &&
        allForbiddenPassed
          ? 'PASSED'
          : 'FAILED',
    };

    fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
    console.log(`Saved report to ${REPORT_PATH}`);

    if (report.status !== 'PASSED') {
      process.exit(1);
    }
    console.log('=== PDF VERIFICATION PASSED SUCCESSFULLY ===');
  } finally {
    preview.kill('SIGTERM');
  }
}

run().catch((e) => {
  console.error('Test execution failed:', e);
  process.exit(1);
});
