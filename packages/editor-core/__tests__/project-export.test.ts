import { describe, expect, it } from 'vitest';
import {
  buildProjectFfmpegExportPlan,
  buildSingleVideoTrackExportPlan,
  deserializeProject,
  normalizeFfmpegPath,
  serializeProject,
  timelineHasExportableVideo
} from '../src';
import { makeAdjustmentClip, makeProject, makeTextClip, makeTimeline, makeVideoClip } from './test-utils';

describe('project serialization and export plan', () => {
  it('round trips project files without losing structure', () => {
    const project = makeProject();
    const file = serializeProject(project);
    const restored = deserializeProject(file);

    expect(file.schemaVersion).toBe(2);
    expect(restored.id).toBe(project.id);
    expect(restored.media[0].path).toBe(project.media[0].path.replace(/\\/g, '/'));
    expect(restored.timeline.tracks[0].clips[0].id).toBe(project.timeline.tracks[0].clips[0].id);
  });

  it('builds a single video track export plan', () => {
    const project = makeProject();
    const plan = buildSingleVideoTrackExportPlan(project);

    expect(plan.segments).toHaveLength(1);
    expect(plan.segments[0].inputPath).toBe('C:/Videos/sample.mp4');
    expect(plan.segments[0].duration).toBe(10);
    expect(plan.width).toBe(1280);
    expect(plan.fps).toBe(30);
    expect(plan.limitation).toContain('first video track');
  });

  it('checks exportable timelines and normalizes paths', () => {
    expect(normalizeFfmpegPath('D:\\Clips\\a.mp4')).toBe('D:/Clips/a.mp4');
    expect(timelineHasExportableVideo(makeProject().timeline)).toBe(true);
    expect(timelineHasExportableVideo(makeTimeline())).toBe(false);
    expect(timelineHasExportableVideo(makeTimeline([makeTextClip()]))).toBe(true);
    expect(timelineHasExportableVideo(makeTimeline([makeAdjustmentClip({ trackId: 'track-video' })]))).toBe(false);
  });

  it('throws when an export clip references a missing asset', () => {
    const project = { ...makeProject(), media: [] };
    expect(() => buildSingleVideoTrackExportPlan(project)).toThrow('Missing media asset');
  });

  it('keeps legacy single-track export limited to video clips', () => {
    const project = makeProject();
    project.media.push({
      id: 'asset-image',
      type: 'image',
      name: 'still.png',
      path: 'D:\\Media\\still.png',
      duration: 0,
      width: 640,
      height: 360
    });
    project.timeline.tracks[0].clips = [
      makeVideoClip({ id: 'video-b', start: 4, duration: 2 }),
      {
        id: 'image-a',
        type: 'image',
        name: 'Still',
        mediaId: 'asset-image',
        trackId: 'track-video',
        start: 1,
        duration: 3,
        trimStart: 0,
        trimEnd: 0,
        transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 }
      },
      makeVideoClip({ id: 'video-a', start: 0, duration: 1 })
    ];

    const plan = buildSingleVideoTrackExportPlan(project);

    expect(plan.segments.map((segment) => segment.name)).toEqual(['Clip', 'Clip']);
    expect(plan.segments.map((segment) => segment.start)).toEqual([0, 0]);
    expect(plan.segments).toHaveLength(2);
  });

  it('builds project ffmpeg plans through the multitrack planner', () => {
    const plan = buildProjectFfmpegExportPlan(makeProject(), 'D:\\Exports\\final.mp4');

    expect(plan.fullArgs).toContain('-filter_complex');
    expect(plan.fullArgs.at(-1)).toBe('D:/Exports/final.mp4');
    expect(plan.duration).toBe(10);
  });

  it('builds empty export plan when no video track exists', () => {
    const project = makeProject();
    project.timeline.tracks = [];
    const plan = buildSingleVideoTrackExportPlan(project);
    expect(plan.segments).toEqual([]);
  });
});
