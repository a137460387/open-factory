import { describe, expect, it } from 'vitest';
import { buildSidecarSubtitlePath } from './export-sidecar';

describe('export queue sidecar subtitles', () => {
  it('writes sidecar subtitles next to the exported media with the subtitle extension', () => {
    expect(buildSidecarSubtitlePath('C:/Exports/video.mp4', 'subtitles.ass')).toBe('C:/Exports/video.ass');
    expect(buildSidecarSubtitlePath('D:\\Exports\\review.cut.mov', 'subtitles.vtt')).toBe('D:\\Exports\\review.cut.vtt');
  });

  it('falls back to srt when the artifact file has no extension', () => {
    expect(buildSidecarSubtitlePath('C:/Exports/video', 'subtitles')).toBe('C:/Exports/video.srt');
  });
});
