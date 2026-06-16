import { expect, test } from '@playwright/test';
import { addMediaCardToTimeline, waitForE2eActions } from './e2e-actions';

test('opens channel analysis and shows frequency and phase curves', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);

  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page, 0);
  await page.locator('[data-testid^="timeline-clip-"]').first().click();

  await page.getByTestId('audio-mixer-tab-channel-analysis').click();

  await expect(page.getByTestId('audio-channel-analysis-panel')).toBeVisible();
  await expect(page.getByTestId('audio-channel-analysis-curve')).toBeVisible();
  await expect(page.getByTestId('audio-channel-analysis-phase')).toBeVisible();
  await expect(page.getByTestId('audio-channel-analysis-correlation')).toContainText('左右相关性');
  await expect(page.getByTestId('audio-channel-analysis-peak-0')).toBeVisible();
});
