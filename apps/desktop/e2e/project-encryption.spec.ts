import { expect, test } from '@playwright/test';
import { addMediaCardToTimeline, waitForE2eActions } from './e2e-actions';

test('saves an encrypted project and opens it with the correct password', async ({ page }) => {
  const encryptedPath = 'C:/Projects/locked.cutproj.enc';

  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate((path) => window.__E2E_ACTIONS__!.setSavePath!(path), encryptedPath);
  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page, 0);
  await expect.poll(() => page.evaluate(() => window.__E2E_ACTIONS__!.getTimelineSnapshot!().tracks.flatMap((track) => track.clips).length)).toBe(1);

  await page.getByTestId('toolbar-save-encrypted-project-button').click();
  await expect(page.getByTestId('project-encryption-dialog')).toBeVisible();
  await expect(page.getByTestId('project-encryption-toggle')).toBeChecked();
  await page.getByTestId('project-encryption-password-input').fill('secret');
  await page.getByTestId('project-encryption-confirm-button').click();

  await expect.poll(() => page.evaluate((path) => window.__E2E_ACTIONS__!.getWrittenFile!(path) as string | undefined, encryptedPath)).toContain('OFCUTENC1');

  await page.getByTestId('toolbar-new-project-button').click();
  await expect.poll(() => page.evaluate(() => window.__E2E_ACTIONS__!.getTimelineSnapshot!().tracks.flatMap((track) => track.clips).length)).toBe(0);

  await page.evaluate((path) => window.__E2E_ACTIONS__!.setOpenFileDialogPaths!([path]), encryptedPath);
  await page.getByTestId('toolbar-open-project-button').click();
  await expect(page.getByTestId('project-password-dialog')).toBeVisible();
  await page.getByTestId('project-password-input').fill('secret');
  await page.getByTestId('project-password-confirm-button').click();

  await expect.poll(() => page.evaluate(() => window.__E2E_ACTIONS__!.getTimelineSnapshot!().tracks.flatMap((track) => track.clips).length)).toBe(1);
});
