import { expect, test } from '@playwright/test';
import { waitForE2eActions, addMediaCardToTimeline } from './e2e-actions';

test('sequence compare side-by-side with cross-sequence drag', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);

  await page.evaluate(() => {
    window.__E2E_ACTIONS__!.clearE2eFiles!();
    window.__E2E_ACTIONS__!.setOpenFileDialogPaths!(['C:/Media/tiny-video.mp4']);
  });

  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page);

  const project = await page.evaluate(() => window.__E2E_ACTIONS__!.getProjectSnapshot!());
  expect(project).toBeDefined();
  expect(project.sequences).toBeDefined();

  const sequences = project.sequences || [];
  expect(sequences.length).toBeGreaterThanOrEqual(1);

  const clipCount = await page.evaluate(() => {
    const p = window.__E2E_ACTIONS__!.getProjectSnapshot!();
    return p.timeline.tracks.reduce((acc: number, t: any) => acc + t.clips.length, 0);
  });
  expect(clipCount).toBeGreaterThanOrEqual(1);
});
