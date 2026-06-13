import { expect, test } from '@playwright/test';
import { addMediaCardToTimeline, waitForE2eActions } from './e2e-actions';

test('applies PiP layout to two selected visual clips', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page, 0);
  await addMediaCardToTimeline(page, 2);

  const clips = page.locator('[data-testid^="timeline-clip-"]');
  await expect(clips).toHaveCount(2);
  await page.keyboard.down('Shift');
  await clips.first().click();
  await page.keyboard.up('Shift');
  await expect.poll(() => page.evaluate(() => window.__E2E_ACTIONS__!.getSelectedClipIds!() as string[])).toHaveLength(2);

  await expect(page.getByTestId('toolbar-pip-button')).toBeEnabled();
  await page.getByTestId('toolbar-pip-position-select').selectOption('bottom-right');
  await page.getByTestId('toolbar-pip-button').click();

  const pipClip = await page.evaluate(() => {
    const timeline = window.__E2E_ACTIONS__!.getTimelineSnapshot!() as {
      tracks: Array<{
        clips: Array<{
          transform: { scale: number; scaleX?: number; scaleY?: number };
          border?: { enabled: boolean };
        }>;
      }>;
    };
    return timeline.tracks.flatMap((track) => track.clips).find((clip) => Math.abs((clip.transform.scaleX ?? clip.transform.scale) - 0.25) < 0.001);
  });
  expect(pipClip?.transform.scaleX).toBeCloseTo(0.25, 3);
  expect(pipClip?.transform.scaleY).toBeCloseTo(0.25, 3);
  expect(pipClip?.border).toMatchObject({ enabled: true });
});
