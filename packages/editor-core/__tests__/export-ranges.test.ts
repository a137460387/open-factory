import { describe, it, expect } from 'vitest';
import {
  normalizeExportRenderRange,
  exportRenderRangeFromPoints,
  appendExportRangeSequence,
} from '../src/export/export-ranges';

describe('export-ranges', () => {
  describe('normalizeExportRenderRange', () => {
    it('returns null for null input', () => {
      expect(normalizeExportRenderRange(null, 60, 30)).toBeNull();
    });

    it('returns null for undefined input', () => {
      expect(normalizeExportRenderRange(undefined, 60, 30)).toBeNull();
    });

    it('returns null for zero duration', () => {
      expect(normalizeExportRenderRange({ start: 0, duration: 0 }, 60, 30)).toBeNull();
    });

    it('returns null for negative duration', () => {
      expect(normalizeExportRenderRange({ start: 0, duration: -1 }, 60, 30)).toBeNull();
    });

    it('returns null for non-finite start', () => {
      expect(normalizeExportRenderRange({ start: NaN, duration: 5 }, 60, 30)).toBeNull();
    });

    it('normalizes a valid range', () => {
      const result = normalizeExportRenderRange({ start: 10, duration: 5 }, 60, 30);
      expect(result).not.toBeNull();
      expect(result!.start).toBe(10);
      expect(result!.duration).toBe(5);
    });

    it('clamps start to timeline bounds', () => {
      const result = normalizeExportRenderRange({ start: 100, duration: 5 }, 60, 30);
      expect(result).not.toBeNull();
      expect(result!.start).toBeLessThanOrEqual(60);
    });

    it('preserves id and label', () => {
      const result = normalizeExportRenderRange({ id: 'r1', label: 'My Range', start: 0, duration: 5 }, 60, 30);
      expect(result!.id).toBe('r1');
      expect(result!.label).toBe('My Range');
    });
  });

  describe('exportRenderRangeFromPoints', () => {
    it('returns null when start is undefined', () => {
      expect(exportRenderRangeFromPoints(undefined, 10, 60, 30)).toBeNull();
    });

    it('returns null when end is undefined', () => {
      expect(exportRenderRangeFromPoints(0, undefined, 60, 30)).toBeNull();
    });

    it('creates range from two points', () => {
      const result = exportRenderRangeFromPoints(5, 15, 60, 30);
      expect(result).not.toBeNull();
      expect(result!.start).toBe(5);
      expect(result!.duration).toBe(10);
    });

    it('handles reversed points', () => {
      const result = exportRenderRangeFromPoints(15, 5, 60, 30);
      expect(result).not.toBeNull();
      expect(result!.start).toBe(5);
      expect(result!.duration).toBe(10);
    });
  });

  describe('appendExportRangeSequence', () => {
    it('appends sequence number to filename', () => {
      expect(appendExportRangeSequence('/output/video.mp4', 1, 3)).toBe('/output/video-01.mp4');
    });

    it('pads based on total', () => {
      expect(appendExportRangeSequence('/output/video.mp4', 1, 100)).toBe('/output/video-001.mp4');
    });

    it('handles no directory', () => {
      expect(appendExportRangeSequence('video.mp4', 1, 3)).toBe('video-01.mp4');
    });

    it('handles no extension', () => {
      expect(appendExportRangeSequence('/output/video', 1, 3)).toBe('/output/video-01');
    });
  });
});
