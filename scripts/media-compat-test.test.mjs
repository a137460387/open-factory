import { describe, expect, it } from 'vitest';
import { assertMediaCompatReport, createMediaCompatReport } from './media-compat-test.mjs';

function passingCase(id, required = false) {
  return {
    id,
    label: id,
    required,
    supported: true,
    passed: true
  };
}

describe('media compatibility report assertions', () => {
  it('passes when all supported and required formats pass', () => {
    const report = createMediaCompatReport({
      workDir: '.tmp/media-compat',
      generatedAt: '2026-06-12T00:00:00.000Z',
      cases: [passingCase('h264-mp4', true), passingCase('h265-mp4', true), passingCase('aac-m4a', true), passingCase('vp9-webm')]
    });

    expect(report.summary.requiredPassed).toBe(true);
    expect(report.summary.allSupportedPassed).toBe(true);
    expect(() => assertMediaCompatReport(report)).not.toThrow();
  });

  it('fails when a required format fails', () => {
    const report = createMediaCompatReport({
      workDir: '.tmp/media-compat',
      generatedAt: '2026-06-12T00:00:00.000Z',
      cases: [
        passingCase('h264-mp4', true),
        { ...passingCase('h265-mp4', true), passed: false, error: 'decode failed' },
        passingCase('aac-m4a', true)
      ]
    });

    expect(() => assertMediaCompatReport(report)).toThrow(/H.265|h265-mp4|required/);
  });
});
