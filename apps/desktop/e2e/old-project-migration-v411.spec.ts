import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

const oldProjectPath = 'C:/Projects/old-v411.cutproj.json';

function makeOldProjectWithoutV411Fields() {
  return {
    schemaVersion: 2,
    project: {
      id: 'project-old-v411',
      name: 'Old V4.11 Project',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      settings: { fps: 30, timecodeFormat: 'ndf', width: 1280, height: 720 },
      media: [
        {
          id: 'media-video',
          type: 'video',
          name: 'sample.mp4',
          path: 'C:/Media/tiny-video.mp4',
          relativePath: null,
          originalAbsolutePath: 'C:/Media/tiny-video.mp4',
          duration: 6,
          width: 1280,
          height: 720,
          size: 4096,
          mtimeMs: 1000,
        },
      ],
      timeline: {
        tracks: [
          {
            id: 'track-video',
            type: 'video',
            name: 'Video 1',
            clips: [
              {
                id: 'clip-video',
                type: 'video',
                name: 'sample.mp4',
                mediaId: 'media-video',
                trackId: 'track-video',
                start: 0,
                duration: 6,
                trimStart: 0,
                trimEnd: 0,
                speed: 1,
                colorCorrection: { brightness: 0, contrast: 1, saturation: 1, hue: 0 },
                transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
                volume: 1,
              },
            ],
          },
          { id: 'track-audio', type: 'audio', name: 'Audio 1', clips: [] },
          { id: 'track-text', type: 'text', name: 'Text 1', clips: [] },
        ],
      },
    },
  };
}

test('loads old project missing v4.11 fields without crash', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);

  const oldProjectJson = JSON.stringify(makeOldProjectWithoutV411Fields(), null, 2);
  await page.evaluate(
    ([path, contents]) => window.__E2E_ACTIONS__!.setMockFile!(path, contents),
    [oldProjectPath, oldProjectJson] as const,
  );
  await page.evaluate(
    ([path]) => window.__E2E_ACTIONS__!.setOpenFileDialogPaths!([path]),
    [oldProjectPath] as const,
  );

  await page.getByTestId('toolbar-open-project-button').click();
  await expect(page.locator('[data-testid^="timeline-clip-"]').first()).toBeVisible({ timeout: 15_000 });

  const snapshot = await page.evaluate(() => window.__E2E_ACTIONS__!.getProjectSnapshot!());
  expect(snapshot.characterTimeline).toBeUndefined();
  expect(snapshot.preflightReport).toBeUndefined();
  expect(snapshot.ttsSegments).toEqual([]);
  expect(snapshot.timeline.tracks[0].clips[0].emotionAnalysis).toBeUndefined();
});

