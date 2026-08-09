import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('AI content generation: panel opens with tab navigation', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupContentGenerationFixture!());

  // Panel should be visible
  const panel = page.getByTestId('content-generation-panel');
  await expect(panel).toBeVisible({ timeout: 10_000 });

  // Title should be visible
  await expect(panel).toContainText('AI 内容生成');

  // Tab buttons should be visible
  await expect(page.getByTestId('content-gen-tab-subtitle')).toBeVisible();
  await expect(page.getByTestId('content-gen-tab-tts')).toBeVisible();
  await expect(page.getByTestId('content-gen-tab-music')).toBeVisible();
  await expect(page.getByTestId('content-gen-tab-effect')).toBeVisible();

  // Click music tab
  await page.getByTestId('content-gen-tab-music').click();

  // Music config should be visible
  await expect(page.getByTestId('content-gen-music-genre')).toBeVisible();
  await expect(page.getByTestId('content-gen-music-mood')).toBeVisible();

  // Click effect tab
  await page.getByTestId('content-gen-tab-effect').click();

  // Effect config should be visible
  await expect(page.getByTestId('content-gen-effect-type')).toBeVisible();
});
