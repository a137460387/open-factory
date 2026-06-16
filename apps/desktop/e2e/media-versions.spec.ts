import { expect, test } from '@playwright/test';
import { addMediaCardToTimeline, waitForE2eActions } from './e2e-actions';

test('adds a media version, switches a timeline clip to it, and undoes the switch', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => {
    window.__E2E_ACTIONS__!.clearE2eFiles!();
    window.__E2E_ACTIONS__!.setOpenFileDialogPaths!(['C:/Media/tiny-video.mp4']);
  });
  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page, 0);

  const before = await page.evaluate(() => {
    const project = window.__E2E_ACTIONS__!.getProjectSnapshot!();
    const asset = project.media.find((item) => item.path === 'C:/Media/tiny-video.mp4')!;
    const clip = project.timeline.tracks.flatMap((track) => track.clips).find((item) => item.type === 'video')!;
    return { assetId: asset.id, clipId: clip.id, mediaId: clip.mediaId };
  });

  await page.evaluate(() => window.__E2E_ACTIONS__!.setOpenFileDialogPaths!(['C:/Media/camera-b.mp4']));
  await page.getByTestId(`media-card-${before.assetId}`).click({ button: 'right' });
  await page.getByTestId(`media-add-version-${before.assetId}`).click();

  await expect
    .poll(() =>
      page.evaluate((assetId) => {
        const project = window.__E2E_ACTIONS__!.getProjectSnapshot!();
        return project.mediaMetadata[assetId]?.versions?.[0]?.assetId;
      }, before.assetId)
    )
    .toBeTruthy();
  const versionAssetId = await page.evaluate((assetId) => {
    const project = window.__E2E_ACTIONS__!.getProjectSnapshot!();
    return project.mediaMetadata[assetId]?.versions?.[0]?.assetId;
  }, before.assetId);
  expect(versionAssetId).toBeTruthy();

  await expect(page.getByTestId(`media-version-badge-${before.assetId}`)).toBeVisible();
  await page.getByTestId(`media-version-badge-${before.assetId}`).click();
  await expect(page.getByTestId(`media-version-list-${before.assetId}`)).toBeVisible();

  await page.getByTestId(`media-card-${before.assetId}`).click({ button: 'right' });
  await page.getByTestId(`media-compare-versions-${before.assetId}`).click();
  await expect(page.getByTestId('media-version-compare-panel')).toBeVisible();
  await page.getByTestId('media-version-compare-close').click();

  await page.getByTestId(`timeline-clip-${before.clipId}`).click({ button: 'right' });
  await expect(page.getByTestId('clip-media-version-menu')).toBeVisible();
  await page.getByTestId(`clip-switch-version-${versionAssetId}`).click();

  await expect.poll(() => page.evaluate((clipId) => {
    const project = window.__E2E_ACTIONS__!.getProjectSnapshot!();
    const clip = project.timeline.tracks.flatMap((track) => track.clips).find((item) => item.id === clipId)!;
    return project.media.find((item) => item.id === clip.mediaId)?.path;
  }, before.clipId)).toBe('C:/Media/camera-b.mp4');

  await page.getByTestId('toolbar-undo-button').click();
  await expect.poll(() => page.evaluate((clipId) => {
    const project = window.__E2E_ACTIONS__!.getProjectSnapshot!();
    const clip = project.timeline.tracks.flatMap((track) => track.clips).find((item) => item.id === clipId)!;
    return project.media.find((item) => item.id === clip.mediaId)?.path;
  }, before.clipId)).toBe('C:/Media/tiny-video.mp4');
});
