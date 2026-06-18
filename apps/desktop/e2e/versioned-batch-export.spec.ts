import { expect, test } from '@playwright/test';
import { addMediaCardToTimeline, expectExportTaskStatus, openExportDialog, waitForE2eActions } from './e2e-actions';

test('creates two versioned exports with independent resolutions and a comparison report', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.holdExportGate!());
  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page, 0);

  await openExportDialog(page);
  await page.getByTestId('export-mode-version-batch-tab').click();
  await page.getByTestId('export-max-concurrent-select').selectOption('2');
  await page.getByTestId('export-version-output-template').fill('C:/Exports/{platform}-{language}.mp4');

  await expect(page.getByTestId('export-version-row')).toHaveCount(2);
  await expect(page.getByTestId('export-version-output-preview').nth(0)).toContainText('C:/Exports/YouTube-zh.mp4');
  await expect(page.getByTestId('export-version-output-preview').nth(1)).toContainText('C:/Exports/TikTok-zh.mp4');

  await page.getByTestId('export-enqueue-button').click();
  await expectExportTaskStatus(page, 0, 'running');
  await expectExportTaskStatus(page, 1, 'running');

  await page.evaluate(() => window.__E2E_ACTIONS__!.releaseAllExportGates!());
  await expectExportTaskStatus(page, 0, 'success');
  await expectExportTaskStatus(page, 1, 'success');

  await expect(page.getByTestId('export-version-report-row')).toHaveCount(2);
  await expect(page.getByTestId('export-version-report')).toContainText('1920 x 1080');
  await expect(page.getByTestId('export-version-report')).toContainText('1080 x 1920');
  await expect(page.getByTestId('export-version-report-size').first()).toContainText('4.0 KB');

  const calls = await page.evaluate(() => window.__E2E_ACTIONS__!.getExportRunCalls!() as Array<{ outputPath?: string; settings?: { width?: number; height?: number }; fullArgs: string[] }>);
  const byOutput = new Map(calls.map((call) => [call.outputPath ?? call.fullArgs.at(-1), call]));
  expect(byOutput.get('C:/Exports/YouTube-zh.mp4')?.settings).toMatchObject({ width: 1920, height: 1080 });
  expect(byOutput.get('C:/Exports/TikTok-zh.mp4')?.settings).toMatchObject({ width: 1080, height: 1920 });
  expect(await page.evaluate(() => window.__E2E_ACTIONS__!.getFileExists!('C:/Exports/YouTube-zh.mp4'))).toBe(true);
  expect(await page.evaluate(() => window.__E2E_ACTIONS__!.getFileExists!('C:/Exports/TikTok-zh.mp4'))).toBe(true);
});
