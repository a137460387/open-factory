import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('emotion tone: calm clip shows blue emotion bar, clip without emotion has no bar', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupEmotionToneFixture!());

  await expect(page.getByTestId('timeline-clip-clip-emo-1')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId('timeline-clip-clip-emo-2')).toBeVisible({ timeout: 10_000 });

  // Emotion bar visible on clip with calm analysis
  const emotionBar = page.getByTestId('emotion-bar-clip-emo-1');
  await expect(emotionBar).toBeVisible();

  // Calm = #3b82f6 = rgb(59, 130, 246)
  await expect(emotionBar).toHaveCSS('background-color', 'rgb(59, 130, 246)');

  // No emotion bar on clip without emotionAnalysis
  await expect(page.getByTestId('emotion-bar-clip-emo-2')).not.toBeVisible();

  // Verify project data
  const emoData = await page.evaluate(() => {
    const project = window.__E2E_ACTIONS__!.getProjectSnapshot!() as {
      timeline: { tracks: Array<{ clips: Array<{ id: string; emotionAnalysis?: { emotionTone: string; intensity: number; reason: string } }> }> };
    };
    const clips = project.timeline.tracks[0].clips;
    return clips.map((c) => ({ id: c.id, emotion: c.emotionAnalysis }));
  });

  const clip1 = emoData.find((c) => c.id === 'clip-emo-1')!;
  expect(clip1.emotion).toBeTruthy();
  expect(clip1.emotion!.emotionTone).toBe('calm');
  expect(clip1.emotion!.intensity).toBe(0.8);
  expect(clip1.emotion!.reason).toBe('平静的水面');

  const clip2 = emoData.find((c) => c.id === 'clip-emo-2')!;
  expect(clip2.emotion).toBeUndefined();
});

test('emotion tone: three clips with different emotions show distinct colored bars', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupEmotionToneMultiFixture!());

  await expect(page.getByTestId('timeline-clip-clip-emo-calm')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId('timeline-clip-clip-emo-energetic')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId('timeline-clip-clip-emo-tense')).toBeVisible({ timeout: 10_000 });

  // Calm = blue
  await expect(page.getByTestId('emotion-bar-clip-emo-calm')).toBeVisible();
  await expect(page.getByTestId('emotion-bar-clip-emo-calm')).toHaveCSS('background-color', 'rgb(59, 130, 246)');

  // Energetic = orange
  await expect(page.getByTestId('emotion-bar-clip-emo-energetic')).toBeVisible();
  await expect(page.getByTestId('emotion-bar-clip-emo-energetic')).toHaveCSS('background-color', 'rgb(249, 115, 22)');

  // Tense = red
  await expect(page.getByTestId('emotion-bar-clip-emo-tense')).toBeVisible();
  await expect(page.getByTestId('emotion-bar-clip-emo-tense')).toHaveCSS('background-color', 'rgb(239, 68, 68)');

  // Verify project data has all three emotion analyses
  const emoData = await page.evaluate(() => {
    const project = window.__E2E_ACTIONS__!.getProjectSnapshot!() as {
      timeline: { tracks: Array<{ clips: Array<{ id: string; emotionAnalysis?: { emotionTone: string; intensity: number } }> }> };
    };
    return project.timeline.tracks[0].clips.map((c) => ({ id: c.id, tone: c.emotionAnalysis?.emotionTone, intensity: c.emotionAnalysis?.intensity }));
  });

  expect(emoData).toHaveLength(3);
  expect(emoData.find((c) => c.id === 'clip-emo-calm')!.tone).toBe('calm');
  expect(emoData.find((c) => c.id === 'clip-emo-energetic')!.tone).toBe('energetic');
  expect(emoData.find((c) => c.id === 'clip-emo-tense')!.tone).toBe('tense');
  expect(emoData.find((c) => c.id === 'clip-emo-tense')!.intensity).toBe(0.85);
});
