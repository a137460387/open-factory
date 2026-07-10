import { test, expect } from './fixtures';

test('snaps a dragged clip to a neighboring clip edge', async ({ mediaBin, timeline }) => {
  await mediaBin.goto();
  await mediaBin.importMedia();
  await mediaBin.addToTimeline(0);
  await mediaBin.addToTimeline(2);

  const imageClip = timeline.getClipByIndex(1);
  await expect(imageClip).toBeVisible();
  await timeline.dragBy(imageClip, 80);
  await expect.poll(() => imageClip.getAttribute('style')).toContain('left: 560px');

  await timeline.dragBy(imageClip, -75);
  await expect.poll(() => imageClip.getAttribute('style')).toContain('left: 480px');
});

test('snaps a dragged clip to the enabled timeline grid', async ({ page, toolbar, mediaBin, timeline }) => {
  await toolbar.goto();
  await page.evaluate(() => window.__E2E_ACTIONS__!.clearE2eFiles!());
  await mediaBin.importMedia();
  await mediaBin.addToTimeline(0);

  await toolbar.toggleGridSnap();
  await toolbar.setGridSnapUnit('second');
  await timeline.waitForGridLine();

  const clip = timeline.getClipByIndex(0);
  await expect(clip).toBeVisible();
  await timeline.dragBy(clip, 85);

  const startTime = await page.evaluate(() => {
    const t = window.__E2E_ACTIONS__!.getTimelineSnapshot!() as { tracks: Array<{ clips: Array<{ start: number }> }> };
    return t.tracks.flatMap((track) => track.clips)[0]?.start ?? -1;
  });
  expect(startTime).toBeGreaterThan(0);
  expect(Math.abs(startTime - Math.round(startTime))).toBeLessThan(0.000001);

  await expect
    .poll(() => page.evaluate(() => window.__E2E_ACTIONS__!.getWrittenFile!('C:/Users/E2E/AppData/Roaming/open-factory/settings.json') as string | undefined))
    .toContain('"timelineGrid"');
});
