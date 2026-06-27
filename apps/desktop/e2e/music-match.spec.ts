import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('AI music match analyzes video mood and shows keywords and recommendations', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupMusicMatchFixture!());

  await page.getByTestId('toolbar-music-match-button').click();
  await expect(page.getByTestId('music-match-panel')).toBeVisible();

  // Start analysis
  await page.getByTestId('music-match-start').click();

  // Wait for result
  await expect(page.getByTestId('music-match-result')).toBeVisible({ timeout: 10_000 });

  // Verify mood display contains expected keywords
  await expect(page.getByTestId('music-match-result')).toContainText('活力积极');

  // Verify audio recommendations appear (media has one audio file)
  await expect(page.getByTestId('music-match-rec-media-mm-audio')).toBeVisible();
});
