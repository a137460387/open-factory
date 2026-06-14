import { expect, test } from '@playwright/test';
import { addMediaCardToTimeline, waitForE2eActions } from './e2e-actions';

test('searches timeline clips by effect type', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page, 0);
  await page.locator('[data-testid^="timeline-clip-"]').first().click();

  await page.getByText('特效', { exact: true }).click();
  await page.getByTestId('effect-type-select').selectOption('blur');
  await page.getByTestId('add-effect-button').click();
  await expect(page.getByTestId('effect-item-blur')).toBeVisible();

  await page.keyboard.press('Control+F');
  await expect(page.getByTestId('timeline-search-panel')).toBeVisible();
  await page.getByTestId('timeline-search-input').fill('blur');

  const result = page.locator('[data-testid^="timeline-search-result-clip-"]').first();
  await expect(result).toContainText('tiny-video.mp4');
  await expect(result).toContainText('特效类型');
});
