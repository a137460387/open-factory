import { expect, test } from '@playwright/test';
import { addMediaCardToTimeline, waitForE2eActions } from './e2e-actions';

test('analyzes an audio clip pitch and renders the pitch curve on the timeline', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setOpenFileDialogPaths!(['C:/Media/tiny-audio.wav']));

  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page, 0);
  await page.locator('[data-testid^="timeline-clip-"]').first().click();

  await expect(page.getByTestId('pitch-analysis-section')).toBeVisible();
  await page.getByTestId('clip-pitch-analyze-button').click();

  await expect(page.locator('[data-testid^="timeline-pitch-curve-"]').first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('clip-pitch-primary-note')).toContainText('A4');

  const pitchData = await page.evaluate(() => {
    const clip = window.__E2E_ACTIONS__!.getTimelineSnapshot!().tracks.flatMap((track) => track.clips).find((item) => item.type === 'audio') as { pitchData?: Array<{ hz: number; note: string }> } | undefined;
    return clip?.pitchData ?? [];
  });
  expect(pitchData.length).toBeGreaterThan(0);
  expect(pitchData[0].note).toBe('A4');
});
