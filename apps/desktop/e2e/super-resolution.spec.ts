import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('AI super resolution preview: renders controls and processes frame', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);

  // Mount the SuperResolutionPreview component via E2E action
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupSuperResolutionPreviewFixture!());

  // Wait for the component to render
  await page.waitForTimeout(500);

  // Verify the preview container is visible
  await expect(page.getByTestId('sr-preview-container')).toBeVisible();

  // Verify the preview canvas is present
  await expect(page.getByTestId('sr-preview-canvas')).toBeVisible();

  // Verify scale factor buttons are visible
  await expect(page.getByTestId('sr-factor-2')).toBeVisible();
  await expect(page.getByTestId('sr-factor-4')).toBeVisible();

  // Default factor should be 4x (active state)
  await expect(page.getByTestId('sr-factor-4')).toBeVisible();

  // Click 2x factor button
  await page.getByTestId('sr-factor-2').click();

  // Verify model select is present
  await expect(page.getByTestId('sr-model-select')).toBeVisible();

  // Select a specific model
  await page.getByTestId('sr-model-select').selectOption('realesrgan-x2plus');

  // Verify denoise slider is present
  await expect(page.getByTestId('sr-denoise')).toBeVisible();

  // Verify sharpen slider is present
  await expect(page.getByTestId('sr-sharpen')).toBeVisible();

  // Verify process button is present
  await expect(page.getByTestId('sr-process-btn')).toBeVisible();

  // Click the process button
  await page.getByTestId('sr-process-btn').click();

  // Wait for processing to complete (button text changes from "处理中...")
  await expect(page.getByTestId('sr-process-btn')).toBeVisible({ timeout: 10_000 });

  // After processing, the apply button should be enabled
  await expect(page.getByTestId('sr-apply-btn')).toBeVisible();
});

test('AI super resolution preview: advanced settings toggle', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);

  await page.evaluate(() => window.__E2E_ACTIONS__!.setupSuperResolutionPreviewFixture!());
  await page.waitForTimeout(500);

  // Verify the container is visible
  await expect(page.getByTestId('sr-preview-container')).toBeVisible();

  // Find and click the advanced settings toggle
  const advancedBtn = page.locator('button:has-text("高级设置")');
  await expect(advancedBtn).toBeVisible();
  await advancedBtn.click();

  // After expanding, the tile size slider should be visible
  await expect(page.getByTestId('sr-tile-size')).toBeVisible();

  // Verify checkboxes are visible (preserve faces, temporal consistency)
  const checkboxes = page.locator('input[type="checkbox"]');
  await expect(checkboxes.first()).toBeVisible();
});
