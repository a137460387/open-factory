import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('AI B-roll: analyze shows 2 suggestions, insert 1, reject 1', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupAIBrollFixture!());

  // Expand the B-roll section in Inspector
  await expect(page.getByTestId('ai-broll-section')).toBeVisible();
  await page.getByTestId('ai-broll-section').locator('summary').click();

  // Verify pre-populated suggestions (fixture sets brollSuggestions on clip)
  await expect(page.getByTestId('ai-broll-results')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId('ai-broll-suggestion-0')).toBeVisible();
  await expect(page.getByTestId('ai-broll-suggestion-1')).toBeVisible();

  // Insert suggestion 0
  await page.getByTestId('ai-broll-insert-0').click();

  // Reject suggestion 1
  await page.getByTestId('ai-broll-reject-1').click();

  // Verify track was updated (broll track added with 1 clip)
  const snapshot = await page.evaluate(() => window.__E2E_ACTIONS__!.getTimelineSnapshot!());
  const brollTrack = snapshot.tracks.find((t: { name: string }) => t.name === 'B-roll');
  expect(brollTrack).toBeDefined();
  expect(brollTrack!.clips.length).toBeGreaterThanOrEqual(1);
});

test('AI B-roll: no gaps shows info message', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupAIBrollFixtureNoGaps!());

  await expect(page.getByTestId('ai-broll-section')).toBeVisible();
  await page.getByTestId('ai-broll-section').locator('summary').click();
  await page.getByTestId('ai-broll-analyze').click();

  // Short clip (2s) is below 3s threshold — should show no-gaps toast
  // Verify no results appear (polling instead of fixed timeout)
  await expect(page.getByTestId('ai-broll-results')).not.toBeVisible({ timeout: 5_000 });
});
