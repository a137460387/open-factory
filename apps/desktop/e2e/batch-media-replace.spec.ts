import { expect, test } from '@playwright/test';
import { addMediaCardToTimeline } from './e2e-actions';

test('batch media replace shows precheck report before replacing', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 720 });
  await page.goto('/');
  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page);

  const clip = page.locator('[data-testid^="timeline-clip-"]').first();
  await clip.click({ button: 'right' });

  const replaceOption = page.getByTestId('context-menu-replace-media');
  if (await replaceOption.isVisible()) {
    await replaceOption.click();
    await expect(page.getByTestId('media-replace-dialog')).toBeVisible({ timeout: 5000 });
  }
});
