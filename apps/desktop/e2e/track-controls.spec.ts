import { expect, test } from '@playwright/test';

test('locked tracks prevent clip selection and trimming handles', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('import-media-button').click();
  await page.locator('[data-testid^="media-card-"]').first().getByText('Add to timeline').click();

  const clip = page.locator('[data-testid^="timeline-clip-"]').first();
  const clipId = await clip.getAttribute('data-clip-id');
  expect(clipId).toBeTruthy();

  await page.locator('[data-testid^="track-lock-"]').first().click();
  await expect(page.getByText('已锁定')).toBeVisible();
  await page.getByTestId('timeline-root').focus();
  await page.keyboard.press('Escape');
  await expect(page.getByText('Select a clip to edit its properties.')).toBeVisible();
  await clip.click();

  await expect(page.getByText('Select a clip to edit its properties.')).toBeVisible();
  await expect(page.getByTestId(`timeline-trim-left-${clipId}`)).toHaveCount(0);
  await expect(page.getByTestId(`timeline-trim-right-${clipId}`)).toHaveCount(0);
});
