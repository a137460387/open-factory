import { expect, test } from '@playwright/test';
import { addMediaCardToTimeline, expectExportTaskStatus, openExportDialog, waitForE2eActions } from './e2e-actions';

test('exports a speed-adjusted clip with shortened duration', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page);

  await page.getByTestId('clip-speed-input').fill('2');
  await expect(page.getByText('开始 00:00:00:00 / 时长 00:00:03:00 / 速度 2.00x')).toBeVisible();

  await openExportDialog(page);
  await page.getByTestId('export-output-path').fill('C:/Exports/speed-output.mp4');
  await page.getByTestId('export-enqueue-button').click();
  await expectExportTaskStatus(page, 0, 'success');

  const plan = await page.evaluate(
    () => window.__E2E_ACTIONS__!.getLastExportPlan!() as { duration: number; inputs: Array<{ args: string[] }>; filterComplex: string }
  );
  expect(plan.duration).toBeCloseTo(3, 2);
  expect(plan.inputs[0].args).toEqual(['-ss', '0', '-t', '6']);
  expect(plan.filterComplex).toContain('setpts=(PTS-STARTPTS)/2+0/TB');
  expect(plan.filterComplex).toContain('atempo=2.0');
});

test('exports a speed-ramped clip with integrated duration', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page);

  const clipId = await page.evaluate(() => window.__E2E_ACTIONS__!.getTimelineSnapshot!().tracks[0].clips[0].id);
  await page.evaluate((id) => {
    window.__E2E_ACTIONS__!.addKeyframe!(id, 'speed', 0, 1);
    window.__E2E_ACTIONS__!.addKeyframe!(id, 'speed', 3, 2);
  }, clipId);
  await expect(page.getByText('开始 00:00:00:00 / 时长 00:00:03:23 / 速度 1.00x')).toBeVisible();

  await openExportDialog(page);
  await page.getByTestId('export-output-path').fill('C:/Exports/speed-ramp-output.mp4');
  await page.getByTestId('export-enqueue-button').click();
  await expectExportTaskStatus(page, 0, 'success');

  const plan = await page.evaluate(
    () => window.__E2E_ACTIONS__!.getLastExportPlan!() as { duration: number; inputs: Array<{ args: string[] }>; filterComplex: string }
  );
  expect(Math.abs(plan.duration - 3.75)).toBeLessThanOrEqual(2 / 30);
  expect(plan.inputs[0].args).toEqual(['-ss', '0', '-t', '6']);
  expect(plan.filterComplex).toContain("setpts='(");
  expect(plan.filterComplex).toContain('if(lte(((PTS-STARTPTS)*TB)');
});

test('exports optical-flow slow motion with mci interpolation', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page);

  await page.getByTestId('clip-speed-input').fill('0.4');
  await expect(page.getByTestId('clip-slow-motion-mode-select')).toBeVisible();
  await page.getByTestId('clip-slow-motion-mode-select').selectOption('optical-flow');

  await openExportDialog(page);
  await page.getByTestId('export-output-path').fill('C:/Exports/optical-flow-output.mp4');
  await page.getByTestId('export-enqueue-button').click();
  await expectExportTaskStatus(page, 0, 'success');

  const plan = await page.evaluate(() => window.__E2E_ACTIONS__!.getLastExportPlan!() as { filterComplex: string });
  expect(plan.filterComplex).toContain('minterpolate=fps=30:mi_mode=mci:mc_mode=aobmc:vsbmc=1');
});
