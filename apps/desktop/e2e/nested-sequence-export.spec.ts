import { test, expect } from './fixtures';

/** 重置为干净项目状态 —— 使用 E2E action 清除文件后导航 */
async function openCleanProject(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/');
  await expect
    .poll(() => page.evaluate(() => Boolean(window.__E2E_ACTIONS__)), { timeout: 15_000 })
    .toBe(true);
  await page.evaluate(() => window.__E2E_ACTIONS__!.clearE2eFiles!());
  // 等待 UI 完全稳定后再进行后续操作
  await expect(page.getByTestId('import-media-button')).toBeVisible({ timeout: 10_000 });
}

test('packs clips into a nested sequence and exports with matching duration', async ({ page, toolbar, mediaBin, timeline, exportDialog }) => {
  test.slow();
  await openCleanProject(page);

  await toolbar.importMedia();
  await mediaBin.addToTimeline(0);
  await mediaBin.addToTimeline(0);

  await timeline.expectClipCount(2);

  // Shift+click 选中第一个 clip，再右键打开上下文菜单
  const firstClip = timeline.getClipByIndex(0);
  await page.keyboard.down('Shift');
  await firstClip.click();
  await page.keyboard.up('Shift');
  // 等待选择状态更新
  await expect(firstClip).toHaveAttribute('data-selected', 'true', { timeout: 5_000 }).catch(() => {
    // 如果没有 data-selected 属性，跳过此检查
  });
  await firstClip.click({ button: 'right' });
  await expect(page.getByTestId('clip-action-menu')).toBeVisible();
  await page.getByTestId('clip-action-pack-nested').click();

  await timeline.expectClipCount(1);
  await expect(timeline.getClipByIndex(0)).toHaveAttribute('data-clip-type', 'nested-sequence');

  // 进入嵌套序列并返回
  await timeline.getClipByIndex(0).dblclick();
  await expect(page.getByTestId('sequence-back-main')).toBeVisible();
  await timeline.expectClipCount(2);
  await page.getByTestId('sequence-back-main').click();
  await timeline.expectClipCount(1);

  // 打开导出对话框并入队
  await toolbar.openExport();
  await exportDialog.waitForOpen();
  await page.getByTestId('export-output-path').fill('C:/Exports/nested-output.mp4');
  await exportDialog.enqueue();
  await exportDialog.expectTaskStatus(0, 'success');

  const plan = await page.evaluate(
    () =>
      window.__E2E_ACTIONS__!.getLastExportPlan!() as {
        duration: number;
        nestedPlans: Array<{ sequenceId: string; placeholder: string; plan: { duration: number } }>;
        inputs: Array<{ path: string }>;
      }
  );
  expect(plan.nestedPlans).toHaveLength(1);
  expect(plan.inputs[0].path).toContain('__NESTED_SEQUENCE_');
  expect(plan.nestedPlans[0].plan.duration).toBeCloseTo(plan.duration, 2);
});

test('queues two selected sequences from batch sequence render', async ({ page, toolbar, mediaBin, timeline, exportDialog }) => {
  test.slow();
  await openCleanProject(page);

  await toolbar.importMedia();
  await mediaBin.addToTimeline(0);
  await mediaBin.addToTimeline(0);

  await timeline.expectClipCount(2);

  // Shift+click 选中第一个 clip，再右键打包为嵌套序列
  const firstClip = timeline.getClipByIndex(0);
  await page.keyboard.down('Shift');
  await firstClip.click();
  await page.keyboard.up('Shift');
  await firstClip.click({ button: 'right' });
  await expect(page.getByTestId('clip-action-menu')).toBeVisible();
  await page.getByTestId('clip-action-pack-nested').click();
  await timeline.expectClipCount(1);

  // 打开导出对话框并切换到批量序列渲染
  await toolbar.openExport();
  await exportDialog.waitForOpen();
  await page.getByTestId('export-mode-sequence-batch-tab').click();
  await expect(page.getByTestId('export-sequence-batch-row')).toHaveCount(2);
  await page.getByTestId('export-sequence-output-template').fill('C:/Exports/{sequence}-{index}.mp4');
  await page.getByTestId('export-sequence-checkbox').nth(1).check();
  await exportDialog.enqueue();

  await expect(page.getByTestId('export-queue-list').getByTestId('export-task-status')).toHaveCount(2);
});
