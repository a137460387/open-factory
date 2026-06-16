import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('marks a too-short subtitle in the batch proofreading panel', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupSubtitleProofreadingFixture!());

  await expect(page.getByTestId('subtitle-proofreading-section')).toBeVisible();
  await expect(page.getByTestId('subtitle-proofreading-summary')).toContainText('发现 1 个问题');
  await expect(page.getByTestId('subtitle-proofreading-issue-too-short-sub-proof-short')).toContainText('太短');
});
