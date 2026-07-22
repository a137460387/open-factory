import { describe, it, expect } from 'vitest';
import { formatTime, formatTimeShort, formatDuration, formatDurationMs, formatTimecode } from '../time';

describe('time utils', () => {
  describe('formatTime', () => {
    it('formats seconds with centiseconds', () => {
      expect(formatTime(0)).toBe('0:00.00');
      expect(formatTime(65.5)).toBe('1:05.50');
      expect(formatTime(3661.25)).toBe('1:01:01.25');
    });

    it('formats minutes and seconds', () => {
      expect(formatTime(125)).toBe('2:05.00');
    });

    it('formats hours when >= 3600', () => {
      expect(formatTime(3600)).toBe('1:00:00.00');
      expect(formatTime(7200)).toBe('2:00:00.00');
    });
  });

  describe('formatTimeShort', () => {
    it('formats as MM:SS', () => {
      expect(formatTimeShort(0)).toBe('0:00');
      expect(formatTimeShort(65)).toBe('1:05');
      expect(formatTimeShort(125)).toBe('2:05');
    });

    it('truncates fractional seconds', () => {
      expect(formatTimeShort(65.9)).toBe('1:05');
    });
  });

  describe('formatDuration', () => {
    it('formats seconds in Chinese', () => {
      expect(formatDuration(30)).toBe('30秒');
      expect(formatDuration(5)).toBe('5秒');
    });

    it('formats minutes and seconds', () => {
      expect(formatDuration(125)).toBe('2分5秒');
      expect(formatDuration(60)).toBe('1分0秒');
    });

    it('formats hours and minutes', () => {
      expect(formatDuration(3600)).toBe('1时0分');
      expect(formatDuration(5400)).toBe('1时30分');
    });
  });

  describe('formatDurationMs', () => {
    it('formats milliseconds', () => {
      expect(formatDurationMs(500)).toBe('500ms');
      expect(formatDurationMs(100)).toBe('100ms');
    });

    it('formats seconds with decimal', () => {
      expect(formatDurationMs(2500)).toBe('2.5s');
    });

    it('formats minutes and seconds', () => {
      expect(formatDurationMs(185000)).toBe('3m 5s');
    });

    it('formats hours and minutes', () => {
      expect(formatDurationMs(3660000)).toBe('1h 1m');
    });
  });

  describe('formatTimecode', () => {
    it('formats as HH:MM:SS', () => {
      expect(formatTimecode(0)).toBe('00:00:00');
      expect(formatTimecode(65)).toBe('00:01:05');
      expect(formatTimecode(3661)).toBe('01:01:01');
    });

    it('truncates fractional seconds', () => {
      expect(formatTimecode(65.9)).toBe('00:01:05');
    });

    it('formats large values', () => {
      expect(formatTimecode(86400)).toBe('24:00:00');
    });
  });
});
