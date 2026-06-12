import { expect, test, type Locator, type Page } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('ripple delete shifts later clips forward', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupEfficientEditingFixture!());

  await page.getByTestId('timeline-clip-clip-edit-b').click();
  await page.keyboard.down('Shift');
  await page.keyboard.press('Delete');
  await page.keyboard.up('Shift');

  const clips = await page.evaluate(() => {
    const timeline = window.__E2E_ACTIONS__!.getTimelineSnapshot!() as EditingTimelineSnapshot;
    return timeline.tracks[0].clips.map((clip) => ({ id: clip.id, start: clip.start }));
  });
  expect(clips).toEqual([
    { id: 'clip-edit-a', start: 0 },
    { id: 'clip-edit-c', start: 2 }
  ]);
});

test('rolling trim keeps adjacent clip duration sum unchanged', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupEfficientEditingFixture!());

  const before = await page.evaluate(() => {
    const [left, right] = (window.__E2E_ACTIONS__!.getTimelineSnapshot!() as EditingTimelineSnapshot).tracks[0].clips;
    return { sum: left.duration + right.duration, boundary: right.start };
  });

  await page.keyboard.down('r');
  await dragHandleBy(page.getByTestId('timeline-trim-right-clip-edit-a'), page, 80);
  await page.keyboard.up('r');

  const after = await page.evaluate(() => {
    const [left, right] = (window.__E2E_ACTIONS__!.getTimelineSnapshot!() as EditingTimelineSnapshot).tracks[0].clips;
    return { leftDuration: left.duration, rightDuration: right.duration, rightStart: right.start, sum: left.duration + right.duration };
  });
  expect(after.sum).toBeCloseTo(before.sum, 6);
  expect(after.rightStart).toBeGreaterThan(before.boundary);
  expect(after.leftDuration).toBeGreaterThan(2);
  expect(after.rightDuration).toBeLessThan(2);
});

async function dragHandleBy(handle: Locator, page: Page, deltaX: number): Promise<void> {
  const box = await handle.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width / 2 + deltaX, box!.y + box!.height / 2, { steps: 8 });
  await page.mouse.up();
}

interface EditingTimelineSnapshot {
  tracks: Array<{ clips: Array<{ id: string; start: number; duration: number }> }>;
}
