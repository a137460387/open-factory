import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('opens media info panel with resolution and codec details', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.clearE2eFiles!());
  await page.reload();
  await waitForE2eActions(page);

  await page.getByTestId('import-media-button').click();
  const firstCard = page.locator('[data-testid^="media-card-"]').first();
  await expect(firstCard).toBeVisible();
  await firstCard.click({ button: 'right' });
  await firstCard.locator('[data-testid^="media-info-"]').click();

  await expect(page.getByTestId('media-info-dialog')).toBeVisible();
  await expect(page.getByTestId('media-info-resolution')).toHaveText('1280 x 720');
  await expect(page.getByTestId('media-info-codec')).toContainText('H.264');
  await expect(page.getByTestId('media-info-loudness')).toContainText('LUFS');
});
