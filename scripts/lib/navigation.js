// Exercise the same visible navigation available to a user, including the compact menu.
export async function navigateToAppTab(page, tab) {
  const desktop = page.getByTestId('tab-' + tab);
  if (await desktop.isVisible()) return desktop.click();
  const mobile = page.getByTestId('mobile-tab-' + tab);
  if (!await mobile.isVisible()) await page.getByTestId('mobile-nav-more').click();
  await mobile.click();
}
