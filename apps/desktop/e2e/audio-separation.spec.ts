import { expect, test } from '@playwright/test';
import { addMediaCardToTimeline, waitForE2eActions } from './e2e-actions';

test('runs mocked Demucs separation and adds vocals/background media to independent tracks', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.clearE2eFiles!());

  await page.getByTestId('toolbar-settings-button').click();
  await page.getByTestId('settings-demucs-executable-input').fill('C:/Tools/demucs.exe');
  await page.getByTestId('settings-close-button').click();

  await page.evaluate(() => window.__E2E_ACTIONS__!.setOpenFileDialogPaths!(['C:/Media/tiny-video.mp4']));
  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page, 0);

  await page.getByTestId('toolbar-tools-menu-button').click();
  const menuItem = page.getByTestId('toolbar-tools-audio-separation-menu-item');
  await expect(menuItem).toBeEnabled();
  await menuItem.click();

  await expect
    .poll(() =>
      page.evaluate(() => {
        const project = window.__E2E_ACTIONS__!.getProjectSnapshot!();
        return {
          mediaNames: project.media.map((asset) => asset.name),
          audioTracks: project.timeline.tracks
            .filter((track) => track.type === 'audio')
            .map((track) => ({ name: track.name, clips: track.clips.map((clip) => ({ start: clip.start, duration: clip.duration })) }))
        };
      })
    )
    .toMatchObject({
      mediaNames: expect.arrayContaining(['tiny-video.mp4 人声.wav', 'tiny-video.mp4 背景音.wav']),
      audioTracks: expect.arrayContaining([
        { name: '人声', clips: [{ start: 0, duration: 6 }] },
        { name: '背景音', clips: [{ start: 0, duration: 6 }] }
      ])
    });
});
