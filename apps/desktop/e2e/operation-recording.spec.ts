import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('records three timeline commands, saves, loads, and replays to the recorded state', async ({ page }) => {
  const recordingPath = 'C:/Exports/timeline-demo.ofrecording.json';

  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => {
    window.__E2E_ACTIONS__!.clearE2eFiles!();
    window.__E2E_ACTIONS__!.setupEfficientEditingFixture!();
  });

  await page.getByTestId('toolbar-tools-menu-button').click();
  await page.getByTestId('toolbar-tools-operation-recording-menu-item').click();
  await expect(page.getByTestId('operation-recording-dialog')).toBeVisible();

  await page.getByTestId('operation-recording-start').click();
  await page.evaluate(() => {
    window.__E2E_ACTIONS__!.addKeyframe!('clip-edit-a', 'x', 0.25, 0.5);
    window.__E2E_ACTIONS__!.addKeyframe!('clip-edit-a', 'opacity', 0.5, 0.8);
    window.__E2E_ACTIONS__!.addKeyframe!('clip-edit-a', 'scaleX', 0.75, 1.2);
  });
  await page.getByTestId('operation-recording-stop').click();

  await expect(page.getByTestId('operation-recording-command')).toHaveCount(3);
  await page.evaluate((path) => window.__E2E_ACTIONS__!.setSavePath!(path), recordingPath);
  await page.getByTestId('operation-recording-save').click();

  await expect
    .poll(() => page.evaluate((path) => window.__E2E_ACTIONS__!.getWrittenFile!(path) as string | undefined, recordingPath))
    .not.toBeUndefined();
  const saved = await page.evaluate((path) => window.__E2E_ACTIONS__!.getWrittenFile!(path) as string, recordingPath);
  const savedRecording = JSON.parse(saved as string) as {
    commands: Array<{ projectAfter: { timeline: unknown } }>;
  };
  expect(savedRecording.commands).toHaveLength(3);
  const recordedFinalTimeline = JSON.stringify(savedRecording.commands.at(-1)!.projectAfter.timeline);

  await page.evaluate(
    ({ path, contents }) => {
      window.__E2E_ACTIONS__!.setupGapFillFixture!();
      window.__E2E_ACTIONS__!.setMockFile!(path, contents);
      window.__E2E_ACTIONS__!.setOpenFileDialogPaths!([path]);
    },
    { path: recordingPath, contents: saved }
  );
  await page.getByTestId('operation-recording-load').click();
  await page.getByTestId('operation-recording-replay').click();

  await expect
    .poll(() => page.evaluate(() => JSON.stringify(window.__E2E_ACTIONS__!.getTimelineSnapshot!())))
    .toBe(recordedFinalTimeline);
});
