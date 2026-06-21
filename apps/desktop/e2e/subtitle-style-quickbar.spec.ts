import { expect, test } from '@playwright/test';
import { addMediaCardToTimeline } from './e2e-actions';

test('subtitle style quickbar appears when subtitle clip is selected', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 720 });
  await page.goto('/');
  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page);

  const subtitleClip = page.locator('[data-testid^="timeline-clip-"][data-clip-type="subtitle"]').first();
  if (await subtitleClip.isVisible()) {
    await subtitleClip.click();
    const quickbar = page.getByTestId('subtitle-style-quickbar');
    await expect(quickbar).toBeVisible({ timeout: 5000 });
  }
});
