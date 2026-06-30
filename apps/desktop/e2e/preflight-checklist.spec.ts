import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('preflight checklist: generates flash and continuity categories from project data', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupPreflightChecklistFixture!());

  // Wait for timeline clips to render
  await expect(page.getByTestId('timeline-clip-clip-preflight-1')).toBeVisible({ timeout: 10_000 });

  // Click generate preflight checklist
  const generateBtn = page.getByTestId('preflight-generate-btn');
  await expect(generateBtn).toBeVisible({ timeout: 10_000 });
  await generateBtn.click();

  // Assert flash and continuity categories are visible
  const flashCategory = page.getByTestId('preflight-category-flash');
  await expect(flashCategory).toBeVisible({ timeout: 5_000 });
  await expect(flashCategory).toContainText('闪烁警告');

  const continuityCategory = page.getByTestId('preflight-category-continuity');
  await expect(continuityCategory).toBeVisible();
  await expect(continuityCategory).toContainText('连续性');

  // Verify critical and warning counts
  const criticalCount = page.getByTestId('preflight-critical-count');
  await expect(criticalCount).toBeVisible();
  await expect(criticalCount).toContainText('1');

  const warningCount = page.getByTestId('preflight-warning-count');
  await expect(warningCount).toBeVisible();
  await expect(warningCount).toContainText('1');

  // Verify project data has preflightReport with correct structure
  const reportData = await page.evaluate(() => {
    const project = window.__E2E_ACTIONS__!.getProjectSnapshot!() as {
      preflightReport?: {
        issuesByCategory: Record<string, Array<{ id: string; category: string }>>;
        totalCritical: number;
        totalWarnings: number;
        acknowledgedIssueIds: string[];
      };
    };
    return project.preflightReport;
  });
  expect(reportData).toBeTruthy();
  expect(reportData!.totalCritical).toBe(1);
  expect(reportData!.totalWarnings).toBe(1);
  expect(reportData!.acknowledgedIssueIds).toEqual([]);
  expect(reportData!.issuesByCategory.flash).toHaveLength(1);
  expect(reportData!.issuesByCategory.continuity).toHaveLength(1);
});

test('preflight checklist: acknowledging an issue removes it and updates counters', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupPreflightChecklistFixture!());

  // Wait for timeline clips to render
  await expect(page.getByTestId('timeline-clip-clip-preflight-1')).toBeVisible({ timeout: 10_000 });

  // Click generate preflight checklist
  const generateBtn = page.getByTestId('preflight-generate-btn');
  await expect(generateBtn).toBeVisible({ timeout: 10_000 });
  await generateBtn.click();

  // Wait for categories to appear
  await expect(page.getByTestId('preflight-category-flash')).toBeVisible({ timeout: 5_000 });

  // Get the flash issue ID from project data
  const flashIssueId = await page.evaluate(() => {
    const project = window.__E2E_ACTIONS__!.getProjectSnapshot!() as {
      preflightReport?: { issuesByCategory: Record<string, Array<{ id: string }>> };
    };
    return project.preflightReport!.issuesByCategory.flash[0].id;
  });

  // Click acknowledge on the flash issue
  const ackBtn = page.getByTestId(`preflight-ack-${flashIssueId}`);
  await expect(ackBtn).toBeVisible();
  await ackBtn.click();

  // Flash category should disappear (all flash issues acknowledged)
  await expect(page.getByTestId('preflight-category-flash')).not.toBeVisible({ timeout: 5_000 });

  // Continuity category should still be visible
  await expect(page.getByTestId('preflight-category-continuity')).toBeVisible();

  // Critical count should decrement (flash was critical)
  const criticalCount = page.getByTestId('preflight-critical-count');
  await expect(criticalCount).toContainText('0');

  // Verify project data updated
  const reportData = await page.evaluate(() => {
    const project = window.__E2E_ACTIONS__!.getProjectSnapshot!() as {
      preflightReport?: { acknowledgedIssueIds: string[] };
    };
    return project.preflightReport;
  });
  expect(reportData!.acknowledgedIssueIds).toContain(flashIssueId);
});

