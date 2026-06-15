import { expect, test } from '@playwright/test';
import { addMediaCardToTimeline, waitForE2eActions } from './e2e-actions';

test('shows undo history branches and jumps between branch states', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page, 0);

  for (const value of ['10', '20']) {
    await page.getByTestId('clip-transform-x-input').fill(value);
    await page.getByTestId('clip-transform-x-input').press('Enter');
  }
  await page.getByTestId('toolbar-undo-button').click();
  await page.getByTestId('clip-transform-x-input').fill('30');
  await page.getByTestId('clip-transform-x-input').press('Enter');

  await page.getByTestId('toolbar-history-button').click();
  await expect(page.getByTestId('history-panel')).toBeVisible();
  await expect(page.getByTestId('history-entry')).toHaveCount(4);
  await expect(page.getByTestId('history-branch-badge')).toHaveCount(2);

  await page.locator('[data-testid="history-entry"][data-history-index="2"]').click();
  await expect.poll(() => readClipX(page)).toBe(20);

  await page.locator('[data-testid="history-entry"][data-history-index="3"]').click();
  await expect.poll(() => readClipX(page)).toBe(30);
});

async function readClipX(page: import('@playwright/test').Page): Promise<number> {
  return page.evaluate(() => {
    const timeline = window.__E2E_ACTIONS__!.getTimelineSnapshot!() as { tracks: Array<{ clips: Array<{ transform: { x: number } }> }> };
    return timeline.tracks[0].clips[0].transform.x;
  });
}
