import { expect, test } from '@playwright/test';
import { addMediaCardToTimeline, waitForE2eActions } from './e2e-actions';

test('adds a bookmark from the keyboard and jumps from the bookmark panel', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);

  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page, 0);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setPlayheadTime!(3));
  await page.getByTestId('timeline-root').focus();
  await page.keyboard.press('B');

  const bookmark = page.locator('[data-testid^="timeline-bookmark-"]').first();
  await expect(bookmark).toBeVisible();
  await expect(page.getByTestId('bookmark-panel')).toBeVisible();
  const row = page.locator('[data-testid^="bookmark-list-item-"]').first();
  await expect(row).toContainText('书签 1');

  await page.evaluate(() => window.__E2E_ACTIONS__!.setPlayheadTime!(0));
  await row.click();
  await expect.poll(() => page.evaluate(() => window.__E2E_ACTIONS__!.getPlayheadTime!())).toBe(3);
});
