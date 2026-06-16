import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('pops preview into a detached window and restores embedded preview after close', async ({ page }) => {
  const settingsPath = 'C:/Users/E2E/AppData/Roaming/open-factory/settings.json';

  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.clearE2eFiles!());
  await page.reload();
  await waitForE2eActions(page);

  await expect(page.getByTestId('preview-canvas')).toBeVisible();
  await page.getByTestId('toolbar-popout-preview-button').click();

  await expect.poll(() => page.evaluate(() => window.__E2E_ACTIONS__!.isPreviewWindowOpen!() as boolean)).toBe(true);
  await expect(page.getByTestId('preview-window-placeholder')).toBeVisible();

  await page.evaluate(() => window.__E2E_ACTIONS__!.closePreviewWindow!());
  await expect.poll(() => page.evaluate(() => window.__E2E_ACTIONS__!.isPreviewWindowOpen!() as boolean)).toBe(false);
  await expect(page.getByTestId('preview-window-placeholder')).toBeHidden();
  await expect(page.getByTestId('preview-canvas')).toBeVisible();

  await expect
    .poll(() => page.evaluate((path) => window.__E2E_ACTIONS__!.getWrittenFile!(path) as string | undefined, settingsPath))
    .toContain('"previewWindow"');
});
