import { expect, test } from '@playwright/test';
import { addMediaCardToTimeline, waitForE2eActions } from './e2e-actions';

test('timeline keyboard shortcuts toggle playback, delete a clip, and undo', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.clearE2eFiles!());
  await page.reload();
  await waitForE2eActions(page);
  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page);

  const timeline = page.getByTestId('timeline-root');
  await timeline.focus();
  await page.keyboard.press('Space');
  await expect(page.getByTestId('preview-playback-button')).toHaveAttribute('data-playback-state', 'playing');

  await page.keyboard.press('KeyK');
  await expect(page.getByTestId('preview-playback-button')).toHaveAttribute('data-playback-state', 'paused');

  await page.locator('[data-testid^="timeline-clip-"]').first().click();
  await page.keyboard.press('Delete');
  await expect(page.locator('[data-testid^="timeline-clip-"]')).toHaveCount(0);

  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Z' : 'Control+Z');
  await expect(page.locator('[data-testid^="timeline-clip-"]')).toHaveCount(1);
});

test('custom keyboard shortcuts persist across reload', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.clearE2eFiles!());

  await page.getByTestId('toolbar-settings-button').click();
  await page.getByTestId('settings-tab-shortcuts').click();
  await page.getByTestId('shortcut-bind-toggle-playback').click();
  await page.keyboard.press('KeyP');
  await expect(page.getByTestId('shortcut-bind-toggle-playback')).toHaveText('P');

  await page.reload();
  await waitForE2eActions(page);
  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page);
  const timeline = page.getByTestId('timeline-root');
  await timeline.focus();

  await page.keyboard.press('Space');
  await expect(page.getByTestId('preview-playback-button')).toHaveAttribute('data-playback-state', 'paused');
  await page.keyboard.press('KeyP');
  await expect(page.getByTestId('preview-playback-button')).toHaveAttribute('data-playback-state', 'playing');
});

test('global macro shortcut updates the target clip', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.clearE2eFiles!());
  await page.reload();
  await waitForE2eActions(page);

  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page);

  await page.getByTestId('toolbar-settings-button').click();
  await page.getByTestId('settings-tab-macros').click();
  await page.getByTestId('macro-bind-macro-scale-150').click();
  await page.keyboard.press('KeyM');
  await expect(page.getByTestId('macro-bind-macro-scale-150')).toHaveText('M');
  await page.getByTestId('settings-close-button').click();

  await page.keyboard.press('KeyM');
  await expect
    .poll(() =>
      page.evaluate(() => {
        const clip = window.__E2E_ACTIONS__!.getTimelineSnapshot!().tracks.flatMap((track) => track.clips)[0] as {
          transform: { scale?: number; scaleX?: number };
        };
        return clip.transform.scaleX ?? clip.transform.scale;
      })
    )
    .toBe(1.5);

  await page.getByTestId('toolbar-tools-menu-button').click();
  await page.getByTestId('toolbar-tools-macro-history-menu-item').click();
  await expect(page.getByTestId('macro-history-row')).toHaveCount(1);
});
