import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('AI version diff: open compare dialog via edit menu and verify structure', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupAIVersionDiffFixture!());

  // Open edit menu
  await page.getByTestId('toolbar-edit-menu-button').click();
  await expect(page.getByTestId('toolbar-edit-menu')).toBeVisible();

  // Click version compare
  await page.getByTestId('toolbar-edit-version-compare-menu-item').click();

  // Dialog should open
  await expect(page.getByTestId('snapshot-version-diff-dialog')).toBeVisible({ timeout: 10_000 });

  // Verify selects are present
  await expect(page.getByTestId('snapshot-version-base-select')).toBeVisible();
  await expect(page.getByTestId('snapshot-version-target-select')).toBeVisible();

  // No real snapshots stored — empty state should show
  await expect(page.getByTestId('snapshot-version-diff-empty')).toBeVisible();

  // Close dialog
  await page.locator('[data-testid="snapshot-version-diff-dialog"] button').filter({ hasText: /关闭|Close/ }).click();
  await expect(page.getByTestId('snapshot-version-diff-dialog')).not.toBeVisible();
});

test('AI version diff: dialog shows empty state when no snapshots exist', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupAIVersionDiffFixture!());

  await page.getByTestId('toolbar-edit-menu-button').click();
  await page.getByTestId('toolbar-edit-version-compare-menu-item').click();
  await expect(page.getByTestId('snapshot-version-diff-dialog')).toBeVisible({ timeout: 10_000 });

  // Empty state with no snapshots
  await expect(page.getByTestId('snapshot-version-diff-empty')).toBeVisible();

  // AI summary button should NOT be visible (no diff items)
  await expect(page.getByTestId('snapshot-version-ai-summary')).not.toBeVisible();
});
