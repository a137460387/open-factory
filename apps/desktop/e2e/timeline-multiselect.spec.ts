import { expect, test } from '@playwright/test';

test('shift-selects two clips, batch deletes them, and undo restores both', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('import-media-button').click();
  await page.locator('[data-testid^="media-card-"]').nth(0).getByText('Add to timeline').click();
  await page.locator('[data-testid^="media-card-"]').nth(2).getByText('Add to timeline').click();

  const clips = page.locator('[data-testid^="timeline-clip-"]');
  await expect(clips).toHaveCount(2);
  await page.keyboard.down('Shift');
  await clips.first().click();
  await page.keyboard.up('Shift');

  await expect(page.getByText('多个 clip 已选中（2）')).toBeVisible();
  await page.keyboard.press('Delete');
  await expect(clips).toHaveCount(0);

  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Z' : 'Control+Z');
  await expect(clips).toHaveCount(2);
});
