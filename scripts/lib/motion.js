// Layout/contrast audits measure the settled UI. Entry travel is exercised
// separately by verify_motion.js; do not relax the actual geometry assertions.
export async function waitForPanelMotion(page) {
  await page.waitForFunction(() => [...document.querySelectorAll(
    '#mobile-more-navigation, .cashbook-screen [role="dialog"] > div',
  )].filter(e => e.checkVisibility()).every(e => {
    const s = getComputedStyle(e), m = new DOMMatrix(s.transform === 'none' ? undefined : s.transform);
    return Math.abs(m.m42) < .1 && Number(s.opacity) > .999;
  }));
}
