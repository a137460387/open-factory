import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('AI subtitle style: display recommendations and apply', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupAISubtitleStyleFixture!());

  // Verify the subtitle style section is visible (details element, collapsed)
  const section = page.getByTestId('ai-subtitle-style-section');
  await expect(section).toBeVisible();

  // Expand the section
  await section.locator('summary').click();

  // Click the analyze button
  const analyzeBtn = page.getByTestId('ai-subtitle-style-analyze');
  await expect(analyzeBtn).toBeVisible();
  await analyzeBtn.click();

  // Wait for loading to appear then results
  await expect(page.getByTestId('ai-subtitle-style-loading')).toBeVisible();
  await expect(page.getByTestId('ai-subtitle-style-results')).toBeVisible({ timeout: 10_000 });

  // Verify 3 recommendation cards
  await expect(page.getByTestId('ai-subtitle-style-card-variety-bold')).toBeVisible();
  await expect(page.getByTestId('ai-subtitle-style-card-social-bold')).toBeVisible();
  await expect(page.getByTestId('ai-subtitle-style-card-cinema-white')).toBeVisible();

  // Verify confidence badge contains percentage text
  await expect(page.getByTestId('ai-subtitle-style-card-variety-bold')).toContainText('90%');
  await expect(page.getByTestId('ai-subtitle-style-card-social-bold')).toContainText('75%');
  await expect(page.getByTestId('ai-subtitle-style-card-cinema-white')).toContainText('60%');

  // Verify tooltip with reason
  await expect(page.getByTestId('ai-subtitle-style-card-variety-bold')).toHaveAttribute('title', /综艺/);

  // Click a card to apply (no crash expected)
  await page.getByTestId('ai-subtitle-style-card-variety-bold').click();
});
