import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('marks generated proxies as expired when the source media mtime changes', async ({ page }) => {
  const sourcePath = 'C:/Media/four-k-hevc.mov';
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.clearE2eFiles!());

  await page.evaluate((path) => window.__E2E_ACTIONS__!.setOpenFileDialogPaths!([path]), sourcePath);
  await page.getByTestId('import-media-button').click();

  const mediaCard = page.locator('[data-testid^="media-card-"]').filter({ hasText: 'four-k-hevc.mov' }).first();
  await expect(mediaCard.locator('[data-testid^="proxy-status-"]')).toHaveAttribute('data-proxy-status', 'ready');

  const assetId = await page.evaluate((path) => {
    const asset = (window.__E2E_ACTIONS__!.getProjectMedia!() as Array<{ id: string; path: string }>).find((item) => item.path === path);
    return asset?.id;
  }, sourcePath);
  expect(assetId).toBeTruthy();

  await page.evaluate((path) => window.__E2E_ACTIONS__!.setMockMtime!(path, 9_000), sourcePath);
  await page.getByTestId('toolbar-settings-button').click();
  await page.getByTestId('settings-tab-proxy').click();
  await page.getByTestId('proxy-verify-button').click();

  await expect(page.getByTestId(`proxy-management-status-${assetId}`)).toHaveAttribute('data-proxy-status', 'expired');
  await expect(page.getByTestId('proxy-storage-stats')).toContainText('1 个过期');
});
