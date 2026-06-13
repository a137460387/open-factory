import { expect, test } from '@playwright/test';
import { addMediaCardToTimeline, waitForE2eActions } from './e2e-actions';

test('analyzes audio ducking, writes background volume keyframes, and undoes them together', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => {
    window.__E2E_ACTIONS__!.clearE2eFiles!();
    window.__E2E_ACTIONS__!.setOpenFileDialogPaths!(['C:/Media/tiny-video.mp4', 'C:/Media/tiny-audio.wav']);
  });

  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page, 0);
  await addMediaCardToTimeline(page, 1);

  await page.getByTestId('audio-ducking-button').click();
  await page.getByTestId('audio-ducking-analyze-button').click();
  await expect(page.getByTestId('audio-ducking-preview-summary')).toContainText('关键帧');
  await page.getByTestId('audio-ducking-apply-button').click();

  await expect
    .poll(() =>
      page.evaluate(() => {
        const audioClip = window.__E2E_ACTIONS__!.getTimelineSnapshot!().tracks.flatMap((track) => track.clips).find((clip) => clip.type === 'audio') as
          | { keyframes?: { volume?: Array<{ time: number; value: number }> } }
          | undefined;
        return audioClip?.keyframes?.volume?.length ?? 0;
      })
    )
    .toBeGreaterThan(0);

  await page.getByTestId('toolbar-undo-button').click();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const audioClip = window.__E2E_ACTIONS__!.getTimelineSnapshot!().tracks.flatMap((track) => track.clips).find((clip) => clip.type === 'audio') as
          | { keyframes?: { volume?: Array<{ time: number; value: number }> } }
          | undefined;
        return audioClip?.keyframes?.volume?.length ?? 0;
      })
    )
    .toBe(0);
});
