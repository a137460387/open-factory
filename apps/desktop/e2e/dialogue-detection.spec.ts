import { expect, test } from '@playwright/test';
import { addMediaCardToTimeline, waitForE2eActions } from './e2e-actions';

test('detects dialogue and shows green markers on the timeline ruler', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);

  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page, 0);

  await page.getByTestId('dialogue-detection-toggle').click();
  await expect(page.getByTestId('dialogue-detection-panel')).toBeVisible();

  await page.getByTestId('dialogue-detection-run').click();

  await expect(page.getByTestId('dialogue-detection-result').first()).toBeVisible();
  await expect(page.getByTestId('timeline-dialogue-marker').first()).toBeVisible();
});
