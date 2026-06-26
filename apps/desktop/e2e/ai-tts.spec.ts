import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('TTS voiceover generates audio clips from subtitle track', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupAITtsVoiceoverFixture!());

  // Right-click on the first subtitle clip to open context menu
  await page.getByTestId('timeline-clip-tts-sub-1').click({ button: 'right' });
  await expect(page.getByTestId('clip-action-menu')).toBeVisible();

  // Click TTS voiceover action
  await page.getByTestId('clip-action-tts-voiceover').click();

  // Wait for audio clips to appear on a new "AI配音" track
  await expect.poll(async () => {
    return page.evaluate(() => {
      const timeline = window.__E2E_ACTIONS__!.getTimelineSnapshot!() as {
        tracks: Array<{ id: string; name: string; type: string; clips: Array<{ start: number; duration: number }> }>;
      };
      const audioTrack = timeline.tracks.find((t) => t.type === 'audio');
      return audioTrack?.clips.length ?? 0;
    });
  }, { timeout: 15_000 }).toBe(3);

  // Verify the audio track name and clip alignment
  const snapshot = await page.evaluate(() => {
    return window.__E2E_ACTIONS__!.getTimelineSnapshot!() as {
      tracks: Array<{ id: string; name: string; type: string; clips: Array<{ start: number; duration: number }> }>;
    };
  });
  const audioTrack = snapshot.tracks.find((t) => t.type === 'audio')!;
  expect(audioTrack.name).toBe('AI配音');

  const starts = audioTrack.clips.map((c) => c.start).sort((a, b) => a - b);
  expect(starts).toEqual([0, 3, 6]);
});

