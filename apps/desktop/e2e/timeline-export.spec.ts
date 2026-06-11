import { expect, test } from '@playwright/test';
import { addMediaCardToTimeline, waitForE2eActions } from './e2e-actions';

test('exports the main timeline as EDL with one edit line per visual clip', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setSavePath!('C:/Exports/timeline.edl'));
  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page, 0);
  await addMediaCardToTimeline(page, 2);

  await page.getByTestId('toolbar-export-timeline-button').click();
  await expect(page.getByTestId('timeline-export-dialog')).toBeVisible();
  await page.getByTestId('timeline-export-format-select').selectOption('edl');
  await page.getByTestId('timeline-export-save-button').click();

  await expect.poll(() => page.evaluate(() => window.__E2E_ACTIONS__!.getWrittenFile!('C:/Exports/timeline.edl') as string | undefined)).toBeTruthy();
  const edl = await page.evaluate(() => window.__E2E_ACTIONS__!.getWrittenFile!('C:/Exports/timeline.edl') as string);
  expect(edl).toContain('TITLE:');
  expect(edl).toContain('FCM: NON-DROP FRAME');
  expect(edl.match(/^\d{3}\s+AX\s+V/gm)).toHaveLength(2);
});
