import { expect, test } from '@playwright/test';
import { addMediaCardToTimeline, waitForE2eActions } from './e2e-actions';

test('applies automatic color match and writes non-default color curves', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page, 0);
  await addMediaCardToTimeline(page, 2);

  const visualClipIds = await page.evaluate(() =>
    window.__E2E_ACTIONS__!.getTimelineSnapshot!()
      .tracks.flatMap((track) => track.clips)
      .filter((clip) => clip.type === 'video' || clip.type === 'image')
      .map((clip) => clip.id)
  );
  expect(visualClipIds).toHaveLength(2);

  await page.locator(`[data-testid="timeline-clip-${visualClipIds[0]}"]`).click();
  await page.getByTestId('color-match-reference-select').selectOption(visualClipIds[1]);
  await page.getByTestId('apply-color-match-button').click();

  await expect.poll(() =>
    page.evaluate((clipId) => {
      const clip = window.__E2E_ACTIONS__!.getTimelineSnapshot!()
        .tracks.flatMap((track) => track.clips)
        .find((item) => item.id === clipId);
      return clip?.colorCorrection?.colorCurves?.r?.length ?? 0;
    }, visualClipIds[0])
  ).toBeGreaterThan(2);
});
