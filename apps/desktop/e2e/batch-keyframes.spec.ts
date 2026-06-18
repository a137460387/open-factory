import { expect, test } from '@playwright/test';
import { addMediaCardToTimeline, waitForE2eActions } from './e2e-actions';

test('batch shifts multi-selected keyframes from the inspector', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page);

  const clip = page.locator('[data-testid^="timeline-clip-"]').first();
  const clipId = await clip.getAttribute('data-clip-id');
  expect(clipId).toBeTruthy();

  await page.evaluate((id) => {
    window.__E2E_ACTIONS__!.addKeyframe!(id, 'x', 0.5, 0);
    window.__E2E_ACTIONS__!.addKeyframe!(id, 'opacity', 1, 0.5);
  }, clipId);

  const xKeyframe = page.locator(`[data-testid^="timeline-keyframe-${clipId}-x-"]`).first();
  const opacityKeyframe = page.locator(`[data-testid^="timeline-keyframe-${clipId}-opacity-"]`).first();
  await expect(xKeyframe).toBeVisible();
  await expect(opacityKeyframe).toBeVisible();

  await xKeyframe.click();
  await page.keyboard.down('Shift');
  await opacityKeyframe.click();
  await page.keyboard.up('Shift');

  await expect(page.getByTestId('batch-keyframe-editor')).toBeVisible();
  await expect(page.getByTestId('batch-keyframe-count')).toContainText('2');
  await page.getByTestId('batch-keyframe-shift-input').fill('0.5');
  await page.getByTestId('batch-keyframe-shift-input').press('Enter');
  await page.getByTestId('batch-keyframe-shift-button').click();

  const times = await page.evaluate((id) => {
    const timeline = window.__E2E_ACTIONS__!.getTimelineSnapshot!() as {
      tracks: Array<{ clips: Array<{ id: string; keyframes?: { x?: Array<{ time: number }>; opacity?: Array<{ time: number }> } }> }>;
    };
    const target = timeline.tracks.flatMap((track) => track.clips).find((item) => item.id === id);
    return {
      x: target?.keyframes?.x?.[0]?.time,
      opacity: target?.keyframes?.opacity?.[0]?.time
    };
  }, clipId);

  expect(times.x).toBeCloseTo(1, 3);
  expect(times.opacity).toBeCloseTo(1.5, 3);
});

test('drags bezier keyframe handles and updates the velocity curve preview', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page);

  const clip = page.locator('[data-testid^="timeline-clip-"]').first();
  const clipId = await clip.getAttribute('data-clip-id');
  expect(clipId).toBeTruthy();

  await page.evaluate((id) => {
    window.__E2E_ACTIONS__!.addKeyframe!(id, 'x', 0, 0);
    window.__E2E_ACTIONS__!.addKeyframe!(id, 'x', 1, 0.5);
    window.__E2E_ACTIONS__!.addKeyframe!(id, 'x', 2, 1);
  }, clipId);
  await clip.click();

  const canvas = page.getByTestId('keyframe-curve-editor-canvas');
  const velocityCanvas = page.getByTestId('keyframe-speed-curve-canvas');
  await expect(canvas).toBeVisible();
  await expect(velocityCanvas).toBeVisible();
  await page.getByTestId('keyframe-curve-property-select').selectOption('x');

  const metrics = await page.evaluate((id) => {
    const timeline = window.__E2E_ACTIONS__!.getTimelineSnapshot!() as {
      tracks: Array<{ clips: Array<{ id: string; duration: number; keyframes?: { x?: Array<{ id: string; time: number; value: number; outHandle?: { dx: number; dy: number } }> } }> }>;
    };
    const target = timeline.tracks.flatMap((track) => track.clips).find((item) => item.id === id);
    const frames = target?.keyframes?.x ?? [];
    return {
      duration: target?.duration ?? 1,
      keyframeId: frames[1]?.id,
      time: frames[1]?.time ?? 1,
      value: frames[1]?.value ?? 0.5,
      nextTime: frames[2]?.time ?? 2
    };
  }, clipId);
  expect(metrics.keyframeId).toBeTruthy();

  const velocityBefore = await velocityCanvas.evaluate((node) => (node as HTMLCanvasElement).toDataURL());
  const pointFor = (box: { x: number; y: number; width: number; height: number }, time: number, value: number) => ({
    x: box.x + (time / metrics.duration) * box.width,
    y: box.y + ((1 - value) / 2) * box.height
  });
  const firstCanvasBox = await canvas.boundingBox();
  expect(firstCanvasBox).toBeTruthy();
  const middle = pointFor(firstCanvasBox!, metrics.time, metrics.value);
  await canvas.click({ position: { x: middle.x - firstCanvasBox!.x, y: middle.y - firstCanvasBox!.y } });
  await expect(page.getByTestId('selected-keyframe-editor')).toBeVisible();

  const dragCanvasBox = await canvas.boundingBox();
  expect(dragCanvasBox).toBeTruthy();
  const handleStart = pointFor(dragCanvasBox!, metrics.time + (metrics.nextTime - metrics.time) / 3, metrics.value);
  const handleEnd = pointFor(dragCanvasBox!, metrics.time + 0.6, 0.8);
  await page.mouse.move(handleStart.x, handleStart.y);
  await page.mouse.down();
  await page.mouse.move(handleEnd.x, handleEnd.y, { steps: 6 });
  await page.mouse.up();

  const readHandle = () =>
    page.evaluate(
      ({ id, keyframeId }) => {
        const timeline = window.__E2E_ACTIONS__!.getTimelineSnapshot!() as {
          tracks: Array<{ clips: Array<{ id: string; keyframes?: { x?: Array<{ id: string; outHandle?: { dx: number; dy: number } }> } }> }>;
        };
        return timeline.tracks
          .flatMap((track) => track.clips)
          .find((item) => item.id === id)
          ?.keyframes?.x?.find((frame) => frame.id === keyframeId)?.outHandle;
      },
      { id: clipId, keyframeId: metrics.keyframeId }
    );

  await expect.poll(async () => (await readHandle())?.dx ?? 0).toBeCloseTo(0.6, 1);
  await expect.poll(async () => await velocityCanvas.evaluate((node) => (node as HTMLCanvasElement).toDataURL())).not.toBe(velocityBefore);
  const handle = await readHandle();

  expect(handle?.dx).toBeCloseTo(0.6, 1);
  expect(handle?.dy).toBeCloseTo(0.3, 1);
});
