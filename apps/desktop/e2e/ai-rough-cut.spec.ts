import { test, expect } from './fixtures';

test('AI rough cut generates storyboard and confirms clips to timeline', async ({ page, toolbar, aiPanel, timeline }) => {
  await toolbar.goto();
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupAIRoughCutFixture!());

  await aiPanel.openRoughCut();
  await aiPanel.fillRoughCutDescription('产品宣传视频');
  await aiPanel.startRoughCut();

  // Wait for preview phase with storyboard
  await aiPanel.waitForStoryboard();

  // Verify 3 clips appear in storyboard
  const storyItems = page.locator('[data-testid^="ai-rough-cut-clip-"]');
  await expect(storyItems).toHaveCount(3);

  // Confirm clips to timeline
  await aiPanel.confirmRoughCut();

  // Verify clips were added to timeline
  await expect.poll(async () => {
    const snapshot = await timeline.getSnapshot();
    return snapshot.tracks.reduce((sum, t) => sum + t.clips.length, 0);
  }).toBeGreaterThanOrEqual(3);
});
