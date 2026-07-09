import { expect, test } from '@playwright/test';
import { waitForE2eActions, waitForAppStore } from './e2e-actions';

test('imports three subtitle clips from CSV data with correct timecodes', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await waitForAppStore(page);

  await page.getByTestId('toolbar-import-menu-button').click();
  await page.getByTestId('subtitle-data-import-mode-select').selectOption('new-track');
  await page.getByTestId('import-data-subtitles-button').click();

  const subtitleClips = page.locator('[data-clip-type="subtitle"]');
  await expect(subtitleClips).toHaveCount(3);
  await expect(subtitleClips.nth(0)).toContainText('CSV subtitle A');
  await expect(subtitleClips.nth(2)).toContainText('CSV subtitle C');

  const imported = await page.evaluate(() =>
    window.__E2E_ACTIONS__!.getTimelineSnapshot!()
      .tracks.filter((track) => track.type === 'subtitle')
      .flatMap((track) => track.clips)
      .map((clip) => ({ start: clip.start, duration: clip.duration, text: clip.text }))
  );

  expect(imported).toEqual([
    { start: 0.25, duration: 1, text: 'CSV subtitle A' },
    { start: 1.5, duration: 1, text: 'CSV subtitle B' },
    { start: 3, duration: 1, text: 'CSV subtitle C' }
  ]);
});

test('binds CSV data to a live data subtitle and previews the current row', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await waitForAppStore(page);

  await page.getByTestId('import-subtitles-button').click();
  const subtitleClip = page.locator('[data-clip-type="subtitle"]').first();
  await expect(subtitleClip).toBeVisible();
  await subtitleClip.click();

  await expect(page.getByTestId('data-subtitle-section')).toBeVisible();
  await page.getByTestId('data-subtitle-template-input').fill('{row.name}: {row.score}');
  await page.getByTestId('data-subtitle-template-input').blur();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const clip = window.__E2E_ACTIONS__!.getTimelineSnapshot!().tracks.flatMap((track) => track.clips).find((item) => item.type === 'subtitle');
        return clip?.text;
      })
    )
    .toBe('{row.name}: {row.score}');

  await page.evaluate(() => window.__E2E_ACTIONS__!.setOpenFileDialogPaths!(['C:/Media/live-score.csv']));
  await page.getByTestId('data-subtitle-bind-button').click();
  await expect(page.getByTestId('data-subtitle-source-summary')).toContainText('CSV');

  await page.evaluate(() => window.__E2E_ACTIONS__!.setPlayheadTime!(1.5));
  await expect
    .poll(() => page.evaluate(() => window.__OPEN_FACTORY_PREVIEW_DEBUG__?.lastText), { timeout: 10_000 })
    .toBe('Lin: 18');
});
