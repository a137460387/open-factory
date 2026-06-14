import { expect, test } from '@playwright/test';
import { addMediaCardToTimeline, waitForE2eActions } from './e2e-actions';

test('sets a track color label and shows it on timeline clips', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);

  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page, 0);

  await page.locator('[data-testid^="track-color-button-"]').first().click();
  await page.getByTestId('track-color-swatch-blue').click();

  const clip = page.locator('[data-testid^="timeline-clip-"]').first();
  const strip = page.locator('[data-testid^="clip-color-strip-"]').first();
  await expect(clip).toHaveAttribute('data-color-label', 'blue');
  await expect(strip).toHaveAttribute('data-color', 'blue');

  await page.getByTestId('timeline-color-filter-blue').click();
  await expect(page.locator('[data-testid^="timeline-clip-"]')).toHaveCount(1);

  await page.getByTestId('timeline-color-filter-pink').click();
  await expect(page.locator('[data-testid^="timeline-clip-"]')).toHaveCount(0);
});
