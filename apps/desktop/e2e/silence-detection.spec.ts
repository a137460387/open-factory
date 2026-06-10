import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('auto-cuts detected silence from a synthetic audio clip', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupSilenceDetectionFixture!());

  const clip = page.getByTestId('timeline-clip-clip-silence-pattern');
  await expect(clip).toBeVisible();
  await clip.click({ button: 'right' });
  await expect(page.getByTestId('clip-action-menu')).toBeVisible();
  await page.getByTestId('clip-action-silence').click();

  await expect(page.getByTestId('silence-dialog')).toBeVisible();
  await page.getByTestId('silence-margin-input').fill('0');
  await page.getByTestId('silence-detect-button').click();
  await expect(page.getByTestId('silence-preview')).toContainText('将删除 1 段');
  await page.getByTestId('silence-confirm-button').click();
  await expect(page.getByTestId('silence-dialog')).toHaveCount(0);

  const clips = await page.evaluate(() => {
    const timeline = window.__E2E_ACTIONS__!.getTimelineSnapshot!() as {
      tracks: Array<{ id: string; clips: Array<{ start: number; duration: number; trimStart: number; trimEnd: number }> }>;
    };
    return timeline.tracks.find((track) => track.id === 'track-audio')?.clips ?? [];
  });

  expect(clips).toHaveLength(2);
  expect(clips.map((item) => item.start)).toEqual([0, 1]);
  expect(clips.map((item) => item.duration)).toEqual([1, 1]);
  expect(clips.map((item) => item.trimStart)).toEqual([0, 1.5]);
});
