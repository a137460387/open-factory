import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('flash warning: shows badge and red bars on clip with warnings', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupFlashWarningFixture!());

  const clip = page.getByTestId('timeline-clip-clip-flash-1');
  await expect(clip).toBeVisible({ timeout: 10_000 });

  // Badge visible (medium severity warning present)
  await expect(page.getByTestId('flash-warning-badge-clip-flash-1')).toBeVisible();

  // Flash warning bars visible
  await expect(page.getByTestId('flash-warning-bars-clip-flash-1')).toBeVisible();

  // Verify data state: 2 warnings (medium + high)
  const warnings = await page.evaluate(() => {
    const project = window.__E2E_ACTIONS__!.getProjectSnapshot!() as {
      timeline: { tracks: Array<{ clips: Array<{ id: string; flashWarnings?: Array<{ severity: string; isRedFlash: boolean }> }> }> };
    };
    const c = project.timeline.tracks.flatMap((t) => t.clips).find((item) => item.id === 'clip-flash-1');
    return c?.flashWarnings ?? [];
  });
  expect(warnings).toHaveLength(2);
  expect(warnings[0].severity).toBe('medium');
  expect(warnings[1].severity).toBe('high');
  expect(warnings[1].isRedFlash).toBe(true);
});

test('flash warning: apply reduction removes low severity warning', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupFlashWarningReduceFixture!());

  const clip = page.getByTestId('timeline-clip-clip-flash-reduce');
  await expect(clip).toBeVisible({ timeout: 10_000 });

  // Badge visible (low severity)
  await expect(page.getByTestId('flash-warning-badge-clip-flash-reduce')).toBeVisible();

  // Apply reduction: should remove low severity warnings
  await page.evaluate(() => window.__E2E_ACTIONS__!.applyFlashReduction!('clip-flash-reduce'));
  await page.waitForTimeout(300);

  // Badge should disappear (low warning was removed)
  await expect(page.getByTestId('flash-warning-badge-clip-flash-reduce')).toHaveCount(0);

  // Data state: flashWarnings should be empty
  const warnings = await page.evaluate(() => {
    const project = window.__E2E_ACTIONS__!.getProjectSnapshot!() as {
      timeline: { tracks: Array<{ clips: Array<{ id: string; flashWarnings?: Array<{ severity: string }> }> }> };
    };
    const c = project.timeline.tracks.flatMap((t) => t.clips).find((item) => item.id === 'clip-flash-reduce');
    return c?.flashWarnings ?? [];
  });
  expect(warnings).toHaveLength(0);
});
