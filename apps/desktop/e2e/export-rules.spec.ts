import { expect, test } from '@playwright/test';
import { addMediaCardToTimeline, expectExportTaskStatus, openExportDialog, waitForE2eActions } from './e2e-actions';

test('copies a successful export to the configured rule directory', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.clearE2eFiles!());
  const targetDirectory = `C:/Exports/rule-copy-${Date.now()}`;
  const outputPath = 'C:/Exports/rule-source.mp4';
  const copiedPath = `${targetDirectory}/rule-source.mp4`;

  await page.getByTestId('toolbar-settings-button').click();
  await expect(page.getByTestId('settings-dialog')).toBeVisible();
  await page.getByTestId('settings-export-rule-copy-success-toggle').check();
  await page.getByTestId('settings-export-rule-copy-directory-input').fill(targetDirectory);
  await page.getByTestId('settings-close-button').click();

  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page, 0);
  await openExportDialog(page);
  await page.getByTestId('export-output-path').fill(outputPath);
  await page.getByTestId('export-enqueue-button').click();
  await expectExportTaskStatus(page, 0, 'success');

  await expect.poll(() => page.evaluate((path) => window.__E2E_ACTIONS__!.getFileExists!(path), copiedPath)).toBe(true);
  await expect.poll(() => page.evaluate((path) => window.__E2E_ACTIONS__!.getWrittenFileSize!(path), copiedPath)).toBeGreaterThan(0);
});
