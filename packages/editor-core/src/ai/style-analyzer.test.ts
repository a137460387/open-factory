import { describe, it, expect } from 'vitest';
import {
  extractProjectStyle,
  mergeStyleFingerprints,
  applyStyleToInstructions,
  computeStyleSimilarity,
  summaryToFingerprint,
  STYLE_FINGERPRINT_VERSION,
  type StyleFingerprint,
  type StyleTransitionPreference,
  type StyleRhythmProfile,
  type ColorGradingStyle,
  type AudioProcessingStyle,
  type EffectUsagePattern,
} from './style-analyzer';
import type { Project, Timeline, Track, Clip, Transition, TransitionType } from '../model-types';
import type { Effect } from '../effects';

// ─── Test Helpers ───────────────────────────────────────────────

function makeClip(overrides: Record<string, unknown> = {}): Clip {
  return {
    id: `clip-${Math.random().toString(36).slice(2, 6)}`,
    type: 'video',
    mediaId: 'media-1',
    trackId: 'track-1',
    startTime: 0,
    duration: 5,
    sourceIn: 0,
    sourceOut: 5,
    colorCorrection: { brightness: 0, contrast: 0, saturation: 0, hue: 0 },
    effects: [],
    ...overrides,
  } as unknown as Clip;
}

function makeTrack(clips: Clip[] = []): Track {
  return {
    id: `track-${Math.random().toString(36).slice(2, 6)}`,
    type: 'video',
    name: 'Video 1',
    clips,
  } as unknown as Track;
}

function makeTransition(overrides: Partial<Transition> = {}): Transition {
  return {
    id: `trans-${Math.random().toString(36).slice(2, 6)}`,
    type: 'dissolve' as TransitionType,
    duration: 0.5,
    fromClipId: 'clip-1',
    toClipId: 'clip-2',
    ...overrides,
  };
}

function makeTimeline(tracks: Track[] = [], transitions: Transition[] = []): Timeline {
  return {
    tracks,
    transitions,
  } as Timeline;
}

function makeProject(timeline: Timeline, name = 'Test Project'): Project {
  return {
    id: 'proj-1',
    name,
    version: '1.0',
    releaseVersion: '1.0.0',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    masterVolume: 1,
    settings: {} as never,
    media: [],
    mediaFolders: [],
    mediaMetadata: {},
    annotations: [],
    reviewAnnotations: [],
    collaborationNotes: [],
    timelineNotes: [],
    bookmarks: [],
    beatMarkers: [],
    exportRanges: [],
    protectedRanges: [],
    clipGroups: [],
    speakers: [],
    documentation: {},
    timeline,
    sequences: [],
    activeSequenceId: '',
  } as unknown as Project;
}

// ─── Tests ──────────────────────────────────────────────────────

describe('style-analyzer', () => {
  describe('extractProjectStyle', () => {
    it('returns null for projects with too few clips', () => {
      const track = makeTrack([makeClip()]);
      const timeline = makeTimeline([track]);
      const project = makeProject(timeline);
      expect(extractProjectStyle(project, { minClipCount: 3 })).toBeNull();
    });

    it('extracts style from a project with sufficient clips', () => {
      const clips = [
        makeClip({ duration: 3, colorCorrection: { brightness: 10, contrast: 5, saturation: -5, hue: 0 } }),
        makeClip({ duration: 5, colorCorrection: { brightness: 5, contrast: 10, saturation: 0, hue: 15 } }),
        makeClip({ duration: 2, colorCorrection: { brightness: -5, contrast: 0, saturation: 10, hue: -10 } }),
        makeClip({ duration: 4 }),
      ];
      const track = makeTrack(clips);
      const transitions = [
        makeTransition({ type: 'dissolve', duration: 0.5 }),
        makeTransition({ type: 'dissolve', duration: 0.8 }),
        makeTransition({ type: 'fade-black', duration: 0.3 }),
      ];
      const timeline = makeTimeline([track], transitions);
      const project = makeProject(timeline);

      const fp = extractProjectStyle(project);
      expect(fp).not.toBeNull();
      expect(fp!.version).toBe(STYLE_FINGERPRINT_VERSION);
      expect(fp!.totalClipCount).toBe(4);
      expect(fp!.analyzedProjectCount).toBe(1);
      expect(fp!.transitions.length).toBeGreaterThan(0);
      expect(fp!.transitions[0].type).toBe('dissolve');
      expect(fp!.transitions[0].count).toBe(2);
      expect(fp!.rhythm.avgClipDurationSec).toBeGreaterThan(0);
      expect(fp!.rhythm.cutsPerMinute).toBeGreaterThan(0);
      expect(fp!.tags.length).toBeGreaterThan(0);
    });

    it('handles empty transitions gracefully', () => {
      const clips = [makeClip({ duration: 3 }), makeClip({ duration: 5 }), makeClip({ duration: 2 })];
      const track = makeTrack(clips);
      const timeline = makeTimeline([track]);
      const project = makeProject(timeline);

      const fp = extractProjectStyle(project);
      expect(fp).not.toBeNull();
      expect(fp!.transitions).toEqual([]);
    });

    it('generates correct rhythm tags', () => {
      // Fast-paced: many short clips
      const clips = Array.from({ length: 20 }, () => makeClip({ duration: 1 }));
      const track = makeTrack(clips);
      const timeline = makeTimeline([track]);
      const project = makeProject(timeline);

      const fp = extractProjectStyle(project);
      expect(fp).not.toBeNull();
      expect(fp!.tags).toContain('fast-paced');
    });
  });

  describe('mergeStyleFingerprints', () => {
    it('returns null for empty array', () => {
      expect(mergeStyleFingerprints([])).toBeNull();
    });

    it('returns same fingerprint for single entry', () => {
      const clips = [makeClip({ duration: 3 }), makeClip({ duration: 5 }), makeClip({ duration: 2 })];
      const track = makeTrack(clips);
      const timeline = makeTimeline([track]);
      const fp = extractProjectStyle(makeProject(timeline))!;
      const merged = mergeStyleFingerprints([fp], 'Test Merged');
      expect(merged).not.toBeNull();
      expect(merged!.name).toBe('Test Merged');
      expect(merged!.totalClipCount).toBe(fp.totalClipCount);
    });

    it('merges multiple fingerprints weighted by clip count', () => {
      const clips1 = Array.from({ length: 5 }, () => makeClip({ duration: 3 }));
      const clips2 = Array.from({ length: 10 }, () => makeClip({ duration: 6 }));
      const fp1 = extractProjectStyle(makeProject(makeTimeline([makeTrack(clips1)])))!;
      const fp2 = extractProjectStyle(makeProject(makeTimeline([makeTrack(clips2)])))!;

      const merged = mergeStyleFingerprints([fp1, fp2])!;
      expect(merged.totalClipCount).toBe(15);
      expect(merged.analyzedProjectCount).toBe(2);
      // Weighted average should lean toward fp2 (more clips)
      expect(merged.rhythm.avgClipDurationSec).toBeGreaterThan(3);
    });
  });

  describe('applyStyleToInstructions', () => {
    it('applies transition preferences to instructions', () => {
      const style: StyleFingerprint = {
        version: STYLE_FINGERPRINT_VERSION,
        id: 'style-1',
        name: 'Test Style',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        analyzedProjectCount: 1,
        totalClipCount: 10,
        totalDurationSec: 60,
        transitions: [{ type: 'dissolve' as TransitionType, count: 5, avgDurationSec: 0.6, durationStddev: 0.1, ratio: 0.5 }],
        rhythm: { avgClipDurationSec: 3, clipDurationStddev: 1, cutsPerMinute: 20, regularity: 0.7, durationHistogram: [], shortClipRatio: 0.2, longClipRatio: 0.1 },
        colorGrading: { brightness: { mean: 0, stddev: 0, count: 0 }, contrast: { mean: 0, stddev: 0, count: 0 }, saturation: { mean: 0, stddev: 0, count: 0 }, hue: { mean: 0, stddev: 0, count: 0 }, preferredLutPath: null, lutUsageRatio: 0, temperatureTendency: 'neutral' },
        audioProcessing: { avgTargetLoudness: -14, loudnessStddev: 0, avgFadeInSec: 0.3, avgFadeOutSec: 0.5, musicSpeechRatio: 0.5, crossfadeRatio: 0.3 },
        effects: [],
        tags: [],
      };

      const instructions = [{ action: 'add_transition', params: {} }];
      const result = applyStyleToInstructions(instructions, style, 1.0);
      expect(result[0].params.type).toBe('dissolve');
      expect(result[0].params.duration).toBeCloseTo(0.6, 1);
    });

    it('applies audio fade preferences', () => {
      const style: StyleFingerprint = {
        version: STYLE_FINGERPRINT_VERSION,
        id: 'style-1',
        name: 'Test Style',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        analyzedProjectCount: 1,
        totalClipCount: 10,
        totalDurationSec: 60,
        transitions: [],
        rhythm: { avgClipDurationSec: 3, clipDurationStddev: 1, cutsPerMinute: 20, regularity: 0.7, durationHistogram: [], shortClipRatio: 0.2, longClipRatio: 0.1 },
        colorGrading: { brightness: { mean: 0, stddev: 0, count: 0 }, contrast: { mean: 0, stddev: 0, count: 0 }, saturation: { mean: 0, stddev: 0, count: 0 }, hue: { mean: 0, stddev: 0, count: 0 }, preferredLutPath: null, lutUsageRatio: 0, temperatureTendency: 'neutral' },
        audioProcessing: { avgTargetLoudness: -14, loudnessStddev: 0, avgFadeInSec: 0.5, avgFadeOutSec: 0.8, musicSpeechRatio: 0.5, crossfadeRatio: 0.3 },
        effects: [],
        tags: [],
      };

      const instructions = [{ action: 'adjust_audio', params: {} }];
      const result = applyStyleToInstructions(instructions, style, 1.0);
      expect(result[0].params.fadeIn).toBeCloseTo(0.5, 1);
      expect(result[0].params.fadeOut).toBeCloseTo(0.8, 1);
    });
  });

  describe('computeStyleSimilarity', () => {
    it('returns 1 for identical styles', () => {
      const clips = Array.from({ length: 5 }, () => makeClip({ duration: 4 }));
      const fp = extractProjectStyle(makeProject(makeTimeline([makeTrack(clips)])))!;
      expect(computeStyleSimilarity(fp, fp)).toBe(1);
    });

    it('returns a value between 0 and 1 for different styles', () => {
      const clips1 = Array.from({ length: 5 }, () => makeClip({ duration: 2 }));
      const clips2 = Array.from({ length: 5 }, () => makeClip({ duration: 10 }));
      const fp1 = extractProjectStyle(makeProject(makeTimeline([makeTrack(clips1)])))!;
      const fp2 = extractProjectStyle(makeProject(makeTimeline([makeTrack(clips2)])))!;
      const sim = computeStyleSimilarity(fp1, fp2);
      expect(sim).toBeGreaterThanOrEqual(0);
      expect(sim).toBeLessThanOrEqual(1);
    });
  });

  describe('summaryToFingerprint', () => {
    it('converts a StyleSummary to partial fingerprint', () => {
      const summary = {
        clipCount: 10,
        color: {
          brightness: { mean: 5, stddev: 2, count: 10 },
          contrast: { mean: 10, stddev: 3, count: 10 },
          saturation: { mean: -5, stddev: 1, count: 10 },
          hue: { mean: 0, stddev: 0, count: 10 },
        },
        lutPath: 'warm.cube',
        effects: [],
      };
      const partial = summaryToFingerprint(summary, 'Imported');
      expect(partial.name).toBe('Imported');
      expect(partial.totalClipCount).toBe(10);
      expect(partial.colorGrading?.preferredLutPath).toBe('warm.cube');
    });
  });
});
