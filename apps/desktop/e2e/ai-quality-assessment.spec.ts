import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('AI quality assessment: right-click media card shows quality badge', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupAIQualityAssessmentFixture!());

  // Verify the media card is visible
  const mediaCard = page.getByTestId('media-card-media-qa-a');
  await expect(mediaCard).toBeVisible();

  // No badge visible yet
  await expect(page.getByTestId('quality-badge-media-qa-a')).toHaveCount(0);

  // Right-click to open context menu
  await mediaCard.click({ button: 'right' });

  // Click the quality assessment button
  const assessBtn = page.getByTestId('media-quality-assess-media-qa-a');
  await expect(assessBtn).toBeVisible();
  await assessBtn.click();

  // Wait for loading badge to appear then disappear
  await expect(page.getByTestId('quality-badge-loading-media-qa-a')).toBeVisible();

  // Wait for the quality badge to appear (mock returns score 85)
  await expect(page.getByTestId('quality-badge-media-qa-a')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId('quality-badge-media-qa-a')).toContainText('85');

  // Verify green color class (score >= 80)
  await expect(page.getByTestId('quality-badge-media-qa-a')).toHaveClass(/emerald/);
});

