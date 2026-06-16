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

test('tab navigation reaches export and Enter opens the export dialog', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.clearE2eFiles!());
  await page.reload();
  await waitForE2eActions(page);

  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page);
  await page.getByTestId('toolbar-file-menu-button').focus();

  let reachedExport = false;
  for (let index = 0; index < 24; index += 1) {
    await page.keyboard.press('Tab');
    const activeTestId = await page.evaluate(() => (document.activeElement as HTMLElement | null)?.dataset.testid);
    if (activeTestId === 'toolbar-export-button') {
      reachedExport = true;
      break;
    }
  }

  expect(reachedExport).toBe(true);
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('export-dialog')).toBeVisible();
});

test('question mark opens the shortcut cheatsheet panel', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);

  await page.keyboard.press('Shift+/');
  await expect(page.getByTestId('shortcut-cheatsheet-panel')).toBeVisible();
  await expect(page.getByTestId('shortcut-cheatsheet-media-bin')).toContainText('Space');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('shortcut-cheatsheet-panel')).toHaveCount(0);
});
