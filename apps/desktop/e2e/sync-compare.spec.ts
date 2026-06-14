import { expect, test } from '@playwright/test';
import { addMediaCardToTimeline, waitForE2eActions } from './e2e-actions';

test('opens sync compare for two selected clips and renders both canvases', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setOpenFileDialogPaths!(['C:/Media/tiny-video.mp4', 'C:/Media/camera-b.mp4']));
  await page.getByTestId('import-media-button').click();

  await addMediaCardToTimeline(page, 0);
  await addMediaCardToTimeline(page, 1);
  const clips = page.locator('[data-testid^="timeline-clip-"]');
  await expect(clips).toHaveCount(2);
  await clips.nth(0).click();
  await clips.nth(1).click({ modifiers: ['Shift'] });

  await page.getByTestId('toolbar-tools-menu-button').click();
  await expect(page.getByTestId('toolbar-tools-sync-compare-menu-item')).toBeEnabled();
  await page.getByTestId('toolbar-tools-sync-compare-menu-item').click();

  await expect(page.getByTestId('sync-compare-panel')).toBeVisible();
  await expect(page.getByTestId('sync-compare-left-canvas')).toBeVisible();
  await expect(page.getByTestId('sync-compare-right-canvas')).toBeVisible();
});
