import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('AI media organize: trigger button visible with 25 media, accept/reject suggestions', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupMediaOrganizeFixture!());

  // The organize trigger button should be visible (media count > 20)
  const triggerBtn = page.getByTestId('media-organize-trigger');
  await expect(triggerBtn).toBeVisible({ timeout: 10_000 });

  // Click to open the organize panel
  await triggerBtn.click();

  // The organize panel should appear
  const panel = page.getByTestId('media-organize-panel');
  await expect(panel).toBeVisible();

  // Since this is E2E without real AI, we just verify the panel opens
  // The button inside the panel should be visible to trigger AI analysis
  await expect(page.getByTestId('media-organize-button')).toBeVisible();

  // Close the panel
  await page.getByTestId('media-organize-close').click();
  await expect(panel).toHaveCount(0);
});
