import { expect, test } from '@playwright/test';
import { openExportDialog, waitForE2eActions } from './e2e-actions';

test('AI platform fit: gray segments visible, open export dialog, restore one segment', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupPlatformFitFixture!());

  // Verify gray (removed) clips are visible via data attribute
  const removedClip = page.locator('[data-platform-fit-removed="true"]');
  await expect(removedClip).toHaveCount(2);

  // Open export dialog to see platform fit section
  await openExportDialog(page);
  await expect(page.getByTestId('export-dialog')).toBeVisible();

  // Verify removed segments list is visible
  await expect(page.getByTestId('platform-fit-removed-list')).toBeVisible();

  // Click restore button for clip-pf-3
  await page.getByTestId('platform-fit-restore-clip-pf-3').click();

  // Verify clip-pf-3 is no longer removed
  await expect.poll(async () => {
    return page.evaluate(() => {
      const actions = window.__E2E_ACTIONS__;
      const project = actions!.getProjectSnapshot!() as {
        platformFitSuggestion?: { removedSegments: Array<{ clipId: string }> };
      };
      return project.platformFitSuggestion?.removedSegments.map((s) => s.clipId) ?? [];
    });
  }).not.toContain('clip-pf-3');
});
