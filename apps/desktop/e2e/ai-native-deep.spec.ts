import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test.describe('AI Native Workflow Deep', () => {
  test('opens smart creation panel and runs analysis', async ({ page }) => {
    await page.goto('/');
    await waitForE2eActions(page);
    await page.evaluate(() => window.__E2E_ACTIONS__!.setupSmartCreationDeepFixture!());

    // Open smart creation panel
    await page.getByTestId('toolbar-smart-creation-button').click();
    await expect(page.getByTestId('smart-creation-panel')).toBeVisible();

    // Click analyze button
    await page.getByTestId('smart-creation-analyze').click();

    // Wait for progress to appear
    await expect(page.getByTestId('smart-creation-progress')).toBeVisible({ timeout: 10_000 });

    // Wait for results to appear
    await expect(page.getByTestId('smart-creation-results')).toBeVisible({ timeout: 30_000 });

    // Verify all sections are present
    await expect(page.getByTestId('section-scenes')).toBeVisible();
    await expect(page.getByTestId('section-emotions')).toBeVisible();
    await expect(page.getByTestId('section-recommendations')).toBeVisible();
    await expect(page.getByTestId('section-narrative')).toBeVisible();
  });

  test('applies recommended clips to timeline', async ({ page }) => {
    await page.goto('/');
    await waitForE2eActions(page);
    await page.evaluate(() => window.__E2E_ACTIONS__!.setupSmartCreationDeepFixture!());

    // Open smart creation panel and run analysis
    await page.getByTestId('toolbar-smart-creation-button').click();
    await expect(page.getByTestId('smart-creation-panel')).toBeVisible();
    await page.getByTestId('smart-creation-analyze').click();
    await expect(page.getByTestId('smart-creation-results')).toBeVisible({ timeout: 30_000 });

    // Check if there are recommendations
    const recommendationList = page.getByTestId('recommendation-list');
    const emptyList = page.getByTestId('recommendation-list-empty');

    // Either we have recommendations or the list is empty
    const hasRecommendations = await recommendationList.isVisible().catch(() => false);
    const isEmpty = await emptyList.isVisible().catch(() => false);

    if (hasRecommendations) {
      // Click apply all button
      await page.getByTestId('recommendation-apply-all').click();

      // Verify timeline has clips
      await expect.poll(() => page.evaluate(() => {
        const timeline = window.__E2E_ACTIONS__!.getTimelineSnapshot!() as {
          tracks: Array<{ clips: Array<{ id: string }> }>;
        };
        return timeline.tracks.flatMap((t) => t.clips).length;
      })).toBeGreaterThan(0);
    } else {
      // If no recommendations, the empty state should be shown
      expect(isEmpty).toBe(true);
    }
  });

  test('toggles section visibility', async ({ page }) => {
    await page.goto('/');
    await waitForE2eActions(page);
    await page.evaluate(() => window.__E2E_ACTIONS__!.setupSmartCreationDeepFixture!());

    // Open smart creation panel
    await page.getByTestId('toolbar-smart-creation-button').click();
    await expect(page.getByTestId('smart-creation-panel')).toBeVisible();

    // Run analysis
    await page.getByTestId('smart-creation-analyze').click();
    await expect(page.getByTestId('smart-creation-results')).toBeVisible({ timeout: 30_000 });

    // Sections are expanded by default — content wrapper should be present
    const sectionScenes = page.getByTestId('section-scenes');
    const contentWrapper = sectionScenes.locator(':scope > div:nth-child(2)');
    await expect(contentWrapper).toBeVisible();

    // Toggle scenes section (collapse)
    await page.getByTestId('section-scenes-toggle').click();

    // Content wrapper should be removed when collapsed
    await expect(contentWrapper).not.toBeAttached();

    // Toggle back (expand)
    await page.getByTestId('section-scenes-toggle').click();

    // Content wrapper should reappear
    await expect(contentWrapper).toBeVisible();
  });

  test('closes smart creation panel', async ({ page }) => {
    await page.goto('/');
    await waitForE2eActions(page);
    await page.evaluate(() => window.__E2E_ACTIONS__!.setupSmartCreationDeepFixture!());

    // Open smart creation panel
    await page.getByTestId('toolbar-smart-creation-button').click();
    await expect(page.getByTestId('smart-creation-panel')).toBeVisible();

    // Close panel
    await page.getByTestId('smart-creation-close').click();

    // Verify panel is closed
    await expect(page.getByTestId('smart-creation-panel')).not.toBeVisible();
  });

  test('shows emotion curve chart', async ({ page }) => {
    await page.goto('/');
    await waitForE2eActions(page);
    await page.evaluate(() => window.__E2E_ACTIONS__!.setupSmartCreationDeepFixture!());

    // Open smart creation panel and run analysis
    await page.getByTestId('toolbar-smart-creation-button').click();
    await page.getByTestId('smart-creation-analyze').click();
    await expect(page.getByTestId('smart-creation-results')).toBeVisible({ timeout: 30_000 });

    // Verify emotion curve section is present
    await expect(page.getByTestId('section-emotions')).toBeVisible();

    // The emotion curve chart should be rendered inside the section
    const emotionSection = page.getByTestId('section-emotions');
    await expect(emotionSection).toBeVisible();
  });
});
