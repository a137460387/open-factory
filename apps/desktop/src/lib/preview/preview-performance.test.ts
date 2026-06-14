import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PREVIEW_PERFORMANCE_SETTINGS,
  calculatePreviewRenderSize,
  getDisabledPreviewEffectTypes,
  normalizePreviewPerformanceSettings,
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
    expect(normalizePreviewPerformanceSettings({ qualityMode: 'half', skipFrames: 2 })).toEqual({ qualityMode: 'half', skipFrames: 2 });
    expect(normalizePreviewPerformanceSettings({ qualityMode: 'tiny', skipFrames: 3 })).toEqual(DEFAULT_PREVIEW_PERFORMANCE_SETTINGS);
  });

  it('disables expensive effects in low quality modes', () => {
    expect(getDisabledPreviewEffectTypes({ qualityMode: 'full', skipFrames: 1 })).toEqual([]);
    expect(getDisabledPreviewEffectTypes({ qualityMode: 'half', skipFrames: 1 })).toEqual(['film-grain', 'chromatic-aberration', 'custom-shader']);
  });
});
