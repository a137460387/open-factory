import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('opens spectrum analysis from media library and shows statistics', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.clearE2eFiles!());
  await page.reload();
  await waitForE2eActions(page);

  await page.getByTestId('import-media-button').click();
  const firstCard = page.locator('[data-testid^="media-card-"]').first();
  await expect(firstCard).toBeVisible();

  await firstCard.click({ button: 'right' });
  await page.locator('[data-testid^="media-spectrum-analysis-"]').first().click();

  await expect(page.getByTestId('audio-spectrum-dialog')).toBeVisible();
  await expect(page.getByTestId('audio-spectrum-canvas')).toBeVisible();
  await expect(page.getByTestId('audio-spectrum-stats')).toBeVisible();
  await expect(page.getByTestId('audio-spectrum-stat-lufs')).toContainText('-18.4 LUFS');
  await expect(page.getByTestId('audio-spectrum-stat-rms')).toContainText('-20.6 dB');
});
