import { expect, test } from '@playwright/test';
import { addMediaCardToTimeline } from './e2e-actions';

test('switches A/B compare preview on and renders processed and original canvases', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page);

  await page.getByTestId('preview-compare-toggle').click();
  await expect(page.getByTestId('preview-canvas')).toBeVisible();
  await expect(page.getByTestId('preview-compare-original-canvas')).toBeVisible();
  await expect(page.getByTestId('preview-compare-divider')).toHaveAttribute('data-orientation', 'vertical');

  await page.getByTestId('preview-compare-mode-top-bottom').click();
  await expect(page.getByTestId('preview-compare-divider')).toHaveAttribute('data-orientation', 'horizontal');
});
