import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('AI director mode generates storyboard and confirms clips and markers to timeline', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupDirectorModeFixture!());

  await page.getByTestId('toolbar-director-mode-button').click();
  await expect(page.getByTestId('director-mode-panel')).toBeVisible();

  // Step 1: fill description and duration
  await page.getByTestId('director-mode-description').fill('制作一个90秒产品宣传片');
  await page.getByTestId('director-mode-duration-60').click();

  // Advance to step 2
  await page.getByTestId('director-mode-next').click();

  // Advance to step 3 (media source defaults to all)
  await page.getByTestId('director-mode-next').click();

  // Start generation
  await page.getByTestId('director-mode-generate').click();

  // Wait for storyboard preview
  await expect(page.getByTestId('director-mode-storyboard')).toBeVisible({ timeout: 10_000 });

  // Verify 3 storyboard cards
  const cards = page.locator('[data-testid^="director-mode-card-"]');
  await expect(cards).toHaveCount(3);

  // Confirm to timeline
  await page.getByTestId('director-mode-confirm').click();

  // Verify clips and markers were added to timeline
  await expect.poll(async () => {
    return page.evaluate(() => {
      const actions = window.__E2E_ACTIONS__;
      const timeline = actions!.getTimelineSnapshot!() as {
        tracks: Array<{ id: string; clips: Array<{ id: string }> }>;
        markers: Array<{ time: number; label: string }>;
      };
      const clipCount = timeline.tracks.reduce((sum, t) => sum + t.clips.length, 0);
      return { clipCount, markerCount: timeline.markers.length };
    });
  }).toMatchObject({ clipCount: 3, markerCount: 2 });
});
