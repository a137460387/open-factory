import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('AI beat snap: shows suggestions panel and apply suggestion with undo', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupBeatSnapFixture!());

  // Beat snap AI button should be visible
  const aiButton = page.getByTestId('beat-snap-ai-button');
  await expect(aiButton).toBeVisible({ timeout: 10_000 });

  // Click to open the suggestions panel
  await aiButton.click();

  // Suggestions panel should show with 1 suggestion (clip-bs-3 in edge)
  await expect(page.getByTestId('beat-snap-suggestions-count')).toBeVisible();
  await expect(page.getByTestId('beat-snap-suggestion-clip-bs-3-in')).toBeVisible();

  // Apply the suggestion
  const applyBtn = page.getByTestId('beat-snap-apply-suggestion-clip-bs-3-in');
  await expect(applyBtn).toBeVisible();
  await applyBtn.click();

  // After applying the only suggestion, the panel auto-hides (no more suggestions)
  await expect(page.getByTestId('beat-snap-suggestion-clip-bs-3-in')).toHaveCount(0);
  await expect(page.getByTestId('beat-snap-suggestions-panel')).toHaveCount(0);
});
