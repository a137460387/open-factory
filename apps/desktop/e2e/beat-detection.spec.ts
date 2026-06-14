import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('detects beat markers and snaps selected clips to nearby beats', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupBeatDetectionFixture!());

  await expect(page.getByTestId('timeline-clip-clip-beat-audio')).toBeVisible();
  await page.getByTestId('toolbar-tools-menu-button').click();
  await page.getByTestId('toolbar-tools-detect-beats-menu-item').click();
  await expect(page.locator('[data-testid^="timeline-beat-marker-"]')).toHaveCount(4);

  await page.getByTestId('timeline-clip-clip-beat-a').click();
  await page.keyboard.down('Shift');
  await page.getByTestId('timeline-clip-clip-beat-b').click();
  await page.keyboard.up('Shift');

  await page.getByTestId('toolbar-tools-menu-button').click();
  await page.getByTestId('toolbar-tools-snap-to-beats-menu-item').click();

  await expect
    .poll(() =>
      page.evaluate(() => {
        const clips = window.__E2E_ACTIONS__!.getTimelineSnapshot!().tracks[0].clips as Array<{ id: string; start: number }>;
        return clips.map((clip) => [clip.id, clip.start]);
      })
    )
    .toEqual([
      ['clip-beat-a', 1],
      ['clip-beat-b', 2]
    ]);

  await page.getByTestId('add-beat-marker-button').click();
  await expect(page.locator('[data-testid^="timeline-beat-marker-"]')).toHaveCount(5);
  await page.locator('[data-testid^="timeline-beat-marker-"]').nth(1).click({ button: 'right' });
  await expect(page.locator('[data-testid^="timeline-beat-marker-"]')).toHaveCount(4);
});

test('splits a selected clip at detected beat markers', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupBeatDetectionFixture!());

  await page.getByTestId('toolbar-tools-menu-button').click();
  await page.getByTestId('toolbar-tools-detect-beats-menu-item').click();
  await expect(page.locator('[data-testid^="timeline-beat-marker-"]')).toHaveCount(4);

  await page.getByTestId('timeline-clip-clip-beat-a').click();
  await page.getByTestId('toolbar-tools-menu-button').click();
  await page.getByTestId('toolbar-tools-split-to-beats-menu-item').click();

  await expect
    .poll(() =>
      page.evaluate(() => {
        return window.__E2E_ACTIONS__!.getTimelineSnapshot!().tracks[0].clips.length;
      })
    )
    .toBe(3);
});
