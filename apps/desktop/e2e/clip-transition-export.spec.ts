import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('adds a dissolve transition between adjacent clips and exports shortened duration', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.getByTestId('import-media-button').click();
  const videoCard = page.locator('[data-testid^="media-card-"]').first();
  await videoCard.getByText('Add to timeline').click();
  await videoCard.getByText('Add to timeline').click();

  const firstClip = page.locator('[data-testid^="timeline-clip-"]').first();
  const box = await firstClip.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.click((box?.x ?? 0) + (box?.width ?? 0) - 4, (box?.y ?? 0) + (box?.height ?? 0) / 2, { button: 'right' });
  await expect(page.getByTestId('transition-menu')).toBeVisible();
  await page.getByTestId('transition-type-select').selectOption('dissolve');
  await page.getByTestId('transition-duration-input').fill('0.5');
  await page.getByTestId('transition-add-button').click();
  await expect(page.locator('[data-testid^="timeline-transition-"]')).toBeVisible();

  await page.getByLabel('Export video').click();
  await page.getByTestId('export-output-path').fill('C:/Exports/transition-output.mp4');
  await page.getByTestId('export-enqueue-button').click();
  await expect(page.getByTestId('export-task-status')).toHaveText('success');

  const plan = await page.evaluate(
    () => window.__E2E_ACTIONS__!.getLastExportPlan!() as { duration: number; inputs: Array<{ args: string[] }>; filterComplex: string }
  );
  expect(plan.inputs).toHaveLength(2);
  expect(plan.duration).toBeCloseTo(11.5, 2);
  expect(plan.filterComplex).toContain('xfade=transition=dissolve:duration=0.5:offset=5.5');
});
