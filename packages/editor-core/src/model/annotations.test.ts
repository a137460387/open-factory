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
} from './annotations';

describe('normalizeTimelinePointTime', () => {
  it('preserves negative values when no maxTime', () => {
    expect(normalizeTimelinePointTime(-5)).toBe(-5);
  });

  it('clamps to maxTime', () => {
    expect(normalizeTimelinePointTime(100, 50)).toBe(50);
  });

  it('clamps negative maxTime to 0', () => {
    expect(normalizeTimelinePointTime(10, -5)).toBe(0);
  });

  it('returns 0 for NaN', () => {
    expect(normalizeTimelinePointTime(NaN)).toBe(0);
  });

  it('returns 0 for Infinity', () => {
    expect(normalizeTimelinePointTime(Infinity)).toBe(0);
  });

  it('returns valid time as-is', () => {
    expect(normalizeTimelinePointTime(10)).toBe(10);
  });

  it('uses maxTime only when finite', () => {
    expect(normalizeTimelinePointTime(10, Infinity)).toBe(10);
  });
});

describe('normalizeTimelineMarkerTime', () => {
  it('delegates to normalizeTimelinePointTime', () => {
    expect(normalizeTimelineMarkerTime(5)).toBe(5);
    expect(normalizeTimelineMarkerTime(-1)).toBe(-1);
  });
});

describe('normalizeTimelineMarkerLabel', () => {
  it('returns trimmed label', () => {
    expect(normalizeTimelineMarkerLabel('  hello  ')).toBe('hello');
  });

  it('truncates to 80 chars', () => {
    const long = 'a'.repeat(100);
    expect(normalizeTimelineMarkerLabel(long).length).toBe(80);
  });

  it('returns fallback for empty', () => {
    expect(normalizeTimelineMarkerLabel(undefined)).toBe('Marker');
    expect(normalizeTimelineMarkerLabel('')).toBe('Marker');
    expect(normalizeTimelineMarkerLabel('   ')).toBe('Marker');
  });
});

describe('normalizeTimelineBookmarkNote', () => {
  it('returns trimmed note', () => {
    expect(normalizeTimelineBookmarkNote('  test  ')).toBe('test');
  });

  it('truncates to 120 chars', () => {
    expect(normalizeTimelineBookmarkNote('a'.repeat(200)).length).toBe(120);
  });

  it('returns fallback for empty', () => {
    expect(normalizeTimelineBookmarkNote(undefined)).toBe('Bookmark');
  });
});

describe('normalizeBookmarkAnnotation', () => {
  it('returns trimmed annotation', () => {
    expect(normalizeBookmarkAnnotation('  note  ')).toBe('note');
  });

  it('truncates to 50 chars', () => {
    expect(normalizeBookmarkAnnotation('a'.repeat(100))!.length).toBe(50);
  });

  it('returns undefined for empty', () => {
    expect(normalizeBookmarkAnnotation(undefined)).toBeUndefined();
    expect(normalizeBookmarkAnnotation('')).toBeUndefined();
  });
});

describe('normalizeTimelineMarkerColor', () => {
  it('returns valid hex color', () => {
    expect(normalizeTimelineMarkerColor('#ff0000')).toBe('#ff0000');
  });

  it('returns default for invalid', () => {
    const result = normalizeTimelineMarkerColor('invalid');
    expect(result).toMatch(/^#/);
  });

  it('returns default for undefined', () => {
    const result = normalizeTimelineMarkerColor(undefined);
    expect(result).toMatch(/^#/);
  });
});

describe('normalizeProjectAnnotationText', () => {
  it('returns trimmed text', () => {
    expect(normalizeProjectAnnotationText('  hello  ')).toBe('hello');
  });

  it('truncates to 240 chars', () => {
    expect(normalizeProjectAnnotationText('a'.repeat(300)).length).toBe(240);
  });

  it('returns fallback for empty', () => {
    expect(normalizeProjectAnnotationText(undefined)).toBe('Annotation');
  });
});

describe('normalizeReviewAnnotationText', () => {
  it('returns trimmed text', () => {
    expect(normalizeReviewAnnotationText('  test  ')).toBe('test');
  });

  it('returns fallback for empty', () => {
    expect(normalizeReviewAnnotationText(undefined)).toBe('Review annotation');
  });
});

describe('normalizeCollaborationNoteText', () => {
  it('returns trimmed text', () => {
    expect(normalizeCollaborationNoteText('  note  ')).toBe('note');
  });

  it('truncates to 2000 chars', () => {
    expect(normalizeCollaborationNoteText('a'.repeat(3000)).length).toBe(2000);
  });

  it('returns fallback for empty', () => {
    expect(normalizeCollaborationNoteText(undefined)).toBe('Collaboration note');
  });
});

describe('normalizeCollaborationAuthorName', () => {
  it('returns trimmed name', () => {
    expect(normalizeCollaborationAuthorName('  Alice  ')).toBe('Alice');
  });

  it('returns default for empty', () => {
    expect(normalizeCollaborationAuthorName(undefined)).toBeTruthy();
  });
});

describe('normalizeTimelineNoteText', () => {
  it('returns trimmed text', () => {
    expect(normalizeTimelineNoteText('  note  ')).toBe('note');
  });

  it('returns fallback for empty', () => {
    expect(normalizeTimelineNoteText(undefined)).toBe('Timeline note');
  });
});

describe('normalizeCollaborationNoteType', () => {
  it('returns valid types', () => {
    expect(normalizeCollaborationNoteType('comment')).toBe('comment');
    expect(normalizeCollaborationNoteType('highlight')).toBe('highlight');
    expect(normalizeCollaborationNoteType('replacement')).toBe('replacement');
  });

  it('defaults to comment', () => {
    expect(normalizeCollaborationNoteType(undefined)).toBe('comment');
    expect(normalizeCollaborationNoteType('invalid' as never)).toBe('comment');
  });
});

describe('normalizeReviewAnnotationType', () => {
  it('returns valid types', () => {
    expect(normalizeReviewAnnotationType('rectangle')).toBe('rectangle');
    expect(normalizeReviewAnnotationType('arrow')).toBe('arrow');
    expect(normalizeReviewAnnotationType('text')).toBe('text');
  });

  it('defaults to text', () => {
    expect(normalizeReviewAnnotationType(undefined)).toBe('text');
  });
});

describe('normalizeReviewAnnotationUnit', () => {
  it('clamps to [0, 1]', () => {
    expect(normalizeReviewAnnotationUnit(-0.5, 0)).toBe(0);
    expect(normalizeReviewAnnotationUnit(1.5, 0)).toBe(1);
  });

  it('returns fallback for undefined', () => {
    expect(normalizeReviewAnnotationUnit(undefined, 0.5)).toBe(0.5);
  });

  it('returns fallback for NaN', () => {
    expect(normalizeReviewAnnotationUnit(NaN, 0.3)).toBe(0.3);
  });
});

describe('normalizeReviewAnnotationDimension', () => {
  it('clamps arrow to [-1, 1]', () => {
    expect(normalizeReviewAnnotationDimension(2, 'arrow', 'width')).toBe(1);
    expect(normalizeReviewAnnotationDimension(-2, 'arrow', 'width')).toBe(-1);
  });

  it('clamps rectangle to [0.01, 1]', () => {
    // 0 is falsy, so fallback is used
    expect(normalizeReviewAnnotationDimension(0, 'rectangle', 'width')).toBeCloseTo(0.18, 2);
    expect(normalizeReviewAnnotationDimension(2, 'rectangle', 'width')).toBe(1);
    expect(normalizeReviewAnnotationDimension(0.001, 'rectangle', 'width')).toBe(0.01);
  });

  it('handles text type with fallback', () => {
    const result = normalizeReviewAnnotationDimension(undefined, 'text', 'width');
    expect(result).toBeGreaterThan(0);
  });
});

describe('normalizeTimelineNoteColor', () => {
  it('returns valid color from known set', () => {
    const result = normalizeTimelineNoteColor('#ff0000');
    expect(result).toMatch(/^#/);
  });

  it('returns default for invalid', () => {
    const result = normalizeTimelineNoteColor('invalid');
    expect(result).toMatch(/^#/);
  });
});

describe('normalizeIsoDate', () => {
  it('returns ISO string for valid date', () => {
    const result = normalizeIsoDate('2024-01-15');
    expect(result).toContain('2024-01-15');
  });

  it('returns current date for invalid', () => {
    const result = normalizeIsoDate('invalid');
    expect(result).toBeTruthy();
    expect(Number.isFinite(Date.parse(result))).toBe(true);
  });

  it('returns current date for undefined', () => {
    const result = normalizeIsoDate(undefined);
    expect(Number.isFinite(Date.parse(result))).toBe(true);
  });
});

describe('normalizeExportRangeLabel', () => {
  it('returns trimmed label', () => {
    expect(normalizeExportRangeLabel('  range  ')).toBe('range');
  });

  it('returns fallback for empty', () => {
    expect(normalizeExportRangeLabel(undefined)).toBe('Export Range');
  });
});

describe('normalizeProtectedRangeLabel', () => {
  it('returns trimmed label', () => {
    expect(normalizeProtectedRangeLabel('  protected  ')).toBe('protected');
  });

  it('returns fallback for empty', () => {
    expect(normalizeProtectedRangeLabel(undefined)).toBe('Protected Range');
  });
});

describe('normalizeHexColor', () => {
  it('normalizes 6-digit hex', () => {
    expect(normalizeHexColor('#FF0000', '#000')).toBe('#ff0000');
  });

  it('normalizes 3-digit hex', () => {
    expect(normalizeHexColor('#f00', '#000')).toBe('#ff0000');
  });

  it('returns fallback for invalid', () => {
    expect(normalizeHexColor('invalid', '#000')).toBe('#000');
  });

  it('returns fallback for undefined', () => {
    expect(normalizeHexColor(undefined, '#000')).toBe('#000');
  });

  it('returns fallback for empty string', () => {
    expect(normalizeHexColor('', '#000')).toBe('#000');
  });
});

describe('normalizeLutPath', () => {
  it('returns trimmed path', () => {
    expect(normalizeLutPath('  /path/to/lut  ')).toBe('/path/to/lut');
  });

  it('returns null for empty', () => {
    expect(normalizeLutPath(null)).toBeNull();
    expect(normalizeLutPath(undefined)).toBeNull();
    expect(normalizeLutPath('')).toBeNull();
  });
});
