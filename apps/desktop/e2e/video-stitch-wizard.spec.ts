import { expect, test } from '@playwright/test';
import { expectExportTaskStatus, waitForE2eActions } from './e2e-actions';

test('stitches three videos through the wizard and exports the generated timeline', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => {
    window.__E2E_ACTIONS__!.setOpenFileDialogPaths!(['C:/Media/tiny-video.mp4', 'C:/Media/camera-b.mp4', 'C:/Media/four-k-hevc.mov']);
    window.__E2E_ACTIONS__!.setSavePath!('C:/Exports/video-stitch-wizard.mp4');
  });
  await page.getByTestId('import-media-button').click();
  await expect(page.locator('[data-testid^="media-card-"]')).toHaveCount(3);

  await page.getByTestId('toolbar-tools-menu-button').click();
  await page.getByTestId('toolbar-tools-video-stitch-menu-item').click();
  await expect(page.getByTestId('video-stitch-wizard-dialog')).toBeVisible();
  await expect(page.getByTestId('video-stitch-order-list').locator('[data-testid^="video-stitch-order-"]')).toHaveCount(3);

  await page.getByTestId('video-stitch-generate-button').click();
  await expect(page.getByTestId('export-dialog')).toBeVisible();

  const generatedTrack = await page.evaluate(() => {
    const timeline = window.__E2E_ACTIONS__!.getTimelineSnapshot!() as { tracks: Array<{ name: string; type: string; clips: Array<{ id: string }> }> };
    return timeline.tracks.find((track) => track.type === 'video' && track.clips.length === 3);
  });
  expect(generatedTrack?.clips).toHaveLength(3);

  await page.getByTestId('export-enqueue-button').click();
  await expectExportTaskStatus(page, 0, 'success');
  await expect.poll(() => page.evaluate(() => window.__E2E_ACTIONS__!.getFileExists!('C:/Exports/video-stitch-wizard.mp4') as boolean)).toBe(true);
});
