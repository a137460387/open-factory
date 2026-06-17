import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('detects scene cuts from the tools menu and applies a split', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => {
    window.__E2E_ACTIONS__!.setupSmartRoughCutFixture!();
    window.__E2E_ACTIONS__!.setSceneDetectionTimes!([1]);
  });

  await page.getByTestId('toolbar-tools-menu-button').click();
  await page.getByTestId('toolbar-tools-scene-detection-menu-item').click();

  await expect(page.getByTestId('scene-detect-dialog')).toBeVisible();
  await expect(page.getByTestId('scene-estimate')).toContainText('预计检测到约');
  await page.getByTestId('scene-detect-button').click();
  await expect(page.getByTestId('scene-result-summary')).toContainText('检测到 1 个切点');
  await expect(page.locator('[data-testid^="timeline-scenecut-"]')).toHaveCount(1);

  await page.getByTestId('scene-apply-button').click();

  await expect
    .poll(() =>
      page.evaluate(() => {
        const timeline = window.__E2E_ACTIONS__!.getTimelineSnapshot!() as {
          tracks: Array<{ id: string; clips: Array<{ start: number; duration: number }> }>;
        };
        return timeline.tracks.find((track) => track.id === 'track-video')?.clips.map((clip) => [clip.start, clip.duration]) ?? [];
      })
    )
    .toEqual([
      [0, 1],
      [1, 1.5]
    ]);
});
