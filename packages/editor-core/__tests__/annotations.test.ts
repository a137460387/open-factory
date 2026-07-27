import { describe, it, expect } from 'vitest';
import {
  normalizeTimelineMarkerTime,
  normalizeTimelinePointTime,
  normalizeTimelineMarkerLabel,
  normalizeTimelineBookmarkNote,
  normalizeBookmarkAnnotation,
  normalizeTimelineMarkerColor,
  normalizeProjectAnnotationText,
  normalizeReviewAnnotationText,
  normalizeCollaborationNoteText,
  normalizeCollaborationAuthorName,
  normalizeTimelineNoteText,
  normalizeCollaborationNoteType,
  normalizeReviewAnnotationType,
  normalizeReviewAnnotationUnit,
  normalizeReviewAnnotationDimension,
  normalizeTimelineNoteColor,
  normalizeIsoDate,
  normalizeExportRangeLabel,
  normalizeProtectedRangeLabel,
  normalizeHexColor,
  normalizeLutPath,
  normalizeLutLayers,
  normalizeClipAIReframe,
  normalizeAnomalyIntervals,
  normalizeSubtitleSpeakerId,
  normalizeSpeakerLabels,
  cloneClipKeyframesLocal,
  normalizePrivacyRedactions,
  normalizeAILookMatch,
  normalizeAiPipSuggestion,
  normalizePlatformFitSuggestion,
  normalizeFlashWarnings,
} from '../src/model/annotations';

describe('normalizeTimelineMarkerTime', () => {
  it('clamps to maxTime when provided', () => {
    expect(normalizeTimelineMarkerTime(100, 50)).toBe(50);
  });

  it('clamps negative when maxTime is 0', () => {
    expect(normalizeTimelineMarkerTime(-5, 0)).toBe(0);
  });

  it('returns 0 for non-finite', () => {
    expect(normalizeTimelineMarkerTime(NaN)).toBe(0);
    expect(normalizeTimelineMarkerTime(Infinity)).toBe(0);
  });

  it('returns valid time as-is', () => {
    expect(normalizeTimelineMarkerTime(10, 100)).toBe(10);
  });
});

describe('normalizeTimelineMarkerLabel', () => {
  it('trims and truncates', () => {
    expect(normalizeTimelineMarkerLabel('  hello  ')).toBe('hello');
    expect(normalizeTimelineMarkerLabel('a'.repeat(100))).toHaveLength(80);
  });

  it('returns Marker for empty/undefined', () => {
    expect(normalizeTimelineMarkerLabel(undefined)).toBe('Marker');
    expect(normalizeTimelineMarkerLabel('')).toBe('Marker');
    expect(normalizeTimelineMarkerLabel('   ')).toBe('Marker');
  });
});

describe('normalizeTimelineBookmarkNote', () => {
  it('truncates to 120 chars', () => {
    expect(normalizeTimelineBookmarkNote('a'.repeat(200))).toHaveLength(120);
  });

  it('returns Bookmark for empty', () => {
    expect(normalizeTimelineBookmarkNote(undefined)).toBe('Bookmark');
    expect(normalizeTimelineBookmarkNote('')).toBe('Bookmark');
  });
});

describe('normalizeBookmarkAnnotation', () => {
  it('truncates to 50 chars', () => {
    expect(normalizeBookmarkAnnotation('a'.repeat(100))).toHaveLength(50);
  });

  it('returns undefined for empty', () => {
    expect(normalizeBookmarkAnnotation(undefined)).toBeUndefined();
    expect(normalizeBookmarkAnnotation('')).toBeUndefined();
    expect(normalizeBookmarkAnnotation('   ')).toBeUndefined();
  });
});

describe('normalizeHexColor', () => {
  it('returns valid 6-digit hex', () => {
    expect(normalizeHexColor('#ABCDEF', '#000000')).toBe('#abcdef');
  });

  it('expands 3-digit hex', () => {
    expect(normalizeHexColor('#abc', '#000000')).toBe('#aabbcc');
  });

  it('returns fallback for invalid', () => {
    expect(normalizeHexColor('invalid', '#000000')).toBe('#000000');
    expect(normalizeHexColor(undefined, '#000000')).toBe('#000000');
    expect(normalizeHexColor('', '#000000')).toBe('#000000');
  });
});

describe('normalizeProjectAnnotationText', () => {
  it('truncates to 240 chars', () => {
    expect(normalizeProjectAnnotationText('a'.repeat(300))).toHaveLength(240);
  });

  it('returns Annotation for empty', () => {
    expect(normalizeProjectAnnotationText(undefined)).toBe('Annotation');
    expect(normalizeProjectAnnotationText('')).toBe('Annotation');
  });
});

describe('normalizeReviewAnnotationText', () => {
  it('returns Review annotation for empty', () => {
    expect(normalizeReviewAnnotationText(undefined)).toBe('Review annotation');
  });
});

describe('normalizeCollaborationNoteText', () => {
  it('truncates to 2000 chars', () => {
    expect(normalizeCollaborationNoteText('a'.repeat(3000))).toHaveLength(2000);
  });

  it('returns default for empty', () => {
    expect(normalizeCollaborationNoteText(undefined)).toBe('Collaboration note');
  });
});

describe('normalizeCollaborationAuthorName', () => {
  it('truncates to 80 chars', () => {
    expect(normalizeCollaborationAuthorName('a'.repeat(100))).toHaveLength(80);
  });
});

describe('normalizeTimelineNoteText', () => {
  it('returns default for empty', () => {
    expect(normalizeTimelineNoteText(undefined)).toBe('Timeline note');
  });
});

describe('normalizeCollaborationNoteType', () => {
  it('accepts valid types', () => {
    expect(normalizeCollaborationNoteType('highlight')).toBe('highlight');
    expect(normalizeCollaborationNoteType('replacement')).toBe('replacement');
    expect(normalizeCollaborationNoteType('comment')).toBe('comment');
  });

  it('defaults to comment', () => {
    expect(normalizeCollaborationNoteType(undefined)).toBe('comment');
    expect(normalizeCollaborationNoteType('invalid' as never)).toBe('comment');
  });
});

describe('normalizeReviewAnnotationType', () => {
  it('accepts valid types', () => {
    expect(normalizeReviewAnnotationType('rectangle')).toBe('rectangle');
    expect(normalizeReviewAnnotationType('arrow')).toBe('arrow');
    expect(normalizeReviewAnnotationType('text')).toBe('text');
  });

  it('defaults to text', () => {
    expect(normalizeReviewAnnotationType(undefined)).toBe('text');
    expect(normalizeReviewAnnotationType('circle' as never)).toBe('text');
  });
});

describe('normalizeReviewAnnotationUnit', () => {
  it('clamps to [0, 1]', () => {
    expect(normalizeReviewAnnotationUnit(0.5, 0)).toBe(0.5);
    expect(normalizeReviewAnnotationUnit(-1, 0)).toBe(0);
    expect(normalizeReviewAnnotationUnit(2, 0)).toBe(1);
  });

  it('returns fallback for undefined', () => {
    expect(normalizeReviewAnnotationUnit(undefined, 0.3)).toBe(0.3);
  });
});

describe('normalizeReviewAnnotationDimension', () => {
  it('handles text type', () => {
    const w = normalizeReviewAnnotationDimension(undefined, 'text', 'width');
    expect(w).toBeGreaterThan(0);
    expect(w).toBeLessThanOrEqual(1);
  });

  it('handles arrow type (allows negative)', () => {
    const w = normalizeReviewAnnotationDimension(-0.5, 'arrow', 'width');
    expect(w).toBe(-0.5);
  });

  it('handles rectangle type', () => {
    const h = normalizeReviewAnnotationDimension(0.5, 'rectangle', 'height');
    expect(h).toBe(0.5);
  });
});

describe('normalizeTimelineNoteColor', () => {
  it('accepts valid note colors', () => {
    const result = normalizeTimelineNoteColor('#ef4444');
    // Should be one of the valid TIMELINE_NOTE_COLORS
    expect(result).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('returns default for invalid', () => {
    const result = normalizeTimelineNoteColor('#xyzxyz');
    expect(result).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe('normalizeIsoDate', () => {
  it('returns valid ISO date', () => {
    const result = normalizeIsoDate('2024-01-15T10:30:00Z');
    expect(result).toBe('2024-01-15T10:30:00.000Z');
  });

  it('returns now for invalid', () => {
    const before = Date.now();
    const result = normalizeIsoDate(undefined);
    const parsed = new Date(result).getTime();
    expect(parsed).toBeGreaterThanOrEqual(before - 1000);
  });

  it('returns now for garbage', () => {
    const result = normalizeIsoDate('not-a-date');
    expect(Number.isFinite(Date.parse(result))).toBe(true);
  });
});

describe('normalizeExportRangeLabel', () => {
  it('truncates to 80', () => {
    expect(normalizeExportRangeLabel('a'.repeat(100))).toHaveLength(80);
  });

  it('returns default for empty', () => {
    expect(normalizeExportRangeLabel(undefined)).toBe('Export Range');
    expect(normalizeExportRangeLabel('')).toBe('Export Range');
  });
});

describe('normalizeProtectedRangeLabel', () => {
  it('returns default for empty', () => {
    expect(normalizeProtectedRangeLabel(undefined)).toBe('Protected Range');
  });
});

describe('normalizeLutPath', () => {
  it('returns null for empty', () => {
    expect(normalizeLutPath(null)).toBeNull();
    expect(normalizeLutPath(undefined)).toBeNull();
    expect(normalizeLutPath('')).toBeNull();
    expect(normalizeLutPath('   ')).toBeNull();
  });

  it('returns trimmed path', () => {
    expect(normalizeLutPath('  /path/to/lut.cube  ')).toBe('/path/to/lut.cube');
  });
});

describe('normalizeLutLayers', () => {
  it('normalizes provided luts', () => {
    const result = normalizeLutLayers([
      { path: '/a.cube', intensity: 0.5 },
      { path: '/b.cube', intensity: 1.5 },
    ]);
    expect(result).toHaveLength(2);
    expect(result[0].intensity).toBe(0.5);
    expect(result[1].intensity).toBe(1); // clamped
  });

  it('limits to 3 luts', () => {
    const result = normalizeLutLayers([
      { path: '/a.cube', intensity: 1 },
      { path: '/b.cube', intensity: 1 },
      { path: '/c.cube', intensity: 1 },
      { path: '/d.cube', intensity: 1 },
    ]);
    expect(result).toHaveLength(3);
  });

  it('falls back to lutPath', () => {
    const result = normalizeLutLayers(undefined, '/legacy.cube');
    expect(result).toEqual([{ path: '/legacy.cube', intensity: 1 }]);
  });

  it('returns empty for nothing', () => {
    expect(normalizeLutLayers(undefined)).toEqual([]);
    expect(normalizeLutLayers([])).toEqual([]);
  });
});

describe('normalizeClipAIReframe', () => {
  it('returns undefined for invalid input', () => {
    expect(normalizeClipAIReframe(null)).toBeUndefined();
    expect(normalizeClipAIReframe(undefined)).toBeUndefined();
    expect(normalizeClipAIReframe('string')).toBeUndefined();
  });

  it('returns undefined for missing keyframes', () => {
    expect(normalizeClipAIReframe({ targetAspect: '16:9', confidence: 0.8, generatedAt: 1000 })).toBeUndefined();
  });

  it('parses valid reframe data', () => {
    const result = normalizeClipAIReframe({
      targetAspect: '9:16',
      confidence: 0.9,
      generatedAt: 1000,
      keyframes: [{ time: 0, cropX: 0.1, cropY: 0.2, cropW: 0.8, cropH: 0.9 }],
    });
    expect(result).toBeDefined();
    expect(result!.targetAspect).toBe('9:16');
    expect(result!.keyframes).toHaveLength(1);
    expect(result!.confidence).toBe(0.9);
  });

  it('clamps confidence to [0, 1]', () => {
    const result = normalizeClipAIReframe({
      targetAspect: '16:9',
      confidence: 1.5,
      generatedAt: 1000,
      keyframes: [{ time: 0, cropX: 0, cropY: 0, cropW: 1, cropH: 1 }],
    });
    expect(result!.confidence).toBe(1);
  });
});

describe('normalizeAnomalyIntervals', () => {
  it('returns empty for non-array', () => {
    expect(normalizeAnomalyIntervals(null)).toEqual([]);
    expect(normalizeAnomalyIntervals(undefined)).toEqual([]);
  });

  it('filters invalid items', () => {
    const result = normalizeAnomalyIntervals([
      { type: 'black', startTime: 0, endTime: 5, severity: 'high' },
      { type: 'invalid', startTime: 0, endTime: 5, severity: 'high' },
      { type: 'static', startTime: 5, endTime: 3, severity: 'medium' }, // end < start
      'not an object',
    ]);
    expect(result).toHaveLength(1);
  });

  it('parses valid intervals', () => {
    const result = normalizeAnomalyIntervals([
      { type: 'black', startTime: 1, endTime: 3, severity: 'medium' },
      { type: 'static', startTime: 5, endTime: 10, severity: 'low' },
    ]);
    expect(result).toHaveLength(2);
    expect(result[0].type).toBe('black');
    expect(result[1].type).toBe('static');
  });
});

describe('normalizeSubtitleSpeakerId', () => {
  it('returns valid non-negative integer', () => {
    expect(normalizeSubtitleSpeakerId(0)).toBe(0);
    expect(normalizeSubtitleSpeakerId(5)).toBe(5);
  });

  it('returns undefined for invalid', () => {
    expect(normalizeSubtitleSpeakerId(-1)).toBeUndefined();
    expect(normalizeSubtitleSpeakerId(1.5)).toBeUndefined();
    expect(normalizeSubtitleSpeakerId(NaN)).toBeUndefined();
    expect(normalizeSubtitleSpeakerId('5' as never)).toBeUndefined();
  });
});

describe('normalizeSpeakerLabels', () => {
  it('returns undefined for non-object', () => {
    expect(normalizeSpeakerLabels(null)).toBeUndefined();
    expect(normalizeSpeakerLabels(undefined)).toBeUndefined();
  });

  it('filters invalid keys/values', () => {
    const result = normalizeSpeakerLabels({ '-1': 'A', 'abc': 'B', '0': 'Speaker 0', '1.5': 'C' });
    expect(result).toEqual({ 0: 'Speaker 0' });
  });

  it('returns undefined for no valid entries', () => {
    expect(normalizeSpeakerLabels({ abc: 123 })).toBeUndefined();
  });
});

describe('cloneClipKeyframesLocal', () => {
  it('returns undefined for undefined input', () => {
    expect(cloneClipKeyframesLocal(undefined)).toBeUndefined();
  });

  it('clones keyframes with handles', () => {
    const input = {
      opacity: [
        { time: 0, value: 1, inHandle: { x: 0, y: 0 }, outHandle: { x: 1, y: 1 } },
        { time: 5, value: 0 },
      ],
    };
    const result = cloneClipKeyframesLocal(input);
    expect(result).toBeDefined();
    expect(result!.opacity).toHaveLength(2);
    // Should be deep clone
    expect(result!.opacity![0].inHandle).not.toBe(input.opacity[0].inHandle);
  });

  it('returns undefined for empty keyframes', () => {
    expect(cloneClipKeyframesLocal({})).toBeUndefined();
    expect(cloneClipKeyframesLocal({ opacity: [] })).toBeUndefined();
  });
});

describe('normalizePrivacyRedactions', () => {
  it('returns empty for non-array', () => {
    expect(normalizePrivacyRedactions(null)).toEqual([]);
  });

  it('filters invalid items', () => {
    const result = normalizePrivacyRedactions([
      { id: 'r1', type: 'face', keyframes: [], blurStrength: 0.5 },
      { id: 'r2', type: 'invalid', keyframes: [] },
      { noId: true, type: 'face' },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('r1');
  });

  it('normalizes keyframes', () => {
    const result = normalizePrivacyRedactions([{
      id: 'r1',
      type: 'face',
      keyframes: [
        { time: 5, x: 0.1, y: 0.2, w: 0.3, h: 0.4 },
        { time: 10, x: 0.5, y: 0.6, w: 0.7, h: 0.8 },
      ],
      blurStrength: 2, // clamped to 1
    }]);
    expect(result[0].keyframes).toHaveLength(2);
    // keyframes are sorted by time
    expect(result[0].keyframes[0].time).toBe(5);
    expect(result[0].keyframes[1].time).toBe(10);
    expect(result[0].blurStrength).toBe(1); // clamped
    expect(result[0].enabled).toBe(true); // default
  });
});

describe('normalizeAILookMatch', () => {
  it('returns undefined for invalid', () => {
    expect(normalizeAILookMatch(null)).toBeUndefined();
    expect(normalizeAILookMatch({})).toBeUndefined();
  });

  it('parses valid look match', () => {
    const result = normalizeAILookMatch({
      sourceImageHash: 'abc123',
      wheelAdjustments: {
        lift: { r: 0.1, g: -0.2, b: 0 },
        gamma: { r: 0, g: 0, b: 0 },
        gain: { r: 0, g: 0, b: 0 },
      },
      confidence: 0.85,
      generatedAt: '2024-01-01',
      blendStrength: 80,
    });
    expect(result).toBeDefined();
    expect(result!.sourceImageHash).toBe('abc123');
    expect(result!.confidence).toBe(0.85);
    expect(result!.blendStrength).toBe(80);
  });
});

describe('normalizeAiPipSuggestion', () => {
  it('returns undefined for invalid', () => {
    expect(normalizeAiPipSuggestion(null)).toBeUndefined();
  });

  it('defaults corner to bottom-right', () => {
    const result = normalizeAiPipSuggestion({ overlapReduction: 50, confidence: 0.7 });
    expect(result!.recommendedCorner).toBe('bottom-right');
  });

  it('accepts valid corners', () => {
    const result = normalizeAiPipSuggestion({ recommendedCorner: 'top-left' });
    expect(result!.recommendedCorner).toBe('top-left');
  });
});

describe('normalizePlatformFitSuggestion', () => {
  it('returns undefined for invalid', () => {
    expect(normalizePlatformFitSuggestion(null)).toBeUndefined();
  });

  it('defaults to custom platform', () => {
    const result = normalizePlatformFitSuggestion({
      limitSeconds: 30,
      keptSegments: [],
      removedSegments: [],
    });
    expect(result!.targetPlatform).toBe('custom');
    expect(result!.limitSeconds).toBe(30);
  });

  it('accepts valid platforms', () => {
    const result = normalizePlatformFitSuggestion({
      targetPlatform: 'tiktok',
      limitSeconds: 60,
      keptSegments: [{ clipId: 'c1', start: 0, end: 5, score: 0.8 }],
      removedSegments: [],
    });
    expect(result!.targetPlatform).toBe('tiktok');
    expect(result!.keptSegments).toHaveLength(1);
  });
});

describe('normalizeFlashWarnings', () => {
  it('returns empty for non-array', () => {
    expect(normalizeFlashWarnings(null)).toEqual([]);
  });

  it('filters invalid items', () => {
    const result = normalizeFlashWarnings([
      { startTime: 0, endTime: 5, flashRate: 3, severity: 'high', isRedFlash: true },
      { startTime: 0, endTime: 5 }, // missing fields
    ]);
    expect(result).toHaveLength(1);
  });
});
