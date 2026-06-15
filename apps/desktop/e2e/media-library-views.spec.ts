import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('switches media library to list view and shows file size column', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => {
    window.__E2E_ACTIONS__!.clearE2eFiles!();
    window.__E2E_ACTIONS__!.setOpenFileDialogPaths!(['C:/Media/tiny-video.mp4', 'C:/Media/tiny-audio.wav', 'C:/Media/test-image.png']);
  });

  await page.getByTestId('import-media-button').click();
  await expect(page.locator('[data-testid^="media-card-"]')).toHaveCount(3);

  await page.getByTestId('media-view-list').click();
  await expect(page.getByTestId('media-list-view')).toBeVisible();
  await expect(page.getByTestId('media-list-sort-size')).toContainText('文件大小');
  await expect(page.locator('[data-testid^="media-list-size-"]').first()).toBeVisible();
});
