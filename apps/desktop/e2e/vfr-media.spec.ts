import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('shows a VFR badge for imported variable frame rate media', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setOpenFileDialogPaths!(['C:/Media/vfr-phone.mp4']));
  await page.getByTestId('import-media-button').click();

  const card = page.locator('[data-testid^="media-card-"]').first();
  await expect(card).toContainText('vfr-phone.mp4');
  await expect(card.locator('[data-testid^="vfr-badge-"]')).toBeVisible();
});
