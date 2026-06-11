import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('filters imported media by filename search and restores all results when cleared', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.getByTestId('import-media-button').click();

  await expect(page.locator('[data-testid^="media-card-"]')).toHaveCount(3);
  await page.getByTestId('media-search-input').fill('tiny-video');
  await expect(page.locator('[data-testid^="media-card-"]')).toHaveCount(1);
  await expect(page.locator('[data-testid^="media-card-"]').first()).toContainText('tiny-video.mp4');

  await page.getByTestId('media-search-input').fill('');
  await expect(page.locator('[data-testid^="media-card-"]')).toHaveCount(3);
});
