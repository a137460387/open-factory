import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('opens smart montage dialog, analyzes beats, and generates montage clips on timeline', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);

  // Import test media: 2 videos + 1 audio
  await page.evaluate(() => {
    window.__E2E_ACTIONS__!.setOpenFileDialogPaths!([
      'C:/Media/tiny-video.mp4',
      'C:/Media/camera-b.mp4',
      'C:/Media/bgm-music.mp3'
    ]);
  });
  await page.getByTestId('import-media-button').click();
  await expect(page.locator('[data-testid^="media-card-"]')).toHaveCount(3);

  // Mock detectBeats to return predictable beat times
  await page.evaluate(() => {
    const mocks = (window as any).__TAURI_MOCKS__ ?? ((window as any).__TAURI_MOCKS__ = {});
    mocks.detectBeats = async () => [0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0];
  });

  // Open Smart Montage dialog from tools menu
  await page.getByTestId('toolbar-tools-menu-button').click();
  await page.getByTestId('toolbar-tools-smart-montage-menu-item').click();
  await expect(page.getByTestId('smart-montage-dialog')).toBeVisible();

  // Verify video and audio asset lists are populated
  await expect(page.getByTestId('smart-montage-video-list')).toBeVisible();
  await expect(page.getByTestId('smart-montage-audio-list')).toBeVisible();

  // Click analyze beats button
  await page.getByTestId('smart-montage-analyze-button').click();

  // Wait for analysis to complete and preview to appear
  await expect(page.getByTestId('smart-montage-stats')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId('smart-montage-beat-preview')).toBeVisible();

  // Generate the montage
  await page.getByTestId('smart-montage-generate-button').click();

  // Verify dialog closes
  await expect(page.getByTestId('smart-montage-dialog')).not.toBeVisible({ timeout: 5_000 });

  // Verify timeline has the expected clips
  // 7 beats = 6 intervals = 6 video clips + 1 audio clip = 7 total clips
  const timeline = await page.evaluate(() => {
    const snapshot = window.__E2E_ACTIONS__!.getTimelineSnapshot!() as {
      tracks: Array<{ name: string; type: string; clips: Array<{ id: string }> }>;
    };
    return snapshot;
  });

  // Should have 2 new tracks: "混剪视频" and "混剪音乐"
  const montageVideoTrack = timeline.tracks.find((t) => t.name === '混剪视频');
  const montageAudioTrack = timeline.tracks.find((t) => t.name === '混剪音乐');

  expect(montageVideoTrack).toBeDefined();
  expect(montageAudioTrack).toBeDefined();
  expect(montageVideoTrack!.type).toBe('video');
  expect(montageAudioTrack!.type).toBe('audio');

  // 7 beats -> 6 video clips (one per beat interval)
  expect(montageVideoTrack!.clips).toHaveLength(6);

  // 1 audio clip (background music)
  expect(montageAudioTrack!.clips).toHaveLength(1);
});
