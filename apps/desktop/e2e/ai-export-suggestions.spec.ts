import { expect, test } from '@playwright/test';
import { openExportDialog, waitForE2eActions } from './e2e-actions';

test('shows AI export suggestions and applies them to draft settings', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupAIExportSuggestionFixture!());

  await openExportDialog(page);

  // AI export suggestion panel should be visible (provider is configured)
  const panel = page.getByTestId('ai-export-suggestion-panel');
  await expect(panel).toBeVisible();

  // Toggle open to trigger analysis
  await page.getByTestId('ai-export-suggestion-toggle').click();

  // Wait for suggestions to appear (mock returns instantly)
  await expect(page.getByTestId('ai-export-suggestion-priority-high')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId('ai-export-suggestion-priority-medium')).toBeVisible();
  await expect(page.getByTestId('ai-export-suggestion-priority-low')).toBeVisible();

  // Verify suggestion content
  await expect(page.getByTestId('ai-export-suggestion-videoBitrate')).toBeVisible();
  await expect(page.getByTestId('ai-export-suggestion-loudnessNormalization')).toBeVisible();
  await expect(page.getByTestId('ai-export-suggestion-subtitleFormat')).toBeVisible();

  // Apply all suggestions
  await page.getByTestId('ai-export-suggestion-apply').click();

  // videoBitrate should be updated to '8M' (the high priority suggestion)
  await expect(page.getByTestId('export-video-bitrate-input')).toHaveValue('8M');
});
