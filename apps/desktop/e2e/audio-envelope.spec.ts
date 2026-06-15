import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('edits an audio clip volume envelope inline and syncs the inspector keyframe panel', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupBeatDetectionFixture!());

  const clipId = 'clip-beat-audio';
  await expect(page.getByTestId(`timeline-clip-${clipId}`)).toBeVisible();
  await page.getByTestId('toggle-envelope-edit-mode-button').click();

  const envelope = page.getByTestId(`timeline-volume-envelope-${clipId}`);
  await expect(envelope).toBeVisible();
  const envelopeBox = await envelope.boundingBox();
  expect(envelopeBox).toBeTruthy();
  await page.mouse.click(envelopeBox!.x + envelopeBox!.width * 0.5, envelopeBox!.y + envelopeBox!.height * 0.25);

  await expect
    .poll(() =>
      page.evaluate((id) => {
        const clip = window.__E2E_ACTIONS__!
          .getTimelineSnapshot!()
          .tracks.flatMap((track) => track.clips)
          .find((item) => item.id === id) as { keyframes?: { volume?: Array<{ id: string; time: number; value: number }> } } | undefined;
        return clip?.keyframes?.volume?.length ?? 0;
      }, clipId)
    )
    .toBe(1);

  const keyframeId = await page.evaluate((id) => {
    const clip = window.__E2E_ACTIONS__!
      .getTimelineSnapshot!()
      .tracks.flatMap((track) => track.clips)
      .find((item) => item.id === id) as { keyframes?: { volume?: Array<{ id: string }> } } | undefined;
    return clip?.keyframes?.volume?.[0]?.id;
  }, clipId);
  expect(keyframeId).toBeTruthy();

  const point = page.getByTestId(`timeline-volume-envelope-point-${clipId}-${keyframeId}`);
  await expect(point).toBeVisible();
  const pointBox = await point.boundingBox();
  expect(pointBox).toBeTruthy();
  await page.mouse.move(pointBox!.x + pointBox!.width / 2, pointBox!.y + pointBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(envelopeBox!.x + envelopeBox!.width * 0.75, envelopeBox!.y + envelopeBox!.height * 0.75, { steps: 6 });
  await page.mouse.up();

  await expect(page.getByTestId('selected-keyframe-editor')).toContainText('音量');
  const frame = await page.evaluate(
    ({ id, keyframeId }) => {
      const clip = window.__E2E_ACTIONS__!
        .getTimelineSnapshot!()
        .tracks.flatMap((track) => track.clips)
        .find((item) => item.id === id) as { keyframes?: { volume?: Array<{ id: string; time: number; value: number }> } } | undefined;
      return clip?.keyframes?.volume?.find((item) => item.id === keyframeId);
    },
    { id: clipId, keyframeId }
  );
  expect(frame?.time).toBeCloseTo(3, 1);
  expect(frame?.value).toBeCloseTo(0.5, 1);
});
