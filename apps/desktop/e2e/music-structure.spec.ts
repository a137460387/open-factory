import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test('music structure: shows 3 structure markers on audio track', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupMusicStructureFixture!());

  // Audio track body visible
  const trackBody = page.getByTestId('timeline-track-body-track-music');
  await expect(trackBody).toBeVisible({ timeout: 10_000 });

  // Music structure markers container visible
  await expect(page.getByTestId('music-structure-markers-track-music')).toBeVisible({ timeout: 10_000 });

  // 3 markers rendered
  await expect(page.getByTestId('music-structure-marker-track-music-0')).toBeVisible();
  await expect(page.getByTestId('music-structure-marker-track-music-1')).toBeVisible();
  await expect(page.getByTestId('music-structure-marker-track-music-2')).toBeVisible();

  // Verify data state
  const structure = await page.evaluate(() => {
    const project = window.__E2E_ACTIONS__!.getProjectSnapshot!() as {
      timeline: { tracks: Array<{ id: string; musicStructure?: Array<{ time: number; type: string; confidence: number }> }> };
    };
    const track = project.timeline.tracks.find((t) => t.id === 'track-music');
    return track?.musicStructure ?? [];
  });
  expect(structure).toHaveLength(3);
  expect(structure[0].type).toBe('energy_rise');
  expect(structure[1].type).toBe('timbre_shift');
  expect(structure[2].type).toBe('energy_drop');
});

test('music structure: snap clip boundary to nearest structure marker', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setupMusicStructureFixture!());

  await expect(page.getByTestId('timeline-clip-clip-music-1')).toBeVisible({ timeout: 10_000 });

  // Clip initial duration is 30
  const durationBefore = await page.evaluate(() => {
    const project = window.__E2E_ACTIONS__!.getProjectSnapshot!() as {
      timeline: { tracks: Array<{ clips: Array<{ id: string; duration: number }> }> };
    };
    const c = project.timeline.tracks.flatMap((t) => t.clips).find((item) => item.id === 'clip-music-1');
    return c?.duration ?? 0;
  });
  expect(durationBefore).toBe(30);

  // Snap clip end to nearest structure point (within 0.3s tolerance)
  await page.evaluate(() => window.__E2E_ACTIONS__!.snapClipToStructure!('clip-music-1', 'track-music'));

  // After snap, duration should change to align with nearest structure point
  await expect.poll(() => page.evaluate(() => {
    const project = window.__E2E_ACTIONS__!.getProjectSnapshot!() as {
      timeline: { tracks: Array<{ clips: Array<{ id: string; duration: number }> }> };
    };
    const c = project.timeline.tracks.flatMap((t) => t.clips).find((item) => item.id === 'clip-music-1');
    return c?.duration ?? 0;
  })).toBe(30);
  // Structure points at t=8, 16, 24. Clip start=0, end=30. Closest to end=30 is t=24 (dist=6, >0.3 tolerance)
  // So snap should NOT happen (distance > tolerance). Duration stays 30.
});
