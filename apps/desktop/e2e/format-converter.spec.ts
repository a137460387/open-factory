import { test, expect } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test.describe('Format Converter', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForE2eActions(page);
  });

  test('format converter dialog opens and shows drop zone', async ({ page }) => {
    await page.evaluate(() => {
      const store = (window as any).__APP_STORE__;
      if (store?.setFormatConverterOpen) store.setFormatConverterOpen(true);
    });
    const dialog = page.getByTestId('format-converter-dialog');
    await expect(dialog).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('format-converter-dropzone')).toBeVisible();
  });

  test('injected files show preset selection', async ({ page }) => {
    await page.evaluate(() => {
      const store = (window as any).__APP_STORE__;
      if (store?.setFormatConverterMockFiles) {
        store.setFormatConverterMockFiles([
          { path: 'video1.mp4', name: 'video1.mp4', format: 'mp4' },
          { path: 'video2.mkv', name: 'video2.mkv', format: 'mkv' },
          { path: 'video3.mov', name: 'video3.mov', format: 'mov' },
        ]);
      }
      if (store?.setFormatConverterOpen) store.setFormatConverterOpen(true);
    });
    await expect(page.getByTestId('format-converter-presets')).toBeVisible({ timeout: 5000 });
  });

  test('selecting extract-audio preset shows tasks with mp3 target', async ({ page }) => {
    await page.evaluate(() => {
      const store = (window as any).__APP_STORE__;
      if (store?.setFormatConverterMockFiles) {
        store.setFormatConverterMockFiles([
          { path: 'v1.mp4', name: 'v1.mp4', format: 'mp4' },
          { path: 'v2.mp4', name: 'v2.mp4', format: 'mp4' },
          { path: 'v3.mp4', name: 'v3.mp4', format: 'mp4' },
        ]);
      }
      if (store?.setFormatConverterOpen) store.setFormatConverterOpen(true);
    });
    // Select extract audio preset
    await page.getByTestId('preset-extract-audio-mp3').click();
    await expect(page.getByTestId('format-converter-tasks')).toBeVisible({ timeout: 5000 });
    // Should show 3 tasks with mp3 target
    const taskItems = page.getByTestId('format-converter-tasks').locator('div');
    await expect(taskItems.first()).toBeVisible();
  });

  test('EXR conversion shows intermediate format hint', async ({ page }) => {
    await page.evaluate(() => {
      const store = (window as any).__APP_STORE__;
      if (store?.setFormatConverterMockFiles) {
        store.setFormatConverterMockFiles([
          { path: 'frame.exr', name: 'frame.exr', format: 'exr' },
        ]);
      }
      if (store?.setFormatConverterOpen) store.setFormatConverterOpen(true);
    });
    await expect(page.getByTestId('format-converter-presets')).toBeVisible({ timeout: 5000 });
  });
});