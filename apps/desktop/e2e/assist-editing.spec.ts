import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('AI assist editing: panel opens with preset selection and config controls', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupAssistEditingFixture!());

  // Panel should be visible (opened by fixture)
  const panel = page.getByTestId('assist-editing-panel');
  await expect(panel).toBeVisible({ timeout: 10_000 });

  // Title should be visible
  await expect(panel).toContainText('AI 辅助剪辑');

  // Preset buttons should be visible
  await expect(page.getByTestId('assist-preset-quick-cut')).toBeVisible();
  await expect(page.getByTestId('assist-preset-rhythm-match')).toBeVisible();
  await expect(page.getByTestId('assist-preset-emotion-driven')).toBeVisible();
  await expect(page.getByTestId('assist-preset-content-aware')).toBeVisible();

  // Click a preset
  await page.getByTestId('assist-preset-rhythm-match').click();

  // Config controls should exist
  await expect(page.getByTestId('assist-config-min-duration')).toBeVisible();
  await expect(page.getByTestId('assist-config-max-duration')).toBeVisible();

  // Generate button should be visible
  await expect(page.getByTestId('assist-generate-btn')).toBeVisible();
});
