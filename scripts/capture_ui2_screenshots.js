import { chromium } from 'playwright';
import { spawn, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

const OUT_DIR = path.resolve('test_artifacts/ui2_dashboard');
const BRAIN_DIR = '/home/jabir/.gemini/antigravity/brain/e45a19bc-f7ab-47cb-82cf-5babbb752a98/ui2_dashboard';

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}
if (!fs.existsSync(BRAIN_DIR)) {
  fs.mkdirSync(BRAIN_DIR, { recursive: true });
}

async function copyToBrain(filename) {
  const src = path.join(OUT_DIR, filename);
  const dst = path.join(BRAIN_DIR, filename);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dst);
  }
}

async function preparePage(page) {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(300);
  const guideSkipBtn = await page.$('[data-testid="guide-skip-button"], [data-testid="guide-close-button"]');
  if (guideSkipBtn) {
    await guideSkipBtn.click();
    await page.waitForTimeout(300);
  }
}

async function main() {
  console.log('=== Building frontend with npm run build ===');
  execSync('npm run build', { stdio: 'inherit' });

  console.log('=== Starting Vite preview on port 4189 ===');
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
  const manifest = [];

  try {
    // 1. Desktop Light (1280x800) - Simple View
    {
      const context = await browser.newContext({
        viewport: { width: 1280, height: 800 },
        colorScheme: 'light',
      });
      const page = await context.newPage();
      await page.goto('http://localhost:4189');
      await preparePage(page);

      const file = 'ui2_desktop_1280_light.png';
      await page.screenshot({ path: path.join(OUT_DIR, file) });
      await copyToBrain(file);
      manifest.push({ name: 'Dashboard Desktop Light (1280x800)', file });
      console.log(`Captured: ${file}`);
      await context.close();
    }

    // 2. Desktop Dark (1280x800) - Simple View
    {
      const context = await browser.newContext({
        viewport: { width: 1280, height: 800 },
        colorScheme: 'dark',
      });
      const page = await context.newPage();
      await page.goto('http://localhost:4189');
      await preparePage(page);
      await page.evaluate(() => {
        document.documentElement.classList.add('dark');
        localStorage.setItem('billzen_appearance_pref', 'dark');
      });
      await page.waitForTimeout(300);

      const file = 'ui2_desktop_1280_dark.png';
      await page.screenshot({ path: path.join(OUT_DIR, file) });
      await copyToBrain(file);
      manifest.push({ name: 'Dashboard Desktop Dark (1280x800)', file });
      console.log(`Captured: ${file}`);
      await context.close();
    }

    // 3. Desktop Light Detailed Analytics (1280x800)
    {
      const context = await browser.newContext({
        viewport: { width: 1280, height: 800 },
        colorScheme: 'light',
      });
      const page = await context.newPage();
      await page.goto('http://localhost:4189');
      await preparePage(page);
      // Switch to Detailed Analytics
      const analyticsBtn = await page.$('#dashboard-mode-analytics');
      if (analyticsBtn) {
        await analyticsBtn.click();
        await page.waitForTimeout(400);
      }

      const file = 'ui2_desktop_analytics_light.png';
      await page.screenshot({ path: path.join(OUT_DIR, file) });
      await copyToBrain(file);
      manifest.push({ name: 'Dashboard Analytics View Light (1280x800)', file });
      console.log(`Captured: ${file}`);
      await context.close();
    }

    // 4. Desktop Dark Detailed Analytics (1280x800)
    {
      const context = await browser.newContext({
        viewport: { width: 1280, height: 800 },
        colorScheme: 'dark',
      });
      const page = await context.newPage();
      await page.goto('http://localhost:4189');
      await preparePage(page);
      await page.evaluate(() => {
        document.documentElement.classList.add('dark');
        localStorage.setItem('billzen_appearance_pref', 'dark');
      });
      await page.waitForTimeout(300);
      const analyticsBtn = await page.$('#dashboard-mode-analytics');
      if (analyticsBtn) {
        await analyticsBtn.click();
        await page.waitForTimeout(400);
      }

      const file = 'ui2_desktop_analytics_dark.png';
      await page.screenshot({ path: path.join(OUT_DIR, file) });
      await copyToBrain(file);
      manifest.push({ name: 'Dashboard Analytics View Dark (1280x800)', file });
      console.log(`Captured: ${file}`);
      await context.close();
    }

    // 5. Mobile 390px Light (390x844)
    {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        colorScheme: 'light',
      });
      const page = await context.newPage();
      await page.goto('http://localhost:4189');
      await preparePage(page);

      const file = 'ui2_mobile_390_light.png';
      await page.screenshot({ path: path.join(OUT_DIR, file) });
      await copyToBrain(file);
      manifest.push({ name: 'Dashboard Mobile Light (390x844)', file });
      console.log(`Captured: ${file}`);
      await context.close();
    }

    // 6. Mobile 390px Dark (390x844)
    {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        colorScheme: 'dark',
      });
      const page = await context.newPage();
      await page.goto('http://localhost:4189');
      await preparePage(page);
      await page.evaluate(() => {
        document.documentElement.classList.add('dark');
        localStorage.setItem('billzen_appearance_pref', 'dark');
      });
      await page.waitForTimeout(300);

      const file = 'ui2_mobile_390_dark.png';
      await page.screenshot({ path: path.join(OUT_DIR, file) });
      await copyToBrain(file);
      manifest.push({ name: 'Dashboard Mobile Dark (390x844)', file });
      console.log(`Captured: ${file}`);
      await context.close();
    }

    // 7. Mobile 360px Light (360x740)
    {
      const context = await browser.newContext({
        viewport: { width: 360, height: 740 },
        colorScheme: 'light',
      });
      const page = await context.newPage();
      await page.goto('http://localhost:4189');
      await preparePage(page);

      const file = 'ui2_mobile_360_light.png';
      await page.screenshot({ path: path.join(OUT_DIR, file) });
      await copyToBrain(file);
      manifest.push({ name: 'Dashboard Mobile Android (360x740)', file });
      console.log(`Captured: ${file}`);
      await context.close();
    }

    // 8. Desktop Arabic RTL (1280x800)
    {
      const context = await browser.newContext({
        viewport: { width: 1280, height: 800 },
        colorScheme: 'light',
      });
      const page = await context.newPage();
      await page.goto('http://localhost:4189');
      await preparePage(page);
      await page.selectOption('select', 'ar');
      await page.waitForTimeout(300);

      const file = 'ui2_desktop_arabic_rtl.png';
      await page.screenshot({ path: path.join(OUT_DIR, file) });
      await copyToBrain(file);
      manifest.push({ name: 'Dashboard Arabic RTL (1280x800)', file });
      console.log(`Captured: ${file}`);
      await context.close();
    }

    fs.writeFileSync(
      path.join(OUT_DIR, 'ui2_manifest.json'),
      JSON.stringify(manifest, null, 2),
      'utf8'
    );
    fs.copyFileSync(path.join(OUT_DIR, 'ui2_manifest.json'), path.join(BRAIN_DIR, 'ui2_manifest.json'));
    console.log(`\nSuccessfully captured ${manifest.length} UI-2 Dashboard production screenshots.`);
  } finally {
    await browser.close();
    killPreviewGroup();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
