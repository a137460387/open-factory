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

test('exports two subtitle languages as separate soft subtitle streams', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupMultilingualSubtitleFixture!());

  await page.evaluate(() => window.__E2E_ACTIONS__!.setSavePath!('C:/Exports/subtitles-multilingual.mp4'));
  await openExportDialog(page);
  await expect(page.getByTestId('export-subtitle-language-section')).toBeVisible();
  await expect(page.getByTestId('export-subtitle-language-zh')).toBeChecked();
  await expect(page.getByTestId('export-subtitle-language-en')).toBeChecked();
  await page.getByTestId('export-subtitle-mode-select').selectOption('soft-sub');
  await page.getByTestId('export-subtitle-format-select').selectOption('srt');
  await page.getByTestId('export-enqueue-button').click();
  if (await page.getByTestId('export-preflight-panel').isVisible({ timeout: 1000 }).catch(() => false)) {
    await page.getByTestId('export-preflight-continue-button').click();
  }

  await expect.poll(() => page.evaluate(() => window.__E2E_ACTIONS__!.getLastExportPlan!())).toBeTruthy();
  const plan = (await page.evaluate(() => window.__E2E_ACTIONS__!.getLastExportPlan!())) as {
    inputs: Array<{ path: string; args: string[]; index: number }>;
    maps: string[];
    outputArgs: string[];
    fullArgs: string[];
    textArtifacts: Array<{ fileName: string; pathMode?: string; text: string }>;
  };
  const subtitleInputs = plan.inputs.filter((input) => input.path.includes('__SUBTITLEFILE_export_subtitles_'));

  expect(subtitleInputs).toHaveLength(2);
  expect(plan.maps.filter((value) => value.endsWith(':s:0'))).toHaveLength(2);
  expect(plan.fullArgs).toEqual(expect.arrayContaining(['-metadata:s:s:0', 'language=zho', '-metadata:s:s:1', 'language=eng']));
  expect(plan.textArtifacts.some((artifact) => artifact.fileName === 'subtitles.zh.srt' && artifact.text.includes('你好'))).toBe(true);
  expect(plan.textArtifacts.some((artifact) => artifact.fileName === 'subtitles.en.srt' && artifact.text.includes('Hello subtitle'))).toBe(true);
});

test('applies the cinema white subtitle style template', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);

  await page.getByTestId('import-subtitles-button').click();
  const subtitleClips = page.locator('[data-clip-type="subtitle"]');
  await expect(subtitleClips).toHaveCount(2);
  await subtitleClips.first().click();

  await page.getByTestId('subtitle-color-input').fill('#ff0000');
  await expect(page.getByTestId('subtitle-color-input')).toHaveValue('#ff0000');
  await page.getByTestId('subtitle-style-template-cinema-white').click();

  await expect(page.getByTestId('subtitle-color-input')).toHaveValue('#ffffff');
  await expect
    .poll(() =>
      page.evaluate(() => {
        const subtitle = window.__E2E_ACTIONS__!
          .getTimelineSnapshot!()
          .tracks.flatMap((track) => track.clips)
          .find((clip) => clip.type === 'subtitle');
        return subtitle?.style?.color;
      })
    )
    .toBe('#ffffff');
});

test('exports CC subtitles to WebVTT with voice tags', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);

  await page.getByTestId('import-subtitles-button').click();
  const subtitleClips = page.locator('[data-clip-type="subtitle"]');
  await expect(subtitleClips).toHaveCount(2);
  await subtitleClips.first().click();

  await page.getByTestId('subtitle-type-select').selectOption('cc');
  await expect(page.locator('[data-testid^="track-cc-badge-"]').first()).toBeVisible();
  await page.getByTestId('subtitle-speaker-input').fill('Alice');
  await page.getByTestId('subtitle-speaker-input').blur();
  await page.getByTestId('subtitle-sound-desc-select').selectOption('[音乐]');
  await page.getByTestId('subtitle-mode-select').selectOption('soft-sub');

  await page.evaluate(() => window.__E2E_ACTIONS__!.setSavePath!('C:/Exports/subtitles-cc.mp4'));
  await openExportDialog(page);
  await page.getByTestId('export-subtitle-format-select').selectOption('vtt');
  await page.getByTestId('export-subtitle-sidecar-toggle').check();
  await page.getByTestId('export-enqueue-button').click();
  if (await page.getByTestId('export-preflight-panel').isVisible({ timeout: 1000 }).catch(() => false)) {
    await page.getByTestId('export-preflight-continue-button').click();
  }

  await expect.poll(() => page.evaluate(() => window.__E2E_ACTIONS__!.getLastExportPlan!())).toBeTruthy();
  const plan = (await page.evaluate(() => window.__E2E_ACTIONS__!.getLastExportPlan!())) as {
    inputs: Array<{ path: string; args: string[] }>;
    textArtifacts: Array<{ fileName: string; pathMode?: string; text: string }>;
  };

  expect(plan.inputs.some((input) => input.path === '__SUBTITLEFILE_export_subtitles__' && input.args.join(' ') === '-f webvtt')).toBe(true);
  expect(plan.textArtifacts.some((artifact) => artifact.fileName === 'subtitles.vtt' && artifact.text.includes('<v Alice>[音乐] Hello subtitle</v>'))).toBe(true);
  await expect
    .poll(() => page.evaluate(() => window.__E2E_ACTIONS__!.getWrittenFile!('C:/Exports/subtitles-cc.vtt')))
    .toContain('<v Alice>');
});
