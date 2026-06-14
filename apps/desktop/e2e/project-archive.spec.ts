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

test('generates an offline media HTML report from the file menu', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setSavePath!('C:/Reports/material-report.html'));
  await page.getByTestId('toolbar-open-project-button').click();

  await page.getByTestId('toolbar-file-menu-button').click();
  await page.getByTestId('toolbar-file-media-report-menu-item').click();

  const reportPath = 'C:/Reports/material-report.html';
  await expect.poll(() => page.evaluate((path) => window.__E2E_ACTIONS__!.getWrittenFile!(path) as string | undefined, reportPath)).not.toBeUndefined();
  const html = await page.evaluate((path) => window.__E2E_ACTIONS__!.getWrittenFile!(path) as string, reportPath);
  expect(html).toContain('素材使用分析：E2E Project');
  expect(html).toContain('C:/Media/tiny-video.mp4');
  expect(html).toContain('项目总时长');
  expect(html).toContain('总媒体大小');
  expect(html).toContain('导出预估大小');
  expect(html).toContain('使用片段列表');
  expect(html).toContain('使用率热力图');
  expect(html).toContain('导出时长分布');
});

test('exports a clip report HTML file from the file menu', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setSavePath!('C:/Reports/clip-report.html'));
  await page.getByTestId('toolbar-open-project-button').click();

  await page.getByTestId('toolbar-file-menu-button').click();
  await page.getByTestId('toolbar-file-clip-report-menu-item').click();

  const reportPath = 'C:/Reports/clip-report.html';
  await expect.poll(() => page.evaluate((path) => window.__E2E_ACTIONS__!.getWrittenFile!(path) as string | undefined, reportPath)).not.toBeUndefined();
  const html = await page.evaluate((path) => window.__E2E_ACTIONS__!.getWrittenFile!(path) as string, reportPath);
  expect(html).toContain('剪辑报告：E2E Project');
  expect(html).toContain('Clip 清单');
  expect(html).toContain('tiny-video.mp4');
});

test('confirms before archiving when project media is missing', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setMissingProjectNext!());
  await page.getByTestId('toolbar-open-project-button').click();

  await page.getByTestId('toolbar-file-menu-button').click();
  await page.getByTestId('toolbar-file-archive-project-menu-item').click();

  await expect
    .poll(() => page.evaluate(() => window.__E2E_ACTIONS__!.getLastConfirmMessage!() as string | undefined))
    .toBe('1 个媒体文件缺失，继续归档将跳过这些文件，是否继续？');
});
