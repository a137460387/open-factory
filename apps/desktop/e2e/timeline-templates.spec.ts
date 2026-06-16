import { expect, test } from '@playwright/test';
import { addMediaCardToTimeline, waitForE2eActions } from './e2e-actions';

test('saves the current timeline as a template and creates a new project from it', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.clearE2eFiles!());

  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page, 0);
  const sourceTrackCount = await page.evaluate(() => {
    const selected = new Set(window.__E2E_ACTIONS__!.getSelectedClipIds!() as string[]);
    const timeline = window.__E2E_ACTIONS__!.getTimelineSnapshot!() as { tracks: Array<{ clips: Array<{ id: string }> }> };
    return selected.size > 0 ? timeline.tracks.filter((track) => track.clips.some((clip) => selected.has(clip.id))).length : timeline.tracks.length;
  });

  await page.getByTestId('toolbar-file-menu-button').click();
  await page.getByTestId('toolbar-file-save-timeline-template-menu-item').click();
  await page.getByTestId('timeline-template-name-input').fill('E2E Timeline Template');
  await page.getByTestId('timeline-template-save-button').click();

  await expect(page.getByTestId('timeline-template-dialog')).toHaveCount(0);

  await page.getByTestId('toolbar-file-menu-button').click();
  await page.getByTestId('toolbar-file-new-timeline-template-menu-item').click();
  await page.getByTestId('timeline-template-card').filter({ hasText: 'E2E Timeline Template' }).click();
  await page.getByTestId('timeline-template-create-button').click();

  await expect(page.getByTestId('timeline-template-dialog')).toHaveCount(0);
  const timeline = await page.evaluate(() => window.__E2E_ACTIONS__!.getTimelineSnapshot!() as { tracks: Array<{ clips: unknown[] }> });
  expect(timeline.tracks).toHaveLength(sourceTrackCount);
  expect(timeline.tracks.flatMap((track) => track.clips)).toHaveLength(1);
});
