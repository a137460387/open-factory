import { expect, test } from '@playwright/test';
import { addMediaCardToTimeline, waitForE2eActions } from './e2e-actions';

test('exports AAF for a professional NLE with copied media references', async ({ page }) => {
  const outputPath = 'C:/Exports/professional-export.aaf';
  const copiedMediaPath = 'C:/Exports/media/tiny-video-001.mp4';

  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.clearE2eFiles!());
  await page.evaluate((path) => window.__E2E_ACTIONS__!.setSavePath!(path), outputPath);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setOpenFileDialogPaths!(['C:/Media/tiny-video.mp4']));
  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page, 0);

  await page.getByTestId('toolbar-file-menu-button').click();
  await page.getByTestId('toolbar-file-professional-nle-export-menu-item').click();
  await expect(page.getByTestId('professional-nle-export-dialog')).toBeVisible();
  await page.getByTestId('professional-nle-format-select').selectOption('aaf');
  await page.getByTestId('professional-nle-media-copy-radio').check();
  await page.getByTestId('professional-nle-export-save-button').click();

  await expect.poll(() => page.evaluate((path) => window.__E2E_ACTIONS__!.getWrittenFile!(path) as string | undefined, outputPath)).toBeTruthy();
  const aaf = await page.evaluate((path) => window.__E2E_ACTIONS__!.getWrittenFile!(path) as string, outputPath);
  expect(aaf).toContain('AAF');
  expect(aaf).toContain('MasterMob');
  expect(aaf).toContain('MobSlotTimecode');
  expect(aaf).toContain('MediaMode: copy');
  expect(aaf).toContain(copiedMediaPath);
  await expect.poll(() => page.evaluate((path) => window.__E2E_ACTIONS__!.getWrittenFile!(path) as string | undefined, copiedMediaPath)).toBeTruthy();
});
