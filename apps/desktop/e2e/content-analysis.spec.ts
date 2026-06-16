import { expect, test } from '@playwright/test';
import { addMediaCardToTimeline, waitForE2eActions } from './e2e-actions';

test('runs local content analysis and shows scene tags in the media bin', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.clearE2eFiles!());
  await page.reload();
  await waitForE2eActions(page);

  await page.getByTestId('import-media-button').click();
  const firstCard = page.locator('[data-testid^="media-card-"]').first();
  await expect(firstCard).toBeVisible();
  const cardTestId = await firstCard.getAttribute('data-testid');
  const mediaId = cardTestId?.replace('media-card-', '');
  expect(mediaId).toBeTruthy();
  await addMediaCardToTimeline(page);

  await page.getByTestId('toolbar-tools-menu-button').click();
  await page.getByTestId('toolbar-tools-content-analysis-menu-item').click();
  await expect(page.getByTestId('content-analysis-dialog')).toBeVisible();
  await page.getByTestId('content-analysis-run-button').click();

  await expect(page.getByTestId(`media-scene-tag-dialogue-${mediaId}`)).toBeVisible();
  await page.getByTestId('content-analysis-close-button').click();
  await page.getByTestId('media-scene-filter-select').selectOption('dialogue');
  await expect(page.getByTestId(`media-card-${mediaId}`)).toBeVisible();
});
