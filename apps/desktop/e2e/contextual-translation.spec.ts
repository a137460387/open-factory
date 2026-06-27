import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('AI contextual translation extracts glossary and shows comparison', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupContextualTranslationFixture!());

  await page.getByTestId('toolbar-contextual-translation-button').click();
  await expect(page.getByTestId('contextual-translation-panel')).toBeVisible();

  // Extract glossary
  await page.getByTestId('contextual-translation-extract').click();

  // Wait for glossary terms to appear
  await expect(page.getByTestId('contextual-translation-glossary-0')).toBeVisible({ timeout: 10_000 });

  // Verify 3 glossary terms
  await expect(page.getByTestId('contextual-translation-glossary-0')).toContainText('OpenFactory');
  await expect(page.getByTestId('contextual-translation-glossary-1')).toContainText('张三');
  await expect(page.getByTestId('contextual-translation-glossary-2')).toContainText('北京');

  // Start translation
  await page.getByTestId('contextual-translation-start').click();

  // Wait for comparison view
  await expect(page.getByTestId('contextual-translation-compare')).toBeVisible({ timeout: 10_000 });

  // Verify comparison items
  const compItems = page.locator('[data-testid^="contextual-translation-compare-"]');
  await expect(compItems.first()).toBeVisible();

  // Apply contextual translation
  await page.getByTestId('contextual-translation-apply').click();

  // Verify done state
  await expect(page.getByTestId('contextual-translation-done')).toBeVisible();
});
