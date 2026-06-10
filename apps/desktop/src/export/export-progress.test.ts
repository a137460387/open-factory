import { describe, expect, it } from 'vitest';
import { normalizeExportProgressPayload } from './export-progress';

describe('export progress payload normalization', () => {
  it('accepts legacy fractional and percentage numbers', () => {
    expect(normalizeExportProgressPayload(0.42)).toBe(0.42);
    expect(normalizeExportProgressPayload(42)).toBe(0.42);
  });

  it('accepts structured Rust progress percentages', () => {
    expect(normalizeExportProgressPayload({ progressPct: 37.5 })).toBe(0.375);
  });

  it('accepts structured fractional progress when present', () => {
    expect(normalizeExportProgressPayload({ progress: 0.62, progressPct: 5 })).toBe(0.62);
  });

  it('computes progress from out_time_us and clamps bounds', () => {
    expect(normalizeExportProgressPayload({ outTimeUs: 2_500_000, expectedDurationUs: 10_000_000 })).toBe(0.25);
    expect(normalizeExportProgressPayload({ outTimeUs: 15_000_000, expectedDurationUs: 10_000_000 })).toBe(1);
    expect(normalizeExportProgressPayload({ outTimeUs: 1_000_000, expectedDurationUs: 0 })).toBe(0);
  });
});
