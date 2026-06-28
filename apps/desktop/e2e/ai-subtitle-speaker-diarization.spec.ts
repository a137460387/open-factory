import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('AI speaker diarization assigns speaker IDs to subtitle clips', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupSubtitleSpeakerDiarizationFixture!());

  const btn = page.getByTestId('subtitle-speaker-diarization-btn');
  await expect(btn).toBeVisible({ timeout: 10_000 });
  await btn.click();

  await expect(page.getByText('已识别 3 位说话人')).toBeVisible({ timeout: 10_000 });

  const snapshot = await page.evaluate(() => {
    const project = window.__E2E_ACTIONS__!.getProjectSnapshot!() as {
      speakerLabels?: Record<number, string>;
      timeline: {
        tracks: Array<{
          clips: Array<{ id: string; speakerId?: number }>;
        }>;
      };
    };
    const clips = project.timeline.tracks.flatMap((t) => t.clips);
    return {
      speakerLabels: project.speakerLabels ?? {},
      speakerIds: clips.map((c) => ({ id: c.id, speakerId: c.speakerId })),
    };
  });

  expect(Object.keys(snapshot.speakerLabels).length).toBe(3);
  expect(snapshot.speakerIds[0].speakerId).toBe(0);
  expect(snapshot.speakerIds[1].speakerId).toBe(1);
  expect(snapshot.speakerIds[2].speakerId).toBe(2);
});
