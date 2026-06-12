import { expect, test } from '@playwright/test';
import { addMediaCardToTimeline, waitForE2eActions } from './e2e-actions';

test('saves a named snapshot, previews it, and restores the timeline state', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => {
    window.__E2E_ACTIONS__!.clearE2eFiles!();
    window.__E2E_ACTIONS__!.setOpenFileDialogPaths!(['C:/Media/tiny-video.mp4']);
  });

  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page);
  await expect.poll(() => page.evaluate(() => window.__E2E_ACTIONS__!.getTimelineSnapshot!().tracks[0].clips.length)).toBe(1);

  await page.getByTestId('toolbar-edit-menu-button').click();
  await page.getByTestId('toolbar-edit-save-snapshot-menu-item').click();
  await page.getByTestId('snapshot-name-input').fill('Before duplicate');
  await page.getByTestId('snapshot-name-save-button').click();

  await addMediaCardToTimeline(page);
  await expect.poll(() => page.evaluate(() => window.__E2E_ACTIONS__!.getTimelineSnapshot!().tracks[0].clips.length)).toBe(2);

  await page.getByTestId('toolbar-edit-menu-button').click();
  await page.getByTestId('toolbar-edit-snapshot-history-menu-item').click();
  await expect(page.getByTestId('snapshot-history-dialog')).toBeVisible();
  await expect(page.getByTestId('snapshot-row')).toContainText('Before duplicate');

  await page.getByTestId('snapshot-preview-button').first().click();
  await expect(page.getByTestId('snapshot-preview-panel')).toContainText('Before duplicate');

  await page.getByTestId('snapshot-restore-button').first().click();
  await expect.poll(() => page.evaluate(() => window.__E2E_ACTIONS__!.getTimelineSnapshot!().tracks[0].clips.length)).toBe(1);
});
