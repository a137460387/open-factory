import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('archives a project with media paths rewritten relative to the archive project', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.getByTestId('toolbar-open-project-button').click();

  await page.getByTestId('toolbar-archive-project-button').click();

  const archiveProjectPath = 'C:/Projects/E2E Project_archive/E2E Project.cutproj.json';
  const archivedMediaPath = 'C:/Projects/E2E Project_archive/media/tiny-video.mp4';
  await expect.poll(() => page.evaluate((path) => window.__E2E_ACTIONS__!.getFileExists!(path) as boolean, archivedMediaPath)).toBe(true);
  await expect.poll(() => page.evaluate((path) => window.__E2E_ACTIONS__!.getWrittenFile!(path) as string | undefined, archiveProjectPath)).not.toBeUndefined();

  const archived = await page.evaluate((path) => JSON.parse(window.__E2E_ACTIONS__!.getWrittenFile!(path) as string), archiveProjectPath);
  const paths = archived.project.media.map((asset: { path: string }) => asset.path);
  expect(paths).toEqual(['media/tiny-video.mp4']);
  expect(paths.every((path: string) => !path.includes(':') && !path.startsWith('/'))).toBe(true);
});
