import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

const settingsPath = 'C:/Users/E2E/AppData/Roaming/open-factory/settings.json';

test('persists the selected light theme across reloads', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.clearE2eFiles!());
  await page.reload();
  await waitForE2eActions(page);

  await page.getByTestId('toolbar-settings-button').click();
  await page.getByTestId('settings-tab-appearance').click();
  await page.getByTestId('theme-select').selectOption('light');

  await expect(page.locator('body')).toHaveClass(/theme-light/);
  await expect
    .poll(() => page.evaluate((path) => window.__E2E_ACTIONS__!.getWrittenFile!(path) as string | undefined, settingsPath))
    .toContain('"activeThemeId": "light"');

  await page.reload();
  await waitForE2eActions(page);
  await expect(page.locator('body')).toHaveClass(/theme-light/);
});
