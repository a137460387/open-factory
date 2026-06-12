import { expect, test } from '@playwright/test';
import { addMediaCardToTimeline, waitForE2eActions } from './e2e-actions';

test('creates a share package from the file menu', async ({ page }) => {
  const outputPath = 'C:/Exports/e2e-share-package.zip';
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate((path) => window.__E2E_ACTIONS__!.setSavePath!(path), outputPath);

  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page, 0);
  await page.getByTestId('toolbar-file-menu-button').click();
  await page.getByTestId('toolbar-file-share-package-menu-item').click();

  await expect.poll(() => page.evaluate((path) => window.__E2E_ACTIONS__!.getFileExists!(path) as boolean, outputPath)).toBe(true);
  await expect.poll(() => page.evaluate((path) => window.__E2E_ACTIONS__!.getWrittenFileSize!(path) as number, outputPath)).toBeGreaterThan(0);
});
