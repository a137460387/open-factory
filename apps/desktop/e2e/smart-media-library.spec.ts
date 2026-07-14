import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('list view shows codec, frame rate and bit rate columns', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupMediaLibraryFixture!());

  // Switch to list view
  await page.getByTestId('media-view-list').click();
  await expect(page.getByTestId('media-list-view')).toBeVisible();

  // Verify new column headers exist
  await expect(page.getByTestId('media-list-sort-codec')).toContainText('编码');
  await expect(page.getByTestId('media-list-sort-frameRate')).toContainText('帧率');
  await expect(page.getByTestId('media-list-bitrate-header')).toContainText('码率');

  // Verify codec value is displayed for video
  await expect(page.getByTestId('media-list-codec-media-video')).toContainText('h264');

  // Verify frame rate is displayed for video
  await expect(page.getByTestId('media-list-frame-rate-media-video')).toContainText('fps');
});

test('sorts by frame rate in list view', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupMediaLibraryFixture!());

  // Switch to list view
  await page.getByTestId('media-view-list').click();
  await expect(page.getByTestId('media-list-view')).toBeVisible();

  // Sort by frame rate
  await page.getByTestId('media-sort-key-select').selectOption('frameRate');
  await expect(page.getByTestId('media-sort-key-select')).toHaveValue('frameRate');

  // Verify rows are present
  await expect(page.locator('[data-testid^="media-list-row-"]')).toHaveCount(3);
});

test('clicking a row shows metadata panel', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupMediaLibraryFixture!());

  // Switch to list view
  await page.getByTestId('media-view-list').click();
  await expect(page.getByTestId('media-list-view')).toBeVisible();

  // Click the row to select it
  await page.getByTestId('media-list-row-media-video').click();

  // Metadata panel should appear with basic info
  await expect(page.getByTestId('metadata-panel')).toBeVisible();
  await expect(page.getByTestId('metadata-codec')).toContainText('h264');
  await expect(page.getByTestId('metadata-frame-rate')).toContainText('fps');
  await expect(page.getByTestId('metadata-duration')).toBeVisible();
  await expect(page.getByTestId('metadata-resolution')).toContainText('1280');
});
