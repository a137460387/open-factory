import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('AI scene match: display similar and contrast recommendations', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupAISceneMatchFixture!());

  // Verify the scene match section is visible (details element, collapsed)
  const section = page.getByTestId('ai-scene-match-section');
  await expect(section).toBeVisible();

  // Expand the section
  await section.locator('summary').click();

  // Click the analyze button
  const analyzeBtn = page.getByTestId('ai-scene-match-analyze');
  await expect(analyzeBtn).toBeVisible();
  await analyzeBtn.click();

  // Wait for loading to appear then results
  await expect(page.getByTestId('ai-scene-match-loading')).toBeVisible();
  await expect(page.getByTestId('ai-scene-match-results')).toBeVisible({ timeout: 10_000 });

  // Verify two groups
  const similarGroup = page.getByTestId('ai-scene-match-similar');
  const contrastGroup = page.getByTestId('ai-scene-match-contrast');
  await expect(similarGroup).toBeVisible();
  await expect(contrastGroup).toBeVisible();

  // Verify 3 similar cards
  await expect(page.getByTestId('ai-scene-match-card-media-scene-match-a')).toBeVisible();
  await expect(page.getByTestId('ai-scene-match-card-media-scene-match-b')).toBeVisible();
  await expect(page.getByTestId('ai-scene-match-card-media-scene-match-c')).toBeVisible();

  // Verify 3 contrast cards
  await expect(page.getByTestId('ai-scene-match-card-media-scene-match-d')).toBeVisible();
  await expect(page.getByTestId('ai-scene-match-card-media-scene-match-e')).toBeVisible();
  await expect(page.getByTestId('ai-scene-match-card-media-scene-match-f')).toBeVisible();

  // Verify score badges contain percentage text
  await expect(page.getByTestId('ai-scene-match-card-media-scene-match-a')).toContainText('90%');
  await expect(page.getByTestId('ai-scene-match-card-media-scene-match-d')).toContainText('85%');

  // Verify tooltip with reason
  await expect(page.getByTestId('ai-scene-match-card-media-scene-match-a')).toHaveAttribute('title', /场景相近/);
  await expect(page.getByTestId('ai-scene-match-card-media-scene-match-d')).toHaveAttribute('title', /明暗对比鲜明/);

  // Click a card to trigger highlight event (no crash expected)
  await page.getByTestId('ai-scene-match-card-media-scene-match-a').click();
});
