import { expect, test } from '@playwright/test';
import { addMediaCardToTimeline, waitForE2eActions } from './e2e-actions';

test('shows the timeline thumbnail track and removes it from the DOM when hidden', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);

  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page, 0);

  await expect(page.getByTestId('timeline-thumbnail-track')).toBeVisible();
  await expect(page.getByTestId('timeline-thumbnail-frame').first()).toBeVisible();

  await page.getByTestId('toolbar-view-menu-button').click();
  await page.getByTestId('toolbar-view-thumbnail-track-menu-item').click();

  await expect(page.getByTestId('timeline-thumbnail-track')).toHaveCount(0);
});
