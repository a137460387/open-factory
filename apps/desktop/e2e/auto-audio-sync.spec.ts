import { expect, test } from '@playwright/test';
import { waitForE2eActions, waitForAppStore } from './e2e-actions';

test('syncs a mocked secondary audio track by applying the calculated offset', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await waitForAppStore(page);
  await page.evaluate(() => {
    window.__E2E_ACTIONS__!.clearE2eFiles!();
    window.__E2E_ACTIONS__!.setupAutoAudioSyncFixture!();
  });

  await page.getByTestId('toolbar-tools-menu-button').click();
  await page.getByTestId('toolbar-tools-auto-audio-sync-menu-item').click();

  await expect(page.getByTestId('auto-audio-sync-dialog')).toBeVisible();
  await page.getByTestId('auto-audio-sync-analyze-button').click();
  await expect(page.getByTestId('auto-audio-sync-offset-clip-auto-secondary')).toContainText('-350 ms', { timeout: 15_000 });
  await expect(page.getByTestId('auto-audio-sync-confidence-clip-auto-secondary')).toContainText('高');

  await page.getByTestId('auto-audio-sync-apply-button').click();

  await expect
    .poll(() =>
      page.evaluate(() => {
        const clips = window.__E2E_ACTIONS__!.getTimelineSnapshot!().tracks.flatMap((track) => track.clips) as Array<{ id: string; start: number }>;
        return clips.find((clip) => clip.id === 'clip-auto-secondary')?.start;
      })
    )
    .toBeCloseTo(0.65, 5);
});
