import { expect, test, type Locator, type Page } from '@playwright/test';
import { addMediaCardToTimeline, expectExportTaskStatus, openExportDialog, waitForE2eActions } from './e2e-actions';

test('right-edge trim updates the exported duration', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page);

  const clip = page.locator('[data-testid^="timeline-clip-"]').first();
  const clipId = await clip.getAttribute('data-clip-id');
  expect(clipId).toBeTruthy();
  await dragHandleBy(page.getByTestId(`timeline-trim-right-${clipId}`), page, -160);

  await openExportDialog(page);
  await page.getByTestId('export-output-path').fill('C:/Exports/trimmed-output.mp4');
  await page.getByTestId('export-enqueue-button').click();
  await expectExportTaskStatus(page, 0, 'success');

  const plan = await page.evaluate(() => window.__E2E_ACTIONS__!.getLastExportPlan!() as { duration: number; inputs: Array<{ args: string[] }> });
  expect(plan.duration).toBeCloseTo(4, 1);
  expect(plan.inputs[0].args).toEqual(['-ss', '0', '-t', '4']);
});

async function dragHandleBy(handle: Locator, page: Page, deltaX: number): Promise<void> {
  const box = await handle.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width / 2 + deltaX, box!.y + box!.height / 2, { steps: 8 });
  await page.mouse.up();
}
