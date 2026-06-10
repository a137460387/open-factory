import { expect, test } from '@playwright/test';

test('brightens the WebGL preview when clip color correction changes', async ({ page }) => {
  await page.goto('/');
  await page.getByTitle('Add text clip').click();
  await page.getByLabel('Text').fill(' ');
  await page.getByLabel('Text').blur();
  await page.locator('input[type="color"]').nth(1).fill('#555555');
  await page.getByLabel(/Background opacity/).fill('1');

  const before = await waitForPreviewPixel(page);
  await page.getByRole('spinbutton', { name: 'Brightness' }).fill('0.5');
  const after = await waitForPreviewPixel(page, before);

  expect(sumRgb(after)).toBeGreaterThan(sumRgb(before) + 40);
});

async function waitForPreviewPixel(page: import('@playwright/test').Page, previous?: number[]): Promise<number[]> {
  await expect
    .poll(async () => {
      const debug = await page.evaluate(() => window.__OPEN_FACTORY_PREVIEW_DEBUG__);
      const pixel = debug?.readback?.pixel;
      if (!pixel || pixel.length < 4 || pixel[3] === 0) {
        return 0;
      }
      if (previous && Math.abs(sumRgb(pixel) - sumRgb(previous)) < 10) {
        return 0;
      }
      return sumRgb(pixel);
    })
    .toBeGreaterThan(0);
  const pixel = await page.evaluate(() => window.__OPEN_FACTORY_PREVIEW_DEBUG__?.readback?.pixel ?? []);
  return pixel;
}

function sumRgb(pixel: number[]): number {
  return pixel[0] + pixel[1] + pixel[2];
}
