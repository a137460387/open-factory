import { expect, test, type Page } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('rough cut compare applies the selected proposal and trims edge gaps', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupRoughCutCompareFixture!());

  const clip = page.getByTestId('timeline-clip-clip-roughcut-video');
  await expect(clip).toBeVisible();
  await clip.click({ button: 'right' });
  await expect(page.getByTestId('clip-action-menu')).toBeVisible();
  await page.getByTestId('clip-action-rough-cut-compare').click();

  await expect(page.getByTestId('rough-cut-compare-panel')).toBeVisible();
  await expect(page.getByTestId('rough-cut-proposal-highlights-first')).toBeVisible();
  await expect(page.getByTestId('rough-cut-proposal-beat-sync')).toBeVisible();
  await expect(page.getByTestId('rough-cut-proposal-balanced')).toBeVisible();

  await page.getByTestId('rough-cut-proposal-highlights-first').click();
  await page.getByTestId('apply-proposal-highlights-first').click();

  // 面板关闭 + 提案应用：提案段 [0.3, 2.4] 连续合并为单保留区间，
  // 首尾间隙（[0,0.3] / [2.4,2.5]）被波纹删除。
  await expect(page.getByTestId('rough-cut-compare-panel')).toHaveCount(0);
  await expect.poll(() => getVideoClips(page).then((clips) => clips.length)).toBe(1);
  const clips = await getVideoClips(page);
  expect(clips[0]).toMatchObject({ start: 0, duration: 2.1, trimStart: 0.3 });
});

test('rough cut compare entry stays disabled for unanalyzed clips', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupSmartRoughCutFixture!());

  const clip = page.getByTestId('timeline-clip-clip-smart-video');
  await expect(clip).toBeVisible();
  await clip.click({ button: 'right' });
  await expect(page.getByTestId('clip-action-menu')).toBeVisible();

  // setupSmartRoughCutFixture 的 clip 无 contentAnalysis → 入口禁用（D1-B 限制）
  await expect(page.getByTestId('clip-action-rough-cut-compare')).toBeDisabled();
});

async function getVideoClips(page: Page): Promise<Array<{ start: number; duration: number; trimStart: number }>> {
  return page.evaluate(() => {
    const timeline = window.__E2E_ACTIONS__!.getTimelineSnapshot!() as {
      tracks: Array<{
        id: string;
        clips: Array<{ start: number; duration: number; trimStart: number }>;
      }>;
    };
    return timeline.tracks.find((track) => track.id === 'track-video')?.clips ?? [];
  });
}
