import { expect, test } from '@playwright/test';
import { addMediaCardToTimeline, expectExportTaskStatus, openExportDialog, waitForE2eActions } from './e2e-actions';

test('adds a blur effect and includes gblur in the export plan', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page, 0);
  await page.locator('[data-testid^="timeline-clip-"]').first().click();

  await page.getByText('特效', { exact: true }).click();
  await page.getByTestId('effect-type-select').selectOption('blur');
  await page.getByTestId('add-effect-button').click();
  await expect(page.getByTestId('effect-item-blur')).toBeVisible();

  await openExportDialog(page);
  await page.getByTestId('export-enqueue-button').click();
  await expectExportTaskStatus(page, 0, 'success');

  const plan = await page.evaluate(() => window.__E2E_ACTIONS__!.getLastExportPlan!() as { filterComplex: string });
  expect(plan.filterComplex).toContain('gblur=sigma=8');
});

test('adds an audio spectrum effect and includes showfreqs in the export plan', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page, 0);
  await page.locator('[data-testid^="timeline-clip-"]').first().click();

  await page.getByText('特效', { exact: true }).click();
  await page.getByTestId('effect-type-select').selectOption('audio-spectrum');
  await page.getByTestId('add-effect-button').click();
  await expect(page.getByTestId('effect-item-audio-spectrum')).toBeVisible();
  await page.getByTestId(/^effect-param-.*-style$/).selectOption('bars');

  await openExportDialog(page);
  await page.getByTestId('export-enqueue-button').click();
  await expectExportTaskStatus(page, 0, 'success');

  const plan = await page.evaluate(() => window.__E2E_ACTIONS__!.getLastExportPlan!() as { filterComplex: string });
  expect(plan.filterComplex).toContain('showfreqs=s=');
  expect(plan.filterComplex).toContain('mode=bar:ascale=log');
  expect(plan.filterComplex).toContain('[amixout]asplit=2[aout][spectrum_audio_0]');
});

test('enables chroma key and includes chromakey in the export plan', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page, 0);
  await page.locator('[data-testid^="timeline-clip-"]').first().click();

  await page.getByTestId('chroma-key-toggle').check();
  await page.getByTestId('chroma-key-color').fill('#00ff00');
  await page.getByTestId('chroma-key-similarity').fill('0.24');
  await page.getByTestId('chroma-key-blend').fill('0.08');

  await openExportDialog(page);
  await page.getByTestId('export-enqueue-button').click();
  await expectExportTaskStatus(page, 0, 'success');

  const plan = await page.evaluate(() => window.__E2E_ACTIONS__!.getLastExportPlan!() as { filterComplex: string });
  expect(plan.filterComplex).toContain('chromakey=color=0x00FF00:similarity=0.24:blend=0.08');
});

test('adds a rect mask and includes mask crop filters in the export plan', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page, 0);
  await page.locator('[data-testid^="timeline-clip-"]').first().click();

  await page.getByTestId('add-mask-button').click();
  await expect(page.getByTestId('masks-editor').locator('[data-testid^="mask-item-"]')).toHaveCount(1);

  await openExportDialog(page);
  await page.getByTestId('export-enqueue-button').click();
  await expectExportTaskStatus(page, 0, 'success');

  const plan = await page.evaluate(() => window.__E2E_ACTIONS__!.getLastExportPlan!() as { filterComplex: string });
  expect(plan.filterComplex).toContain("crop=w='iw*0.5':h='ih*0.5':x='iw*0.25':y='ih*0.25'");
  expect(plan.filterComplex).toContain("pad=w='iw/0.5':h='ih/0.5':x='ow*0.25':y='oh*0.25':color=black@0");
});

test('adds a path mask from preview edit mode and includes geq in the export plan', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page, 0);
  await page.locator('[data-testid^="timeline-clip-"]').first().click();

  await page.getByTestId('add-mask-button').click();
  await page.getByTestId(/^mask-type-/).selectOption('path');
  await page.getByTestId('preview-canvas-edit-toggle').click();
  const overlay = page.getByTestId('path-mask-overlay');
  await expect(overlay).toBeVisible();
  const overlayBox = await overlay.boundingBox();
  expect(overlayBox).not.toBeNull();
  const pointA = { x: overlayBox!.width * 0.25, y: overlayBox!.height * 0.25 };
  const pointB = { x: overlayBox!.width * 0.75, y: overlayBox!.height * 0.25 };
  const pointC = { x: overlayBox!.width * 0.5, y: overlayBox!.height * 0.75 };

  await overlay.click({ position: pointA });
  await overlay.click({ position: pointB });
  await overlay.click({ position: pointC });
  await overlay.dblclick({ position: pointA });
  await expect(page.getByTestId('path-mask-anchor-2')).toBeVisible();

  const pathMask = await page.evaluate(() => {
    const timeline = window.__E2E_ACTIONS__!.getTimelineSnapshot!() as {
      tracks: Array<{ clips: Array<{ id: string; masks?: Array<{ type: string; path?: unknown[] }> }> }>;
    };
    return timeline.tracks.flatMap((track) => track.clips).flatMap((clip) => clip.masks ?? []).find((mask) => mask.type === 'path');
  });
  expect(pathMask?.path).toHaveLength(4);

  await openExportDialog(page);
  await page.getByTestId('export-enqueue-button').click();
  await expectExportTaskStatus(page, 0, 'success');

  const plan = await page.evaluate(() => window.__E2E_ACTIONS__!.getLastExportPlan!() as { filterComplex: string });
  expect(plan.filterComplex).toContain("geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='alpha(X,Y)*(");
});

test('analyzes stabilization and includes vidstabtransform in the export plan', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page, 0);
  await page.locator('[data-testid^="timeline-clip-"]').first().click();

  await page.getByTestId('stabilization-toggle').check();
  await page.getByTestId('stabilization-smoothing').fill('45');
  await page.getByTestId('stabilization-zoom').fill('1.2');
  await page.getByTestId('analyze-stabilization-button').click();
  await expect(page.getByTestId('stabilization-status')).toContainText('已分析');

  await openExportDialog(page);
  await page.getByTestId('export-enqueue-button').click();
  await expectExportTaskStatus(page, 0, 'success');

  const plan = await page.evaluate(() => window.__E2E_ACTIONS__!.getLastExportPlan!() as { filterComplex: string });
  expect(plan.filterComplex).toContain('vidstabtransform=smoothing=45:zoom=1.2:input=C\\\\:/Users/E2E/AppData/Roaming/open-factory/stabilization/');
});

test('enables frame interpolation and includes minterpolate in the export plan', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page, 0);
  await page.locator('[data-testid^="timeline-clip-"]').first().click();

  await expect(page.getByTestId('frame-interpolation-toggle')).toBeEnabled();
  await page.getByTestId('frame-interpolation-toggle').check();
  await page.getByTestId('frame-interpolation-fps-select').selectOption('60');

  await openExportDialog(page);
  await page.getByTestId('export-enqueue-button').click();
  await expectExportTaskStatus(page, 0, 'success');

  const plan = await page.evaluate(() => window.__E2E_ACTIONS__!.getLastExportPlan!() as { filterComplex: string });
  expect(plan.filterComplex).toContain('minterpolate=fps=60:mi_mode=mci:mc_mode=aobmc');
});

test('enables audio denoise and includes arnndn in the export plan', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page, 0);
  await page.locator('[data-testid^="timeline-clip-"]').first().click();

  await expect(page.getByTestId('audio-denoise-toggle')).toBeEnabled();
  await page.getByTestId('audio-denoise-toggle').check();
  await page.getByTestId('audio-denoise-strength').fill('0.8');

  await openExportDialog(page);
  await page.getByTestId('export-enqueue-button').click();
  await expectExportTaskStatus(page, 0, 'success');

  const plan = await page.evaluate(() => window.__E2E_ACTIONS__!.getLastExportPlan!() as { filterComplex: string });
  expect(plan.filterComplex).toContain('arnndn=m=model.rnnn:mix=0.8');
});
