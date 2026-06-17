import { expect, test } from '@playwright/test';
import { expectExportTaskStatus, openExportDialog, waitForE2eActions } from './e2e-actions';

test('creates a multicam sequence, records an angle cut, and exports direct angle clips', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupMulticamFixture!());
  await page.evaluate(() => window.__E2E_ACTIONS__!.setSavePath!('C:/Exports/multicam-e2e.mp4'));

  await expect(page.getByTestId('toolbar-create-multicam-button')).toBeEnabled();
  await page.getByTestId('toolbar-create-multicam-button').click();
  await expect(page.getByTestId('multicam-preview-grid')).toBeVisible();
  await expect(page.getByTestId('multicam-angle-button-angle-1')).toBeVisible();
  await expect(page.getByTestId('multicam-angle-button-angle-2')).toBeVisible();

  await page.getByTestId('multicam-angle-button-angle-2').click();
  const switches = await page.evaluate(() => {
    const clip = window.__E2E_ACTIONS__!.getTimelineSnapshot!().tracks[0].clips[0] as {
      multicam?: { switches: Array<{ time: number; angleId: string }> };
    };
    return clip.multicam?.switches;
  });
  expect(switches).toEqual([
    { id: expect.any(String), time: 0, angleId: 'angle-1' },
    { id: expect.any(String), time: 1, angleId: 'angle-2' }
  ]);

  await openExportDialog(page);
  await page.getByTestId('export-enqueue-button').click();
  await expectExportTaskStatus(page, 0, 'success');

  const plan = await page.evaluate(
    () =>
      window.__E2E_ACTIONS__!.getLastExportPlan!() as {
        inputs: Array<{ path: string }>;
        fullArgs: string[];
        nestedPlans?: unknown[];
      }
  );
  expect(plan.inputs.map((input) => input.path)).toEqual(['C:/Media/tiny-video.mp4', 'C:/Media/camera-b.mp4']);
  expect(plan.nestedPlans).toHaveLength(0);
  expect(plan.fullArgs.join(' ')).not.toContain('__NESTED_SEQUENCE_');
  await expect.poll(() => page.evaluate(() => window.__E2E_ACTIONS__!.getFileExists!('C:/Exports/multicam-e2e.mp4'))).toBe(true);
});

test('records live multicam angle cuts with number keys and updates the history panel', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupMulticamFixture!());

  await page.getByTestId('toolbar-create-multicam-button').click();
  await expect(page.getByTestId('multicam-preview-grid')).toBeVisible();
  await page.getByTestId('multicam-live-mode-toggle').click();
  await expect(page.getByTestId('multicam-live-mode-toggle')).toHaveAttribute('data-active', 'true');

  await page.getByTestId('toolbar-playback-button').click();
  await page.evaluate(() => window.__E2E_ACTIONS__!.setPlayheadTime!(1));
  await page.keyboard.press('2');

  await expect
    .poll(() =>
      page.evaluate(() => {
        const clip = window.__E2E_ACTIONS__!.getTimelineSnapshot!().tracks[0].clips[0] as {
          multicam?: { switches: Array<{ time: number; angleId: string }> };
        };
        return clip.multicam?.switches.length ?? 0;
      })
    )
    .toBe(2);

  const switches = await page.evaluate(() => {
    const clip = window.__E2E_ACTIONS__!.getTimelineSnapshot!().tracks[0].clips[0] as {
      multicam?: { switches: Array<{ time: number; angleId: string }> };
    };
    return clip.multicam?.switches ?? [];
  });
  expect(switches[1].angleId).toBe('angle-2');
  expect(switches[1].time).toBeGreaterThanOrEqual(0.9);
  expect(switches[1].time).toBeLessThan(2.5);
  await expect(page.locator('[data-testid^="multicam-history-row-"][data-angle-id="angle-2"]')).toHaveCount(1);

  await page.getByTestId('toolbar-undo-button').click();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const clip = window.__E2E_ACTIONS__!.getTimelineSnapshot!().tracks[0].clips[0] as {
          multicam?: { switches: Array<{ time: number; angleId: string }> };
        };
        return clip.multicam?.switches.length ?? 0;
      })
    )
    .toBe(1);
});
