import { expect, test } from '@playwright/test';
import { addMediaCardToTimeline, waitForE2eActions } from './e2e-actions';

test('compares two snapshots and applies one selected timeline difference', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => {
    window.__E2E_ACTIONS__!.clearE2eFiles!();
    window.__E2E_ACTIONS__!.setOpenFileDialogPaths!(['C:/Media/tiny-video.mp4']);
  });

  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page);
  await expect.poll(() => page.evaluate(() => window.__E2E_ACTIONS__!.getTimelineSnapshot!().tracks[0].clips.length)).toBe(1);

  await page.getByTestId('toolbar-edit-menu-button').click();
  await page.getByTestId('toolbar-edit-save-snapshot-menu-item').click();
  await page.getByTestId('snapshot-name-input').fill('Timeline A');
  await page.getByTestId('snapshot-name-save-button').click();

  const baseProject = await page.evaluate(() => JSON.parse(JSON.stringify(window.__E2E_ACTIONS__!.getProjectSnapshot!())));
  await addMediaCardToTimeline(page);
  await expect.poll(() => page.evaluate(() => window.__E2E_ACTIONS__!.getTimelineSnapshot!().tracks[0].clips.length)).toBe(2);

  await page.getByTestId('toolbar-edit-menu-button').click();
  await page.getByTestId('toolbar-edit-save-snapshot-menu-item').click();
  await page.getByTestId('snapshot-name-input').fill('Timeline B');
  await page.getByTestId('snapshot-name-save-button').click();
  await page.evaluate((project) => window.__E2E_ACTIONS__!.setProjectSnapshot!(project), baseProject);
  await expect.poll(() => page.evaluate(() => window.__E2E_ACTIONS__!.getTimelineSnapshot!().tracks[0].clips.length)).toBe(1);

  await page.getByTestId('toolbar-view-menu-button').click();
  await page.getByTestId('toolbar-view-timeline-compare-menu-item').click();
  await expect(page.getByTestId('timeline-compare-dialog')).toBeVisible();
  await expect.poll(async () => page.getByTestId('timeline-compare-base-select').evaluate((element) => (element as HTMLSelectElement).options.length)).toBeGreaterThan(2);
  await page.getByTestId('timeline-compare-base-select').selectOption({ label: 'Timeline A' });
  await page.getByTestId('timeline-compare-target-select').selectOption({ label: 'Timeline B' });

  await expect(page.getByTestId('timeline-compare-diff-row')).toHaveCount(1);
  await expect(page.getByTestId('timeline-compare-highlight-added')).toHaveCount(1);
  await expect(page.getByTestId('timeline-compare-summary')).toContainText('1 新增');

  await page.getByTestId('timeline-compare-scroll-a').evaluate((element) => {
    element.scrollLeft = 240;
    element.dispatchEvent(new Event('scroll', { bubbles: true }));
  });
  await expect.poll(() => page.getByTestId('timeline-compare-scroll-b').evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);

  await page.getByTestId('timeline-compare-diff-row').first().locator('input[type="checkbox"]').check();
  await page.getByTestId('timeline-compare-apply-selected').click();
  await expect.poll(() => page.evaluate(() => window.__E2E_ACTIONS__!.getTimelineSnapshot!().tracks[0].clips.length)).toBe(2);
});
