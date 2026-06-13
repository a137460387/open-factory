import { expect, test } from '@playwright/test';
import { addMediaCardToTimeline, waitForE2eActions } from './e2e-actions';

test('replaces timeline clip media while preserving color correction and undoing original media', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => {
    window.__E2E_ACTIONS__!.clearE2eFiles!();
    window.__E2E_ACTIONS__!.setOpenFileDialogPaths!(['C:/Media/tiny-video.mp4']);
  });
  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page, 0);

  const before = await page.evaluate(() => {
    const clip = window.__E2E_ACTIONS__!.getTimelineSnapshot!().tracks.flatMap((track) => track.clips).find((item) => item.type === 'video')!;
    return { id: clip.id, mediaId: clip.mediaId, duration: clip.duration };
  });

  await page.getByTestId(`timeline-clip-${before.id}`).click();
  await page.getByTestId('clip-brightness-input').fill('0.42');
  await page.getByTestId('clip-brightness-input').press('Enter');
  await expect.poll(() => page.evaluate((clipId) => {
    const clip = window.__E2E_ACTIONS__!.getTimelineSnapshot!().tracks.flatMap((track) => track.clips).find((item) => item.id === clipId);
    return clip?.colorCorrection?.brightness;
  }, before.id)).toBe(0.42);

  await page.evaluate(() => window.__E2E_ACTIONS__!.setOpenFileDialogPaths!(['C:/Media/camera-b.mp4']));
  await page.getByTestId(`timeline-clip-${before.id}`).click({ button: 'right' });
  await page.getByTestId('clip-action-replace-media').click();
  await expect(page.getByTestId('replace-media-dialog')).toBeVisible();
  await page.getByTestId('replace-media-duration-mode').selectOption('use-new-duration');
  await page.getByTestId('replace-media-confirm').click();

  await expect.poll(() => page.evaluate((clipId) => {
    const project = window.__E2E_ACTIONS__!.getProjectSnapshot!();
    const clip = project.timeline.tracks.flatMap((track) => track.clips).find((item) => item.id === clipId)!;
    const media = project.media.find((item) => item.id === clip.mediaId);
    return { mediaPath: media?.path, brightness: clip.colorCorrection?.brightness };
  }, before.id)).toEqual({ mediaPath: 'C:/Media/camera-b.mp4', brightness: 0.42 });

  await page.getByTestId('toolbar-undo-button').click();
  await expect.poll(() => page.evaluate((clipId) => {
    const clip = window.__E2E_ACTIONS__!.getTimelineSnapshot!().tracks.flatMap((track) => track.clips).find((item) => item.id === clipId)!;
    return { mediaId: clip.mediaId, duration: clip.duration, brightness: clip.colorCorrection?.brightness };
  }, before.id)).toEqual({ mediaId: before.mediaId, duration: before.duration, brightness: 0.42 });
});
