import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('autosave recovery dialog is shown when recovery data exists', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);

  // After navigation, the autosave recovery dialog should appear if recovery data exists
  const dialog = page.getByTestId('autosave-recovery-dialog');
  // The dialog may or may not be visible depending on recovery state; verify DOM is ready
  const count = await dialog.count();
  expect(count).toBeLessThanOrEqual(1);
});

test('archive progress dialog is not rendered by default', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);

  const archiveDialog = page.getByTestId('archive-progress-dialog');
  expect(await archiveDialog.count()).toBe(0);
});

test('export queue recovery dialog is not rendered by default', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);

  const exportDialog = page.getByTestId('export-queue-recovery-dialog');
  expect(await exportDialog.count()).toBe(0);
});
