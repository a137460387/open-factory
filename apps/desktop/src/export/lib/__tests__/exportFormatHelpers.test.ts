import { describe, expect, it } from 'vitest';
import {
  formatQualityMetricValue,
  formatPostExportQualityValue,
  formatOptionalNumber,
  formatBytes,
  formatMilliseconds,
  qualityLevelClass,
  postExportQualityStatusClass,
  uploadStatusClass,
  formatLoudness,
  priorityLabel,
} from '../exportFormatHelpers';

describe('exportFormatHelpers', () => {
  describe('formatQualityMetricValue', () => {
    it('formats number with suffix', () => {
      expect(formatQualityMetricValue(85.5, '%')).toBe('85.5%');
    });

    it('formats number without suffix with 3 decimals', () => {
      expect(formatQualityMetricValue(0.123, '')).toBe('0.123');
    });

    it('returns unavailable for undefined', () => {
      const result = formatQualityMetricValue(undefined, '%');
      expect(result).toBeTruthy();
    });

    it('returns unavailable for NaN', () => {
      const result = formatQualityMetricValue(NaN, '%');
      expect(result).toBeTruthy();
    });

    it('returns unavailable for Infinity', () => {
      const result = formatQualityMetricValue(Infinity, '%');
      expect(result).toBeTruthy();
    });
  });

  describe('formatPostExportQualityValue', () => {
    it('returns string values as-is', () => {
      const check = { id: 'test' } as any;
      expect(formatPostExportQualityValue(check, 'passed')).toBe('passed');
    });

    it('formats fileSize check with bytes', () => {
      const check = { id: 'fileSize' } as any;
      const result = formatPostExportQualityValue(check, 1048576);
      expect(result).toContain('MB');
    });

    it('formats duration check with seconds', () => {
      const check = { id: 'duration' } as any;
      expect(formatPostExportQualityValue(check, 12.345)).toBe('12.345s');
    });

    it('formats integer values as strings', () => {
      const check = { id: 'other' } as any;
      expect(formatPostExportQualityValue(check, 42)).toBe('42');
    });

    it('formats float values with 3 decimals', () => {
      const check = { id: 'other' } as any;
      expect(formatPostExportQualityValue(check, 3.14159)).toBe('3.142');
    });
  });

  describe('formatOptionalNumber', () => {
    it('formats finite number', () => {
      expect(formatOptionalNumber(3.14159, 2)).toBe('3.14');
    });

    it('returns unavailable for undefined', () => {
      const result = formatOptionalNumber(undefined, 2);
      expect(result).toBeTruthy();
    });

    it('returns unavailable for NaN', () => {
      const result = formatOptionalNumber(NaN, 2);
      expect(result).toBeTruthy();
    });
  });

  describe('formatBytes', () => {
    it('formats bytes < 1024', () => {
      expect(formatBytes(500)).toBe('500 B');
    });

    it('formats kilobytes', () => {
      expect(formatBytes(1536)).toBe('1.5 KB');
    });

    it('formats megabytes', () => {
      expect(formatBytes(1048576)).toBe('1.0 MB');
    });

    it('formats gigabytes', () => {
      expect(formatBytes(1073741824)).toBe('1.00 GB');
    });

    it('returns unavailable for undefined', () => {
      const result = formatBytes(undefined);
      expect(result).toBeTruthy();
    });

    it('returns unavailable for NaN', () => {
      const result = formatBytes(NaN);
      expect(result).toBeTruthy();
    });
  });

  describe('formatMilliseconds', () => {
    it('formats milliseconds as seconds', () => {
      expect(formatMilliseconds(1500)).toBe('1.5s');
    });

    it('formats large values without decimals', () => {
      expect(formatMilliseconds(15000)).toBe('15s');
    });

    it('returns unavailable for undefined', () => {
      const result = formatMilliseconds(undefined);
      expect(result).toBeTruthy();
    });

    it('returns unavailable for NaN', () => {
      const result = formatMilliseconds(NaN);
      expect(result).toBeTruthy();
    });
  });

  describe('qualityLevelClass', () => {
    it('returns emerald class for excellent', () => {
      expect(qualityLevelClass('excellent')).toContain('emerald');
    });

    it('returns amber class for average', () => {
      expect(qualityLevelClass('average')).toContain('amber');
    });

    it('returns rose class for poor', () => {
      expect(qualityLevelClass('poor')).toContain('rose');
    });
  });

  describe('postExportQualityStatusClass', () => {
    it('returns emerald for pass', () => {
      expect(postExportQualityStatusClass('pass')).toContain('emerald');
    });

    it('returns amber for warning', () => {
      expect(postExportQualityStatusClass('warning')).toContain('amber');
    });

    it('returns rose for fail', () => {
      expect(postExportQualityStatusClass('fail')).toContain('rose');
    });
  });

  describe('uploadStatusClass', () => {
    it('returns emerald for success', () => {
      expect(uploadStatusClass('success')).toContain('emerald');
    });

    it('returns sky for running', () => {
      expect(uploadStatusClass('running')).toContain('sky');
    });

    it('returns rose for error', () => {
      expect(uploadStatusClass('error')).toContain('rose');
    });

    it('returns amber for other statuses', () => {
      expect(uploadStatusClass('idle' as any)).toContain('amber');
    });
  });

  describe('formatLoudness', () => {
    it('formats finite number with 1 decimal', () => {
      expect(formatLoudness(-14.5)).toBe('-14.5');
    });

    it('returns unavailable for NaN', () => {
      const result = formatLoudness(NaN);
      expect(result).toBeTruthy();
    });
  });

  describe('priorityLabel', () => {
    it('returns label for low priority', () => {
      expect(priorityLabel('low')).toBeTruthy();
    });

    it('returns label for normal priority', () => {
      expect(priorityLabel('normal')).toBeTruthy();
    });

    it('returns label for high priority', () => {
      expect(priorityLabel('high')).toBeTruthy();
    });
  });
});
