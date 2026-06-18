import { expect, test } from '@playwright/test';
import { addMediaCardToTimeline, waitForE2eActions } from './e2e-actions';

test('analyzes timeline color consistency and aligns clips to a reference', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => {
    window.__E2E_ACTIONS__!.clearE2eFiles!();
    window.__E2E_ACTIONS__!.setOpenFileDialogPaths!(['C:/Media/tiny-video.mp4', 'C:/Media/tiny-audio.wav', 'C:/Media/test-image.png']);
  });

  await page.getByTestId('import-media-button').click();
  await expect(page.locator('[data-testid^="media-card-"]')).toHaveCount(3);
  await addMediaCardToTimeline(page, 0);
  await addMediaCardToTimeline(page, 2);

  const visualClipIds = await page.evaluate(() =>
    window.__E2E_ACTIONS__!.getTimelineSnapshot!()
      .tracks.flatMap((track) => track.clips)
      .filter((clip) => clip.type === 'video' || clip.type === 'image')
      .map((clip) => clip.id)
  );
  expect(visualClipIds).toHaveLength(2);

  await page.getByTestId('toolbar-tools-menu-button').click();
  await page.getByTestId('toolbar-tools-color-analysis-menu-item').click();
  await expect(page.getByTestId('color-analysis-dialog')).toBeVisible();
  await expect(page.getByTestId('color-analysis-result-row')).toHaveCount(2, { timeout: 15_000 });
  await expect(page.getByTestId('timeline-color-heatmap-layer')).toBeVisible();
  await expect(page.getByTestId('timeline-color-heatmap-point')).toHaveCount(2);
  await expect(page.getByTestId('timeline-color-jump-marker')).toHaveCount(1);

  await page.getByTestId('color-analysis-reference-select').selectOption(visualClipIds[1]);
  await page.getByTestId('color-analysis-align-button').click();

  await expect
    .poll(() =>
      page.evaluate((clipId) => {
        const clip = window.__E2E_ACTIONS__!.getTimelineSnapshot!()
          .tracks.flatMap((track) => track.clips)
          .find((item) => item.id === clipId);
        return clip?.colorCorrection?.colorCurves?.r?.length ?? 0;
      }, visualClipIds[0])
    )
    .toBeGreaterThan(2);
});
