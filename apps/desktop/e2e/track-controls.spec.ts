import { expect, test } from '@playwright/test';
import { addMediaCardToTimeline } from './e2e-actions';

test('locked tracks prevent clip selection and trimming handles', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page);

  const clip = page.locator('[data-testid^="timeline-clip-"]').first();
  const clipId = await clip.getAttribute('data-clip-id');
  expect(clipId).toBeTruthy();

  await page.locator('[data-testid^="track-lock-"]').first().click();
  await expect(page.getByText('已锁定')).toBeVisible();
  await page.getByTestId('timeline-root').focus();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('inspector-empty-state')).toBeVisible();
  await clip.click();

  await expect(page.getByTestId('inspector-empty-state')).toBeVisible();
  await expect(page.getByTestId(`timeline-trim-left-${clipId}`)).toHaveCount(0);
  await expect(page.getByTestId(`timeline-trim-right-${clipId}`)).toHaveCount(0);
});
