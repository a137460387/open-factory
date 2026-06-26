import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('AI rough cut generates storyboard and confirms clips to timeline', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupAIRoughCutFixture!());

  await page.getByTestId('toolbar-ai-rough-cut-button').click();
  await expect(page.getByTestId('ai-rough-cut-panel')).toBeVisible();

  // Fill in description and start generation
  await page.getByTestId('ai-rough-cut-text-input').fill('产品宣传视频');
  await page.getByTestId('ai-rough-cut-start').click();

  // Wait for preview phase with storyboard
  await expect(page.getByTestId('ai-rough-cut-storyboard')).toBeVisible({ timeout: 10_000 });

  // Verify 3 clips appear in storyboard
  const storyItems = page.locator('[data-testid^="ai-rough-cut-clip-"]');
  await expect(storyItems).toHaveCount(3);

  // Confirm clips to timeline
  await page.getByTestId('ai-rough-cut-confirm').click();

  // Verify clips were added to timeline
  await expect.poll(async () => {
    return page.evaluate(() => {
      const actions = window.__E2E_ACTIONS__;
      const timeline = actions!.getTimelineSnapshot!() as {
        tracks: Array<{ id: string; clips: Array<{ id: string }> }>;
      };
      return timeline.tracks.reduce((sum, t) => sum + t.clips.length, 0);
    });
  }).toBeGreaterThanOrEqual(3);
});
