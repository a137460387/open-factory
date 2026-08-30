import { describe, it, expect } from 'vitest';
import {
  ROLLING_WINDOW_DURATION_MS,
  MAX_EXPORT_HISTORY_COUNT,
  DEFAULT_OVERLOAD_COEFFICIENT,
  MAX_OVERLOAD_COEFFICIENT,
  MIN_OVERLOAD_COEFFICIENT,
  createEmptyDashboardState,
  appendResourceSample,
  calculateOverloadStatus,
  isOverloaded,
  clampCoefficient,
  startExportRecording,
  appendExportSample,
  finishExportRecording,
  trimExportHistory,
  extractExportCurve,
  normalizeExportHistory,
  normalizeOverloadCoefficient,
} from './resource-dashboard';
import type { ResourceSample, ExportResourceSnapshot } from './resource-dashboard';

function makeSample(overrides: Partial<ResourceSample> = {}): ResourceSample {
  return {
    timestamp: Date.now(),
    cpuPercent: 50,
    memoryUsedMb: 1000,
    diskReadMbPerSec: 10,
    diskWriteMbPerSec: 5,
    memoryTotalMb: 8000,
    ...overrides,
  };
}

describe('constants', () => {
  it('has expected values', () => {
    expect(ROLLING_WINDOW_DURATION_MS).toBe(60_000);
    expect(MAX_EXPORT_HISTORY_COUNT).toBe(5);
    expect(DEFAULT_OVERLOAD_COEFFICIENT).toBe(1.2);
    expect(MAX_OVERLOAD_COEFFICIENT).toBe(3);
    expect(MIN_OVERLOAD_COEFFICIENT).toBe(0.5);
  });
});

describe('createEmptyDashboardState', () => {
  it('creates empty state', () => {
    const state = createEmptyDashboardState();
    expect(state.rollingWindow).toEqual([]);
    expect(state.exportHistory).toEqual([]);
    expect(state.enabled).toBe(false);
    expect(state.overloadStatus.overloaded).toBe(false);
  });
});

describe('appendResourceSample', () => {
  it('adds sample', () => {
    const result = appendResourceSample([], makeSample(), Date.now());
    expect(result.length).toBe(1);
  });

  it('filters old samples', () => {
    const now = Date.now();
    const old = makeSample({ timestamp: now - 120_000 });
    const fresh = makeSample({ timestamp: now - 10_000 });
    const result = appendResourceSample([old, fresh], makeSample(), now);
    expect(result.length).toBe(2);
  });
});

describe('calculateOverloadStatus', () => {
  it('reports not overloaded when under limit', () => {
    const status = calculateOverloadStatus(2, 8);
    expect(status.overloaded).toBe(false);
    expect(status.runningCount).toBe(2);
  });

  it('reports overloaded when over limit', () => {
    const status = calculateOverloadStatus(20, 4);
    expect(status.overloaded).toBe(true);
  });

  it('uses default coefficient', () => {
    const status = calculateOverloadStatus(5, 4);
    expect(status.overloadCoefficient).toBe(DEFAULT_OVERLOAD_COEFFICIENT);
  });
});

describe('isOverloaded', () => {
  it('returns false for low count', () => {
    expect(isOverloaded(1, 8)).toBe(false);
  });

  it('returns true for high count', () => {
    expect(isOverloaded(20, 2)).toBe(true);
  });
});

describe('clampCoefficient', () => {
  it('clamps to min', () => {
    expect(clampCoefficient(0)).toBe(MIN_OVERLOAD_COEFFICIENT);
  });

  it('clamps to max', () => {
    expect(clampCoefficient(10)).toBe(MAX_OVERLOAD_COEFFICIENT);
  });

  it('returns default for NaN', () => {
    expect(clampCoefficient(NaN)).toBe(DEFAULT_OVERLOAD_COEFFICIENT);
  });

  it('preserves in-range value', () => {
    expect(clampCoefficient(1.5)).toBe(1.5);
  });
});

describe('startExportRecording', () => {
  it('creates new snapshot', () => {
    const result = startExportRecording([], 'export-1', ['task-1'], Date.now());
    expect(result.length).toBe(1);
    expect(result[0].exportId).toBe('export-1');
  });

  it('trims when at max', () => {
    const snapshots: ExportResourceSnapshot[] = Array.from({ length: MAX_EXPORT_HISTORY_COUNT }, (_, i) => ({
      exportId: `e${i}`,
      startedAt: i,
      finishedAt: i,
      samples: [],
      taskNames: [],
    }));
    const result = startExportRecording(snapshots, 'new', [], Date.now());
    expect(result.length).toBe(MAX_EXPORT_HISTORY_COUNT);
  });
});

describe('appendExportSample', () => {
  it('adds sample to matching snapshot', () => {
    const snapshots = startExportRecording([], 'e1', [], Date.now());
    const result = appendExportSample(snapshots, 'e1', makeSample());
    expect(result[0].samples.length).toBe(1);
  });

  it('does not add to non-matching snapshot', () => {
    const snapshots = startExportRecording([], 'e1', [], Date.now());
    const result = appendExportSample(snapshots, 'e2', makeSample());
    expect(result[0].samples.length).toBe(0);
  });
});

describe('finishExportRecording', () => {
  it('sets finishedAt', () => {
    const snapshots = startExportRecording([], 'e1', [], 1000);
    const result = finishExportRecording(snapshots, 'e1', 2000);
    expect(result[0].finishedAt).toBe(2000);
  });
});

describe('trimExportHistory', () => {
  it('trims when over max', () => {
    const snapshots: ExportResourceSnapshot[] = Array.from({ length: 10 }, (_, i) => ({
      exportId: `e${i}`,
      startedAt: i,
      finishedAt: i,
      samples: [],
      taskNames: [],
    }));
    const result = trimExportHistory(snapshots);
    expect(result.length).toBe(MAX_EXPORT_HISTORY_COUNT);
  });

  it('keeps when under max', () => {
    const snapshots: ExportResourceSnapshot[] = [
      {
        exportId: 'e1',
        startedAt: 0,
        finishedAt: 0,
        samples: [],
        taskNames: [],
      },
    ];
    const result = trimExportHistory(snapshots);
    expect(result.length).toBe(1);
  });
});

describe('extractExportCurve', () => {
  it('returns empty for no samples', () => {
    const snapshot: ExportResourceSnapshot = {
      exportId: 'e1',
      startedAt: 0,
      finishedAt: 100,
      samples: [],
      taskNames: [],
    };
    expect(extractExportCurve(snapshot)).toEqual([]);
  });

  it('extracts curve points', () => {
    const snapshot: ExportResourceSnapshot = {
      exportId: 'e1',
      startedAt: 1000,
      finishedAt: 5000,
      samples: [makeSample({ timestamp: 2000 })],
      taskNames: [],
    };
    const result = extractExportCurve(snapshot);
    expect(result.length).toBe(1);
    expect(result[0].elapsedSeconds).toBe(1);
  });
});

describe('normalizeExportHistory', () => {
  it('delegates to trimExportHistory', () => {
    const snapshots: ExportResourceSnapshot[] = [
      {
        exportId: 'e1',
        startedAt: 0,
        finishedAt: 0,
        samples: [],
        taskNames: [],
      },
    ];
    expect(normalizeExportHistory(snapshots)).toEqual(snapshots);
  });
});

describe('normalizeOverloadCoefficient', () => {
  it('uses default for undefined', () => {
    expect(normalizeOverloadCoefficient(undefined)).toBe(DEFAULT_OVERLOAD_COEFFICIENT);
  });

  it('clamps value', () => {
    expect(normalizeOverloadCoefficient(10)).toBe(MAX_OVERLOAD_COEFFICIENT);
  });
});
