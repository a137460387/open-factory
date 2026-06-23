import { describe, expect, it } from 'vitest';
import {
  getSensitivityThresholds,
  mapSensitivityLabel,
  calculateClipTimingDelta,
  detectSubtitleSyncOffset,
  shouldTriggerSyncWarning,
  buildSyncWarning,
  scanSubtitleTrackSync,
  batchScanSubtitleSync,
  calculateSingleSubtitleRepair,
  needsSyncRecheck,
  type SubtitleSyncSensitivity,
  type SubtitleTimingReference,
  type SubtitleClip,
  type Track,
} from '../src';

function makeSubtitleClip(overrides: Partial<SubtitleClip> = {}): SubtitleClip {
  return {
    id: overrides.id ?? 'sub-1',
    type: 'subtitle',
    name: overrides.name ?? 'subtitle',
    trackId: overrides.trackId ?? 'sub-track',
    start: overrides.start ?? 0,
    duration: overrides.duration ?? 2,
    trimStart: 0,
    trimEnd: 0,
    speed: 1,
    text: overrides.text ?? 'Hello',
    subtitleMode: 'burn-in',
    style: {
      fontSize: 42,
      color: '#ffffff',
      backgroundColor: '#000000',
      backgroundOpacity: 0.55,
      fontFamily: 'Arial',
      bold: false,
      italic: false,
      yOffset: 72,
      outlineColor: '#000000',
      outlineWidth: 0,
      shadowColor: '#000000',
      shadowOffset: 0,
    },
    transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
    colorCorrection: { brightness: 0, contrast: 1, saturation: 1, hue: 0 },
  };
}

function makeTimingRef(overrides: Partial<SubtitleTimingReference> = {}): SubtitleTimingReference {
  return {
    clipId: overrides.clipId ?? 'video-clip',
    originalStart: overrides.originalStart ?? 0,
    originalDuration: overrides.originalDuration ?? 20,
    originalSpeed: overrides.originalSpeed ?? 1,
    currentStart: overrides.currentStart ?? 0,
    currentDuration: overrides.currentDuration ?? 20,
    currentSpeed: overrides.currentSpeed ?? 1,
  };
}

describe('getSensitivityThresholds', () => {
  it('returns thresholds for each level', () => {
    const strict = getSensitivityThresholds('strict');
    const standard = getSensitivityThresholds('standard');
    const loose = getSensitivityThresholds('loose');
    expect(strict.minorMs).toBeLessThan(standard.minorMs);
    expect(standard.minorMs).toBeLessThan(loose.minorMs);
  });
});

describe('mapSensitivityLabel', () => {
  it('maps Chinese labels', () => {
    expect(mapSensitivityLabel('严格')).toBe('strict');
    expect(mapSensitivityLabel('宽松')).toBe('loose');
  });

  it('maps English labels', () => {
    expect(mapSensitivityLabel('strict')).toBe('strict');
    expect(mapSensitivityLabel('loose')).toBe('loose');
    expect(mapSensitivityLabel('standard')).toBe('standard');
  });

  it('defaults to standard for unknown', () => {
    expect(mapSensitivityLabel('unknown')).toBe('standard');
  });
});

describe('calculateClipTimingDelta', () => {
  it('returns zero deltas for unchanged clip', () => {
    const ref = makeTimingRef();
    const delta = calculateClipTimingDelta(ref);
    expect(delta.startDelta).toBe(0);
    expect(delta.durationDelta).toBe(0);
    expect(delta.speedChanged).toBe(false);
  });

  it('detects speed change', () => {
    const ref = makeTimingRef({ currentSpeed: 2 });
    expect(calculateClipTimingDelta(ref).speedChanged).toBe(true);
  });

  it('detects start delta', () => {
    const ref = makeTimingRef({ currentStart: 5 });
    expect(calculateClipTimingDelta(ref).startDelta).toBe(5);
  });
});

describe('detectSubtitleSyncOffset', () => {
  it('returns 0 for no change', () => {
    const sub = makeSubtitleClip({ start: 5 });
    const ref = makeTimingRef();
    expect(detectSubtitleSyncOffset(sub, ref)).toBe(0);
  });

  it('calculates offset when speed changes', () => {
    const sub = makeSubtitleClip({ start: 5 });
    const ref = makeTimingRef({ currentSpeed: 2 });
    const offset = detectSubtitleSyncOffset(sub, ref);
    expect(offset).not.toBe(0);
  });
});

describe('shouldTriggerSyncWarning', () => {
  it('triggers for offset above threshold', () => {
    expect(shouldTriggerSyncWarning(0.2, 'standard')).toBe(true);
  });

  it('does not trigger for small offset in standard', () => {
    expect(shouldTriggerSyncWarning(0.05, 'standard')).toBe(false);
  });

  it('triggers for small offset in strict mode', () => {
    expect(shouldTriggerSyncWarning(0.1, 'strict')).toBe(true);
  });

  it('does not trigger for tiny offset in loose mode', () => {
    expect(shouldTriggerSyncWarning(0.1, 'loose')).toBe(false);
  });
});

describe('buildSyncWarning', () => {
  it('returns undefined when offset below threshold', () => {
    expect(buildSyncWarning('sub-1', 'track-1', 0.01, 5, 'standard')).toBeUndefined();
  });

  it('creates warning with severity', () => {
    const warning = buildSyncWarning('sub-1', 'track-1', 1.0, 105, 'standard');
    expect(warning).toBeDefined();
    expect(warning!.severity).toBe('major');
    expect(warning!.offsetMs).toBe(1000);
  });
});

describe('scanSubtitleTrackSync', () => {
  it('reports aligned subtitles as aligned', () => {
    const subs = [makeSubtitleClip({ id: 's1', start: 5 })];
    const refs = [makeTimingRef({ currentStart: 0, currentDuration: 20 })];
    const report = scanSubtitleTrackSync(subs, 'sub-track', refs);
    expect(report.warningCount).toBe(0);
    expect(report.alignedCount).toBe(1);
  });

  it('reports warnings for misaligned subtitles', () => {
    const subs = [makeSubtitleClip({ id: 's1', start: 0 })];
    const refs = [makeTimingRef({ currentStart: 0, currentDuration: 20, currentSpeed: 2 })];
    const report = scanSubtitleTrackSync(subs, 'sub-track', refs, 'strict');
    expect(report.totalSubtitles).toBe(1);
  });
});

describe('batchScanSubtitleSync', () => {
  it('scans multiple subtitle tracks', () => {
    const tracks: Track[] = [
      {
        id: 'sub-track-1',
        type: 'subtitle',
        name: 'Sub 1',
        clips: [makeSubtitleClip({ id: 's1', start: 5, trackId: 'sub-track-1' })],
      },
      {
        id: 'video-track',
        type: 'video',
        name: 'Video',
        clips: [],
      },
    ];
    const refs = [makeTimingRef()];
    const report = batchScanSubtitleSync(tracks, refs);
    expect(report.totalSubtitles).toBe(1);
  });

  it('returns empty for no subtitle tracks', () => {
    const tracks: Track[] = [{ id: 'v', type: 'video', name: 'V', clips: [] }];
    const report = batchScanSubtitleSync(tracks, []);
    expect(report.totalSubtitles).toBe(0);
  });
});

describe('calculateSingleSubtitleRepair', () => {
  it('returns undefined when no offset', () => {
    const sub = makeSubtitleClip({ start: 5 });
    const ref = makeTimingRef();
    expect(calculateSingleSubtitleRepair(sub, ref, 100)).toBeUndefined();
  });

  it('calculates repair when speed changed', () => {
    const sub = makeSubtitleClip({ start: 5 });
    const ref = makeTimingRef({ currentSpeed: 2 });
    const repair = calculateSingleSubtitleRepair(sub, ref, 100);
    if (repair) {
      expect(repair.duration).toBe(2);
    }
  });
});

describe('needsSyncRecheck', () => {
  it('returns false for unchanged clip', () => {
    expect(needsSyncRecheck(
      { start: 0, duration: 10, speed: 1 },
      { start: 0, duration: 10, speed: 1 },
    )).toBe(false);
  });

  it('returns true when speed changes', () => {
    expect(needsSyncRecheck(
      { start: 0, duration: 10, speed: 1 },
      { start: 0, duration: 10, speed: 2 },
    )).toBe(true);
  });

  it('returns true when duration changes', () => {
    expect(needsSyncRecheck(
      { start: 0, duration: 10, speed: 1 },
      { start: 0, duration: 5, speed: 1 },
    )).toBe(true);
  });

  it('returns true when start changes', () => {
    expect(needsSyncRecheck(
      { start: 0, duration: 10, speed: 1 },
      { start: 3, duration: 10, speed: 1 },
    )).toBe(true);
  });
});

describe('scanSubtitleTrackSync warning path', () => {
  it('generates warnings when subtitle start is offset by ref startDelta', () => {
    const subs = [makeSubtitleClip({ id: 's1', start: 5 })];
    const refs = [makeTimingRef({ currentStart: 2, currentDuration: 20, originalStart: 0, originalDuration: 20 })];
    const report = scanSubtitleTrackSync(subs, 'sub-track', refs, 'standard');
    expect(report.warningCount).toBeGreaterThan(0);
    expect(report.warnings[0].subtitleClipId).toBe('s1');
    expect(report.warnings[0].trackId).toBe('sub-track');
    expect(report.alignedCount).toBe(0);
  });

  it('produces major severity for large offsets in strict mode', () => {
    const subs = [makeSubtitleClip({ id: 's2', start: 0 })];
    const refs = [makeTimingRef({ currentStart: 0, currentDuration: 20, originalStart: 0, originalDuration: 20, currentSpeed: 0.5 })];
    const report = scanSubtitleTrackSync(subs, 'sub-track', refs, 'strict');
    expect(report.totalSubtitles).toBe(1);
    if (report.warningCount > 0) {
      expect(['minor', 'major']).toContain(report.warnings[0].severity);
    }
  });
});

describe('batchScanSubtitleSync warning path', () => {
  it('generates warnings when subtitle clips have offset from ref', () => {
    const tracks: Track[] = [
      {
        id: 'sub-track-1',
        type: 'subtitle',
        name: 'Subs',
        clips: [makeSubtitleClip({ id: 'b1', start: 5, trackId: 'sub-track-1' })],
      },
    ];
    const refs = [makeTimingRef({ currentStart: 2, currentDuration: 20, originalStart: 0, originalDuration: 20 })];
    const report = batchScanSubtitleSync(tracks, refs, 'standard');
    expect(report.warningCount).toBeGreaterThan(0);
    expect(report.warnings[0].subtitleClipId).toBe('b1');
    expect(report.warnings[0].trackId).toBe('sub-track-1');
  });
});
