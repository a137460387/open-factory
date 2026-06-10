import { expect, test } from '@playwright/test';

test('uses the preview compositor and mixes embedded video audio', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('import-media-button').click();
  await page.locator('[data-testid^="media-card-"]').first().getByText('Add to timeline').click();
  await page.getByLabel('Play').first().click();

  await expect.poll(() => page.evaluate(() => window.__OPEN_FACTORY_PREVIEW_DEBUG__?.mode)).toBeTruthy();
  await expect.poll(() => page.evaluate(() => window.__OPEN_FACTORY_PREVIEW_DEBUG__?.renderCount ?? 0)).toBeGreaterThan(0);
  await expect.poll(() => page.evaluate(() => window.__OPEN_FACTORY_AUDIO_MIX_DEBUG__?.clipTypes.includes('video') ?? false)).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__OPEN_FACTORY_AUDIO_MIX_DEBUG__?.gainValues.some((value) => value > 0) ?? false)).toBe(true);
});
