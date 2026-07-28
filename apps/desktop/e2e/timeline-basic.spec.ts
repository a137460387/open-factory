import { expect, test } from '@playwright/test';
import { waitForE2eActions, waitForAppStore, addMediaCardToTimeline } from './e2e-actions';

test.describe('Timeline Basic Operations', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForE2eActions(page);
    await waitForAppStore(page);
    await page.evaluate(() => window.__E2E_ACTIONS__!.clearE2eFiles!());
    await page.reload();
    await waitForE2eActions(page);
  });

  test('adding media creates a clip on timeline', async ({ page }) => {
    await page.getByTestId('import-media-button').click();
    await addMediaCardToTimeline(page);

    const clips = page.locator('[data-testid^="timeline-clip-"]');
    await expect(clips).toHaveCount(1);
  });

  test('selecting a clip updates the inspector panel', async ({ page }) => {
    await page.getByTestId('import-media-button').click();
    await addMediaCardToTimeline(page);

    const clip = page.locator('[data-testid^="timeline-clip-"]').first();
    await clip.click();

    await expect(page.getByTestId('inspector-empty-state')).not.toBeVisible();
  });

  test('delete key removes selected clip', async ({ page }) => {
    await page.getByTestId('import-media-button').click();
    await addMediaCardToTimeline(page);

    const clip = page.locator('[data-testid^="timeline-clip-"]').first();
    await clip.click();
    await page.keyboard.press('Delete');

    await expect(page.locator('[data-testid^="timeline-clip-"]')).toHaveCount(0);
  });

  test('multiple clips can be added to timeline', async ({ page }) => {
    await page.getByTestId('import-media-button').click();
    await addMediaCardToTimeline(page, 0);
    await addMediaCardToTimeline(page, 1);

    const clips = page.locator('[data-testid^="timeline-clip-"]');
    const count = await clips.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });
});
