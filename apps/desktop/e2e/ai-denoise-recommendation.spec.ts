import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('AI denoise: detect hum+hiss, recommend 2 filters, apply and A/B toggle', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupAIDenoiseFixture!());

  // Expand the denoise section in Inspector
  await expect(page.getByTestId('ai-denoise-section')).toBeVisible();
  await page.getByTestId('ai-denoise-section').locator('summary').click();

  // Verify pre-populated recommendation results (fixture sets aiDenoiseRecommendation on clip)
  await expect(page.getByTestId('ai-denoise-results')).toBeVisible({ timeout: 10_000 });

  // Verify noise profile bars
  await expect(page.getByTestId('ai-denoise-bar-hum')).toBeVisible();
  await expect(page.getByTestId('ai-denoise-bar-hiss')).toBeVisible();

  // Verify recommended filters
  await expect(page.getByTestId('ai-denoise-filter-afftdn')).toBeVisible();
  await expect(page.getByTestId('ai-denoise-filter-highpass')).toBeVisible();

  // Apply filters
  await page.getByTestId('ai-denoise-apply').click();

  // A/B toggle
  await expect(page.getByTestId('ai-denoise-ab-toggle')).toBeVisible();
  await page.getByTestId('ai-denoise-ab-toggle').click();
});

test('AI denoise: no provider shows message', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupAIDenoiseFixtureNoProvider!());

  await expect(page.getByTestId('ai-denoise-section')).toBeVisible();
  await page.getByTestId('ai-denoise-section').locator('summary').click();
  await expect(page.getByTestId('ai-denoise-no-provider')).toBeVisible();
});
