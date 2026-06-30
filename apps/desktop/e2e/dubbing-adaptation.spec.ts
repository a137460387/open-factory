import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('dubbing adaptation: dubbed 30% longer produces compress suggestion with valid atempoRatio', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupDubbingAdaptationCompressFixture!());

  const panel = page.getByTestId('dubbing-adaptation-panel');
  await expect(panel).toBeVisible({ timeout: 10_000 });

  // Click analyze
  await page.getByTestId('dubbing-analyze-btn').click();

  // Segment should appear
  await expect(page.getByTestId('dubbing-segment-tts-seg-1')).toBeVisible();

  // Delta should be +3.00s
  await expect(page.getByTestId('dubbing-delta-tts-seg-1')).toContainText('3.00');

  // Type should be 压缩 (compress)
  await expect(page.getByTestId('dubbing-type-tts-seg-1')).toContainText('压缩');

  // Atempo ratio should be visible and in range [0.75, 1.0]
  const atempoEl = page.getByTestId('dubbing-atempo-tts-seg-1');
  await expect(atempoEl).toBeVisible();
  const atempoText = await atempoEl.textContent();
  const atempoMatch = atempoText!.match(/[\d.]+/);
  expect(atempoMatch).not.toBeNull();
  const atempoValue = parseFloat(atempoMatch![0]);
  expect(atempoValue).toBeGreaterThanOrEqual(0.75);
  expect(atempoValue).toBeLessThanOrEqual(1.0);
  // Should be close to 10/13 ≈ 0.7692
  expect(atempoValue).toBeCloseTo(10 / 13, 2);

  // Verify project data via getProjectSnapshot
  const snapshot = await page.evaluate(() => {
    const project = window.__E2E_ACTIONS__!.getProjectSnapshot!() as { ttsSegments?: Array<{ id: string; timingAdaptation?: { durationDelta: number; adaptationType: string; atempoRatio: number | null } }> };
    return project.ttsSegments;
  });
  expect(snapshot).toHaveLength(1);
  expect(snapshot![0].timingAdaptation!.adaptationType).toBe('compress');
  expect(snapshot![0].timingAdaptation!.atempoRatio!).toBeCloseTo(10 / 13, 2);
  expect(snapshot![0].timingAdaptation!.durationDelta).toBeCloseTo(3);
});

test('dubbing adaptation: shorter dubbed produces pad, extreme compress clamps atempo to 0.75', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupDubbingAdaptationPadFixture!());

  const panel = page.getByTestId('dubbing-adaptation-panel');
  await expect(panel).toBeVisible({ timeout: 10_000 });

  // Click analyze
  await page.getByTestId('dubbing-analyze-btn').click();

  // Segment 1: shorter dubbed (10→7) should produce pad
  await expect(page.getByTestId('dubbing-segment-tts-seg-short')).toBeVisible();
  await expect(page.getByTestId('dubbing-delta-tts-seg-short')).toContainText('-3.00');
  await expect(page.getByTestId('dubbing-type-tts-seg-short')).toContainText('填充静音');

  // Segment 2: extreme compression (10→20) should produce compress with atempo clamped to 0.75
  await expect(page.getByTestId('dubbing-segment-tts-seg-extreme')).toBeVisible();
  await expect(page.getByTestId('dubbing-delta-tts-seg-extreme')).toContainText('10.00');
  await expect(page.getByTestId('dubbing-type-tts-seg-extreme')).toContainText('压缩');

  const atempoExtremeEl = page.getByTestId('dubbing-atempo-tts-seg-extreme');
  await expect(atempoExtremeEl).toBeVisible();
  const atempoExtremeText = await atempoExtremeEl.textContent();
  const atempoExtremeMatch = atempoExtremeText!.match(/[\d.]+/);
  expect(atempoExtremeMatch).not.toBeNull();
  const atempoExtremeValue = parseFloat(atempoExtremeMatch![0]);
  // Raw would be 10/20=0.5, clamped to 0.75
  expect(atempoExtremeValue).toBe(0.75);

  // Verify project data
  const snapshot = await page.evaluate(() => {
    const project = window.__E2E_ACTIONS__!.getProjectSnapshot!() as { ttsSegments?: Array<{ id: string; timingAdaptation?: { adaptationType: string; atempoRatio: number | null } }> };
    return project.ttsSegments;
  });
  expect(snapshot).toHaveLength(2);
  expect(snapshot![0].timingAdaptation!.adaptationType).toBe('pad');
  expect(snapshot![0].timingAdaptation!.atempoRatio).toBeNull();
  expect(snapshot![1].timingAdaptation!.adaptationType).toBe('compress');
  expect(snapshot![1].timingAdaptation!.atempoRatio).toBe(0.75);
});
