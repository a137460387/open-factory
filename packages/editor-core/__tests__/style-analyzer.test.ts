import { describe, it, expect } from 'vitest';
import {
  STYLE_FINGERPRINT_VERSION,
  extractProjectStyle,
  mergeStyleFingerprints,
  applyStyleToInstructions,
  computeStyleSimilarity,
  summaryToFingerprint,
} from '../src/ai/style-analyzer';
import type { StyleFingerprint, StyleExtractionOptions } from '../src/ai/style-analyzer';
import type { Project, Timeline, Clip, Track, Transition } from '../src/model-types';

function makeClip(overrides: Partial<Clip> = {}): Clip {
  return {
    id: 'c1',
    type: 'video',
    start: 0,
    duration: 5,
    trimStart: 0,
    mediaId: 'm1',
    keyframes: {},
    ...overrides,
  } as Clip;
}

function makeTrack(clips: Clip[] = [makeClip()]): Track {
  return { id: 't1', type: 'video', clips, name: 'Track 1' } as Track;
}

function makeTimeline(tracks: Track[] = [makeTrack()], transitions: Transition[] = []): Timeline {
  return { tracks, duration: 60, transitions } as unknown as Timeline;
}

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'p1',
    name: 'Test Project',
    timeline: makeTimeline(),
    ...overrides,
  } as Project;
}

function makeFingerprint(overrides: Partial<StyleFingerprint> = {}): StyleFingerprint {
  return {
    version: STYLE_FINGERPRINT_VERSION,
    id: 'fp1',
    name: 'Test Style',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    analyzedProjectCount: 1,
    totalClipCount: 10,
    totalDurationSec: 60,
    transitions: [],
    rhythm: {
      avgClipDurationSec: 5,
      clipDurationStddev: 1,
      cutsPerMinute: 12,
      regularity: 0.8,
      durationHistogram: new Array(60).fill(0),
      shortClipRatio: 0.1,
      longClipRatio: 0.2,
    },
    colorGrading: {
      brightness: { mean: 0, stddev: 0, count: 10 },
      contrast: { mean: 0, stddev: 0, count: 10 },
      saturation: { mean: 0, stddev: 0, count: 10 },
      hue: { mean: 0, stddev: 0, count: 10 },
      preferredLutPath: null,
      lutUsageRatio: 0,
      temperatureTendency: 'neutral',
    },
    audioProcessing: {
      avgTargetLoudness: -14,
      loudnessStddev: 0,
      avgFadeInSec: 0,
      avgFadeOutSec: 0,
      musicSpeechRatio: 0.5,
      crossfadeRatio: 0,
    },
    effects: [],
    tags: [],
    ...overrides,
  };
}

describe('style-analyzer', () => {
  describe('extractProjectStyle', () => {
    it('returns null when clips < minClipCount', () => {
      const project = makeProject();
      const result = extractProjectStyle(project, { minClipCount: 100 });
      expect(result).toBeNull();
    });

    it('extracts style from project with enough clips', () => {
      const clips = Array.from({ length: 5 }, (_, i) => makeClip({ id: `c${i}`, start: i * 5, duration: 5 }));
      const project = makeProject({ timeline: makeTimeline([makeTrack(clips)]) });
      const result = extractProjectStyle(project);
      expect(result).not.toBeNull();
      expect(result!.version).toBe(STYLE_FINGERPRINT_VERSION);
      expect(result!.totalClipCount).toBe(5);
      expect(result!.rhythm.avgClipDurationSec).toBe(5);
      expect(result!.tags.length).toBeGreaterThan(0);
    });

    it('extracts transitions', () => {
      const transitions = [
        { id: 'tr1', type: 'crossfade' as any, duration: 1, fromClipId: 'c1', toClipId: 'c2' },
        { id: 'tr2', type: 'crossfade' as any, duration: 1.5, fromClipId: 'c2', toClipId: 'c3' },
      ];
      const clips = Array.from({ length: 5 }, (_, i) => makeClip({ id: `c${i}`, start: i * 5, duration: 5 }));
      const project = makeProject({ timeline: makeTimeline([makeTrack(clips)], transitions as any) });
      const result = extractProjectStyle(project);
      expect(result!.transitions.length).toBeGreaterThan(0);
      expect(result!.transitions[0].type).toBe('crossfade');
      expect(result!.transitions[0].count).toBe(2);
    });

    it('extracts effects from clips', () => {
      const clip = makeClip({
        effects: [
          { type: 'blur', enabled: true, params: { radius: 5 } },
          { type: 'blur', enabled: true, params: { radius: 10 } },
        ],
      } as Partial<Clip>);
      const project = makeProject({ timeline: makeTimeline([makeTrack([clip])]) });
      const result = extractProjectStyle(project, { minClipCount: 1 });
      expect(result!.effects.length).toBe(1);
      expect(result!.effects[0].type).toBe('blur');
      expect(result!.effects[0].totalCount).toBe(2);
    });

    it('handles empty timeline', () => {
      const project = makeProject({ timeline: makeTimeline([]) });
      const result = extractProjectStyle(project, { minClipCount: 0 });
      expect(result).not.toBeNull();
      expect(result!.totalClipCount).toBe(0);
      expect(result!.rhythm.cutsPerMinute).toBe(0);
    });
  });

  describe('mergeStyleFingerprints', () => {
    it('returns null for empty array', () => {
      expect(mergeStyleFingerprints([])).toBeNull();
    });

    it('returns single fingerprint with updated name', () => {
      const fp = makeFingerprint();
      const result = mergeStyleFingerprints([fp], 'Merged');
      expect(result!.name).toBe('Merged');
      expect(result!.totalClipCount).toBe(10);
    });

    it('merges multiple fingerprints', () => {
      const fp1 = makeFingerprint({ totalClipCount: 10, totalDurationSec: 60 });
      const fp2 = makeFingerprint({ totalClipCount: 20, totalDurationSec: 120 });
      const result = mergeStyleFingerprints([fp1, fp2]);
      expect(result!.totalClipCount).toBe(30);
      expect(result!.totalDurationSec).toBe(180);
      expect(result!.analyzedProjectCount).toBe(2);
    });

    it('merges transitions from multiple fingerprints', () => {
      const fp1 = makeFingerprint({
        transitions: [{ type: 'crossfade' as any, count: 5, avgDurationSec: 1, durationStddev: 0, ratio: 1 }],
      });
      const fp2 = makeFingerprint({
        transitions: [{ type: 'crossfade' as any, count: 3, avgDurationSec: 1.5, durationStddev: 0, ratio: 1 }],
      });
      const result = mergeStyleFingerprints([fp1, fp2]);
      expect(result!.transitions.length).toBe(1);
      expect(result!.transitions[0].count).toBe(8);
    });

    it('uses custom name', () => {
      const fp = makeFingerprint();
      const result = mergeStyleFingerprints([fp], 'Custom Name');
      expect(result!.name).toBe('Custom Name');
    });
  });

  describe('applyStyleToInstructions', () => {
    it('applies transition preferences', () => {
      const style = makeFingerprint({
        transitions: [{ type: 'crossfade' as any, count: 10, avgDurationSec: 1.5, durationStddev: 0, ratio: 1 }],
      });
      const instructions = [{ action: 'add_transition', params: {} }];
      const result = applyStyleToInstructions(instructions, style);
      expect(result[0].params.type).toBe('crossfade');
      expect(result[0].params.duration).toBeCloseTo(1.05, 1); // 1.5 * 0.7
    });

    it('applies audio fade preferences', () => {
      const style = makeFingerprint({
        audioProcessing: {
          avgTargetLoudness: -14, loudnessStddev: 0,
          avgFadeInSec: 0.5, avgFadeOutSec: 1.0,
          musicSpeechRatio: 0.5, crossfadeRatio: 0,
        },
      });
      const instructions = [{ action: 'adjust_audio', params: {} }];
      const result = applyStyleToInstructions(instructions, style);
      expect(result[0].params.fadeIn).toBeCloseTo(0.35, 1); // 0.5 * 0.7
      expect(result[0].params.fadeOut).toBeCloseTo(0.7, 1); // 1.0 * 0.7
    });

    it('applies effect preferences', () => {
      const style = makeFingerprint({
        effects: [{ type: 'blur', totalCount: 5, ratio: 1, avgParams: { radius: 10 }, typicallyEnabled: true }],
      });
      const instructions = [{ action: 'add_effect', params: {} }];
      const result = applyStyleToInstructions(instructions, style);
      expect(result[0].params.effectType).toBe('blur');
      expect(result[0].params.enabled).toBe(true);
    });

    it('does not overwrite existing params', () => {
      const style = makeFingerprint({
        transitions: [{ type: 'crossfade' as any, count: 10, avgDurationSec: 1.5, durationStddev: 0, ratio: 1 }],
      });
      const instructions = [{ action: 'add_transition', params: { type: 'dissolve' } }];
      const result = applyStyleToInstructions(instructions, style);
      expect(result[0].params.type).toBe('dissolve');
    });

    it('respects strength parameter', () => {
      const style = makeFingerprint({
        transitions: [{ type: 'crossfade' as any, count: 10, avgDurationSec: 2, durationStddev: 0, ratio: 1 }],
      });
      const instructions = [{ action: 'add_transition', params: {} }];
      const result = applyStyleToInstructions(instructions, style, 0.5);
      expect(result[0].params.duration).toBeCloseTo(1.0, 1); // 2 * 0.5
    });

    it('passes through unrelated actions unchanged', () => {
      const style = makeFingerprint();
      const instructions = [{ action: 'trim_clip', params: { start: 1, end: 5 } }];
      const result = applyStyleToInstructions(instructions, style);
      expect(result[0].params.start).toBe(1);
      expect(result[0].params.end).toBe(5);
    });
  });

  describe('computeStyleSimilarity', () => {
    it('returns 1 for identical fingerprints', () => {
      const fp = makeFingerprint();
      expect(computeStyleSimilarity(fp, fp)).toBe(1);
    });

    it('returns lower similarity for different fingerprints', () => {
      const fp1 = makeFingerprint({
        rhythm: { ...makeFingerprint().rhythm, avgClipDurationSec: 2, cutsPerMinute: 30 },
        colorGrading: {
          ...makeFingerprint().colorGrading,
          brightness: { mean: 50, stddev: 0, count: 10 },
        },
      });
      const fp2 = makeFingerprint({
        rhythm: { ...makeFingerprint().rhythm, avgClipDurationSec: 10, cutsPerMinute: 5 },
        colorGrading: {
          ...makeFingerprint().colorGrading,
          brightness: { mean: -50, stddev: 0, count: 10 },
        },
      });
      const similarity = computeStyleSimilarity(fp1, fp2);
      expect(similarity).toBeLessThan(1);
      expect(similarity).toBeGreaterThanOrEqual(0);
    });

    it('accounts for transition overlap', () => {
      const fp1 = makeFingerprint({
        transitions: [{ type: 'crossfade' as any, count: 5, avgDurationSec: 1, durationStddev: 0, ratio: 1 }],
      });
      const fp2 = makeFingerprint({
        transitions: [{ type: 'dissolve' as any, count: 5, avgDurationSec: 1, durationStddev: 0, ratio: 1 }],
      });
      const similarity = computeStyleSimilarity(fp1, fp2);
      expect(similarity).toBeLessThan(1);
    });
  });

  describe('summaryToFingerprint', () => {
    it('converts summary to partial fingerprint', () => {
      const summary = {
        clipCount: 10,
        color: {
          brightness: { mean: 0, stddev: 0, count: 10 },
          contrast: { mean: 0, stddev: 0, count: 10 },
          saturation: { mean: 0, stddev: 0, count: 10 },
          hue: { mean: 0, stddev: 0, count: 10 },
        },
        effects: [],
      } as any;
      const result = summaryToFingerprint(summary, 'My Style');
      expect(result.name).toBe('My Style');
      expect(result.totalClipCount).toBe(10);
      expect(result.version).toBe(STYLE_FINGERPRINT_VERSION);
    });

    it('uses default name', () => {
      const summary = { clipCount: 5, color: { brightness: { mean: 0, stddev: 0, count: 5 }, contrast: { mean: 0, stddev: 0, count: 5 }, saturation: { mean: 0, stddev: 0, count: 5 }, hue: { mean: 0, stddev: 0, count: 5 } }, effects: [] } as any;
      const result = summaryToFingerprint(summary);
      expect(result.name).toBe('Imported Style');
    });
  });
});
