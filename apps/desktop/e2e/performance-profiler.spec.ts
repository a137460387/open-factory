import { expect, test } from '@playwright/test';
import { addMediaCardToTimeline, waitForE2eActions } from './e2e-actions';

test('records preview activity and shows the slowest frame report', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page);

  await page.getByTestId('toolbar-tools-menu-button').click();
  await page.getByTestId('toolbar-tools-performance-profiler-menu-item').click();
  await expect(page.getByTestId('profiler-dialog')).toBeVisible();

  await page.getByTestId('profiler-start-recording-button').click();
  await page.evaluate(() => window.__E2E_ACTIONS__?.setPlayheadTime(0.5));
  await page.getByTestId('preview-playback-button').click();
  await expect.poll(() => page.evaluate(() => window.__OPEN_FACTORY_PROFILER_DEBUG__?.frameCount ?? 0), { timeout: 10_000 }).toBeGreaterThan(0);
  await expect(page.getByTestId('profiler-recording-elapsed')).not.toHaveText('00:00', { timeout: 2500 });

  await page.getByTestId('profiler-stop-recording-button').click();

  await expect(page.getByTestId('profiler-report-panel')).toBeVisible();
  await expect.poll(() => page.getByTestId('profiler-slowest-frame').count()).toBeGreaterThan(0);
  await expect(page.getByTestId('profiler-slowest-frame').first()).toContainText('第');
  await expect(page.getByTestId('profiler-flamegraph').locator('rect')).not.toHaveCount(0);
});
