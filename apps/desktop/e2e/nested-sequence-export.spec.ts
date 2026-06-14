import { expect, test, type Page } from '@playwright/test';
import { addMediaCardToTimeline, expectExportTaskStatus, openExportDialog, waitForE2eActions } from './e2e-actions';

async function openCleanProject(page: Page): Promise<void> {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.clearE2eFiles!());
  await page.reload();
  await waitForE2eActions(page);
}

test('packs clips into a nested sequence and exports with matching duration', async ({ page }) => {
  await openCleanProject(page);

  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page, 0);
  await addMediaCardToTimeline(page, 0);

  const clips = page.locator('[data-testid^="timeline-clip-"]');
  await expect(clips).toHaveCount(2);
  await page.keyboard.down('Shift');
  await clips.first().click();
  await page.keyboard.up('Shift');
  await clips.first().click({ button: 'right' });
  await expect(page.getByTestId('clip-action-menu')).toBeVisible();
  await page.getByTestId('clip-action-pack-nested').click();

  await expect(clips).toHaveCount(1);
  await expect(clips.first()).toHaveAttribute('data-clip-type', 'nested-sequence');
  await clips.first().dblclick();
  await expect(page.getByTestId('sequence-back-main')).toBeVisible();
  await expect(clips).toHaveCount(2);
  await page.getByTestId('sequence-back-main').click();
  await expect(clips).toHaveCount(1);

  await openExportDialog(page);
  await page.getByTestId('export-output-path').fill('C:/Exports/nested-output.mp4');
  await page.getByTestId('export-enqueue-button').click();
  await expectExportTaskStatus(page, 0, 'success');

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

test('queues two selected sequences from batch sequence render', async ({ page }) => {
  await openCleanProject(page);

  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page, 0);
  await addMediaCardToTimeline(page, 0);

  const clips = page.locator('[data-testid^="timeline-clip-"]');
  await expect(clips).toHaveCount(2);
  await page.keyboard.down('Shift');
  await clips.first().click();
  await page.keyboard.up('Shift');
  await clips.first().click({ button: 'right' });
  await page.getByTestId('clip-action-pack-nested').click();
  await expect(clips).toHaveCount(1);

  await openExportDialog(page);
  await page.getByTestId('export-mode-sequence-batch-tab').click();
  await expect(page.getByTestId('export-sequence-batch-row')).toHaveCount(2);
  await page.getByTestId('export-sequence-output-template').fill('C:/Exports/{sequence}-{index}.mp4');
  await page.getByTestId('export-sequence-checkbox').nth(1).check();
  await page.getByTestId('export-enqueue-button').click();

  await expect(page.getByTestId('export-queue-list').getByTestId('export-task-status')).toHaveCount(2);
});
