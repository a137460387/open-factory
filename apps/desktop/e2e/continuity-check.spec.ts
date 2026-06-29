import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('continuity check: shows axis jump and jump cut warnings at clip boundary', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupContinuityWarningFixture!());

  // Both clips visible
  await expect(page.getByTestId('timeline-clip-clip-cont-a')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId('timeline-clip-clip-cont-b')).toBeVisible();

  // Verify data state: 2 continuity warnings
  const warnings = await page.evaluate(() => {
    const project = window.__E2E_ACTIONS__!.getProjectSnapshot!() as {
      timeline: { continuityWarnings?: Array<{ clipAId: string; clipBId: string; type: string; confidence: number; reason: string }> };
    };
    return project.timeline.continuityWarnings ?? [];
  });
  expect(warnings).toHaveLength(2);
  expect(warnings[0].type).toBe('axis_jump');
  expect(warnings[0].confidence).toBeGreaterThanOrEqual(0.8);
  expect(warnings[1].type).toBe('jump_cut');
  expect(warnings[1].confidence).toBeGreaterThanOrEqual(0.8);

  // Continuity warning icons visible in the track body
  const axisWarning = page.getByTestId('continuity-warning-clip-cont-a-clip-cont-b-axis_jump');
  await expect(axisWarning).toBeVisible({ timeout: 10_000 });
});

test('continuity check: insert transition clears warnings', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupContinuityWarningFixture!());

  await expect(page.getByTestId('timeline-clip-clip-cont-a')).toBeVisible({ timeout: 10_000 });

  // Insert transition (simulate via E2E action)
  await page.evaluate(() => window.__E2E_ACTIONS__!.insertContinuityTransition!());
  await page.waitForTimeout(300);

  // Verify warnings cleared
  const warnings = await page.evaluate(() => {
    const project = window.__E2E_ACTIONS__!.getProjectSnapshot!() as {
      timeline: { continuityWarnings?: Array<{ type: string }> };
    };
    return project.timeline.continuityWarnings ?? [];
  });
  expect(warnings).toHaveLength(0);
});
