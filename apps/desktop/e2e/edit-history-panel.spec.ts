import { expect, test } from '@playwright/test';
import { addMediaCardToTimeline, waitForE2eActions } from './e2e-actions';

test('jumps to an earlier edit history entry and restores clip state', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page, 0);

  for (const value of ['10', '20', '30']) {
    await page.getByTestId('clip-transform-x-input').fill(value);
    await page.getByTestId('clip-transform-x-input').press('Enter');
  }

  await page.getByTestId('toolbar-history-button').click();
  await expect(page.getByTestId('history-panel')).toBeVisible();
  await expect(page.getByTestId('history-entry')).toHaveCount(4);
  await page.locator('[data-testid="history-entry"][data-history-index="1"]').click();

  const x = await page.evaluate(() => {
    const timeline = window.__E2E_ACTIONS__!.getTimelineSnapshot!() as { tracks: Array<{ clips: Array<{ transform: { x: number } }> }> };
    return timeline.tracks[0].clips[0].transform.x;
  });
  expect(x).toBe(10);
  await expect(page.getByTestId('history-position')).toHaveText('当前位置 2/4');
});
