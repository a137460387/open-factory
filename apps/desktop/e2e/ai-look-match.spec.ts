import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('AI look match: setup fixture shows look match panel with blend slider', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupLookMatchFixture!());

  // AI look match panel should be visible since clip 'clip-lm' is selected with aiLookMatch
  const panel = page.getByTestId('ai-look-match-panel');
  await expect(panel).toBeVisible({ timeout: 10_000 });

  // Blend slider should exist
  await expect(page.getByTestId('ai-look-match-blend')).toBeVisible();

  // Preview text should exist
  await expect(page.getByTestId('ai-look-match-preview')).toBeVisible();

  // Apply button should exist
  const applyBtn = page.getByTestId('ai-look-match-apply');
  await expect(applyBtn).toBeVisible();
  await applyBtn.click();
});
