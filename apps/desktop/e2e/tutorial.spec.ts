import { expect, test } from '@playwright/test';
import { waitForE2eActions, waitForAppStore } from './e2e-actions';

test('restarts tutorial from help menu and advances after importing media', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await waitForAppStore(page);

  await page.getByTestId('toolbar-help-menu-button').click();
  await page.getByTestId('toolbar-help-tutorial-menu-item').click();

  await expect(page.getByTestId('tutorial-overlay')).toBeVisible();
  await expect(page.getByTestId('tutorial-overlay')).toHaveAttribute('data-step-id', 'import-media');

  await page.getByTestId('import-media-button').click();

  // Wait for media import to complete and tutorial to advance
  await expect(page.getByTestId('tutorial-overlay')).toHaveAttribute('data-step-id', 'add-clip', { timeout: 10_000 });
  await expect(page.locator('[data-testid^="media-card-"]')).toHaveCount(3);
});
