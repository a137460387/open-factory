import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('AI PiP avoidance: warning badge visible, apply suggestion updates transform', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupPipAvoidanceFixture!());

  // Verify PiP warning badge is visible on the timeline clip
  const badge = page.getByTestId('pip-warning-clip-pip');
  await expect(badge).toBeVisible();

  // Verify PiP avoidance panel is visible in inspector
  await expect(page.getByTestId('pip-avoidance-panel')).toBeVisible();

  // Click apply placement button
  await page.getByTestId('apply-pip-placement').click();

  // Verify the clip's transform was updated via store snapshot
  await expect.poll(async () => {
    return page.evaluate(() => {
      const actions = window.__E2E_ACTIONS__;
      const project = actions!.getProjectSnapshot!() as {
        timeline: { tracks: Array<{ clips: Array<{ id: string; transform: { x: number; y: number } }> }> };
      };
      const clip = project.timeline.tracks.flatMap((t) => t.clips).find((c) => c.id === 'clip-pip');
      return clip?.transform?.x ?? 0;
    });
  }).toBe(-0.5);
});
