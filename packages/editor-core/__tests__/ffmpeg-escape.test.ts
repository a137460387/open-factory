import { describe, it, expect } from 'vitest';
import {
  normalizeFfmpegPath,
  escapeDrawtextValue,
  cssColorToFfmpeg,
  formatFfmpegSeconds,
  quoteForDisplay,
} from '../src/export/ffmpeg-escape';

describe('ffmpeg-escape', () => {
  describe('normalizeFfmpegPath', () => {
    it('converts backslashes to forward slashes', () => {
      expect(normalizeFfmpegPath('C:\\Users\\test\\file.mp4')).toBe('C:/Users/test/file.mp4');
    });

    it('leaves forward slashes unchanged', () => {
      expect(normalizeFfmpegPath('/home/user/file.mp4')).toBe('/home/user/file.mp4');
    });
  });

  describe('escapeDrawtextValue', () => {
    it('escapes colons', () => {
      expect(escapeDrawtextValue('text:value')).toContain('\\:');
    });

    it('escapes single quotes', () => {
      expect(escapeDrawtextValue("it's")).toContain("\'");
    });

    it('escapes percent signs', () => {
      expect(escapeDrawtextValue('100%')).toContain('\%');
    });

    it('normalizes backslashes in path', () => {
      const result = escapeDrawtextValue('C:\\path\\file');
      expect(result).toContain('/');
    });
  });

  describe('cssColorToFfmpeg', () => {
    it('converts 3-digit hex to 6-digit', () => {
      expect(cssColorToFfmpeg('#fff')).toBe('0xffffff');
      expect(cssColorToFfmpeg('#abc')).toBe('0xaabbcc');
    });

    it('converts 6-digit hex', () => {
      expect(cssColorToFfmpeg('#ff0000')).toBe('0xff0000');
      expect(cssColorToFfmpeg('#00FF00')).toBe('0x00ff00');
    });

    it('returns named colors as-is', () => {
      expect(cssColorToFfmpeg('white')).toBe('white');
      expect(cssColorToFfmpeg('red')).toBe('red');
    });

    it('returns white for empty string', () => {
      expect(cssColorToFfmpeg('')).toBe('white');
      expect(cssColorToFfmpeg('  ')).toBe('white');
    });
  });

  describe('formatFfmpegSeconds', () => {
    it('formats integer seconds', () => {
      expect(formatFfmpegSeconds(5)).toBe('5');
    });

    it('formats decimal seconds removing trailing zeros', () => {
      expect(formatFfmpegSeconds(1.5)).toBe('1.5');
      expect(formatFfmpegSeconds(1.500)).toBe('1.5');
    });

    it('clamps negative to 0', () => {
      expect(formatFfmpegSeconds(-1)).toBe('0');
    });

    it('rounds to 3 decimal places', () => {
      expect(formatFfmpegSeconds(1.2345)).toBe('1.235');
    });
  });

  describe('quoteForDisplay', () => {
    it('quotes values with spaces', () => {
      expect(quoteForDisplay('hello world')).toBe('"hello world"');
    });

    it('does not quote values without spaces', () => {
      expect(quoteForDisplay('hello')).toBe('hello');
    });

    it('escapes double quotes inside quoted value', () => {
      expect(quoteForDisplay('say "hi"')).toBe('"say \\"hi\\""');
    });
  });
});
