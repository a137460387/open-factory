import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('rates media and filters the five star smart album', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.getByTestId('import-media-button').click();

  const cards = page.locator('[data-testid^="media-card-"]');
  await expect(cards).toHaveCount(3);
  await cards.first().locator('[data-testid^="media-rating-star-"][data-rating-value="5"]').click();
  await expect(cards.first()).toHaveAttribute('data-rating', '5');

  await page.getByTestId('smart-album-rating-five').click();

  await expect(page.locator('[data-testid^="media-card-"]')).toHaveCount(1);
  await expect(page.locator('[data-testid^="media-card-"]').first()).toHaveAttribute('data-rating', '5');
});
