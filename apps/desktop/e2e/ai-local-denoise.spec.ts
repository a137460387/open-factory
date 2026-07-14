import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('AI local noise reduction: enable, process and verify completion', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupAIDenoiseLocalFixture!());
  await expect(page.getByTestId('ai-local-denoise-toggle')).toBeVisible();
  await page.getByTestId('ai-local-denoise-toggle').click();
  await page.getByTestId('ai-local-denoise-process').click();
  await expect(page.getByTestId('ai-local-denoise-progress')).toBeVisible();
  await expect(page.getByTestId('ai-local-denoise-complete')).toBeVisible({ timeout: 10_000 });
});
