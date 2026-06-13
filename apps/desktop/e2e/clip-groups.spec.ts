import { expect, test, type Locator, type Page } from '@playwright/test';
import { addMediaCardToTimeline, waitForE2eActions } from './e2e-actions';

test('creates a clip group and drags every grouped clip by the same delta', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page, 0);
  await addMediaCardToTimeline(page, 2);

  const clips = page.locator('[data-testid^="timeline-clip-"]');
  await expect(clips).toHaveCount(2);
  await page.keyboard.down('Shift');
  await clips.first().click();
  await page.keyboard.up('Shift');
  await expect.poll(() => page.evaluate(() => window.__E2E_ACTIONS__!.getSelectedClipIds!() as string[])).toHaveLength(2);

  await page.getByTestId('timeline-create-group-button').click();
  await expect(page.locator('[data-testid^="timeline-clip-group-strip-"]')).toHaveCount(2);

  const before = await readGroupedClipStarts(page);
  await dragClipBy(page.getByTestId(`timeline-clip-${before[0].id}`), page, 80);

  const after = await readGroupedClipStarts(page);
  expect(after).toHaveLength(2);
  const deltas = after.map((clip, index) => Number((clip.start - before[index].start).toFixed(3)));
  expect(deltas[0]).toBeGreaterThan(0.5);
  expect(deltas[0]).toBeCloseTo(deltas[1], 2);
});

async function readGroupedClipStarts(page: Page): Promise<Array<{ id: string; start: number }>> {
  return page.evaluate(() => {
    const project = window.__E2E_ACTIONS__!.getProjectSnapshot!();
    const group = project.clipGroups[0]!;
    const clips = project.timeline.tracks.flatMap((track) => track.clips);
    return group.clipIds.map((clipId) => {
      const clip = clips.find((item) => item.id === clipId)!;
      return { id: clip.id, start: clip.start };
    });
  });
}

async function dragClipBy(clip: Locator, page: Page, deltaX: number): Promise<void> {
  const box = await clip.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width / 2 + deltaX, box!.y + box!.height / 2, { steps: 8 });
  await page.mouse.up();
}
