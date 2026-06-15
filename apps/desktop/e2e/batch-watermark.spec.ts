import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('queues three batch watermark export tasks for selected media files', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setOpenFileDialogPaths!(['C:/Media/tiny-video.mp4', 'C:/Media/camera-b.mp4', 'C:/Media/test-image.png']));
  await page.getByTestId('import-media-button').click();
  await expect(page.locator('[data-testid^="media-card-"]')).toHaveCount(3);

  await page.getByTestId('toolbar-tools-menu-button').click();
  await page.getByTestId('toolbar-tools-batch-watermark-menu-item').click();
  await expect(page.getByTestId('batch-watermark-dialog')).toBeVisible();

  await page.getByTestId('batch-watermark-select-all').click();
  await expect(page.getByTestId('batch-watermark-selected-count')).toContainText('3');
  await page.getByTestId('batch-watermark-text-input').fill('DRAFT');
  await page.getByTestId('batch-watermark-enqueue-button').click();

  await expect(page.getByTestId('batch-watermark-queue-status')).toContainText('当前队列 3 个任务');
  await expect
    .poll(() => page.evaluate(() => window.__E2E_ACTIONS__!.getExportRunCalls!().length))
    .toBe(3);

  const calls = await page.evaluate(() => window.__E2E_ACTIONS__!.getExportRunCalls!() as Array<{ fullArgs: string[] }>);
  expect(calls.every((call) => call.fullArgs.join(' ').includes("drawtext=text='DRAFT'"))).toBe(true);
});
