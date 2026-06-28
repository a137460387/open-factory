import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('AI privacy redaction: setup fixture shows 2 face redaction items in inspector panel', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupPrivacyRedactionFixture!());

  // Privacy redaction panel should be visible since clip 'clip-pr' is selected with redactions
  const panel = page.getByTestId('privacy-redaction-panel');
  await expect(panel).toBeVisible({ timeout: 10_000 });

  // Should show 2 redaction items (2 faces)
  await expect(page.getByTestId('privacy-redaction-item-redact-face-1')).toBeVisible();
  await expect(page.getByTestId('privacy-redaction-item-redact-face-2')).toBeVisible();

  // Toggle off one redaction
  await page.getByTestId('privacy-redaction-toggle-redact-face-1').click();

  // Add button should exist
  await expect(page.getByTestId('privacy-redaction-add')).toBeVisible();
});
