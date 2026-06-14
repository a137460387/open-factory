import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('shows an error marker for a mocked damaged media file', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.getByTestId('toolbar-open-project-button').click();
  await page.evaluate(() => window.__E2E_ACTIONS__!.setDamagedMediaPaths!(['C:/Media/tiny-video.mp4']));

  await page.getByTestId('toolbar-tools-menu-button').click();
  await page.getByTestId('toolbar-tools-media-precheck-menu-item').click();

  await expect(page.getByTestId('media-precheck-panel')).toBeVisible();
  const row = page.getByTestId('media-precheck-row-media-video');
  await expect(row).toHaveAttribute('data-status', 'error');
  await expect(row.getByTestId('media-precheck-issue')).toContainText('可能损坏');
});
