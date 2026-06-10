import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('relinks three missing media files from a folder', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.removeItem('open-factory:e2e-files');
    localStorage.removeItem('open-factory:e2e-mtimes');
  });
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => {
    window.__E2E_ACTIONS__!.clearE2eFiles!();
    window.__E2E_ACTIONS__!.setOpenFileDialogPaths!(['C:/Projects/batch-missing.cutproj.json']);
  });

  await page.getByLabel('Open project').click();
  const missingCards = page.locator('[data-testid^="media-card-"]').filter({ hasText: 'Missing' });
  await expect(missingCards).toHaveCount(3);

  await page.getByTestId('relink-all-button').click();
  await expect(missingCards).toHaveCount(0);
});
