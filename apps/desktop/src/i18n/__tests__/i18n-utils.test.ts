import { describe, it, expect } from 'vitest';
import { formatSignedNumber, formatTrackType } from '../i18n-utils';

describe('i18n-utils', () => {
  describe('formatSignedNumber', () => {
    it('formats positive with + prefix', () => {
      expect(formatSignedNumber(1.5)).toBe('+1.50');
    });

    it('formats negative with - prefix', () => {
      expect(formatSignedNumber(-2.3)).toBe('-2.30');
    });

    it('formats zero with + prefix', () => {
      expect(formatSignedNumber(0)).toBe('+0.00');
    });

    it('pads to 2 decimal places', () => {
      expect(formatSignedNumber(5)).toBe('+5.00');
    });
  });

  describe('formatTrackType', () => {
    it('returns Chinese for video', () => {
      expect(formatTrackType('video')).toBe('视频');
    });

    it('returns Chinese for audio', () => {
      expect(formatTrackType('audio')).toBe('音频');
    });

    it('returns Chinese for text', () => {
      expect(formatTrackType('text')).toBe('文字');
    });

    it('returns Chinese for subtitle', () => {
      expect(formatTrackType('subtitle')).toBe('字幕');
    });

    it('returns original for unknown type', () => {
      expect(formatTrackType('unknown')).toBe('unknown');
    });
  });
});
