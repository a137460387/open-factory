import { expect, test } from '@playwright/test';
import { addMediaCardToTimeline, expectExportTaskStatus, openExportDialog, waitForE2eActions } from './e2e-actions';

test('creates a playable partial file while running and resumes progressive export after pause', async ({ page }) => {
  const outputPath = 'C:/Exports/progressive-export.mp4';
  const partialPath = 'C:/Exports/progressive-export.partial.mp4';

  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate((path) => {
    window.__E2E_ACTIONS__!.clearE2eFiles!();
    window.__E2E_ACTIONS__!.setSavePath!(path);
    window.__E2E_ACTIONS__!.holdExportGate!();
  }, outputPath);
  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page, 0);

  await openExportDialog(page);
  await page.getByTestId('export-preset-select').selectOption('web-1080p');
  await page.getByTestId('export-progressive-toggle').check();
  await page.getByTestId('export-enqueue-button').click();

  await expectExportTaskStatus(page, 0, 'running');
  await expect(page.getByTestId('export-progressive-state')).toBeVisible();
  await expect(page.getByTestId('export-progressive-partial-path')).toHaveText(partialPath);
  await expect.poll(() => page.evaluate((path) => window.__E2E_ACTIONS__!.getFileExists!(path) as boolean, partialPath)).toBe(true);
  await expect.poll(async () => (await page.getByTestId('export-progressive-completed').textContent())?.trim()).not.toContain('0s');

  await page.getByTestId('export-task-progressive-pause-button').click();
  await expectExportTaskStatus(page, 0, 'interrupted');

  await page.getByTestId('export-task-retry-button').click();
  await expectExportTaskStatus(page, 0, 'success');
  await expect.poll(() => page.evaluate((path) => window.__E2E_ACTIONS__!.getFileExists!(path) as boolean, outputPath)).toBe(true);
  await expect.poll(() => page.evaluate((path) => window.__E2E_ACTIONS__!.getFileExists!(path) as boolean, partialPath)).toBe(false);

  const calls = await page.evaluate(() => window.__E2E_ACTIONS__!.getExportRunCalls!() as Array<{ fullArgs: string[] }>);
  const resumed = calls.at(-1)?.fullArgs ?? [];
  const movflags = resumed[resumed.indexOf('-movflags') + 1] ?? '';
  expect(movflags).toContain('frag_keyframe');
  expect(movflags).toContain('empty_moov');
  expect(movflags).toContain('default_base_moof');
  expect(resumed).toContain('-ss');
  expect(resumed.at(-1)).toBe(partialPath);
});
