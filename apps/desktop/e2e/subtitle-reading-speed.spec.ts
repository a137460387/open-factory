import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('subtitle reading speed: shows warning badges for fast subtitles', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupSubtitleReadingSpeedFixture!());

  // Both subtitle clips visible
  await expect(page.getByTestId('timeline-clip-clip-sub-rs-1')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId('timeline-clip-clip-sub-rs-2')).toBeVisible();

  // Reading speed warning badges visible
  await expect(page.getByTestId('reading-speed-warning-clip-sub-rs-1')).toBeVisible();
  await expect(page.getByTestId('reading-speed-warning-clip-sub-rs-2')).toBeVisible();

  // Verify data state
  const warnings = await page.evaluate(() => {
    const project = window.__E2E_ACTIONS__!.getProjectSnapshot!() as {
      timeline: { tracks: Array<{ clips: Array<{ id: string; readingSpeedWarning?: { charsPerSecond: number; severity: string } | null }> }> };
    };
    const clips = project.timeline.tracks.flatMap((t) => t.clips);
    return clips.map((c) => ({ id: c.id, warning: c.readingSpeedWarning }));
  });
  const w1 = warnings.find((w) => w.id === 'clip-sub-rs-1');
  const w2 = warnings.find((w) => w.id === 'clip-sub-rs-2');
  expect(w1?.warning?.severity).toBe('critical');
  expect(w2?.warning?.severity).toBe('warning');
});

test('subtitle reading speed: auto split clears warning on split clip', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupSubtitleReadingSpeedFixture!());

  await expect(page.getByTestId('reading-speed-warning-clip-sub-rs-1')).toBeVisible({ timeout: 10_000 });

  // Auto split the critical clip
  await page.evaluate(() => window.__E2E_ACTIONS__!.autoSplitSubtitle!('clip-sub-rs-1', 'track-sub-rs'));
  await page.waitForTimeout(300);

  // Warning should be cleared after split
  const warning = await page.evaluate(() => {
    const project = window.__E2E_ACTIONS__!.getProjectSnapshot!() as {
      timeline: { tracks: Array<{ clips: Array<{ id: string; readingSpeedWarning?: { severity: string } | null }> }> };
    };
    const c = project.timeline.tracks.flatMap((t) => t.clips).find((item) => item.id === 'clip-sub-rs-1');
    return c?.readingSpeedWarning;
  });
  expect(warning).toBeNull();
});

test('subtitle reading speed: extend duration clears warning', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupSubtitleReadingSpeedFixture!());

  await expect(page.getByTestId('reading-speed-warning-clip-sub-rs-2')).toBeVisible({ timeout: 10_000 });

  // Extend clip-sub-rs-2 (start=1, duration=1.5). Next clip starts at 2.5 but no next in fixture.
  // clip-sub-rs-2 text = '另一段速度偏快的字幕' (10 chars), safe duration = 10/6 ≈ 1.667s
  // New end = 1 + 1.667 = 2.667. nextStart = 999 (no overlap concern)
  await page.evaluate(() => window.__E2E_ACTIONS__!.extendSubtitleDuration!('clip-sub-rs-2', 'track-sub-rs', 999));
  await page.waitForTimeout(300);

  // Warning should be cleared after extension
  const warning = await page.evaluate(() => {
    const project = window.__E2E_ACTIONS__!.getProjectSnapshot!() as {
      timeline: { tracks: Array<{ clips: Array<{ id: string; readingSpeedWarning?: { severity: string } | null }> }> };
    };
    const c = project.timeline.tracks.flatMap((t) => t.clips).find((item) => item.id === 'clip-sub-rs-2');
    return c?.readingSpeedWarning;
  });
  expect(warning).toBeNull();
});
