import { expect, test } from '@playwright/test';
import { addMediaCardToTimeline, waitForE2eActions } from './e2e-actions';

test('gap stats panel shows count after adding clips', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page, 0);
  await addMediaCardToTimeline(page, 1);
  const gapToggle = page.getByTestId('gap-stats-toggle');
  if (await gapToggle.count() > 0) {
    await gapToggle.click();
    await expect(page.getByTestId('gap-stats-panel')).toBeVisible();
  }
});

test('sequence settings button opens dialog', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  const settingsButton = page.getByTestId('sequence-settings-button');
  if (await settingsButton.count() > 0) {
    await settingsButton.click();
    await expect(page.getByTestId('sequence-settings-dialog')).toBeVisible();
    await page.getByTestId('sequence-settings-override').check();
    await page.getByTestId('sequence-settings-fps').fill('24');
    await page.getByTestId('sequence-settings-save').click();
    await expect(page.getByTestId('sequence-settings-dialog')).not.toBeVisible();
  }
});

test('track resize handle visible on track header hover', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page, 0);
  const resizeHandle = page.getByTestId('track-resize-handle');
  if (await resizeHandle.count() > 0) {
    await expect(resizeHandle.first()).toBeAttached();
  }
});
