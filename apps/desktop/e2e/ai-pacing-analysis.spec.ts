import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('pacing analysis: shows chart with slow segment highlight and avg CPM', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupPacingAnalysisFixture!());

  await expect(page.getByTestId('timeline-clip-clip-pacing-0')).toBeVisible({ timeout: 10_000 });

  const chart = page.getByTestId('pacing-analysis-chart');
  await expect(chart).toBeVisible({ timeout: 10_000 });

  const slowSeg = page.getByTestId('pacing-slow-segment-0');
  await expect(slowSeg).toBeVisible();

  const avgCpm = page.getByTestId('pacing-avg-cpm');
  await expect(avgCpm).toBeVisible();
  await expect(avgCpm).toContainText('3.5');

  const pacingData = await page.evaluate(() => {
    const project = window.__E2E_ACTIONS__!.getProjectSnapshot!() as {
      pacingAnalysis?: { slowSegments: Array<{ start: number; end: number }>; overallAvgCPM: number };
    };
    return project.pacingAnalysis;
  });
  expect(pacingData).toBeTruthy();
  expect(pacingData!.slowSegments).toHaveLength(1);
  expect(pacingData!.slowSegments[0].start).toBe(60);
  expect(pacingData!.slowSegments[0].end).toBe(75);
  expect(pacingData!.overallAvgCPM).toBeCloseTo(3.5, 1);
});

test('pacing analysis: slow segment has suggestion title', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupPacingAnalysisFixture!());

  await expect(page.getByTestId('timeline-clip-clip-pacing-0')).toBeVisible({ timeout: 10_000 });

  const slowSeg = page.getByTestId('pacing-slow-segment-0');
  await expect(slowSeg).toBeVisible();
  const title = await slowSeg.getAttribute('title');
  expect(title).toBeTruthy();
  expect(title).toContain('建议');
});
