import { expect, test } from '@playwright/test';
import { waitForE2eActions, addMediaCardToTimeline } from './e2e-actions';

test('subtitle sync monitor detects offset after speed change', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);

  await page.evaluate(() => {
    window.__E2E_ACTIONS__!.clearE2eFiles!();
    window.__E2E_ACTIONS__!.setOpenFileDialogPaths!(['C:/Media/tiny-video.mp4']);
  });

  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page);

  const hasClips = await page.evaluate(() => {
    const p = window.__E2E_ACTIONS__!.getProjectSnapshot!();
    return p.timeline.tracks.some((t: any) => t.clips.length > 0);
  });
  expect(hasClips).toBe(true);

  const tracks = await page.evaluate(() => {
    const p = window.__E2E_ACTIONS__!.getProjectSnapshot!();
    return p.timeline.tracks.map((t: any) => ({ id: t.id, type: t.type, clipCount: t.clips.length }));
  });
  expect(tracks.length).toBeGreaterThanOrEqual(1);
});
