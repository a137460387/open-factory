import { expect, test } from '@playwright/test';
import { addMediaCardToTimeline, expectExportTaskStatus, openExportDialog, waitForE2eActions } from './e2e-actions';

test('adds sequential and LUT color nodes and exports matching FFmpeg filters', async ({ page }) => {
  const lutPath = 'C:/Users/E2E/AppData/Roaming/open-factory/luts/Warm Contrast.cube';

  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => {
    window.__E2E_ACTIONS__!.clearE2eFiles!();
    window.__E2E_ACTIONS__!.setOpenFileDialogPaths!(['C:/Media/tiny-video.mp4']);
    window.__E2E_ACTIONS__!.setSavePath!('C:/Exports/color-node-e2e.mp4');
  });

  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page, 0);
  await page.locator('[data-testid^="timeline-clip-"]').first().click();
  await expect(page.getByTestId('clip-brightness-input')).toBeVisible();

  await page.getByTestId('toolbar-tools-menu-button').click();
  await page.getByTestId('toolbar-tools-color-node-editor-menu-item').click();
  await expect(page.getByTestId('color-node-editor-dialog')).toBeVisible();

  await page.getByTestId('color-node-editor-add-sequential-button').click();
  await expect(page.getByTestId('color-node-type-select')).toHaveValue('sequential');
  await page.getByTestId('color-node-brightness-input').fill('0.2');
  await page.getByTestId('color-node-contrast-input').fill('1.1');

  await page.getByTestId('color-node-editor-add-lut-button').click();
  await expect(page.getByTestId('color-node-type-select')).toHaveValue('lut');
  await page.getByTestId('color-node-lut-path-input').fill(lutPath);
  await page.getByTestId('color-node-editor-apply-button').click();

  await expect
    .poll(() =>
      page.evaluate(() => {
        const clip = window.__E2E_ACTIONS__!.getTimelineSnapshot!().tracks[0].clips[0] as {
          colorNodeGraph?: { nodes: Array<{ type: string }>; outputNodeId: string };
        };
        return {
          nodeTypes: clip.colorNodeGraph?.nodes.map((node) => node.type) ?? [],
          outputNodeId: clip.colorNodeGraph?.outputNodeId ?? ''
        };
      })
    )
    .toMatchObject({ nodeTypes: expect.arrayContaining(['sequential', 'lut']) });

  await openExportDialog(page);
  await page.getByTestId('export-enqueue-button').click();
  await expectExportTaskStatus(page, 0, 'success');

  const plan = await page.evaluate(() => window.__E2E_ACTIONS__!.getLastExportPlan!() as { filterComplex: string; fullArgs: string[] });
  expect(plan.fullArgs).toContain('-filter_complex');
  expect(plan.filterComplex).toContain('eq=brightness=0.2:contrast=1.1:saturation=1');
  expect(plan.filterComplex).toContain('lut3d=file=');
  expect(plan.filterComplex).toContain('Warm Contrast.cube');
});
