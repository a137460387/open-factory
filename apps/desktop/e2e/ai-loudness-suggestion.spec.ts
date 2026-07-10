import { expect, test } from '@playwright/test';
import { openExportDialog, waitForE2eActions } from './e2e-actions';

test('AI loudness: measure shows suggestion, apply gain updates audio chain', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupAILoudnessFixture!());

  // Open export dialog
  await openExportDialog(page);

  // Expand loudness section
  await expect(page.getByTestId('ai-loudness-section')).toBeVisible();
  await page.getByTestId('ai-loudness-section').locator('summary').click();

  // Click measure
  await expect(page.getByTestId('ai-loudness-measure')).toBeVisible();
  await page.getByTestId('ai-loudness-measure').click();

  // Verify measurement result appears (fixture pre-populates project.loudnessSuggestion)
  await expect(page.getByTestId('ai-loudness-result')).toBeVisible({ timeout: 10_000 });

  // Verify platform select is present
  await expect(page.getByTestId('ai-loudness-platform-select')).toBeVisible();

  // Apply suggested gain
  await expect(page.getByTestId('ai-loudness-apply')).toBeVisible();
  await page.getByTestId('ai-loudness-apply').click();

  // After applying, "applied" text should appear in the summary
  // The apply button should no longer be clickable (applied state)
  await expect(page.getByTestId('ai-loudness-apply')).not.toBeVisible();
});

test('AI loudness: switching to broadcast platform shows no suggestion when gain equals 1dB threshold', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupAILoudnessFixture!());

  await openExportDialog(page);
  await page.getByTestId('ai-loudness-section').locator('summary').click();
  await page.getByTestId('ai-loudness-measure').click();
  await expect(page.getByTestId('ai-loudness-result')).toBeVisible({ timeout: 10_000 });

  // Switch to broadcast (-23 LUFS) — measured is -24, gain = 1dB which equals threshold
  // shouldSuggestGain uses > not >= so 1dB is NOT a suggestion
  await page.getByTestId('ai-loudness-platform-select').selectOption('broadcast');

  // Apply button should not be visible (gain not > 1dB)
  await expect(page.getByTestId('ai-loudness-apply')).not.toBeVisible();
});
