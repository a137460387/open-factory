import { test, expect } from './fixtures';
import type { TimelineSnapshot } from './pages/timeline.page';

test('ripple delete shifts later clips forward', async ({ page, timeline }) => {
  await timeline.goto();
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupEfficientEditingFixture!());

  await timeline.selectClip('clip-edit-b');
  await timeline.rippleDeleteSelected();

  const clips = await timeline.getFirstTrackClips();
  expect(clips.map((clip) => ({ id: clip.id, start: clip.start }))).toEqual([
    { id: 'clip-edit-a', start: 0 },
    { id: 'clip-edit-c', start: 2 }
  ]);
});

test('rolling trim keeps adjacent clip duration sum unchanged', async ({ page, timeline }) => {
  await timeline.goto();
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupEfficientEditingFixture!());

  const before = await page.evaluate(() => {
    const [left, right] = (window.__E2E_ACTIONS__!.getTimelineSnapshot!() as TimelineSnapshot).tracks[0].clips;
    return { sum: left.duration + right.duration, boundary: right.start };
  });

  await timeline.focus();
  await page.keyboard.down('r');
  await timeline.waitForEditingMode('rolling-trim');
  await timeline.dragTrimHandle('clip-edit-a', 'right', 80);
  await page.keyboard.up('r');

  const after = await page.evaluate(() => {
    const [left, right] = (window.__E2E_ACTIONS__!.getTimelineSnapshot!() as TimelineSnapshot).tracks[0].clips;
    return { leftDuration: left.duration, rightDuration: right.duration, rightStart: right.start, sum: left.duration + right.duration };
  });
  expect(after.sum).toBeCloseTo(before.sum, 6);
  expect(after.rightStart).toBeGreaterThan(before.boundary);
  expect(after.leftDuration).toBeGreaterThan(2);
  expect(after.rightDuration).toBeLessThan(2);
});

test('slip edit changes source trims while keeping clip position and duration', async ({ page, timeline }) => {
  await timeline.goto();
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupEfficientEditingFixture!());

  const before = await page.evaluate(() => {
    const clip = (window.__E2E_ACTIONS__!.getTimelineSnapshot!() as TimelineSnapshot).tracks[0].clips.find((c) => c.id === 'clip-edit-a')!;
    return { start: clip.start, duration: clip.duration, trimStart: clip.trimStart, trimEnd: clip.trimEnd };
  });

  await timeline.focus();
  await page.keyboard.down('s');
  await timeline.waitForEditingMode('slip');
  await timeline.dragClipBy('clip-edit-a', 80);
  await page.keyboard.up('s');

  const after = await page.evaluate(() => {
    const clip = (window.__E2E_ACTIONS__!.getTimelineSnapshot!() as TimelineSnapshot).tracks[0].clips.find((c) => c.id === 'clip-edit-a')!;
    return { start: clip.start, duration: clip.duration, trimStart: clip.trimStart, trimEnd: clip.trimEnd };
  });
  expect(after.start).toBe(before.start);
  expect(after.duration).toBe(before.duration);
  expect(after.trimStart).toBeGreaterThan(before.trimStart);
  expect(after.trimEnd).toBeLessThan(before.trimEnd);
});

test('slide edit keeps the three-clip total duration unchanged', async ({ page, timeline }) => {
  await timeline.goto();
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupEfficientEditingFixture!());

  const beforeClips = await timeline.getFirstTrackClips();
  const beforeTotal = beforeClips.reduce((total, clip) => total + clip.duration, 0);
  const beforeEnd = beforeClips.at(-1)!.start + beforeClips.at(-1)!.duration;

  await timeline.focus();
  await page.keyboard.down('d');
  await timeline.waitForEditingMode('slide');
  await timeline.dragClipBy('clip-edit-b', 80);
  await page.keyboard.up('d');

  const afterClips = await timeline.getFirstTrackClips();
  const afterTotal = afterClips.reduce((total, clip) => total + clip.duration, 0);
  const afterMiddle = afterClips.find((clip) => clip.id === 'clip-edit-b')!;
  expect(afterMiddle.start).toBeGreaterThan(beforeClips.find((clip) => clip.id === 'clip-edit-b')!.start);
  expect(afterTotal).toBeCloseTo(beforeTotal, 6);
  expect(afterClips.at(-1)!.start + afterClips.at(-1)!.duration).toBeCloseTo(beforeEnd, 6);
});
