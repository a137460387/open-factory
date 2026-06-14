import { expect, test } from '@playwright/test';
import { addMediaCardToTimeline, waitForE2eActions } from './e2e-actions';

test('uses the preview compositor and mixes embedded video audio', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page);
  await page.getByTestId('preview-playback-button').click();

  await expect.poll(() => page.evaluate(() => window.__OPEN_FACTORY_PREVIEW_DEBUG__?.mode)).toBeTruthy();
  await expect.poll(() => page.evaluate(() => window.__OPEN_FACTORY_PREVIEW_DEBUG__?.renderCount ?? 0)).toBeGreaterThan(0);
  await expect.poll(() => page.evaluate(() => window.__OPEN_FACTORY_AUDIO_MIX_DEBUG__?.clipTypes.includes('video') ?? false)).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__OPEN_FACTORY_AUDIO_MIX_DEBUG__?.gainValues.some((value) => value > 0) ?? false)).toBe(true);
});

test('scales the preview canvas for half-resolution quality', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.clearE2eFiles!());
  await page.reload();
  await waitForE2eActions(page);

  const canvas = page.getByTestId('preview-canvas');
  await expect(canvas).toHaveAttribute('width', '1280');
  await expect(canvas).toHaveAttribute('height', '720');

  await page.getByTestId('toolbar-preview-quality-select').selectOption('half');

  await expect(canvas).toHaveAttribute('width', '640');
  await expect(canvas).toHaveAttribute('height', '360');
  await expect(canvas).toHaveAttribute('data-preview-quality', 'half');

  await page.reload();
  await waitForE2eActions(page);
  await expect(page.getByTestId('toolbar-preview-quality-select')).toHaveValue('half');
});
