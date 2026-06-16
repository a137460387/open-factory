import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PREVIEW_PERFORMANCE_SETTINGS,
  appendPreviewFpsSample,
  calculatePreviewRenderSize,
  calculatePreviewFpsAverage,
  getDisabledPreviewEffectTypes,
  normalizePreviewPerformanceSettings,
  resolveAdaptivePreviewPerformance,
  resolveEffectivePreviewPerformance,
  shouldRenderPreviewFrame
} from './preview-performance';

describe('preview performance settings', () => {
  it('calculates resolution scale for each quality mode', () => {
    expect(calculatePreviewRenderSize(1280, 720, 'full')).toEqual({ width: 1280, height: 720, scale: 1 });
    expect(calculatePreviewRenderSize(1280, 720, 'half')).toEqual({ width: 640, height: 360, scale: 0.5 });
    expect(calculatePreviewRenderSize(1280, 720, 'quarter')).toEqual({ width: 320, height: 180, scale: 0.25 });
    expect(calculatePreviewRenderSize(1280, 720, 'audio-only')).toEqual({ width: 1280, height: 720, scale: 1 });
  });

  it('renders every Nth frame only while playing', () => {
    expect(shouldRenderPreviewFrame(false, 3, 4)).toBe(true);
    expect(shouldRenderPreviewFrame(true, 8, 4)).toBe(true);
    expect(shouldRenderPreviewFrame(true, 9, 4)).toBe(false);
    expect(shouldRenderPreviewFrame(true, 9, 1)).toBe(true);
  });

  it('normalizes unknown persisted values to full quality defaults', () => {
    expect(normalizePreviewPerformanceSettings(undefined)).toEqual(DEFAULT_PREVIEW_PERFORMANCE_SETTINGS);
    expect(normalizePreviewPerformanceSettings({ qualityMode: 'half', skipFrames: 2, adaptiveEnabled: false })).toEqual({ qualityMode: 'half', skipFrames: 2, adaptiveEnabled: false });
    expect(normalizePreviewPerformanceSettings({ qualityMode: 'tiny', skipFrames: 3 })).toEqual(DEFAULT_PREVIEW_PERFORMANCE_SETTINGS);
  });

  it('disables expensive effects in low quality modes', () => {
    expect(getDisabledPreviewEffectTypes({ qualityMode: 'full', skipFrames: 1 })).toEqual([]);
    expect(getDisabledPreviewEffectTypes({ qualityMode: 'half', skipFrames: 1 })).toEqual(['film-grain', 'chromatic-aberration', 'custom-shader']);
  });

  it('calculates the moving fps window average', () => {
    const samples = appendPreviewFpsSample(
      [
        { timestampMs: 0, fps: 60 },
        { timestampMs: 1000, fps: 30 }
      ],
      { timestampMs: 4000, fps: 18 }
    );

    expect(samples).toEqual([
      { timestampMs: 1000, fps: 30 },
      { timestampMs: 4000, fps: 18 }
    ]);
    expect(calculatePreviewFpsAverage(samples)).toBe(24);
  });

  it('switches adaptive quality at fps thresholds', () => {
    const full = { qualityMode: 'full', skipFrames: 1, averageFps: 60, stableMs: 0, status: 'full' } as const;

    expect(resolveAdaptivePreviewPerformance({ averageFps: 20, current: full, elapsedMs: 1000 })).toMatchObject({
      qualityMode: 'half',
      skipFrames: 2,
      status: 'degraded'
    });
    expect(resolveAdaptivePreviewPerformance({ averageFps: 12, current: full, elapsedMs: 1000 })).toMatchObject({
      qualityMode: 'quarter',
      skipFrames: 4,
      status: 'low'
    });
  });

  it('requires three stable seconds before upgrading adaptive quality', () => {
    const degraded = { qualityMode: 'half', skipFrames: 2, averageFps: 20, stableMs: 0, status: 'degraded' } as const;
    const waiting = resolveAdaptivePreviewPerformance({ averageFps: 30, current: degraded, elapsedMs: 2000 });

    expect(waiting).toMatchObject({ qualityMode: 'half', skipFrames: 2, stableMs: 2000 });
    expect(resolveAdaptivePreviewPerformance({ averageFps: 31, current: waiting, elapsedMs: 1000 })).toMatchObject({
      qualityMode: 'full',
      skipFrames: 1,
      stableMs: 0,
      status: 'full'
    });
  });

  it('keeps the manual quality when adaptive control is disabled', () => {
    const adaptiveLow = { qualityMode: 'quarter', skipFrames: 4, averageFps: 8, stableMs: 0, status: 'low' } as const;

    expect(resolveEffectivePreviewPerformance({ qualityMode: 'half', skipFrames: 2, adaptiveEnabled: false }, adaptiveLow)).toEqual({
      qualityMode: 'half',
      skipFrames: 2,
      adaptiveEnabled: false
    });
    expect(resolveAdaptivePreviewPerformance({ averageFps: 8, current: adaptiveLow, elapsedMs: 1000, adaptiveEnabled: false })).toMatchObject({
      qualityMode: 'full',
      skipFrames: 1,
      status: 'full'
    });
  });
});
