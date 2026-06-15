import { expect, test, type Locator, type Page } from '@playwright/test';
import { addMediaCardToTimeline, waitForE2eActions } from './e2e-actions';

test('snaps a dragged clip to a neighboring clip edge', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page, 0);
  await addMediaCardToTimeline(page, 2);

  const imageClip = page.locator('[data-testid^="timeline-clip-"]').nth(1);
  await expect(imageClip).toBeVisible();
  await dragClipBy(imageClip, page, 80);
  await expect.poll(() => imageClip.getAttribute('style')).toContain('left: 560px');

  await dragClipBy(imageClip, page, -75);
  await expect.poll(() => imageClip.getAttribute('style')).toContain('left: 480px');
});

test('snaps a dragged clip to the enabled timeline grid', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.clearE2eFiles!());
  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page, 0);

  await page.getByTestId('toolbar-grid-snap-button').click();
  await page.getByTestId('toolbar-grid-snap-unit-select').selectOption('second');
  await expect(page.getByTestId('timeline-grid-line').first()).toBeVisible();

  const clip = page.locator('[data-testid^="timeline-clip-"]').first();
  await expect(clip).toBeVisible();
  await dragClipBy(clip, page, 85);

  const startTime = await page.evaluate(() => {
    const timeline = window.__E2E_ACTIONS__!.getTimelineSnapshot!() as { tracks: Array<{ clips: Array<{ start: number }> }> };
    return timeline.tracks.flatMap((track) => track.clips)[0]?.start ?? -1;
  });
  expect(startTime).toBeGreaterThan(0);
  expect(Math.abs(startTime - Math.round(startTime))).toBeLessThan(0.000001);

  await expect
    .poll(() => page.evaluate(() => window.__E2E_ACTIONS__!.getWrittenFile!('C:/Users/E2E/AppData/Roaming/open-factory/settings.json') as string | undefined))
    .toContain('"timelineGrid"');
});

async function dragClipBy(clip: Locator, page: Page, deltaX: number): Promise<void> {
  const box = await clip.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width / 2 + deltaX, box!.y + box!.height / 2, { steps: 6 });
  await page.mouse.up();
}
