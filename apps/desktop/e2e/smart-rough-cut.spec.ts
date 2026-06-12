import { expect, test, type Page } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('smart rough cut panel runs scene, silence, and Whisper steps', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupSmartRoughCutFixture!());

  await page.getByTestId('toolbar-smart-rough-cut-button').click();
  await expect(page.getByTestId('smart-rough-cut-panel')).toBeVisible();

  await page.getByTestId('smart-scene-button').click();
  await expect(page.getByTestId('smart-scene-status')).toHaveAttribute('data-status', 'complete');
  await expect(page.getByTestId('smart-scene-preview')).toContainText('检测到 1 个切点');
  await page.getByTestId('smart-scene-apply-button').click();
  await expect.poll(() => getVideoClipCount(page)).toBe(2);

  await page.evaluate(() => window.__E2E_ACTIONS__!.setupSmartRoughCutFixture!());
  await page.getByTestId('smart-silence-button').click();
  await expect(page.getByTestId('smart-silence-status')).toHaveAttribute('data-status', 'complete');
  await expect(page.getByTestId('smart-silence-preview')).toContainText('将删除 1 段静音');
  await page.getByTestId('smart-silence-apply-button').click();
  await expect.poll(() => getVideoClipCount(page)).toBe(2);

  await page.evaluate(() => window.__E2E_ACTIONS__!.setupSmartRoughCutFixture!());
  await page.getByTestId('whisper-executable-path-input').fill('C:/Tools/whisper.exe');
  await page.getByTestId('whisper-model-path-input').fill('C:/Models/base.bin');
  await expect(page.getByTestId('smart-whisper-button')).toBeEnabled();
  await page.getByTestId('smart-whisper-button').click();
  await expect(page.getByTestId('smart-whisper-status')).toHaveAttribute('data-status', 'complete');
  await expect(page.locator('[data-clip-type="subtitle"]')).toHaveCount(2);
  await expect(page.getByTestId('smart-rough-cut-report')).toContainText('生成 2 条字幕');
});

async function getVideoClipCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    const timeline = window.__E2E_ACTIONS__!.getTimelineSnapshot!() as {
      tracks: Array<{ id: string; clips: unknown[] }>;
    };
    return timeline.tracks.find((track) => track.id === 'track-video')?.clips.length ?? 0;
  });
}
