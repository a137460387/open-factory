import { expect, test } from '@playwright/test';
import { addMediaCardToTimeline, openExportDialog, waitForE2eActions } from './e2e-actions';

test('drags a title template, edits text, and exports drawtext', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);

  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page, 0);

  await page.getByTestId('media-filter-titles').click();
  await page.getByTestId('title-template-card-lower-third').dragTo(page.getByTestId('timeline-scroll-container'), {
    targetPosition: { x: 220, y: 80 }
  });

  const textClip = page.locator('[data-clip-type="text"]').first();
  await expect(textClip).toBeVisible();
  await textClip.click();
  await page.getByTestId('clip-text-input').fill('Launch Day');
  await page.getByTestId('timeline-scroll-container').click({ position: { x: 10, y: 10 } });

  await page.evaluate(() => window.__E2E_ACTIONS__!.setSavePath!('C:/Exports/title-template.mp4'));
  await openExportDialog(page);
  await page.getByTestId('export-enqueue-button').click();

  await expect.poll(() => page.evaluate(() => window.__E2E_ACTIONS__!.getLastExportPlan!())).toBeTruthy();
  const plan = (await page.evaluate(() => window.__E2E_ACTIONS__!.getLastExportPlan!())) as {
    filterComplex: string;
    textArtifacts: Array<{ text: string }>;
  };

  expect(plan.filterComplex).toContain('drawtext');
  expect(plan.textArtifacts.some((artifact) => artifact.text === 'Launch Day')).toBe(true);
});
