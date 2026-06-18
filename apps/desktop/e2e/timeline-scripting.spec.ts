import { expect, test, type Page } from '@playwright/test';
import { addMediaCardToTimeline, waitForE2eActions } from './e2e-actions';

test('runs the bulk speed timeline script and undoes all script operations together', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.clearE2eFiles!());

  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page, 0);
  await addMediaCardToTimeline(page, 1);

  await expect.poll(() => readTimelineSpeeds(page)).toEqual([1, 1]);

  await page.getByTestId('toolbar-settings-button').click();
  await page.getByTestId('settings-tab-scripts').click();
  await expect(page.getByTestId('timeline-scripts-panel')).toBeVisible();
  await page.getByTestId('timeline-script-example-bulk-speed').click();
  await page.getByTestId('timeline-script-run-button').click();

  await expect(page.getByTestId('timeline-script-output')).toContainText('updated 2 clips');
  await expect.poll(() => readTimelineSpeeds(page)).toEqual([1.25, 1.25]);

  await page.getByTestId('settings-close-button').click();
  await page.getByTestId('toolbar-undo-button').click();

  await expect.poll(() => readTimelineSpeeds(page)).toEqual([1, 1]);
});

async function readTimelineSpeeds(page: Page): Promise<number[]> {
  return page.evaluate(() => {
    const timeline = window.__E2E_ACTIONS__!.getTimelineSnapshot!() as {
      tracks: Array<{ clips: Array<{ speed?: number }> }>;
    };
    return timeline.tracks.flatMap((track) => track.clips).map((clip) => clip.speed ?? 1);
  });
}
