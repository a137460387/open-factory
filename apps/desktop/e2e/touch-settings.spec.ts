import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('enables touch optimization mode from settings and verifies persisted config', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);

  await page.getByTestId('toolbar-settings-button').click();
  await expect(page.getByTestId('settings-dialog')).toBeVisible();

  const touchToggle = page.getByTestId('settings-touch-optimization-toggle');
  await expect(touchToggle).toBeVisible();
  await expect(touchToggle).not.toBeChecked();

  await page.evaluate(() => {
    const checkbox = document.querySelector('[data-testid="settings-touch-optimization-toggle"]') as HTMLInputElement;
    checkbox?.click();
  });

  await expect
    .poll(() => page.evaluate(() => window.__E2E_ACTIONS__!.getWrittenFile!('C:/Users/E2E/AppData/Roaming/open-factory/settings.json') as string | undefined))
    .toContain('"enabled": true');
});