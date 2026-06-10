import { expect, test } from '@playwright/test';

test('ctrl wheel zoom changes clip width while keeping the playhead anchored', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 720 });
  await page.goto('/');
  await page.getByTestId('import-media-button').click();
  await page.locator('[data-testid^="media-card-"]').first().getByText('Add to timeline').click();

  const rulerBox = await page.getByTestId('timeline-ruler').boundingBox();
  expect(rulerBox).not.toBeNull();
  await page.mouse.click(rulerBox!.x + 160, rulerBox!.y + rulerBox!.height / 2);

  const clip = page.locator('[data-testid^="timeline-clip-"]').first();
  const beforeClipBox = await clip.boundingBox();
  const beforePlayheadBox = await page.getByTestId('timeline-playhead').boundingBox();
  expect(beforeClipBox).not.toBeNull();
  expect(beforePlayheadBox).not.toBeNull();

  for (let index = 0; index < 5; index += 1) {
    await page.getByTestId('timeline-scroll-container').dispatchEvent('wheel', {
      deltaY: -120,
      ctrlKey: true,
      clientX: beforePlayheadBox!.x,
      clientY: beforePlayheadBox!.y + 8
    });
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  }

  await expect.poll(async () => (await clip.boundingBox())?.width ?? 0).toBeGreaterThan(beforeClipBox!.width * 1.1);
  await expect
    .poll(async () => {
      const box = await page.getByTestId('timeline-playhead').boundingBox();
      return Math.abs((box?.x ?? 0) - beforePlayheadBox!.x);
    })
    .toBeLessThanOrEqual(2);
});
