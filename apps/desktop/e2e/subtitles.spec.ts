import { expect, test } from '@playwright/test';
import { openExportDialog, waitForE2eActions } from './e2e-actions';

test('imports SRT subtitles and exports them as an ASS soft subtitle stream with a sidecar file', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);

  await page.getByTestId('import-subtitles-button').click();

  const subtitleClips = page.locator('[data-clip-type="subtitle"]');
  await expect(subtitleClips).toHaveCount(2);
  await expect(subtitleClips.first()).toContainText('Hello subtitle');
  await expect(subtitleClips.nth(1)).toContainText('Second subtitle');

  await subtitleClips.first().click();
  await page.getByTestId('subtitle-mode-select').selectOption('soft-sub');

  await page.evaluate(() => window.__E2E_ACTIONS__!.setSavePath!('C:/Exports/subtitles-soft.mp4'));
  await openExportDialog(page);
  await page.getByTestId('export-subtitle-format-select').selectOption('ass');
  await page.getByTestId('export-subtitle-sidecar-toggle').check();
  await page.getByTestId('export-enqueue-button').click();
  if (await page.getByTestId('export-preflight-panel').isVisible({ timeout: 1000 }).catch(() => false)) {
    await page.getByTestId('export-preflight-continue-button').click();
  }

  await expect
    .poll(() => page.evaluate(() => window.__E2E_ACTIONS__!.getLastExportPlan!()))
    .toBeTruthy();
  const plan = (await page.evaluate(() => window.__E2E_ACTIONS__!.getLastExportPlan!())) as {
    inputs: Array<{ path: string; args: string[] }>;
    maps: string[];
    outputArgs: string[];
    filterComplex: string;
    textArtifacts: Array<{ fileName: string; pathMode?: string; text: string }>;
  };

  expect(plan.inputs.some((input) => input.path === '__SUBTITLEFILE_export_subtitles__' && input.args.join(' ') === '-f ass')).toBe(true);
  expect(plan.maps.some((value) => value.endsWith(':s:0'))).toBe(true);
  expect(plan.outputArgs).toEqual(expect.arrayContaining(['-c:s', 'ass']));
  expect(plan.filterComplex).not.toContain('subtitles=filename=');
  expect(plan.textArtifacts.some((artifact) => artifact.fileName === 'subtitles.ass' && artifact.pathMode === 'argument' && artifact.text.includes('Hello subtitle'))).toBe(true);
  expect(plan.textArtifacts.some((artifact) => artifact.fileName === 'subtitles.ass' && artifact.pathMode === 'sidecar')).toBe(true);
  await expect
    .poll(() => page.evaluate(() => window.__E2E_ACTIONS__!.getWrittenFile!('C:/Exports/subtitles-soft.ass')))
    .toContain('[V4+ Styles]');
});
