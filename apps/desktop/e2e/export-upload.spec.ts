import { expect, test } from '@playwright/test';
import { addMediaCardToTimeline, expectExportTaskStatus, openExportDialog, waitForE2eActions } from './e2e-actions';

test('runs mocked WebDAV upload after export and shows upload status in history', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => {
    window.__E2E_ACTIONS__!.clearE2eFiles!();
    window.__E2E_ACTIONS__!.setSavePath!('C:/Exports/upload-source.mp4');
  });
  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page, 0);

  await openExportDialog(page);
  await page.getByTestId('export-output-path').fill('C:/Exports/upload-source.mp4');
  await page.getByTestId('export-upload-enabled').check();
  await page.getByTestId('export-upload-target-select').selectOption('webdav');
  await page.getByTestId('export-upload-webdav-url').fill('https://dav.example.test/exports/upload-source.mp4');
  await page.getByTestId('export-upload-webdav-username').fill('editor');
  await page.getByTestId('export-upload-webdav-password').fill('secret');

  const settingsPath = 'C:/Users/E2E/AppData/Roaming/open-factory/settings.json';
  await expect
    .poll(() => page.evaluate((path) => window.__E2E_ACTIONS__!.getWrittenFile!(path) as string | undefined, settingsPath))
    .toContain('https://dav.example.test/exports/upload-source.mp4');
  await expect.poll(() => page.evaluate((path) => window.__E2E_ACTIONS__!.getWrittenFile!(path) as string | undefined, settingsPath)).not.toContain('secret');

  await page.getByTestId('export-enqueue-button').click();
  await expectExportTaskStatus(page, 0, 'success');
  await expect(page.getByTestId('export-upload-status')).toHaveAttribute('data-status', 'success');

  const uploadRequest = await page.evaluate(() => window.__E2E_ACTIONS__!.getLastWebdavExportUploadRequest!() as { url: string; username?: string; password?: string; sourcePath: string });
  expect(uploadRequest).toMatchObject({
    url: 'https://dav.example.test/exports/upload-source.mp4',
    username: 'editor',
    password: 'secret',
    sourcePath: 'C:/Exports/upload-source.mp4'
  });

  const historyPath = 'C:/Users/E2E/AppData/Roaming/open-factory/export-history.json';
  const history = await page.evaluate((path) => JSON.parse(window.__E2E_ACTIONS__!.getWrittenFile!(path) as string) as Array<{ upload?: { status: string; destination?: string } }>, historyPath);
  expect(history[0].upload).toMatchObject({
    status: 'success',
    destination: 'https://dav.example.test/exports/upload-source.mp4'
  });
});
