import { test, expect } from './fixtures';

test('builds a multitrack FFmpeg plan with text artifacts and runs mocked export', async ({ page, toolbar, mediaBin, timeline, exportDialog }) => {
  await toolbar.goto();
  await page.evaluate(() => window.__E2E_ACTIONS__!.holdExportGate!());
  await mediaBin.importMedia();
  await mediaBin.addToTimeline(0);
  await timeline.addTextClip();

  await toolbar.openExport();
  await exportDialog.waitForOpen();
  await exportDialog.selectPreset('web-1080p');
  await exportDialog.setMaxConcurrent('1');
  await exportDialog.selectFps('60');
  await exportDialog.fillBatchPaths('C:/Exports/e2e-output.mp4\nC:/Exports/e2e-output-2.mp4');
  await exportDialog.enqueue();
  await exportDialog.expectTaskStatus(0, 'running');
  await exportDialog.expectTaskStatus(1, 'pending');
  await exportDialog.cancelTask(1);
  await exportDialog.expectTaskStatus(1, 'canceled');
  await page.evaluate(() => window.__E2E_ACTIONS__!.releaseExportGate!());
  await exportDialog.expectTaskStatus(0, 'success');
  await exportDialog.retryTask(0);
  await exportDialog.expectTaskStatus(1, 'success');

  const plan = await page.evaluate(() => window.__E2E_ACTIONS__!.getLastExportPlan!() as { fullArgs: string[]; filterComplex: string; textArtifacts: unknown[] });
  expect(plan.fullArgs).toContain('-filter_complex');
  expect(plan.filterComplex).toContain('s=1920x1080:r=60');
  expect(plan.filterComplex).toContain('overlay=');
  expect(plan.filterComplex).toContain('drawtext=textfile=__TEXTFILE_');
  expect(plan.filterComplex).toContain('[0:a:0]');
  expect(plan.filterComplex).toContain('amix=inputs=1');
  expect(plan.textArtifacts).toHaveLength(1);
  expect(plan.fullArgs.at(-1)).toBe('C:/Exports/e2e-output-2.mp4');
});

test('updates export cost estimate when switching presets', async ({ toolbar, mediaBin, exportDialog }) => {
  await toolbar.goto();
  await mediaBin.importMedia();
  await mediaBin.addToTimeline(0);

  await toolbar.openExport();
  await expect(exportDialog.costEstimatePanel).toBeVisible();
  await exportDialog.selectPreset('web-1080p');
  const initialDuration = await exportDialog.getCostDuration();
  await exportDialog.selectPreset('4k');

  await expect.poll(async () => await exportDialog.getCostDuration()).not.toBe(initialDuration);
  await expect(exportDialog.costSize).toContainText('MB');
});

test('exports the marked in/out range with frame-aligned duration', async ({ page, toolbar, mediaBin, timeline, exportDialog }) => {
  await toolbar.goto();
  await page.evaluate(() => window.__E2E_ACTIONS__!.setSavePath!('C:/Exports/range-export.mp4'));
  await mediaBin.importMedia();
  await mediaBin.addToTimeline(0);

  await timeline.focus();
  await timeline.setPlayheadTime(1);
  await timeline.markIn();
  await timeline.setPlayheadTime(3.033);
  await timeline.markOut();

  await expect(timeline.exportRangeHighlight).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => window.__E2E_ACTIONS__!.getExportRanges!() as Array<{ start: number; end: number }>))
    .toEqual([{ id: expect.any(String), label: '导出区间 1', start: 1, end: 3.033 }]);

  await toolbar.openExport();
  await exportDialog.setRange('in-out');
  await exportDialog.enqueue();
  await exportDialog.expectTaskStatus(0, 'success');

  const plan = await page.evaluate(() => window.__E2E_ACTIONS__!.getLastExportPlan!() as { outputArgs: string[]; duration: number });
  expect(plan.outputArgs).toEqual(expect.arrayContaining(['-ss', '1', '-t', '2.033']));
  expect(Math.abs(plan.duration - 61 / 30)).toBeLessThanOrEqual(1 / 30);
});

test('runs export queue with two concurrent tasks and starts the third after a slot frees', async ({ page, toolbar, mediaBin, exportDialog }) => {
  await toolbar.goto();
  await page.evaluate(() => window.__E2E_ACTIONS__!.holdExportGate!());
  await mediaBin.importMedia();
  await mediaBin.addToTimeline(0);

  await toolbar.openExport();
  await exportDialog.selectPreset('web-1080p');
  await exportDialog.setMaxConcurrent('2');
  await exportDialog.fillBatchPaths('C:/Exports/queue-a.mp4\nC:/Exports/queue-b.mp4\nC:/Exports/queue-c.mp4');
  await exportDialog.enqueue();

  await exportDialog.expectTaskStatus(0, 'running');
  await exportDialog.expectTaskStatus(1, 'running');
  await exportDialog.expectTaskStatus(2, 'pending');

  await page.evaluate(() => window.__E2E_ACTIONS__!.releaseExportGate!());

  await exportDialog.expectTaskStatus(0, 'success');
  await exportDialog.expectTaskStatus(1, 'running');
  await exportDialog.expectTaskStatus(2, 'running');
  await page.evaluate(() => window.__E2E_ACTIONS__!.releaseAllExportGates!());
  await exportDialog.expectTaskStatus(1, 'success');
  await exportDialog.expectTaskStatus(2, 'success');
});

test('starts a scheduled export after the selected start time', async ({ page, toolbar, mediaBin, exportDialog }) => {
  await toolbar.goto();
  await page.evaluate(() => window.__E2E_ACTIONS__!.holdExportGate!());
  await mediaBin.importMedia();
  await mediaBin.addToTimeline(0);

  await toolbar.openExport();
  const startValue = await page.evaluate(() => {
    const date = new Date(Date.now() + 4_000);
    if (date.getSeconds() === 0) {
      date.setSeconds(1);
    }
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  });
  await exportDialog.enableSchedule();
  await exportDialog.setScheduleTime(startValue);
  await exportDialog.fillBatchPaths('C:/Exports/scheduled.mp4');
  await exportDialog.enqueue();

  await exportDialog.expectTaskStatus(0, 'scheduled');
  await exportDialog.expectTaskStatus(0, 'running');
  const trayProgress = await page.evaluate(() => window.__E2E_ACTIONS__!.getLastTrayProgress!() as { runningCount: number } | undefined);
  expect(trayProgress?.runningCount).toBe(1);
  await page.evaluate(() => window.__E2E_ACTIONS__!.releaseAllExportGates!());
  await exportDialog.expectTaskStatus(0, 'success');
});

test('starts high priority export before queued low priority work and writes log history', async ({ page, toolbar, mediaBin, exportDialog }) => {
  await toolbar.goto();
  await page.evaluate(() => {
    window.__E2E_ACTIONS__!.holdExportGate!();
    window.__E2E_ACTIONS__!.setAvailableMemoryBytes!(1024 * 1024 * 1024);
  });
  await mediaBin.importMedia();
  await mediaBin.addToTimeline(0);

  await toolbar.openExport();
  await exportDialog.setMaxConcurrent('1');
  await exportDialog.setPriority('low');
  await exportDialog.fillBatchPaths('C:/Exports/priority-low.mp4');
  await exportDialog.enqueue();
  await expect(exportDialog.queueList).toContainText('可用内存低于 2GB');
  await exportDialog.expectTaskStatus(0, 'pending');

  await exportDialog.setPriority('high');
  await exportDialog.fillBatchPaths('C:/Exports/priority-high.mp4');
  await exportDialog.enqueue();

  await expect(exportDialog.getTaskPriority(0)).toHaveText('高');
  await exportDialog.expectTaskStatus(0, 'pending');
  await page.evaluate(() => window.__E2E_ACTIONS__!.setAvailableMemoryBytes!(8 * 1024 * 1024 * 1024));
  await exportDialog.expectTaskStatus(0, 'running');
  await exportDialog.expectTaskStatus(1, 'pending');

  await page.evaluate(() => window.__E2E_ACTIONS__!.releaseExportGate!());
  await exportDialog.expectTaskStatus(0, 'success');

  const historyPath = 'C:/Users/E2E/AppData/Roaming/open-factory/export-history.json';
  await expect.poll(() => page.evaluate((path) => window.__E2E_ACTIONS__!.getWrittenFile!(path) as string | undefined, historyPath)).not.toBeUndefined();
  const history = await page.evaluate((path) => JSON.parse(window.__E2E_ACTIONS__!.getWrittenFile!(path) as string) as Array<{ outputPath: string; logPath?: string }>, historyPath);
  const high = history.find((entry) => entry.outputPath === 'C:/Exports/priority-high.mp4');
  expect(high?.logPath).toBeTruthy();
  await expect.poll(() => page.evaluate((path) => window.__E2E_ACTIONS__!.getWrittenFileSize!(path) as number, high!.logPath!)).toBeGreaterThan(0);
  await expect(exportDialog.historyList).toContainText('priority-high.mp4');

  await page.evaluate(() => window.__E2E_ACTIONS__!.releaseAllExportGates!());
  await exportDialog.expectTaskStatus(1, 'success');
});

test('uses detected NVENC hardware encoder when hardware encoding is enabled', async ({ page, toolbar, mediaBin, exportDialog }) => {
  await toolbar.goto();
  await mediaBin.importMedia();
  await mediaBin.addToTimeline(0);

  await toolbar.openExport();
  await exportDialog.selectPreset('web-1080p');
  await expect(page.getByTestId('export-hardware-encoding-toggle')).toBeEnabled();
  await exportDialog.enableHardwareEncoding();
  await exportDialog.enqueue();
  await exportDialog.expectTaskStatus(0, 'success');

  const plan = await page.evaluate(() => window.__E2E_ACTIONS__!.getLastExportPlan!() as { fullArgs: string[] });
  expect(plan.fullArgs).toEqual(expect.arrayContaining(['-c:v', 'h264_nvenc', '-preset', 'p4', '-cq', '23']));
});

test('limits FFmpeg threads when low-power export mode is enabled', async ({ page, toolbar, mediaBin, settingsDialog, exportDialog }) => {
  await toolbar.goto();
  await page.evaluate(() => window.__E2E_ACTIONS__!.clearE2eFiles!());
  await toolbar.openSettings();
  await settingsDialog.waitForOpen();
  await settingsDialog.enableLowPowerExport();
  await expect
    .poll(() => page.evaluate(() => window.__E2E_ACTIONS__!.getWrittenFile!('C:/Users/E2E/AppData/Roaming/open-factory/settings.json') as string | undefined))
    .toContain('"lowPowerMode": true');
  await settingsDialog.close();

  await mediaBin.importMedia();
  await mediaBin.addToTimeline(0);
  await toolbar.openExport();
  await exportDialog.selectPreset('web-1080p');
  await exportDialog.enqueue();
  await exportDialog.expectTaskStatus(0, 'success');

  const plan = await page.evaluate(() => window.__E2E_ACTIONS__!.getLastExportPlan!() as { fullArgs: string[] });
  const threadsIndex = plan.fullArgs.lastIndexOf('-threads');
  expect(threadsIndex).toBeGreaterThan(-1);
  expect(Number(plan.fullArgs[threadsIndex + 1])).toBeGreaterThanOrEqual(1);
});

test('blocks export when preflight finds missing media and allows export after relink', async ({ page, toolbar, mediaBin, exportDialog }) => {
  await toolbar.goto();
  await page.evaluate(() => window.__E2E_ACTIONS__!.setMissingProjectNext!());
  await toolbar.openProject();
  await expect(page.locator('[data-testid^="media-card-"][data-missing="true"]')).toBeVisible();

  await toolbar.openExport();
  await exportDialog.enqueue();
  await expect(exportDialog.preflightPanel).toBeVisible();
  await expect(exportDialog.preflightIssue).toHaveAttribute('data-type', 'missing-media');
  await expect(exportDialog.preflightPanel).toContainText('tiny-video.mp4');
  await expect(page.getByTestId('export-task-status')).toHaveCount(0);

  await exportDialog.preflightRelink();
  await expect(page.locator('[data-testid^="media-card-"][data-missing="true"]')).toHaveCount(0);

  await toolbar.openExport();
  await exportDialog.enqueue();
  await exportDialog.expectTaskStatus(0, 'success');
});
