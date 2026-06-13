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
