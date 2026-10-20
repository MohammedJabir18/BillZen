import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const OUT_DIR = path.resolve('test_artifacts/prototypes');
const BRAIN_DIR = '/home/jabir/.gemini/antigravity/brain/e45a19bc-f7ab-47cb-82cf-5babbb752a98/prototypes';

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}
if (!fs.existsSync(BRAIN_DIR)) {
  fs.mkdirSync(BRAIN_DIR, { recursive: true });
}

const VIEWPORTS = [
  { name: '320_compact', width: 320, height: 640 },
  { name: '360_android', width: 360, height: 740 },
  { name: '390_standard_mobile', width: 390, height: 844 },
  { name: '412_large_mobile', width: 412, height: 915 },
  { name: '568_landscape', width: 568, height: 320 },
  { name: '768_tablet_portrait', width: 768, height: 1024 },
  { name: '1024_tablet_landscape', width: 1024, height: 768 },
  { name: '1280_desktop', width: 1280, height: 800 },
];

async function checkOverflow(page, label, width) {
  const result = await page.evaluate(() => {
    const docScroll = document.documentElement.scrollWidth;
    const winInner = window.innerWidth;
    const bodyScroll = document.body.scrollWidth;
    const protoBanner = document.querySelector('.proto-banner');
    const bannerScroll = protoBanner ? protoBanner.scrollWidth : 0;
    const bannerClient = protoBanner ? protoBanner.clientWidth : 0;

    return {
      docScroll,
      winInner,
      bodyScroll,
      docOverflow: docScroll > winInner + 1,
      bannerOverflow: bannerScroll > bannerClient + 1,
    };
  });

  if (result.docOverflow) {
    throw new Error(`[OVERFLOW] ${label} at ${width}px: Document scrollWidth (${result.docScroll}px) exceeds window innerWidth (${result.winInner}px)!`);
  }
  if (result.bannerOverflow) {
    throw new Error(`[OVERFLOW] ${label} at ${width}px: Prototype banner scrollWidth exceeds clientWidth!`);
  }
  return result;
}

async function copyToBrain(filename) {
  const src = path.join(OUT_DIR, filename);
  const dst = path.join(BRAIN_DIR, filename);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dst);
  }
}

async function captureAll() {
  console.log('--- Launching Headless Chromium for Prototype Verification & Capture ---');
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });

  const manifest = {
    timestamp: new Date().toISOString(),
    engine: 'Chromium / Playwright',
    verifiedViewports: VIEWPORTS,
    screenshots: [],
    overflowAudit: {
      direction1: {},
      direction2: {}
    }
  };

  try {
    const proto1Path = 'file://' + path.resolve('docs/prototypes/direction-1-precision-ledger.html');
    const proto2Path = 'file://' + path.resolve('docs/prototypes/direction-2-executive-clarity.html');

    // =========================================================================
    // 1. DIRECTION 1: VIEWPORT OVERFLOW AUDIT (All 8 Viewports)
    // =========================================================================
    console.log('\n[Direction 1] Auditing zero-overflow across 8 viewports...');
    for (const vp of VIEWPORTS) {
      const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
      await page.goto(proto1Path);
      await page.waitForTimeout(100);
      const res = await checkOverflow(page, 'Direction 1', vp.width);
      manifest.overflowAudit.direction1[vp.width] = {
        scrollWidth: res.docScroll,
        innerWidth: res.winInner,
        overflow: false
      };
      console.log(`  ✓ Direction 1 at ${vp.width}x${vp.height} (${vp.name}): 0px overflow (scrollWidth=${res.docScroll}px, innerWidth=${res.winInner}px)`);
      await page.close();
    }

    // =========================================================================
    // 2. DIRECTION 2: VIEWPORT OVERFLOW AUDIT (All 8 Viewports)
    // =========================================================================
    console.log('\n[Direction 2] Auditing zero-overflow across 8 viewports...');
    for (const vp of VIEWPORTS) {
      const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
      await page.goto(proto2Path);
      await page.waitForTimeout(100);
      const res = await checkOverflow(page, 'Direction 2', vp.width);
      manifest.overflowAudit.direction2[vp.width] = {
        scrollWidth: res.docScroll,
        innerWidth: res.winInner,
        overflow: false
      };
      console.log(`  ✓ Direction 2 at ${vp.width}x${vp.height} (${vp.name}): 0px overflow (scrollWidth=${res.docScroll}px, innerWidth=${res.winInner}px)`);
      await page.close();
    }

    // =========================================================================
    // 3. CAPTURE DIRECTION 1 SCREENSHOTS
    // =========================================================================
    console.log('\n[Direction 1] Capturing real-viewport visual states...');

    // Desktop Page (1280x800)
    const deskPage1 = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await deskPage1.goto(proto1Path);
    await deskPage1.waitForTimeout(250);

    // 1. Desktop Light
    const f1 = 'dir1_desktop_light.png';
    await deskPage1.screenshot({ path: path.join(OUT_DIR, f1) });
    await copyToBrain(f1);
    manifest.screenshots.push({ id: f1, direction: 1, name: 'Desktop Light Dashboard', viewport: '1280x800', theme: 'light', lang: 'en' });

    // 2. Desktop Dark
    await deskPage1.evaluate(() => document.body.classList.add('dark'));
    await deskPage1.waitForTimeout(150);
    const f2 = 'dir1_desktop_dark.png';
    await deskPage1.screenshot({ path: path.join(OUT_DIR, f2) });
    await copyToBrain(f2);
    manifest.screenshots.push({ id: f2, direction: 1, name: 'Desktop Dark Dashboard', viewport: '1280x800', theme: 'dark', lang: 'en' });

    // 3. Desktop Malayalam
    await deskPage1.evaluate(() => {
      document.body.classList.remove('dark');
      changeLanguage('ml');
    });
    await deskPage1.waitForTimeout(150);
    const f3 = 'dir1_desktop_malayalam.png';
    await deskPage1.screenshot({ path: path.join(OUT_DIR, f3) });
    await copyToBrain(f3);
    manifest.screenshots.push({ id: f3, direction: 1, name: 'Desktop Malayalam Dashboard', viewport: '1280x800', theme: 'light', lang: 'ml' });

    // 4. Desktop Arabic RTL
    await deskPage1.evaluate(() => {
      changeLanguage('ar');
    });
    await deskPage1.waitForTimeout(150);
    const f4 = 'dir1_desktop_arabic_rtl.png';
    await deskPage1.screenshot({ path: path.join(OUT_DIR, f4) });
    await copyToBrain(f4);
    manifest.screenshots.push({ id: f4, direction: 1, name: 'Desktop Arabic RTL Dashboard', viewport: '1280x800', theme: 'light', lang: 'ar' });
    await deskPage1.close();

    // 5. Mobile 390px Light (Real 390x844 viewport, no fake frame)
    const mobPage1 = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
    await mobPage1.goto(proto1Path);
    await mobPage1.waitForTimeout(200);
    const f5 = 'dir1_mobile_390_light.png';
    await mobPage1.screenshot({ path: path.join(OUT_DIR, f5) });
    await copyToBrain(f5);
    manifest.screenshots.push({ id: f5, direction: 1, name: 'Mobile 390px Light Dashboard', viewport: '390x844', theme: 'light', lang: 'en' });

    // 6. Mobile 390px Dark
    await mobPage1.evaluate(() => document.body.classList.add('dark'));
    await mobPage1.waitForTimeout(150);
    const f6 = 'dir1_mobile_390_dark.png';
    await mobPage1.screenshot({ path: path.join(OUT_DIR, f6) });
    await copyToBrain(f6);
    manifest.screenshots.push({ id: f6, direction: 1, name: 'Mobile 390px Dark Dashboard', viewport: '390x844', theme: 'dark', lang: 'en' });

    // 7. Mobile 390px Cashbook View
    await mobPage1.evaluate(() => {
      document.body.classList.remove('dark');
      navigateTo('cashbook');
    });
    await mobPage1.waitForTimeout(150);
    const f7 = 'dir1_mobile_cashbook.png';
    await mobPage1.screenshot({ path: path.join(OUT_DIR, f7) });
    await copyToBrain(f7);
    manifest.screenshots.push({ id: f7, direction: 1, name: 'Mobile 390px Cashbook Ledger', viewport: '390x844', theme: 'light', lang: 'en' });

    // 8. Mobile 390px Receipt Entry Modal (Bottom Sheet)
    await mobPage1.evaluate(() => openEntryModal('inflow'));
    await mobPage1.waitForTimeout(200);
    const f8 = 'dir1_mobile_receipt_modal.png';
    await mobPage1.screenshot({ path: path.join(OUT_DIR, f8) });
    await copyToBrain(f8);
    manifest.screenshots.push({ id: f8, direction: 1, name: 'Mobile 390px Receipt Entry Sheet', viewport: '390x844', theme: 'light', lang: 'en' });
    await mobPage1.evaluate(() => closeEntryModal());
    await mobPage1.waitForTimeout(100);

    // 9. Mobile 390px More Drawer
    await mobPage1.evaluate(() => toggleMoreDrawer(true));
    await mobPage1.waitForTimeout(200);
    const f9 = 'dir1_mobile_more_drawer.png';
    await mobPage1.screenshot({ path: path.join(OUT_DIR, f9) });
    await copyToBrain(f9);
    manifest.screenshots.push({ id: f9, direction: 1, name: 'Mobile 390px More Drawer Sheet', viewport: '390x844', theme: 'light', lang: 'en' });
    await mobPage1.close();

    // 10. Compact Android 360px Light
    const mob360Page1 = await browser.newPage({ viewport: { width: 360, height: 740 }, isMobile: true });
    await mob360Page1.goto(proto1Path);
    await mob360Page1.waitForTimeout(200);
    const f10 = 'dir1_mobile_360_light.png';
    await mob360Page1.screenshot({ path: path.join(OUT_DIR, f10) });
    await copyToBrain(f10);
    manifest.screenshots.push({ id: f10, direction: 1, name: 'Compact Android 360px Dashboard', viewport: '360x740', theme: 'light', lang: 'en' });
    await mob360Page1.close();

    // 11. Landscape 568x320 Light
    const landPage1 = await browser.newPage({ viewport: { width: 568, height: 320 } });
    await landPage1.goto(proto1Path);
    await landPage1.waitForTimeout(200);
    const f11 = 'dir1_landscape_568_light.png';
    await landPage1.screenshot({ path: path.join(OUT_DIR, f11) });
    await copyToBrain(f11);
    manifest.screenshots.push({ id: f11, direction: 1, name: 'Landscape 568x320 Mobile View', viewport: '568x320', theme: 'light', lang: 'en' });
    await landPage1.close();

    // =========================================================================
    // 4. CAPTURE DIRECTION 2 SCREENSHOTS
    // =========================================================================
    console.log('\n[Direction 2] Capturing real-viewport visual states...');

    // Desktop Page (1280x800)
    const deskPage2 = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await deskPage2.goto(proto2Path);
    await deskPage2.waitForTimeout(250);

    // 12. Desktop Light
    const f12 = 'dir2_desktop_light.png';
    await deskPage2.screenshot({ path: path.join(OUT_DIR, f12) });
    await copyToBrain(f12);
    manifest.screenshots.push({ id: f12, direction: 2, name: 'Desktop Light Statement', viewport: '1280x800', theme: 'light', lang: 'en' });

    // 13. Desktop Dark
    await deskPage2.evaluate(() => document.body.classList.add('dark'));
    await deskPage2.waitForTimeout(150);
    const f13 = 'dir2_desktop_dark.png';
    await deskPage2.screenshot({ path: path.join(OUT_DIR, f13) });
    await copyToBrain(f13);
    manifest.screenshots.push({ id: f13, direction: 2, name: 'Desktop Dark Statement', viewport: '1280x800', theme: 'dark', lang: 'en' });

    // 14. Desktop Malayalam
    await deskPage2.evaluate(() => {
      document.body.classList.remove('dark');
      changeLanguage('ml');
    });
    await deskPage2.waitForTimeout(150);
    const f14 = 'dir2_desktop_malayalam.png';
    await deskPage2.screenshot({ path: path.join(OUT_DIR, f14) });
    await copyToBrain(f14);
    manifest.screenshots.push({ id: f14, direction: 2, name: 'Desktop Malayalam Statement', viewport: '1280x800', theme: 'light', lang: 'ml' });

    // 15. Desktop Arabic RTL
    await deskPage2.evaluate(() => {
      changeLanguage('ar');
    });
    await deskPage2.waitForTimeout(150);
    const f15 = 'dir2_desktop_arabic_rtl.png';
    await deskPage2.screenshot({ path: path.join(OUT_DIR, f15) });
    await copyToBrain(f15);
    manifest.screenshots.push({ id: f15, direction: 2, name: 'Desktop Arabic RTL Statement', viewport: '1280x800', theme: 'light', lang: 'ar' });
    await deskPage2.close();

    // 16. Mobile 390px Light
    const mobPage2 = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
    await mobPage2.goto(proto2Path);
    await mobPage2.waitForTimeout(200);
    const f16 = 'dir2_mobile_390_light.png';
    await mobPage2.screenshot({ path: path.join(OUT_DIR, f16) });
    await copyToBrain(f16);
    manifest.screenshots.push({ id: f16, direction: 2, name: 'Mobile 390px Light Statement', viewport: '390x844', theme: 'light', lang: 'en' });

    // 17. Mobile 390px Dark
    await mobPage2.evaluate(() => document.body.classList.add('dark'));
    await mobPage2.waitForTimeout(150);
    const f17 = 'dir2_mobile_390_dark.png';
    await mobPage2.screenshot({ path: path.join(OUT_DIR, f17) });
    await copyToBrain(f17);
    manifest.screenshots.push({ id: f17, direction: 2, name: 'Mobile 390px Dark Statement', viewport: '390x844', theme: 'dark', lang: 'en' });

    // 18. Mobile 390px Disbursement Modal
    await mobPage2.evaluate(() => {
      document.body.classList.remove('dark');
      openModal('out');
    });
    await mobPage2.waitForTimeout(200);
    const f18 = 'dir2_mobile_disbursement_modal.png';
    await mobPage2.screenshot({ path: path.join(OUT_DIR, f18) });
    await copyToBrain(f18);
    manifest.screenshots.push({ id: f18, direction: 2, name: 'Mobile 390px Disbursement Entry Modal', viewport: '390x844', theme: 'light', lang: 'en' });
    await mobPage2.evaluate(() => closeModal());
    await mobPage2.waitForTimeout(100);

    // 19. Mobile 390px Navigation Menu Drawer
    await mobPage2.evaluate(() => toggleMoreDrawer(true));
    await mobPage2.waitForTimeout(200);
    const f19 = 'dir2_mobile_menu_drawer.png';
    await mobPage2.screenshot({ path: path.join(OUT_DIR, f19) });
    await copyToBrain(f19);
    manifest.screenshots.push({ id: f19, direction: 2, name: 'Mobile 390px Navigation Menu Drawer', viewport: '390x844', theme: 'light', lang: 'en' });
    await mobPage2.close();

    // 20. Compact Android 360px Light
    const mob360Page2 = await browser.newPage({ viewport: { width: 360, height: 740 }, isMobile: true });
    await mob360Page2.goto(proto2Path);
    await mob360Page2.waitForTimeout(200);
    const f20 = 'dir2_mobile_360_light.png';
    await mob360Page2.screenshot({ path: path.join(OUT_DIR, f20) });
    await copyToBrain(f20);
    manifest.screenshots.push({ id: f20, direction: 2, name: 'Compact Android 360px Statement', viewport: '360x740', theme: 'light', lang: 'en' });
    await mob360Page2.close();

    // 21. Landscape 568x320 Light
    const landPage2 = await browser.newPage({ viewport: { width: 568, height: 320 } });
    await landPage2.goto(proto2Path);
    await landPage2.waitForTimeout(200);
    const f21 = 'dir2_landscape_568_light.png';
    await landPage2.screenshot({ path: path.join(OUT_DIR, f21) });
    await copyToBrain(f21);
    manifest.screenshots.push({ id: f21, direction: 2, name: 'Landscape 568x320 Mobile View', viewport: '568x320', theme: 'light', lang: 'en' });
    await landPage2.close();

    // Write manifest
    const manifestPath = path.join(OUT_DIR, 'prototype_manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    console.log(`\nSuccessfully captured ${manifest.screenshots.length} screenshots and verified 8/8 viewports without overflow.`);
    console.log(`Manifest written to: ${manifestPath}`);
  } finally {
    await browser.close();
  }
}

captureAll().catch(err => {
  console.error('Prototype capture & verification failed:', err);
  process.exit(1);
});
