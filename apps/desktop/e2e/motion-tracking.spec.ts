import { expect, test } from '@playwright/test';
import { addMediaCardToTimeline, waitForE2eActions } from './e2e-actions';

test('analyzes motion tracking and binds x/y keyframes for every frame', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page, 0);
  await page.locator('[data-testid^="timeline-clip-"]').first().click();

  await page.getByTestId('analyze-motion-track-button').click();
  await expect(page.getByTestId('motion-track-status')).toContainText('4 个跟踪点');
  await page.getByTestId('bind-motion-track-button').click();

  const keyframeCounts = await page.evaluate(() => {
    const clip = window.__E2E_ACTIONS__!.getTimelineSnapshot!().tracks[0].clips[0] as {
      keyframes?: { x?: unknown[]; y?: unknown[] };
      motionTrack?: unknown[];
    };
    return {
      points: clip.motionTrack?.length ?? 0,
      x: clip.keyframes?.x?.length ?? 0,
      y: clip.keyframes?.y?.length ?? 0
    };
  });
  expect(keyframeCounts).toEqual({ points: 4, x: 4, y: 4 });
});
