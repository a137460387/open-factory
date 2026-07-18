import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('AI quality assessment: panel opens with profile selection', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupQualityAssessmentFixture!());

  // Panel should be visible
  const panel = page.getByTestId('quality-assessment-panel');
  await expect(panel).toBeVisible({ timeout: 10_000 });

  // Title should be visible
  await expect(panel).toContainText('AI 质量评估');

  // Profile cards should be visible
  await expect(page.getByTestId('qa-profile-broadcast')).toBeVisible();
  await expect(page.getByTestId('qa-profile-web')).toBeVisible();
  await expect(page.getByTestId('qa-profile-social')).toBeVisible();
  await expect(page.getByTestId('qa-profile-cinema')).toBeVisible();

  // Click a profile
  await page.getByTestId('qa-profile-web').click();

  // Assess button should be visible
  await expect(page.getByTestId('qa-assess-btn')).toBeVisible();
});
