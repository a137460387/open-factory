import { expect, test } from '@playwright/test';
import { addMediaCardToTimeline, waitForE2eActions } from './e2e-actions';

test('batch mutes two selected tracks and undo restores them', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page, 0);
  const trackIds = await page.evaluate(() => {
    const tracks = window.__E2E_ACTIONS__!.getTimelineSnapshot!().tracks;
    return {
      video: tracks.find((track) => track.type === 'video')!.id,
      audio: tracks.find((track) => track.type === 'audio')!.id
    };
  });

  await page.getByTestId(`track-header-${trackIds.video}`).dispatchEvent('click');
  await page.getByTestId(`track-header-${trackIds.audio}`).dispatchEvent('click', { shiftKey: true });

  await expect(page.getByTestId(`track-header-${trackIds.video}`)).toHaveAttribute('data-track-selected', 'true');
  await expect(page.getByTestId(`track-header-${trackIds.audio}`)).toHaveAttribute('data-track-selected', 'true');

  await page.getByTestId(`track-batch-menu-button-${trackIds.video}`).click();
  await expect(page.getByTestId('track-batch-menu')).toBeVisible();
  await page.getByTestId('track-batch-mute').click();

  await expect(page.getByTestId(`track-mute-${trackIds.video}`)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId(`track-mute-${trackIds.audio}`)).toHaveAttribute('aria-pressed', 'true');

  await page.getByTestId('toolbar-undo-button').click();
  await expect(page.getByTestId(`track-mute-${trackIds.video}`)).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByTestId(`track-mute-${trackIds.audio}`)).toHaveAttribute('aria-pressed', 'false');
});
