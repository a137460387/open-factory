import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('touch optimization toggle is visible in settings dialog', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);

  await page.getByTestId('toolbar-settings-button').click();
  await expect(page.getByTestId('settings-dialog')).toBeVisible();

  const touchToggle = page.getByTestId('settings-touch-optimization-toggle');
  await expect(touchToggle).toBeVisible();
  await expect(touchToggle).not.toBeChecked();
  await expect(page.getByTestId('settings-dialog')).toBeVisible();
});