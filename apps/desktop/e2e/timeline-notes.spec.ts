import { expect, test } from '@playwright/test';
import { addMediaCardToTimeline, waitForE2eActions } from './e2e-actions';

test('adds a timeline note and jumps from the review layer panel', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);

  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page, 0);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setPlayheadTime!(2));
  await page.getByTestId('timeline-root').focus();
  await page.keyboard.press('N');

  await expect(page.getByTestId('timeline-note-editor')).toBeVisible();
  await page.getByTestId('timeline-note-text-input').fill('Check opening beat');
  await page.getByTestId('timeline-note-save-button').click();

  await expect(page.getByTestId('timeline-note-panel')).toBeVisible();
  const row = page.locator('[data-testid^="timeline-note-list-item-"]').first();
  await expect(row).toContainText('Check opening beat');
  await expect(page.locator('[data-testid^="timeline-note-block-"]').filter({ hasText: 'Check opening beat' })).toBeVisible();

  await expect
    .poll(() =>
      page.evaluate(() => {
        const [note] = window.__E2E_ACTIONS__!.getProjectSnapshot!().timelineNotes;
        return note ? { text: note.text, start: note.start, end: note.end } : undefined;
      })
    )
    .toEqual({ text: 'Check opening beat', start: 2, end: 3 });

  await page.evaluate(() => window.__E2E_ACTIONS__!.setPlayheadTime!(0));
  await row.click();
  await expect.poll(() => page.evaluate(() => window.__E2E_ACTIONS__!.getPlayheadTime!())).toBe(2);
});

test('exports timeline notes as CSV from the note panel', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);

  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page, 0);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setPlayheadTime!(2));
  await page.getByTestId('timeline-root').focus();
  await page.keyboard.press('N');
  await page.getByTestId('timeline-note-text-input').fill('CSV review beat');
  await page.getByTestId('timeline-note-save-button').click();

  const csvPath = 'C:/Exports/timeline-notes.csv';
  await page.evaluate((path) => window.__E2E_ACTIONS__!.setSavePath!(path), csvPath);
  await page.getByTestId('timeline-note-export-csv').click();

  await expect
    .poll(() => page.evaluate((path) => window.__E2E_ACTIONS__!.getWrittenFile!(path) as string | undefined, csvPath))
    .toBe('start_timecode,end_timecode,text,color\n00:00:02:00,00:00:03:00,CSV review beat,#facc15\n');
});
