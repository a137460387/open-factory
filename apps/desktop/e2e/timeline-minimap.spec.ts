import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('drags the timeline minimap viewport to sync the timeline scroll position', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupGapFillFixture!());

  await page.getByTestId('timeline-zoom-slider').fill('1600');
  await expect(page.getByTestId('timeline-minimap')).toBeVisible();
  await expect(page.getByTestId('timeline-minimap-viewport')).toBeVisible();

  const scroll = page.getByTestId('timeline-scroll-container');
  const before = await scroll.evaluate((element) => element.scrollLeft);
  const viewportBox = await page.getByTestId('timeline-minimap-viewport').boundingBox();
  expect(viewportBox).not.toBeNull();

  await page.mouse.move(viewportBox!.x + viewportBox!.width / 2, viewportBox!.y + viewportBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(viewportBox!.x + viewportBox!.width / 2, viewportBox!.y + viewportBox!.height / 2 + 90, { steps: 6 });
  await page.mouse.up();

  await expect.poll(() => scroll.evaluate((element) => element.scrollLeft)).toBeGreaterThan(before + 100);
});
