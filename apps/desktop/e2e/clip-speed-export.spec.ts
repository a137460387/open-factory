import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('exports a speed-adjusted clip with shortened duration', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.getByTestId('import-media-button').click();
  await page.locator('[data-testid^="media-card-"]').first().getByText('Add to timeline').click();

  await page.getByRole('spinbutton', { name: 'Speed' }).fill('2');
  await expect(page.getByText('速度 2.00x / 时长 3.00s')).toBeVisible();

  await page.getByLabel('Export video').click();
  await page.getByTestId('export-output-path').fill('C:/Exports/speed-output.mp4');
  await page.getByTestId('export-enqueue-button').click();
  await expect(page.getByTestId('export-task-status')).toHaveText('success');

  const plan = await page.evaluate(
    () => window.__E2E_ACTIONS__!.getLastExportPlan!() as { duration: number; inputs: Array<{ args: string[] }>; filterComplex: string }
  );
  expect(plan.duration).toBeCloseTo(3, 2);
  expect(plan.inputs[0].args).toEqual(['-ss', '0', '-t', '6']);
  expect(plan.filterComplex).toContain('setpts=(PTS-STARTPTS)/2+0/TB');
  expect(plan.filterComplex).toContain('atempo=2.0');
});

