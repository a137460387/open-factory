import { expect, test } from '@playwright/test';
import { addMediaCardToTimeline, expectExportTaskStatus, openExportDialog, waitForE2eActions } from './e2e-actions';

test('adds a dissolve transition between adjacent clips and exports shortened duration', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page);
  await addMediaCardToTimeline(page);

  const firstClip = page.locator('[data-testid^="timeline-clip-"]').first();
  const box = await firstClip.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.click((box?.x ?? 0) + (box?.width ?? 0) - 4, (box?.y ?? 0) + (box?.height ?? 0) / 2, { button: 'right' });
  await expect(page.getByTestId('transition-menu')).toBeVisible();
  await page.getByTestId('transition-type-select').selectOption('dissolve');
  await page.getByTestId('transition-duration-input').fill('0.5');
  await page.getByTestId('transition-add-button').click();
  await expect(page.locator('[data-testid^="timeline-transition-"]')).toBeVisible();

  await openExportDialog(page);
  await page.getByTestId('export-output-path').fill('C:/Exports/transition-output.mp4');
  await page.getByTestId('export-enqueue-button').click();
  await expectExportTaskStatus(page, 0, 'success');

  const plan = await page.evaluate(
    () => window.__E2E_ACTIONS__!.getLastExportPlan!() as { duration: number; inputs: Array<{ args: string[] }>; filterComplex: string }
  );
  expect(plan.inputs).toHaveLength(2);
  expect(plan.duration).toBeCloseTo(11.5, 2);
  expect(plan.filterComplex).toContain('xfade=transition=dissolve:duration=0.5:offset=5.5');
});
