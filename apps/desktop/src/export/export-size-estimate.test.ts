import { describe, expect, it } from 'vitest';
import { estimateExportFileSizeBytes, formatEstimatedFileSize } from './export-size-estimate';

describe('export file size estimate', () => {
  it('estimates bitrate-based video and audio sizes', () => {
    expect(
      estimateExportFileSizeBytes({
        width: 1920,
        height: 1080,
        fps: 30,
        duration: 10,
        format: 'mp4',
        videoBitrate: '8M',
        audioBitrate: '192k',
      }),
    ).toBe(10_240_000);
    expect(
      estimateExportFileSizeBytes({
        width: 0,
        height: 0,
        fps: 30,
        duration: 10,
        format: 'm4a',
        outputMode: 'audio',
        audioBitrate: '192k',
      }),
    ).toBe(240_000);
  });

  it('uses animated image heuristics and formats display labels', () => {
    const gif = estimateExportFileSizeBytes({ width: 1080, height: 608, fps: 30, duration: 2, format: 'gif' });
    const webp = estimateExportFileSizeBytes({ width: 1080, height: 608, fps: 30, duration: 2, format: 'webp' });

    expect(gif).toBeGreaterThan(webp);
    expect(formatEstimatedFileSize(512 * 1024)).toBe('512 KB');
    expect(formatEstimatedFileSize(5.5 * 1024 * 1024)).toBe('5.5 MB');
  });
});
