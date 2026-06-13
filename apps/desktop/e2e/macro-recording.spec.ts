import { expect, test } from '@playwright/test';
import { addMediaCardToTimeline, waitForE2eActions } from './e2e-actions';

test('records two clip edits, saves a macro, and replays it on another clip', async ({ page }) => {
  const macroName = 'E2E Recorded Macro';
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.clearE2eFiles!());
  await page.reload();
  await waitForE2eActions(page);

  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page, 0);
  await addMediaCardToTimeline(page, 2);
  await expect(page.locator('[data-testid^="timeline-clip-"]')).toHaveCount(2);

  await page.locator('[data-testid^="timeline-clip-"]').first().click();
  await page.getByTestId('toolbar-tools-menu-button').click();
  await page.getByTestId('toolbar-tools-start-macro-recording-menu-item').click();

  await page.getByTestId('clip-transform-x-input').fill('42');
  await page.getByTestId('clip-transform-x-input').press('Enter');
  await page.getByTestId('clip-scale-x-input').fill('1.35');
  await page.getByTestId('clip-scale-x-input').press('Enter');

  let promptMessage = '';
  page.once('dialog', async (dialog) => {
    promptMessage = dialog.message();
    await dialog.accept(macroName);
  });
  await page.getByTestId('toolbar-tools-menu-button').click();
  await page.getByTestId('toolbar-tools-stop-macro-recording-menu-item').click();
  expect(promptMessage).toContain('请输入宏名称');

  await expect
    .poll(() =>
      page.evaluate(() => {
        const raw = window.__E2E_ACTIONS__!.getWrittenFile!('C:/Users/E2E/AppData/Roaming/open-factory/macros.json') as string | undefined;
        return raw ? JSON.parse(raw).macros.some((macro: { name: string; steps?: unknown[] }) => macro.name === 'E2E Recorded Macro' && macro.steps?.length === 2) : false;
      })
    )
    .toBe(true);

  await page.locator('[data-testid^="timeline-clip-"]').nth(1).click();
  await page.getByTestId('toolbar-settings-button').click();
  await page.getByTestId('settings-tab-macros').click();
  const recordedRow = page.locator('[data-testid^="macro-row-"]').filter({ hasText: macroName });
  await recordedRow.locator('[data-testid^="macro-apply-"]').click();

  await expect
    .poll(() =>
      page.evaluate(() => {
        const clips = window.__E2E_ACTIONS__!.getTimelineSnapshot!().tracks.flatMap((track) => track.clips) as Array<{
          transform: { x: number; scaleX?: number };
        }>;
        return { x: clips[1]?.transform.x, scaleX: clips[1]?.transform.scaleX };
      })
    )
    .toEqual({ x: 42, scaleX: 1.35 });
});
