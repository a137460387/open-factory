import { describe, expect, it } from 'vitest';
import {
  calculateExportPreviewSampleTimes,
  sanitizeStemPathComponent,
  buildStemOutputPath,
} from '../src/export/ffmpeg-builder/export-plan';

// ---------------------------------------------------------------------------
// calculateExportPreviewSampleTimes
// ---------------------------------------------------------------------------
describe('calculateExportPreviewSampleTimes', () => {
  it('returns 3 samples (start, middle, end)', () => {
    const samples = calculateExportPreviewSampleTimes(10);
    expect(samples).toHaveLength(3);
    expect(samples.map((s) => s.kind)).toEqual(['start', 'middle', 'end']);
  });

  it('start sample is at time 0', () => {
    const samples = calculateExportPreviewSampleTimes(10);
    expect(samples[0].time).toBe(0);
  });

  it('middle sample is at half duration', () => {
    const samples = calculateExportPreviewSampleTimes(10);
    expect(samples[1].time).toBe(5);
  });

  it('end sample is at full duration', () => {
    const samples = calculateExportPreviewSampleTimes(10);
    expect(samples[2].time).toBe(10);
  });

  it('handles zero duration', () => {
    const samples = calculateExportPreviewSampleTimes(0);
    expect(samples).toHaveLength(3);
    expect(samples[0].time).toBe(0);
    expect(samples[1].time).toBe(0);
    expect(samples[2].time).toBe(0);
  });

  it('handles NaN duration', () => {
    const samples = calculateExportPreviewSampleTimes(NaN);
    expect(samples).toHaveLength(3);
    expect(samples[0].time).toBe(0);
  });

  it('handles negative duration', () => {
    const samples = calculateExportPreviewSampleTimes(-5);
    expect(samples).toHaveLength(3);
    expect(samples[0].time).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// sanitizeStemPathComponent
// ---------------------------------------------------------------------------
describe('sanitizeStemPathComponent', () => {
  it('replaces unsafe characters with underscores', () => {
    expect(sanitizeStemPathComponent('My Track (v2)')).toBe('My_Track_v2');
  });

  it('collapses multiple underscores', () => {
    expect(sanitizeStemPathComponent('a  b  c')).toBe('a_b_c');
  });

  it('trims leading and trailing underscores', () => {
    expect(sanitizeStemPathComponent(' _track_ ')).toBe('track');
  });

  it('handles empty string', () => {
    expect(sanitizeStemPathComponent('')).toBe('');
  });

  it('handles special characters', () => {
    expect(sanitizeStemPathComponent('Track<>:"/\\|?*1')).toBe('Track_1');
  });
});

// ---------------------------------------------------------------------------
// buildStemOutputPath
// ---------------------------------------------------------------------------
describe('buildStemOutputPath', () => {
  it('builds path with project name, stem name, and index', () => {
    const path = buildStemOutputPath('/exports', 'My Project', 'Vocals', 1, 'wav');
    expect(path).toContain('/exports/');
    expect(path).toContain('My_Project');
    expect(path).toContain('Vocals');
    expect(path).toContain('_1.wav');
  });

  it('uses default format for default', () => {
    const path = buildStemOutputPath('/exports', 'Project', 'Track', 0, 'default');
    expect(path.endsWith('.wav')).toBe(true);
  });

  it('uses specified format', () => {
    const path = buildStemOutputPath('/exports', 'Project', 'Track', 0, 'mp3');
    expect(path.endsWith('.mp3')).toBe(true);
  });

  it('handles empty project name', () => {
    const path = buildStemOutputPath('/exports', '', 'Track', 0, 'wav');
    expect(path).toContain('project');
  });

  it('handles empty stem name', () => {
    const path = buildStemOutputPath('/exports', 'Project', '', 3, 'wav');
    expect(path).toContain('track-3');
  });

  it('strips trailing slashes from output dir', () => {
    const path = buildStemOutputPath('/exports///', 'Project', 'Track', 0, 'wav');
    expect(path).toMatch(/^\/exports\//);
    expect(path).not.toContain('///');
  });
});
