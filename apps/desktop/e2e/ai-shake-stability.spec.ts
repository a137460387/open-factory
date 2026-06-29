import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('AI shake stability: high shake badge visible, apply stabilization updates clip', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupShakeAnalysisFixture!());

  // Verify shake badge is visible on the timeline clip
  const badge = page.getByTestId('shake-badge-clip-shake');
  await expect(badge).toBeVisible();

  // Verify shake analysis panel is visible in inspector (clip already selected by fixture)
  await expect(page.getByTestId('shake-analysis-panel')).toBeVisible();
  await expect(page.getByTestId('shake-analysis-severity')).toContainText('75');

  // Click apply stabilization button
  await page.getByTestId('apply-shake-stabilization').click();

  // Verify the clip's stabilization was updated via store snapshot
  await expect.poll(async () => {
    return page.evaluate(() => {
      const actions = window.__E2E_ACTIONS__;
      const project = actions!.getProjectSnapshot!() as {
        timeline: { tracks: Array<{ clips: Array<{ id: string; stabilization?: { enabled: boolean; suggestedFilter: string } }> }> };
      };
      const clip = project.timeline.tracks.flatMap((t) => t.clips).find((c) => c.id === 'clip-shake');
      return clip?.stabilization?.enabled ?? false;
    });
  }).toBe(true);
});
