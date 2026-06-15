import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('fills a timeline gap with freeze frame smart fill and undo restores it', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupGapFillFixture!());

  const trackBody = page.getByTestId('timeline-track-body-track-video');
  const clientX = await trackBody.evaluate((element) => Math.round(element.getBoundingClientRect().left + 240));
  await trackBody.evaluate(
    (element, point) => {
      element.dispatchEvent(new MouseEvent('contextmenu', { button: 2, clientX: point.clientX, clientY: 320, bubbles: true, cancelable: true }));
    },
    { clientX }
  );
  await expect(page.getByTestId('gap-action-menu')).toBeVisible();
  await page.getByTestId('gap-action-freeze-frame').click();

  await expect
    .poll(() =>
      page.evaluate(() => {
        const clips = window.__E2E_ACTIONS__!.getTimelineSnapshot!().tracks[0].clips as Array<{ id: string; type: string; start: number; duration: number }>;
        return clips.map((clip) => ({ id: clip.id, type: clip.type, start: clip.start, duration: clip.duration })).sort((left, right) => left.start - right.start || left.id.localeCompare(right.id));
      })
    )
    .toEqual([
      { id: 'clip-gap-a', type: 'video', start: 0, duration: 2 },
      { id: expect.any(String), type: 'image', start: 2, duration: 2 },
      { id: 'clip-gap-b', type: 'video', start: 4, duration: 2 }
    ]);

  await page.getByTestId('toolbar-undo-button').click();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const clips = window.__E2E_ACTIONS__!.getTimelineSnapshot!().tracks[0].clips as Array<{ id: string; start: number; duration: number }>;
        return clips.map((clip) => ({ id: clip.id, start: clip.start, duration: clip.duration })).sort((left, right) => left.start - right.start || left.id.localeCompare(right.id));
      })
    )
    .toEqual([
      { id: 'clip-gap-a', start: 0, duration: 2 },
      { id: 'clip-gap-b', start: 4, duration: 2 }
    ]);
});
