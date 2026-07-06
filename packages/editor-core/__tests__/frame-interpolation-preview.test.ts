import { describe, expect, it } from 'vitest';
import {
  buildFrameInterpolationCompareArgs,
  buildFrameInterpolationCompareFrameTimes,
  estimateFrameInterpolationModeDurationMs,
  frameInterpolationCompareModeToSlowMotionMode
} from '../src/export/frame-interpolation-preview';

describe('frame interpolation compare preview', () => {
  it('builds ffmpeg args for each comparison mode', () => {
    expect(buildFrameInterpolationCompareArgs('original', 60)).toEqual([]);
    expect(buildFrameInterpolationCompareArgs('blend', 60)).toEqual(['minterpolate=fps=60:mi_mode=blend']);
    expect(buildFrameInterpolationCompareArgs('mci', 60)).toEqual(['minterpolate=fps=60:mi_mode=mci:mc_mode=aobmc']);
    expect(buildFrameInterpolationCompareArgs('optical-flow', 60)).toEqual(['minterpolate=fps=60:mi_mode=mci:mc_mode=aobmc:vsbmc=1']);
  });

  it('estimates processing time from frame count and mode coefficients', () => {
    expect(estimateFrameInterpolationModeDurationMs(100, 'original')).toBe(30);
    expect(estimateFrameInterpolationModeDurationMs(100, 'blend')).toBe(90);
    expect(estimateFrameInterpolationModeDurationMs(100, 'mci')).toBe(180);
    expect(estimateFrameInterpolationModeDurationMs(100, 'optical-flow')).toBe(240);
  });

  it('maps comparison mode selection to persisted slow motion mode', () => {
    expect(frameInterpolationCompareModeToSlowMotionMode('original')).toBe('none');
    expect(frameInterpolationCompareModeToSlowMotionMode('blend')).toBe('blend');
    expect(frameInterpolationCompareModeToSlowMotionMode('mci')).toBe('mci');
    expect(frameInterpolationCompareModeToSlowMotionMode('optical-flow')).toBe('optical-flow');
  });

  it('selects five source frame times around the playhead within clip bounds', () => {
    expect(buildFrameInterpolationCompareFrameTimes(10, 1, 10.1, 25)).toEqual([10.02, 10.06, 10.1, 10.14, 10.18]);
    expect(buildFrameInterpolationCompareFrameTimes(10, 1, 10.01, 25)).toEqual([10, 10, 10.01, 10.05, 10.09]);
  });

  it('falls back to default fps when targetFps is not finite', () => {
    expect(buildFrameInterpolationCompareArgs('blend', NaN)).toEqual(['minterpolate=fps=30:mi_mode=blend']);
    expect(buildFrameInterpolationCompareArgs('mci', Infinity)).toEqual(['minterpolate=fps=30:mi_mode=mci:mc_mode=aobmc']);
  });

  it('falls back to zero frame count when input is not finite', () => {
    expect(estimateFrameInterpolationModeDurationMs(NaN, 'blend')).toBe(0);
    expect(estimateFrameInterpolationModeDurationMs(Infinity, 'mci')).toBe(0);
  });

  it('handles non-finite clipStart, clipDuration, playheadTime and fps', () => {
    expect(buildFrameInterpolationCompareFrameTimes(NaN, NaN, NaN, NaN)).toEqual([0, 0, 0, 0, 0]);
    expect(buildFrameInterpolationCompareFrameTimes(Infinity, Infinity, Infinity, Infinity)).toEqual([0, 0, 0, 0, 0]);
  });
});
