import { expect, test } from '@playwright/test';
import { addMediaCardToTimeline, openExportDialog, waitForE2eActions } from './e2e-actions';

test('creates a project from the vertical short template and prefills export settings', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);

  await page.getByTestId('toolbar-file-menu-button').click();
  await page.getByTestId('toolbar-file-new-template-menu-item').click();
  await page.getByTestId('project-template-vertical-short').click();

  await expect(page.getByTestId('toolbar-project-name')).toHaveText('竖版短视频');
  const timeline = await page.evaluate(() => window.__E2E_ACTIONS__!.getTimelineSnapshot!() as { tracks: Array<{ type: string; clips: unknown[] }> });
  expect(timeline.tracks.map((track) => track.type)).toEqual(['video', 'audio', 'text']);
  expect(timeline.tracks.every((track) => track.clips.length === 0)).toBe(true);

  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page, 0);
  await openExportDialog(page);

  await expect(page.getByTestId('export-width-input')).toHaveValue('1080');
  await expect(page.getByTestId('export-height-input')).toHaveValue('1920');
  await expect(page.getByTestId('export-fps-select')).toHaveValue('30');
  await expect(page.getByTestId('export-target-aspect-select')).toHaveValue('9:16');
  await expect(page.getByTestId('export-format-select')).toHaveValue('mp4');
});
