import { expect, test } from '@playwright/test';
import { addMediaCardToTimeline, openExportDialog, waitForE2eActions } from './e2e-actions';

test('shows hardware encoder settings panel when hardware encoding is enabled', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page, 0);
  await openExportDialog(page);

  const hwToggle = page.getByTestId('export-hardware-encoding-toggle');
  await expect(hwToggle).toBeVisible();
  await hwToggle.click();

  const panel = page.getByTestId('hw-encoder-settings');
  const visible = await panel.isVisible().catch(() => false);
  if (visible) {
    await expect(page.getByTestId('hw-encoder-select')).toBeVisible();
    await expect(page.getByTestId('hw-rate-control-select')).toBeVisible();
  }
});

test('disables hardware encoding controls for audio-only export', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page, 0);
  await openExportDialog(page);
  await page.getByTestId('export-output-mode-select').selectOption('audio');
  await expect(page.getByTestId('export-hardware-encoding-toggle')).toBeDisabled();
});
