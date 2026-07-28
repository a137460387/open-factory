import { expect, test } from '@playwright/test';
import { waitForE2eActions, waitForAppStore, addMediaCardToTimeline } from './e2e-actions';

test.describe('Playback Controls', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForE2eActions(page);
    await waitForAppStore(page);
    await page.evaluate(() => window.__E2E_ACTIONS__!.clearE2eFiles!());
    await page.reload();
    await waitForE2eActions(page);

    await page.getByTestId('import-media-button').click();
    await addMediaCardToTimeline(page);
  });

  test('play button toggles playback state', async ({ page }) => {
    const playBtn = page.getByTestId('preview-playback-button');

    await expect(playBtn).toHaveAttribute('data-playback-state', 'paused');

    await playBtn.click();
    await expect(playBtn).toHaveAttribute('data-playback-state', 'playing');

    await playBtn.click();
    await expect(playBtn).toHaveAttribute('data-playback-state', 'paused');
  });

  test('keyboard space toggles playback', async ({ page }) => {
    const playBtn = page.getByTestId('preview-playback-button');
    const timeline = page.getByTestId('timeline-root');

    await timeline.focus();
    await page.keyboard.press('Space');
    await expect(playBtn).toHaveAttribute('data-playback-state', 'playing');

    await page.keyboard.press('Space');
    await expect(playBtn).toHaveAttribute('data-playback-state', 'paused');
  });

  test('ruler timecode element is visible', async ({ page }) => {
    await expect(page.getByTestId('timeline-ruler')).toBeVisible();
    await expect(page.getByTestId('timeline-ruler-timecode')).toBeVisible();
  });

  test('playhead is visible on timeline', async ({ page }) => {
    await expect(page.getByTestId('timeline-playhead')).toBeVisible();
  });
});
