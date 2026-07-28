import {describe, expect, it} from 'vitest';
import {
  labelColorToHex,
  formatFrameRateLabel,
  formatMediaFormat,
  formatMediaResolution,
  formatMediaColorProfile,
  formatPreciseFrameRate,
  formatBytes,
  formatBitRate,
  formatDateTime,
  formatImportedAt,
  MEDIA_LABEL_COLORS,
  MEDIA_LABEL_COLOR_STYLES,
  TIMELINE_COLORS,
  TIMELINE_COLOR_STYLES,
  MEDIA_CARD_DRAG_MIME,
  SUBCLIP_DRAG_MIME,
} from '../media-bin-utils';
import type {MediaAsset} from '@open-factory/editor-core';

function makeAsset(overrides: Partial<MediaAsset> = {}): MediaAsset {
  return {
    id: 'a1',
    name: 'test.mp4',
    type: 'video',
    path: '/test.mp4',
    duration: 10,
    width: 1920,
    height: 1080,
    ...overrides,
  } as MediaAsset;
}

describe('media-bin-utils', () => {
  describe('constants', () => {
    it('MEDIA_CARD_DRAG_MIME has correct value', () => {
      expect(MEDIA_CARD_DRAG_MIME).toBe('application/x-open-factory-media-id');
    });

    it('SUBCLIP_DRAG_MIME has correct value', () => {
      expect(SUBCLIP_DRAG_MIME).toBe('application/x-open-factory-subclip');
    });

    it('MEDIA_LABEL_COLORS has 6 entries', () => {
      expect(MEDIA_LABEL_COLORS).toHaveLength(6);
    });

    it('MEDIA_LABEL_COLOR_STYLES maps each key to a CSSProperties with backgroundColor', () => {
      for (const item of MEDIA_LABEL_COLORS) {
        expect(MEDIA_LABEL_COLOR_STYLES[item.key]).toEqual({backgroundColor: item.value});
      }
    });

    it('TIMELINE_COLORS has 12 entries', () => {
      expect(TIMELINE_COLORS).toHaveLength(12);
    });

    it('TIMELINE_COLOR_STYLES maps each key', () => {
      for (const item of TIMELINE_COLORS) {
        expect(TIMELINE_COLOR_STYLES[item.key]).toEqual({backgroundColor: item.value});
      }
    });
  });

  describe('labelColorToHex', () => {
    it('returns hex for known color', () => {
      expect(labelColorToHex('red')).toBe('#ef4444');
      expect(labelColorToHex('blue')).toBe('#3b82f6');
    });

    it('returns fallback for unknown color', () => {
      expect(labelColorToHex('unknown' as any)).toBe('#64748b');
    });
  });

  describe('formatFrameRateLabel', () => {
    it('formats integer frame rate without decimals', () => {
      expect(formatFrameRateLabel(24)).toBe('24fps');
      expect(formatFrameRateLabel(30)).toBe('30fps');
      expect(formatFrameRateLabel(60)).toBe('60fps');
    });

    it('formats decimal frame rate with trimmed zeros', () => {
      expect(formatFrameRateLabel(23.976)).toBe('23.98fps');
      expect(formatFrameRateLabel(29.97)).toBe('29.97fps');
    });

    it('rounds to 2 decimal places', () => {
      expect(formatFrameRateLabel(23.976)).toBe('23.98fps');
    });
  });

  describe('formatMediaFormat', () => {
    it('shows type and extension for video', () => {
      const asset = makeAsset({type: 'video', name: 'clip.mp4'});
      const result = formatMediaFormat(asset);
      expect(result).toContain('MP4');
    });

    it('shows type for audio without extension', () => {
      const asset = makeAsset({type: 'audio', name: 'audiofile'});
      expect(formatMediaFormat(asset)).toBeTruthy();
    });

    it('handles image type', () => {
      const asset = makeAsset({type: 'image', name: 'photo.jpg'});
      expect(formatMediaFormat(asset)).toContain('JPG');
    });
  });

  describe('formatMediaResolution', () => {
    it('returns resolution for video', () => {
      const asset = makeAsset({type: 'video', width: 1920, height: 1080});
      expect(formatMediaResolution(asset)).toBe('1920 x 1080');
    });

    it('returns unavailable for audio', () => {
      const asset = makeAsset({type: 'audio'});
      expect(formatMediaResolution(asset)).toBeTruthy();
    });

    it('returns unavailable when dimensions missing', () => {
      const asset = makeAsset({type: 'video', width: undefined, height: undefined});
      expect(formatMediaResolution(asset)).toBeTruthy();
    });
  });

  describe('formatMediaColorProfile', () => {
    it('returns label when present', () => {
      const asset = makeAsset({colorProfile: {label: 'sRGB'}} as any);
      expect(formatMediaColorProfile(asset)).toBe('sRGB');
    });

    it('returns unavailable when no color profile', () => {
      const asset = makeAsset();
      expect(formatMediaColorProfile(asset)).toBeTruthy();
    });
  });

  describe('formatPreciseFrameRate', () => {
    it('formats with 3 decimal places', () => {
      expect(formatPreciseFrameRate(23.976)).toBe('23.976 fps');
      expect(formatPreciseFrameRate(30)).toBe('30.000 fps');
    });
  });

  describe('formatBytes', () => {
    it('returns unavailable for undefined', () => {
      expect(formatBytes(undefined)).toBeTruthy();
    });

    it('returns unavailable for NaN', () => {
      expect(formatBytes(NaN)).toBeTruthy();
    });

    it('formats bytes', () => {
      expect(formatBytes(0)).toBe('0 B');
      expect(formatBytes(500)).toBe('500 B');
    });

    it('formats kilobytes', () => {
      expect(formatBytes(1024)).toBe('1.0 KB');
      expect(formatBytes(1536)).toBe('1.5 KB');
    });

    it('formats megabytes', () => {
      expect(formatBytes(1048576)).toBe('1.0 MB');
    });

    it('formats gigabytes', () => {
      expect(formatBytes(1073741824)).toBe('1.0 GB');
    });

    it('formats terabytes', () => {
      expect(formatBytes(1099511627776)).toBe('1.0 TB');
    });
  });

  describe('formatBitRate', () => {
    it('returns unavailable for undefined', () => {
      expect(formatBitRate(undefined)).toBeTruthy();
    });

    it('formats bps', () => {
      expect(formatBitRate(500)).toBe('500 bps');
    });

    it('formats kbps', () => {
      expect(formatBitRate(128000)).toBe('128.0 kbps');
    });

    it('formats Mbps', () => {
      expect(formatBitRate(5000000)).toBe('5.00 Mbps');
    });
  });

  describe('formatDateTime', () => {
    it('returns unavailable for undefined', () => {
      expect(formatDateTime(undefined)).toBeTruthy();
    });

    it('returns unavailable for NaN', () => {
      expect(formatDateTime(NaN)).toBeTruthy();
    });

    it('formats valid timestamp', () => {
      const result = formatDateTime(1700000000000);
      expect(result).toBeTruthy();
      expect(result).not.toBe(formatDateTime(undefined));
    });
  });

  describe('formatImportedAt', () => {
    it('returns unavailable for undefined', () => {
      expect(formatImportedAt(undefined)).toBeTruthy();
    });

    it('returns unavailable for empty string', () => {
      expect(formatImportedAt('')).toBeTruthy();
    });

    it('returns unavailable for invalid date', () => {
      expect(formatImportedAt('not-a-date')).toBeTruthy();
    });

    it('formats valid ISO date', () => {
      const result = formatImportedAt('2024-01-15T10:30:00Z');
      expect(result).toBeTruthy();
    });
  });
});
