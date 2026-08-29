import { expect, test } from '@playwright/test';
import { addMediaCardToTimeline, waitForE2eActions } from './e2e-actions';

test('opens channel analysis and shows frequency and phase curves', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);

  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page, 0);
  await page.locator('[data-testid^="timeline-clip-"]').first().click();

  await page.getByTestId('audio-mixer-tab-channel-analysis').click();

  // 面板于 50f336e7 重构：audio-channel-analysis-* testid 更名为 channel-analysis-*，
  // 频率曲线/相位示波器为独立 SVG 图表；统计区（相关性/峰值）仅在有采样快照时渲染。
  await expect(page.getByTestId('channel-analysis-record-button')).toBeVisible();
  await expect(page.getByTestId('channel-analysis-frequency-chart')).toBeVisible();
  await expect(page.getByTestId('channel-analysis-phase-scope')).toBeVisible();
});
