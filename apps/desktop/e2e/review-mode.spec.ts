import { expect, test } from '@playwright/test';
import { waitForE2eActions, waitForAppStore } from './e2e-actions';

test('enters review mode, hides editing controls, stores an annotation, and exports a report', async ({ page }) => {
  const reportPath = 'C:/Reports/review-mode.html';
  await page.goto('/');
  await waitForE2eActions(page);
  await waitForAppStore(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.clearE2eFiles!());
  await page.evaluate((path) => window.__E2E_ACTIONS__!.setSavePath!(path), reportPath);

  await page.getByTestId('toolbar-view-menu-button').click();
  await page.getByTestId('toolbar-view-review-mode-menu-item').click();

  await expect(page).toHaveURL(/#review$/);
  await expect(page.getByTestId('review-toolbar')).toBeVisible();
  await expect(page.getByTestId('toolbar-edit-menu-button')).toHaveCount(0);
  await expect(page.getByTestId('timeline-panel')).toHaveCount(0);
  await expect(page.getByTestId('review-annotation-overlay')).toBeVisible();

  await page.getByTestId('review-tool-text').click();
  await page.getByTestId('review-annotation-text-input').fill('客户确认标题安全区');
  await page.getByTestId('review-annotation-overlay').click({ position: { x: 320, y: 180 } });

  await expect
    .poll(() =>
      page.evaluate(() => {
        const project = window.__E2E_ACTIONS__!.getProjectSnapshot!() as { reviewAnnotations?: Array<{ text: string; time: number; type: string }> };
        return project.reviewAnnotations?.[0];
      })
    )
    .toMatchObject({ text: '客户确认标题安全区', time: 0, type: 'text' });

  await page.getByTestId('review-export-report-button').click();
  await expect.poll(() => page.evaluate((path) => window.__E2E_ACTIONS__!.getWrittenFile!(path) as string | undefined, reportPath)).toContain('客户确认标题安全区');
});
