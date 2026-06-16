import { expect, test } from '@playwright/test';
import { addMediaCardToTimeline, waitForE2eActions } from './e2e-actions';

test('shows frame interpolation comparison grid and applies the selected mode', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page, 0);
  await page.locator('[data-testid^="timeline-clip-"]').first().click();

  await expect(page.getByTestId('frame-interpolation-compare-button')).toBeEnabled();
  await page.getByTestId('frame-interpolation-compare-button').click();

  await expect(page.getByTestId('frame-interpolation-compare-grid')).toBeVisible();
  await expect(page.getByTestId('frame-interpolation-compare-image')).toHaveCount(4);

  const calls = await page.evaluate(() => window.__E2E_ACTIONS__!.getExportPreviewRunCalls!() as Array<{ id: string; fullArgs: string[] }>);
  expect(calls.map((call) => call.id)).toEqual([
    'frame-interpolation-original',
    'frame-interpolation-blend',
    'frame-interpolation-mci',
    'frame-interpolation-optical-flow'
  ]);
  expect(calls.find((call) => call.id === 'frame-interpolation-mci')?.fullArgs.join(' ')).toContain('minterpolate=fps=60:mi_mode=mci:mc_mode=aobmc');
  expect(calls.find((call) => call.id === 'frame-interpolation-optical-flow')?.fullArgs.join(' ')).toContain('minterpolate=fps=60:mi_mode=mci:mc_mode=aobmc:vsbmc=1');

  await page.getByTestId('frame-interpolation-select-mci').click();

  const slowMotionMode = await page.evaluate(() => {
    const clip = window.__E2E_ACTIONS__!.getTimelineSnapshot!().tracks.flatMap((track) => track.clips).find((item) => item.type === 'video');
    return clip?.slowMotionMode;
  });
  expect(slowMotionMode).toBe('mci');
});
