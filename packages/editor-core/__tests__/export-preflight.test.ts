import { describe, expect, it } from 'vitest';
import { createTrack, runExportPreflight, parseFontFamilyList, PRIMARY_SEQUENCE_ID, type MediaAsset } from '../src';
import { makeProject, makeSubtitleClip, makeTextClip, makeTimeline, makeVideoClip } from './test-utils';

describe('export preflight', () => {
  it('blocks export when timeline media is missing', () => {
    const project = makeProject();
    project.media = [
      {
        ...project.media[0],
        id: 'asset-missing',
        name: 'missing-camera.mp4',
        path: 'C:/Missing/missing-camera.mp4',
        missing: true
      }
    ];
    project.timeline = makeTimeline([makeVideoClip({ id: 'clip-missing', mediaId: 'asset-missing' })]);

    expect(runExportPreflight(project)).toEqual([
      expect.objectContaining({
        type: 'missing-media',
        severity: 'blocking',
        items: ['missing-camera.mp4'],
        clipIds: ['clip-missing'],
        mediaIds: ['asset-missing']
      })
    ]);
  });

  it('ignores missing media that is not reachable from the exported timeline', () => {
    const project = makeProject();
    project.media = [
      ...project.media,
      {
        id: 'asset-unused',
        type: 'video',
        name: 'unused-missing.mp4',
        path: 'C:/Missing/unused-missing.mp4',
        duration: 1,
        width: 1920,
        height: 1080,
        missing: true
      } satisfies MediaAsset
    ];

    expect(runExportPreflight(project).some((issue) => issue.type === 'missing-media')).toBe(false);
  });

  it('checks missing media inside reachable nested sequences', () => {
    const project = makeProject();
    project.media = [
      project.media[0],
      { ...project.media[0], id: 'asset-nested', name: 'nested-missing.mp4', path: '', missing: true }
    ];
    project.timeline = makeTimeline([
      {
        ...makeVideoClip({ id: 'nested-wrapper', mediaId: 'asset-1' }),
        type: 'nested-sequence',
        sequenceId: 'sequence-nested',
        volume: 1
      }
    ]);
    project.sequences = [
      { id: PRIMARY_SEQUENCE_ID, name: 'Main Sequence', timeline: project.timeline },
      { id: 'sequence-nested', name: 'Nested', timeline: makeTimeline([makeVideoClip({ id: 'nested-child', mediaId: 'asset-nested' })]) }
    ];

    expect(runExportPreflight(project)).toContainEqual(expect.objectContaining({ type: 'missing-media', items: ['nested-missing.mp4'] }));
  });

  it('warns when text drawtext fonts are not available', () => {
    const project = makeProject();
    project.timeline = makeTimeline([
      makeTextClip({ id: 'text-a', style: { fontFamily: '"Missing Brand", Missing Fallback' } }),
      makeTextClip({ id: 'text-b', style: { fontFamily: 'Inter, Arial, sans-serif' } })
    ]);

    const issues = runExportPreflight(project, {
      isFontFamilyAvailable: (fontFamily) => fontFamily === 'Arial'
    });

    expect(issues).toContainEqual(
      expect.objectContaining({
        type: 'missing-font',
        severity: 'warning',
        items: ['Missing Brand'],
        clipIds: ['text-a']
      })
    );
  });

  it('does not warn when a font stack has an available fallback family', () => {
    const project = makeProject();
    project.timeline = makeTimeline([makeTextClip({ id: 'text-fallback', style: { fontFamily: 'Missing Brand, Arial' } })]);

    expect(runExportPreflight(project, { isFontFamilyAvailable: (fontFamily) => fontFamily === 'Arial' }).some((issue) => issue.type === 'missing-font')).toBe(false);
  });

  it('blocks when FFmpeg is unavailable', () => {
    expect(runExportPreflight(makeProject(), { ffmpegAvailable: false })).toContainEqual(
      expect.objectContaining({
        type: 'ffmpeg',
        severity: 'blocking',
        items: ['ffmpeg']
      })
    );
  });

  it('warns when subtitle clips exist and Whisper is not configured', () => {
    const project = makeProject();
    project.timeline = {
      transitions: [],
      tracks: [
        createTrack({ id: 'track-video', type: 'video', name: 'Video 1', clips: [] }),
        createTrack({ id: 'track-audio', type: 'audio', name: 'Audio 1', clips: [] }),
        createTrack({ id: 'track-subtitle', type: 'subtitle', name: 'Subtitle 1', clips: [makeSubtitleClip()] })
      ]
    };

    expect(runExportPreflight(project, { whisperReady: false, whisperMessage: 'Whisper path missing' })).toContainEqual(
      expect.objectContaining({
        type: 'whisper-path',
        severity: 'warning',
        items: ['Whisper path missing']
      })
    );
  });

  it('parses CSS font-family lists with quoted names', () => {
    expect(parseFontFamilyList('"Noto Sans CJK", Arial, sans-serif')).toEqual(['Noto Sans CJK', 'Arial', 'sans-serif']);
  });
});
