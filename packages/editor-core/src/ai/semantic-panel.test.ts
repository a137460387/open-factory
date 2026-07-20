import { describe, it, expect } from 'vitest';
import {
  createInitialPanelState,
  semanticPanelReducer,
  getFilteredSegments,
  getSelectedKeyFrame,
  getProgressPercent,
  getProgressLabel,
  getMetadataStats,
} from './semantic-panel';
import type { SemanticPanelState } from './semantic-panel';
import type { MaterialMetadata } from './semantic-extractor';

function makeMetadata(overrides: Partial<MaterialMetadata> = {}): MaterialMetadata {
  return {
    version: '1.0',
    source: {
      fileName: 'test.mp4', durationSec: 125, width: 1920,
      height: 1080, fps: 30, codec: 'h264', fileSizeBytes: 10_000_000,
    },
    extractedAt: new Date().toISOString(),
    keyFrames: [
      { timeSec: 1, frameIndex: 30 },
      { timeSec: 5, frameIndex: 150 },
      { timeSec: 10, frameIndex: 300 },
    ],
    asrSegments: [
      { startSec: 0, endSec: 2, text: 'Hello world', confidence: 0.9 },
      { startSec: 3, endSec: 5, text: 'Testing panel', confidence: 0.85 },
      { startSec: 6, endSec: 8, text: 'Final segment', confidence: 0.95 },
    ],
    transcriptText: 'Hello world Testing panel Final segment',
    audioProfile: {
      avgLoudness: -14, peakDb: -1, silenceRatio: 0.1,
      hasMusic: false, speechRatio: 0.8, noiseLevel: 'quiet',
    },
    visualProfile: {
      motionIntensity: 0.5, colorPalette: ['#ff0000'],
      avgBrightness: 0.5, sceneDistribution: {},
      faceCount: 1, hasOverlay: false,
    },
    tags: ['speech', 'indoor', 'people'],
    ...overrides,
  };
}

// ─── semanticPanelReducer ──────────────────────────────────────

describe('semanticPanelReducer', () => {
  it('starts extraction from idle', () => {
    const state = createInitialPanelState();
    const next = semanticPanelReducer(state, { type: 'START_EXTRACTION' });
    expect(next.phase).toBe('extracting');
    expect(next.error).toBeUndefined();
  });

  it('rejects extraction with invalid config', () => {
    const state = createInitialPanelState();
    state.config.maxKeyFrames = -1;
    const next = semanticPanelReducer(state, { type: 'START_EXTRACTION' });
    expect(next.phase).toBe('error');
  });

  it('updates progress', () => {
    const state = { ...createInitialPanelState(), phase: 'extracting' as const };
    const next = semanticPanelReducer(state, {
      type: 'UPDATE_PROGRESS',
      event: { phase: 'asr', progress: 50 },
    });
    expect(next.progress?.progress).toBe(50);
  });

  it('completes extraction', () => {
    const state = { ...createInitialPanelState(), phase: 'extracting' as const };
    const meta = makeMetadata();
    const next = semanticPanelReducer(state, {
      type: 'EXTRACTION_COMPLETE',
      metadata: meta,
      warnings: ['test warning'],
    });
    expect(next.phase).toBe('complete');
    expect(next.metadata).toBe(meta);
    expect(next.warnings).toEqual(['test warning']);
  });

  it('handles error', () => {
    const state = createInitialPanelState();
    const next = semanticPanelReducer(state, { type: 'EXTRACTION_ERROR', error: 'fail' });
    expect(next.phase).toBe('error');
    expect(next.error).toBe('fail');
  });

  it('updates config', () => {
    const state = createInitialPanelState();
    const next = semanticPanelReducer(state, { type: 'UPDATE_CONFIG', config: { maxKeyFrames: 50 } });
    expect(next.config.maxKeyFrames).toBe(50);
  });

  it('selects key frame', () => {
    const state = createInitialPanelState();
    const next = semanticPanelReducer(state, { type: 'SELECT_KEY_FRAME', index: 2 });
    expect(next.selectedKeyFrameIndex).toBe(2);
  });

  it('sets transcript filter', () => {
    const state = createInitialPanelState();
    const next = semanticPanelReducer(state, { type: 'SET_TRANSCRIPT_FILTER', query: 'hello' });
    expect(next.transcriptFilter).toBe('hello');
  });

  it('toggles tags expanded', () => {
    const state = createInitialPanelState();
    expect(state.expandedTags).toBe(false);
    const next = semanticPanelReducer(state, { type: 'TOGGLE_TAGS_EXPANDED' });
    expect(next.expandedTags).toBe(true);
  });

  it('resets to initial state', () => {
    const state = { ...createInitialPanelState(), phase: 'complete' as const, error: 'test' };
    const next = semanticPanelReducer(state, { type: 'RESET' });
    expect(next.phase).toBe('idle');
    expect(next.error).toBeUndefined();
  });
});

// ─── Selectors ──────────────────────────────────────────────────

describe('getFilteredSegments', () => {
  it('returns all segments when no filter', () => {
    const state: SemanticPanelState = {
      ...createInitialPanelState(),
      phase: 'complete',
      metadata: makeMetadata(),
    };
    expect(getFilteredSegments(state)).toHaveLength(3);
  });

  it('filters by text', () => {
    const state: SemanticPanelState = {
      ...createInitialPanelState(),
      phase: 'complete',
      metadata: makeMetadata(),
      transcriptFilter: 'panel',
    };
    const segs = getFilteredSegments(state);
    expect(segs).toHaveLength(1);
    expect(segs[0].text).toContain('panel');
  });

  it('returns empty when no metadata', () => {
    expect(getFilteredSegments(createInitialPanelState())).toEqual([]);
  });
});

describe('getSelectedKeyFrame', () => {
  it('returns selected key frame', () => {
    const state: SemanticPanelState = {
      ...createInitialPanelState(),
      phase: 'complete',
      metadata: makeMetadata(),
      selectedKeyFrameIndex: 1,
    };
    const kf = getSelectedKeyFrame(state);
    expect(kf?.timeSec).toBe(5);
  });

  it('returns undefined when nothing selected', () => {
    const state: SemanticPanelState = {
      ...createInitialPanelState(),
      phase: 'complete',
      metadata: makeMetadata(),
    };
    expect(getSelectedKeyFrame(state)).toBeUndefined();
  });
});

describe('getProgressPercent', () => {
  it('returns 0 for idle', () => {
    expect(getProgressPercent(createInitialPanelState())).toBe(0);
  });

  it('returns 100 for complete', () => {
    const state = { ...createInitialPanelState(), phase: 'complete' as const };
    expect(getProgressPercent(state)).toBe(100);
  });

  it('returns progress value during extraction', () => {
    const state = {
      ...createInitialPanelState(),
      phase: 'extracting' as const,
      progress: { phase: 'asr' as const, progress: 75 },
    };
    expect(getProgressPercent(state)).toBe(75);
  });
});

describe('getProgressLabel', () => {
  it('returns Ready for idle', () => {
    expect(getProgressLabel(createInitialPanelState())).toBe('Ready');
  });

  it('returns phase-specific label', () => {
    const state = {
      ...createInitialPanelState(),
      phase: 'extracting' as const,
      progress: { phase: 'keyframes' as const, progress: 50 },
    };
    expect(getProgressLabel(state)).toContain('key frames');
  });
});

describe('getMetadataStats', () => {
  it('returns correct stats', () => {
    const stats = getMetadataStats(makeMetadata());
    expect(stats.keyFrameCount).toBe(3);
    expect(stats.segmentCount).toBe(3);
    expect(stats.duration).toBe('2:05');
    expect(stats.tagCount).toBe(3);
    expect(stats.wordCount).toBeGreaterThan(0);
  });
});
