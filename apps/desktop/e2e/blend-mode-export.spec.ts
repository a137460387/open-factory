import { expect, test } from '@playwright/test';
import { expectExportTaskStatus, openExportDialog, waitForE2eActions } from './e2e-actions';

test('exports overlay blend mode selected from the inspector', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => {
    window.__E2E_ACTIONS__!.setupMulticamFixture!();
    window.__E2E_ACTIONS__!.setSavePath!('C:/Exports/blend-mode-overlay.mp4');
  });

  await page.evaluate(() => window.__E2E_ACTIONS__!.selectClip!('clip-camera-b'));
  await expect(page.getByTestId('clip-blend-mode-select')).toBeVisible();
  await page.getByTestId('clip-blend-mode-select').selectOption('overlay');

  await expect
    .poll(() =>
      page.evaluate(() => {
        const clips = window.__E2E_ACTIONS__!.getTimelineSnapshot!().tracks.flatMap((track) => track.clips);
        return clips.find((clip) => clip.id === 'clip-camera-b')?.blendMode;
      })
    )
    .toBe('overlay');

  await openExportDialog(page);
  await page.getByTestId('export-enqueue-button').click();
  await expectExportTaskStatus(page, 0, 'success');

  const plan = await page.evaluate(() => window.__E2E_ACTIONS__!.getLastExportPlan!() as { filterComplex: string });
  expect(plan.filterComplex).toContain('blend=all_mode=overlay');
});
