import {describe, expect, it} from 'vitest';
import {
  isCreditsTextFile,
  timelineRangesOverlap,
  joinLocalPath,
  isSubtitleAlignmentMediaClip,
  buildSubtitleAlignmentPeaks,
  SUBTITLE_ALIGNMENT_SAMPLES_PER_SECOND,
  SUBTITLE_ALIGNMENT_MAX_DISTANCE,
  TRANSITION_DRAG_MIME,
} from './utils';

describe('isCreditsTextFile', () => {
  it('returns true for .txt files', () => {
    expect(isCreditsTextFile(new File([''], 'credits.txt'))).toBe(true);
  });

  it('returns true for .csv files', () => {
    expect(isCreditsTextFile(new File([''], 'credits.csv'))).toBe(true);
  });

  it('returns true case-insensitively', () => {
    expect(isCreditsTextFile(new File([''], 'CREDITS.TXT'))).toBe(true);
    expect(isCreditsTextFile(new File([''], 'data.CSV'))).toBe(true);
  });

  it('returns false for non-matching extensions', () => {
    expect(isCreditsTextFile(new File([''], 'video.mp4'))).toBe(false);
    expect(isCreditsTextFile(new File([''], 'image.png'))).toBe(false);
    expect(isCreditsTextFile(new File([''], 'script.js'))).toBe(false);
  });
});

describe('timelineRangesOverlap', () => {
  it('returns true for overlapping ranges', () => {
    expect(timelineRangesOverlap(0, 10, 5, 15)).toBe(true);
  });

  it('returns true for contained ranges', () => {
    expect(timelineRangesOverlap(0, 20, 5, 10)).toBe(true);
  });

  it('returns false for non-overlapping ranges', () => {
    expect(timelineRangesOverlap(0, 5, 10, 15)).toBe(false);
  });

  it('returns false for adjacent ranges (touching edges)', () => {
    expect(timelineRangesOverlap(0, 5, 5, 10)).toBe(false);
  });

  it('returns true for reverse overlap', () => {
    expect(timelineRangesOverlap(5, 15, 0, 10)).toBe(true);
  });
});

describe('joinLocalPath', () => {
  it('joins base dir and child', () => {
    expect(joinLocalPath('/home/user', 'file.txt')).toBe('/home/user/file.txt');
  });

  it('normalizes trailing slashes in base dir', () => {
    expect(joinLocalPath('/home/user/', 'file.txt')).toBe('/home/user/file.txt');
    expect(joinLocalPath('/home/user///', 'file.txt')).toBe('/home/user/file.txt');
  });

  it('converts backslashes to forward slashes', () => {
    expect(joinLocalPath('C:\\Users\\test', 'file.txt')).toBe('C:/Users/test/file.txt');
  });
});

describe('isSubtitleAlignmentMediaClip', () => {
  it('returns true for audio clips', () => {
    expect(isSubtitleAlignmentMediaClip({type: 'audio'} as any)).toBe(true);
  });

  it('returns true for video clips', () => {
    expect(isSubtitleAlignmentMediaClip({type: 'video'} as any)).toBe(true);
  });

  it('returns false for subtitle clips', () => {
    expect(isSubtitleAlignmentMediaClip({type: 'subtitle'} as any)).toBe(false);
  });

  it('returns false for text clips', () => {
    expect(isSubtitleAlignmentMediaClip({type: 'text'} as any)).toBe(false);
  });
});

describe('constants', () => {
  it('exports SUBTITLE_ALIGNMENT_SAMPLES_PER_SECOND', () => {
    expect(SUBTITLE_ALIGNMENT_SAMPLES_PER_SECOND).toBe(20);
  });

  it('exports SUBTITLE_ALIGNMENT_MAX_DISTANCE', () => {
    expect(SUBTITLE_ALIGNMENT_MAX_DISTANCE).toBe(0.3);
  });

  it('exports TRANSITION_DRAG_MIME', () => {
    expect(TRANSITION_DRAG_MIME).toBe('application/x-transition-type');
  });
});

describe('buildSubtitleAlignmentPeaks', () => {
  const baseClip = {
    start: 0,
    trimStart: 0,
    trimEnd: 0,
    duration: 5,
    speed: 1,
  } as any;

  it('returns empty array for empty samples', () => {
    expect(buildSubtitleAlignmentPeaks([], 20, baseClip)).toEqual([]);
  });

  it('returns empty array when all samples are zero', () => {
    const samples = new Array(100).fill(0);
    expect(buildSubtitleAlignmentPeaks(samples, 20, baseClip)).toEqual([]);
  });

  it('detects peaks above threshold', () => {
    const samples = new Array(100).fill(0);
    samples[40] = 1.0;
    samples[41] = 0.5;
    const result = buildSubtitleAlignmentPeaks(samples, 20, baseClip);
    expect(result.length).toBe(1);
  });

  it('skips samples outside trim range', () => {
    const clip = {...baseClip, trimStart: 1, trimEnd: 1} as any;
    const samples = new Array(100).fill(0);
    samples[10] = 1.0;
    samples[11] = 0.5;
    const result = buildSubtitleAlignmentPeaks(samples, 20, clip);
    expect(result.length).toBe(0);
  });

  it('handles non-finite sample values', () => {
    const samples = [NaN, Infinity, -Infinity, 0.5, 0.1];
    const result = buildSubtitleAlignmentPeaks(samples, 20, baseClip);
    expect(Array.isArray(result)).toBe(true);
  });

  it('uses sample rate of 1 when zero is provided', () => {
    const samples = [0, 1.0, 0.5];
    const result = buildSubtitleAlignmentPeaks(samples, 0, baseClip);
    expect(Array.isArray(result)).toBe(true);
  });
});
