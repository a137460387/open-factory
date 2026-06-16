import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('batch exports two project files and reports both outputs', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);

  const projectA = 'C:/Projects/batch-a.cutproj.json';
  const projectB = 'C:/Projects/batch-b.cutproj.json';
  const outputA = 'C:/Exports/batch-a.mp4';
  const outputB = 'C:/Exports/batch-b.mp4';
  await page.evaluate(
    ({ projectAPath, projectBPath }) => {
      const makeProject = (id: string, name: string, mediaPath: string) =>
        JSON.stringify(
          {
            schemaVersion: 2,
            project: {
              id,
              name,
              createdAt: '2026-01-01T00:00:00.000Z',
              updatedAt: '2026-01-01T00:00:00.000Z',
              settings: { fps: 30, timecodeFormat: 'ndf', width: 1280, height: 720 },
              media: [
                {
                  id: `${id}-media`,
                  type: 'video',
                  name: 'tiny-video.mp4',
                  path: mediaPath,
                  duration: 6,
                  width: 1280,
                  height: 720
                }
              ],
              timeline: {
                tracks: [
                  {
                    id: `${id}-track`,
                    type: 'video',
                    name: 'Video 1',
                    clips: [
                      {
                        id: `${id}-clip`,
                        type: 'video',
                        name: 'tiny-video.mp4',
                        mediaId: `${id}-media`,
                        trackId: `${id}-track`,
                        start: 0,
                        duration: 6,
                        trimStart: 0,
                        trimEnd: 0,
                        speed: 1,
                        colorCorrection: { brightness: 0, contrast: 1, saturation: 1, hue: 0 },
                        transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
                        volume: 1
                      }
                    ]
                  }
                ]
              }
            }
          },
          null,
          2
        );
      window.__E2E_ACTIONS__!.setMockFile!(projectAPath, makeProject('batch-a', 'Batch A', 'C:/Media/tiny-video.mp4'));
      window.__E2E_ACTIONS__!.setMockFile!(projectBPath, makeProject('batch-b', 'Batch B', 'C:/Media/camera-b.mp4'));
      window.__E2E_ACTIONS__!.setOpenFileDialogPaths!([projectAPath, projectBPath]);
    },
    { projectAPath: projectA, projectBPath: projectB }
  );

  await page.getByTestId('toolbar-tools-menu-button').click();
  await page.getByTestId('toolbar-tools-batch-project-menu-item').click();
  await expect(page.getByTestId('batch-project-dialog')).toBeVisible();

  await page.getByTestId('batch-project-select-files-button').click();
  await expect(page.getByTestId('batch-project-file-list')).toContainText('batch-a.cutproj.json');
  await expect(page.getByTestId('batch-project-file-list')).toContainText('batch-b.cutproj.json');
  await page.getByTestId('batch-project-operation-select').selectOption('batch-export');
  await page.getByTestId('batch-project-run-button').click();

  await expect.poll(() => page.evaluate((path) => window.__E2E_ACTIONS__!.getFileExists!(path), outputA)).toBe(true);
  await expect.poll(() => page.evaluate((path) => window.__E2E_ACTIONS__!.getFileExists!(path), outputB)).toBe(true);
  await expect(page.getByTestId('batch-project-report')).toContainText('"succeeded": 2');
  await expect(page.getByTestId('batch-project-report')).toContainText(outputA);
  await expect(page.getByTestId('batch-project-report')).toContainText(outputB);
});
