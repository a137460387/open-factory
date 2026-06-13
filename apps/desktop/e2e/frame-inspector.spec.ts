import { expect, test } from '@playwright/test';
import { addMediaCardToTimeline, waitForE2eActions } from './e2e-actions';

test('shows frame inspector values when hovering the preview', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page, 0);

  await expect.poll(() => page.evaluate(() => window.__OPEN_FACTORY_PREVIEW_DEBUG__?.renderCount ?? 0)).toBeGreaterThan(0);
  await page.getByTestId('preview-frame-inspector-toggle').click();
  await expect(page.getByTestId('frame-inspector-overlay')).toBeVisible();

  await page.getByTestId('frame-inspector-overlay').hover({ position: { x: 480, y: 270 } });
  await expect(page.getByTestId('frame-inspector-popover')).toBeVisible();
  await expect(page.getByTestId('frame-inspector-hex')).toContainText('#');
});
