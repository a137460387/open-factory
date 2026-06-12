import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('batch transcodes selected videos and imports the outputs into the media bin', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);

  await page.evaluate(() => {
    window.__E2E_ACTIONS__!.setOpenFileDialogPaths!(['C:/Media/tiny-video.mp4', 'C:/Media/four-k-hevc.mov']);
  });

  await page.getByTestId('toolbar-tools-menu-button').click();
  await page.getByTestId('toolbar-tools-batch-transcode-menu-item').click();
  await expect(page.getByTestId('batch-transcode-dialog')).toBeVisible();

  await page.getByTestId('batch-transcode-add-files').click();
  await expect(page.getByTestId('batch-transcode-file-list')).toContainText('tiny-video.mp4');
  await expect(page.getByTestId('batch-transcode-file-list')).toContainText('four-k-hevc.mov');

  await page.getByTestId('batch-transcode-start').click();

  await expect
    .poll(() => page.evaluate(() => (window.__E2E_ACTIONS__!.getProjectMedia!() as Array<{ path: string }>).map((item) => item.path)))
    .toEqual(expect.arrayContaining(['C:/Users/E2E/AppData/Roaming/open-factory/transcodes/tiny-video-h264-720p.mp4', 'C:/Users/E2E/AppData/Roaming/open-factory/transcodes/four-k-hevc-h264-720p.mp4']));

  await expect(page.locator('[data-testid^="media-card-"]')).toHaveCount(2);
});
