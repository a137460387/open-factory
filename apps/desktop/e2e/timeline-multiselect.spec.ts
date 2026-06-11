import { expect, test } from '@playwright/test';
import { addMediaCardToTimeline } from './e2e-actions';

test('shift-selects two clips, batch deletes them, and undo restores both', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page, 0);
  await addMediaCardToTimeline(page, 2);

  const clips = page.locator('[data-testid^="timeline-clip-"]');
  await expect(clips).toHaveCount(2);
  await page.keyboard.down('Shift');
  await clips.first().click();
  await page.keyboard.up('Shift');

  await expect(page.getByTestId('inspector-multiple-selection-state')).toBeVisible();
  await page.keyboard.press('Delete');
  await expect(clips).toHaveCount(0);

  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Z' : 'Control+Z');
  await expect(clips).toHaveCount(2);
});
