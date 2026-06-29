import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

function getSwitchCount(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const actions = window.__E2E_ACTIONS__;
    const project = actions!.getProjectSnapshot!() as any;
    const mcClip = project.timeline.tracks.flatMap((t: any) => t.clips).find((c: any) => c.multicam);
    return mcClip?.multicam?.switches.length ?? 0;
  });
}

test('AI multicam cut: 3 suggestions visible, apply all, manual override, undo', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupMulticamAiCutFixture!());

  // Verify multicam preview grid is visible
  await expect(page.getByTestId('multicam-preview-grid')).toBeVisible();

  // Verify AI cut panel with 3 suggestions
  await expect(page.getByTestId('multicam-ai-cut-panel')).toBeVisible();
  await expect(page.getByTestId('multicam-ai-cut-suggestion-0')).toBeVisible();
  await expect(page.getByTestId('multicam-ai-cut-suggestion-1')).toBeVisible();
  await expect(page.getByTestId('multicam-ai-cut-suggestion-2')).toBeVisible();

  // Apply all suggestions by clicking button
  await page.getByTestId('multicam-ai-cut-apply-all').click();

  // Verify 3 suggestions applied to existing 1 switch = 4 switches total
  await expect.poll(async () => getSwitchCount(page)).toBeGreaterThanOrEqual(4);

  // Manual override: move playhead to time 5 (no switch there) and switch to angle-b
  await page.evaluate(() => window.__E2E_ACTIONS__!.setPlayheadTime!(5));
  await page.waitForTimeout(100);
  await page.getByTestId('multicam-angle-button-angle-b').click();

  await expect.poll(async () => getSwitchCount(page)).toBeGreaterThanOrEqual(5);

  // Undo the override
  await page.getByTestId('toolbar-undo-button').click();

  await expect.poll(async () => getSwitchCount(page)).toBe(4);
});
