import { expect, test } from '@playwright/test';
import { openExportDialog, waitForE2eActions } from './e2e-actions';

test('renders a long export through two local render farm segments and concat merge', async ({ page }) => {
  const outputPath = 'C:/Exports/render-farm-e2e.mp4';

  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate((path) => {
    window.__E2E_ACTIONS__!.clearE2eFiles!();
    window.__E2E_ACTIONS__!.setupRenderFarmFixture!();
    window.__E2E_ACTIONS__!.setSavePath!(path);
  }, outputPath);

  await openExportDialog(page);
  await page.getByTestId('export-render-farm-toggle').check();
  await page.getByTestId('export-render-farm-instances').fill('2');
  await page.getByTestId('export-enqueue-button').click();

  await expect.poll(() => page.evaluate((path) => window.__E2E_ACTIONS__!.getFileExists!(path) as boolean, outputPath)).toBe(true);
  await expect(page.getByTestId('export-task-segment-row')).toHaveCount(2);

  const calls = await page.evaluate(() => window.__E2E_ACTIONS__!.getExportRunCalls!() as Array<{ taskId?: string; fullArgs: string[]; duration: number }>);
  const segmentCalls = calls.filter((call) => call.taskId?.includes(':segment-'));
  const concatCall = calls.find((call) => call.taskId?.endsWith(':concat'));
  expect(segmentCalls).toHaveLength(2);
  expect(concatCall?.fullArgs).toEqual(expect.arrayContaining(['-f', 'concat', '-safe', '0', '-c', 'copy', outputPath]));
  expect(segmentCalls.every((call) => call.fullArgs.includes('-ss') && call.fullArgs.includes('-t'))).toBe(true);

  for (const call of segmentCalls) {
    const segmentOutput = call.fullArgs.at(-1)!;
    expect(segmentOutput).toContain('C:/Temp/open-factory/segments/');
    await expect.poll(() => page.evaluate((path) => window.__E2E_ACTIONS__!.getFileExists!(path) as boolean, segmentOutput)).toBe(false);
  }
});
