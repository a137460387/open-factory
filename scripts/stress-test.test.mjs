import { describe, expect, it } from 'vitest';
import { assertStressReport, createStressProjectFile, createStressReport } from './stress-test.mjs';

describe('stress-test project generation', () => {
  it('generates a schemaVersion 2 project with the requested clip count', () => {
    const file = createStressProjectFile({ clipCount: 200 });
    const clips = file.project.timeline.tracks.flatMap((track) => track.clips);

    expect(file.schemaVersion).toBe(2);
    expect(file.project.media).toHaveLength(1);
    expect(clips).toHaveLength(200);
    expect(file.project.sequences[0].timeline).toBe(file.project.timeline);
  });

  it('keeps generated clips ordered and bound to the stress media asset', () => {
    const file = createStressProjectFile({ clipCount: 4, clipDuration: 2, gapDuration: 0.5 });
    const clips = file.project.timeline.tracks[0].clips;

    expect(clips.map((clip) => clip.start)).toEqual([0, 2.5, 5, 7.5]);
    expect(new Set(clips.map((clip) => clip.mediaId))).toEqual(new Set(['media-stress-video']));
    expect(clips.every((clip) => clip.trackId === 'track-stress-video')).toBe(true);
  });

  it('falls back to a 200 clip project for invalid clip counts', () => {
    const file = createStressProjectFile({ clipCount: -1 });
    const clips = file.project.timeline.tracks.flatMap((track) => track.clips);

    expect(clips).toHaveLength(200);
  });
});

describe('stress-test report assertions', () => {
  it('passes when render and memory metrics stay within thresholds', () => {
    const report = createStressReport({
      projectPath: 'C:/Projects/stress-200.cutproj.json',
      totalClipCount: 200,
      renderedClipCount: 18,
      initialRenderMs: 512,
      scrollElapsedMs: 1_000,
      scrollFrameCount: 60,
      memoryBytes: 120 * 1024 * 1024
    });

    expect(report.metrics.scrollFps).toBe(60);
    expect(() => assertStressReport(report)).not.toThrow();
  });

  it('fails when the render threshold is exceeded', () => {
    const report = createStressReport({
      projectPath: 'C:/Projects/stress-200.cutproj.json',
      totalClipCount: 200,
      renderedClipCount: 18,
      initialRenderMs: 2_000,
      scrollElapsedMs: 1_000,
      scrollFrameCount: 60,
      memoryBytes: 120 * 1024 * 1024
    });

    expect(() => assertStressReport(report)).toThrow(/timeline initial render/);
  });

  it('fails when memory exceeds the threshold', () => {
    const report = createStressReport({
      projectPath: 'C:/Projects/stress-200.cutproj.json',
      totalClipCount: 200,
      renderedClipCount: 18,
      initialRenderMs: 512,
      scrollElapsedMs: 1_000,
      scrollFrameCount: 60,
      memoryBytes: 500 * 1024 * 1024
    });

    expect(() => assertStressReport(report)).toThrow(/JS heap/);
  });
});
