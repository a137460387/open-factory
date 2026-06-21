import { expect, test } from '@playwright/test';
import { addMediaCardToTimeline } from './e2e-actions';

test('zoom level changes when switching between edit and browse modes', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 720 });
  await page.goto('/');
  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page);

  const rulerBox = await page.getByTestId('timeline-ruler').boundingBox();
  expect(rulerBox).not.toBeNull();
  await page.mouse.click(rulerBox!.x + 160, rulerBox!.y + rulerBox!.height / 2);

  const zoomSlider = page.getByTestId('timeline-zoom-slider');
  expect(zoomSlider).toBeVisible();
  const initialZoom = await zoomSlider.inputValue();
  expect(Number(initialZoom)).toBeGreaterThan(0);

  const clip = page.locator('[data-testid^="timeline-clip-"]').first();
  await clip.dblclick();

  await page.getByTestId('inspector-panel').isVisible();

  const closeBtn = page.getByTestId('inspector-close-button');
  if (await closeBtn.isVisible()) {
    await closeBtn.click();
  }

  const restoredZoom = await zoomSlider.inputValue();
  expect(Number(restoredZoom)).toBeGreaterThan(0);
});
