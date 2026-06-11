import { expect, test } from '@playwright/test';
import { addMediaCardToTimeline, waitForE2eActions } from './e2e-actions';

test('exports the current frame with Shift+E into a non-empty image file', async ({ page }) => {
  const outputPath = 'C:/Exports/current-frame.png';
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate((path) => window.__E2E_ACTIONS__!.setSavePath!(path), outputPath);

  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page, 0);
  await page.getByTestId('timeline-root').click();
  await page.keyboard.press('Shift+E');

  await expect.poll(() => page.evaluate((path) => window.__E2E_ACTIONS__!.getWrittenFileSize!(path) as number, outputPath)).toBeGreaterThan(0);
  const plan = await page.evaluate(() => window.__E2E_ACTIONS__!.getLastExportPlan!() as { maps: string[]; outputArgs: string[]; fullArgs: string[] });

  expect(plan.maps).toEqual(['-map', '[vout]']);
  expect(plan.outputArgs).toEqual(['-ss', '0', '-frames:v', '1', '-f', 'image2', outputPath]);
  expect(plan.fullArgs).toEqual(expect.arrayContaining(['-frames:v', '1']));
});
