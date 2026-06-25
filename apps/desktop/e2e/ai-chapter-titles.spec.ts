import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('generate chapter titles via AI and verify markers in timeline', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupAIChapterTitlesFixture!());

  await expect(page.getByTestId('chapter-title-ai-section')).toBeVisible();
  await page.getByTestId('chapter-title-ai-section').locator('summary').click();
  await expect(page.getByTestId('chapter-title-ai-generate-button')).toBeVisible();

  await page.getByTestId('chapter-title-ai-generate-button').click();
  await expect(page.getByTestId('chapter-title-ai-preview')).toBeVisible({ timeout: 10_000 });

  await expect(page.getByTestId('chapter-title-ai-item-0')).toBeVisible();
  await expect(page.getByTestId('chapter-title-ai-item-1')).toBeVisible();
  await expect(page.getByTestId('chapter-title-ai-item-2')).toBeVisible();

  await page.getByTestId('chapter-title-ai-apply').click();

  const snapshot = await page.evaluate(() => window.__E2E_ACTIONS__!.getTimelineSnapshot!());
  expect(snapshot.markers.length).toBeGreaterThanOrEqual(3);
  expect(snapshot.markers.some((m: { label: string }) => m.label === '开场问候')).toBe(true);
  expect(snapshot.markers.some((m: { label: string }) => m.label === '天气话题')).toBe(true);
  expect(snapshot.markers.some((m: { label: string }) => m.label === '户外散步')).toBe(true);
});
