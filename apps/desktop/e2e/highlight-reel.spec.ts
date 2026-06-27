import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('AI highlight reel scores clips and generates highlight sequence', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupHighlightReelFixture!());

  await page.getByTestId('toolbar-highlight-reel-button').click();
  await expect(page.getByTestId('highlight-reel-panel')).toBeVisible();

  // Generate highlight reel
  await page.getByTestId('highlight-reel-generate').click();

  // Wait for result
  await expect(page.getByTestId('highlight-reel-result')).toBeVisible({ timeout: 10_000 });

  // Verify scored items appear
  const items = page.locator('[data-testid^="highlight-reel-item-"]');
  await expect(items.first()).toBeVisible();

  // Apply highlight reel
  await page.getByTestId('highlight-reel-apply').click();

  // Verify clips were added to a new sequence or timeline
  await expect.poll(async () => {
    return page.evaluate(() => {
      const actions = window.__E2E_ACTIONS__;
      const timeline = actions!.getTimelineSnapshot!() as {
        tracks: Array<{ id: string; clips: Array<{ id: string }> }>;
      };
      return timeline.tracks.reduce((sum, t) => sum + t.clips.length, 0);
    });
  }).toBeGreaterThanOrEqual(1);
});
