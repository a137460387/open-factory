import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('color consistency: shows skin tone warning at clip boundary', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupColorConsistencyFixture!());

  await expect(page.getByTestId('timeline-clip-clip-cc-a')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId('timeline-clip-clip-cc-b')).toBeVisible();

  const warnings = await page.evaluate(() => {
    const project = window.__E2E_ACTIONS__!.getProjectSnapshot!() as {
      timeline: { colorConsistencyWarnings?: Array<{ clipAId: string; clipBId: string; type: string; deltaRGB: number | null; reason: string }> };
    };
    return project.timeline.colorConsistencyWarnings ?? [];
  });
  expect(warnings).toHaveLength(1);
  expect(warnings[0].type).toBe('skin_tone');
  expect(warnings[0].deltaRGB).toBeGreaterThan(30);

  const warningIcon = page.getByTestId('color-consistency-warning-clip-cc-a-clip-cc-b-skin_tone');
  await expect(warningIcon).toBeVisible({ timeout: 10_000 });
});

test('color consistency: apply compensation removes warning', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupColorConsistencyFixture!());

  await expect(page.getByTestId('timeline-clip-clip-cc-a')).toBeVisible({ timeout: 10_000 });

  await page.evaluate(() => window.__E2E_ACTIONS__!.applyColorCompensation!());

  await expect.poll(() => page.evaluate(() => {
    const project = window.__E2E_ACTIONS__!.getProjectSnapshot!() as {
      timeline: { colorConsistencyWarnings?: Array<{ type: string }> };
    };
    return project.timeline.colorConsistencyWarnings?.length ?? 0;
  })).toBe(0);
});
