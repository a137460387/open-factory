import { describe, it, expect } from 'vitest';
import {
  RENDER_FARM_SPLIT_THRESHOLD_SECONDS,
  RENDER_FARM_TARGET_SEGMENT_SECONDS,
  suggestRenderFarmInstances,
  clampRenderFarmInstances,
  calculateRenderFarmSegments,
  buildRenderFarmSegmentPath,
  buildRenderFarmConcatList,
  calculateRenderFarmProgress,
  createRenderFarmSegmentStatuses,
} from './render-farm';

describe('constants', () => {
  it('has expected values', () => {
    expect(RENDER_FARM_SPLIT_THRESHOLD_SECONDS).toBe(60);
    expect(RENDER_FARM_TARGET_SEGMENT_SECONDS).toBe(30);
  });
});

describe('suggestRenderFarmInstances', () => {
  it('returns 1 for undefined', () => {
    expect(suggestRenderFarmInstances(undefined)).toBe(1);
  });

  it('returns 1 for 0', () => {
    expect(suggestRenderFarmInstances(0)).toBe(1);
  });

  it('returns 1 for NaN', () => {
    expect(suggestRenderFarmInstances(NaN)).toBe(1);
  });

  it('returns 1 for negative', () => {
    expect(suggestRenderFarmInstances(-5)).toBe(1);
  });

  it('returns 1 for 4 cores', () => {
    expect(suggestRenderFarmInstances(4)).toBe(1);
  });

  it('returns 2 for 8 cores', () => {
    expect(suggestRenderFarmInstances(8)).toBe(2);
  });

  it('clamps to 4 max', () => {
    expect(suggestRenderFarmInstances(32)).toBe(4);
  });
});

describe('clampRenderFarmInstances', () => {
  it('clamps to 1 minimum', () => {
    expect(clampRenderFarmInstances(0)).toBe(1);
    expect(clampRenderFarmInstances(-5)).toBe(1);
  });

  it('clamps to 4 maximum', () => {
    expect(clampRenderFarmInstances(10)).toBe(4);
  });

  it('rounds fractional', () => {
    expect(clampRenderFarmInstances(2.7)).toBe(3);
  });

  it('returns 1 for NaN', () => {
    expect(clampRenderFarmInstances(NaN)).toBe(1);
  });

  it('returns 1 for Infinity', () => {
    expect(clampRenderFarmInstances(Infinity)).toBe(1);
  });
});

describe('calculateRenderFarmSegments', () => {
  it('returns empty for short duration', () => {
    expect(calculateRenderFarmSegments(30)).toEqual([]);
  });

  it('returns empty for 0', () => {
    expect(calculateRenderFarmSegments(0)).toEqual([]);
  });

  it('returns empty for NaN', () => {
    expect(calculateRenderFarmSegments(NaN)).toEqual([]);
  });

  it('splits long duration', () => {
    const segments = calculateRenderFarmSegments(120);
    expect(segments.length).toBeGreaterThan(1);
  });

  it('covers full duration', () => {
    const segments = calculateRenderFarmSegments(120);
    const totalDuration = segments.reduce((sum, s) => sum + s.duration, 0);
    expect(totalDuration).toBeCloseTo(120, 0);
  });

  it('respects custom options', () => {
    const segments = calculateRenderFarmSegments(120, { thresholdSeconds: 10, targetSegmentSeconds: 20 });
    expect(segments.length).toBeGreaterThan(1);
  });
});

describe('buildRenderFarmSegmentPath', () => {
  it('builds path', () => {
    const path = buildRenderFarmSegmentPath('/tmp', 'task-1', 0, '/out.mp4');
    expect(path).toContain('task-1');
    expect(path).toContain('.mp4');
  });
});

describe('buildRenderFarmConcatList', () => {
  it('builds concat list', () => {
    const list = buildRenderFarmConcatList([
      { outputPath: '/seg1.mp4' },
      { outputPath: '/seg2.mp4' },
    ]);
    expect(list).toContain('seg1.mp4');
    expect(list).toContain('seg2.mp4');
  });
});

describe('createRenderFarmSegmentStatuses', () => {
  it('creates statuses from segments', () => {
    const segments = calculateRenderFarmSegments(120);
    const statuses = createRenderFarmSegmentStatuses(segments, '/tmp', 'task-1', '/out.mp4');
    expect(statuses.length).toBe(segments.length);
    for (const s of statuses) {
      expect(s.status).toBe('pending');
      expect(s.progress).toBe(0);
      expect(s.outputPath).toBeDefined();
    }
  });
});

describe('calculateRenderFarmProgress', () => {
  it('returns 0 for empty statuses', () => {
    expect(calculateRenderFarmProgress([])).toBe(0);
  });

  it('calculates weighted progress', () => {
    const statuses = [
      { duration: 30, progress: 1 },
      { duration: 30, progress: 0.5 },
    ];
    expect(calculateRenderFarmProgress(statuses)).toBeCloseTo(0.75);
  });
});
