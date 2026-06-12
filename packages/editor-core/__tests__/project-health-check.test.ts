import { describe, expect, it } from 'vitest';
import { createTrack, getProjectHealthIssueCount, PRIMARY_SEQUENCE_ID, runProjectHealthCheck, type MediaAsset } from '../src';
import { makeProject, makeSubtitleClip, makeTimeline, makeVideoClip } from './test-utils';

describe('project health check', () => {
  it('reports missing media with the source path and owning clip', () => {
    const project = makeProject();
    project.media = [{ ...project.media[0], id: 'asset-missing', name: 'missing.mp4', path: 'C:/Missing/missing.mp4', missing: true }];
    project.timeline = makeTimeline([makeVideoClip({ id: 'clip-missing', name: 'Missing Clip', mediaId: 'asset-missing' })]);

    const report = runProjectHealthCheck(project);

    expect(report.missingMedia).toEqual([
      expect.objectContaining({
        assetId: 'asset-missing',
        path: 'C:/Missing/missing.mp4',
        fileName: 'missing.mp4',
        references: [expect.objectContaining({ clipId: 'clip-missing', clipName: 'Missing Clip', trackName: 'Video 1' })]
      })
    ]);
  });

  it('groups duplicate media when different paths share size and mtime', () => {
    const project = makeProject();
    project.media = [
      makeAsset({ id: 'asset-a', path: 'C:/Media/a.mp4', size: 4096, mtimeMs: 1000 }),
      makeAsset({ id: 'asset-b', path: 'D:/Mirror/a.mp4', size: 4096, mtimeMs: 1000 }),
      makeAsset({ id: 'asset-c', path: 'C:/Media/c.mp4', size: 4096, mtimeMs: 2000 })
    ];
    project.timeline = makeTimeline([makeVideoClip({ id: 'clip-b', mediaId: 'asset-b' })]);

    const report = runProjectHealthCheck(project);

    expect(report.duplicateMedia).toHaveLength(1);
    expect(report.duplicateMedia[0]).toMatchObject({
      size: 4096,
      mtimeMs: 1000,
      assets: [
        expect.objectContaining({ assetId: 'asset-a', path: 'C:/Media/a.mp4' }),
        expect.objectContaining({ assetId: 'asset-b', path: 'D:/Mirror/a.mp4', references: [expect.objectContaining({ clipId: 'clip-b' })] })
      ]
    });
  });

  it('reports orphan media that is imported but unused by any timeline clip', () => {
    const project = makeProject();
    project.media = [
      makeAsset({ id: 'asset-used', path: 'C:/Media/used.mp4' }),
      makeAsset({ id: 'asset-orphan', path: 'C:/Media/orphan.wav', name: 'orphan.wav', type: 'audio', width: 0, height: 0 })
    ];
    project.timeline = makeTimeline([makeVideoClip({ mediaId: 'asset-used' })]);

    expect(runProjectHealthCheck(project).orphanMedia).toEqual([
      expect.objectContaining({ assetId: 'asset-orphan', fileName: 'orphan.wav' })
    ]);
  });

  it('reports large video files that need a proxy but have no ready proxy', () => {
    const project = makeProject();
    project.media = [
      makeAsset({ id: 'asset-4k', path: 'C:/Media/4k.mov', name: '4k.mov', width: 3840, height: 2160, proxyStatus: 'none' }),
      makeAsset({ id: 'asset-ready', path: 'C:/Media/proxy.mp4', name: 'proxy.mp4', width: 3840, height: 2160, proxyStatus: 'ready', proxyPath: 'C:/Proxy/proxy.mp4' })
    ];
    project.timeline = makeTimeline([makeVideoClip({ mediaId: 'asset-4k' }), makeVideoClip({ id: 'clip-ready', mediaId: 'asset-ready', start: 11 })]);

    expect(runProjectHealthCheck(project).proxyMissing).toEqual([
      expect.objectContaining({ assetId: 'asset-4k', width: 3840, height: 2160 })
    ]);
  });

  it('reports subtitle fonts that are not installed', () => {
    const project = makeProject();
    project.timeline = {
      transitions: [],
      markers: [],
      tracks: [
        createTrack({ id: 'track-video', type: 'video', name: 'Video 1', clips: [] }),
        createTrack({ id: 'track-subtitle', type: 'subtitle', name: 'Subtitle 1', clips: [makeSubtitleClip({ id: 'subtitle-a', style: { fontFamily: '"Missing Brand", Missing Fallback' } })] })
      ]
    };
    project.sequences = [{ id: PRIMARY_SEQUENCE_ID, name: 'Main Sequence', timeline: project.timeline }];

    expect(runProjectHealthCheck(project, { isFontFamilyAvailable: (fontFamily) => fontFamily === 'Arial' }).missingFonts).toEqual([
      expect.objectContaining({
        fontFamily: 'Missing Brand',
        clip: expect.objectContaining({ clipId: 'subtitle-a', trackName: 'Subtitle 1' })
      })
    ]);
  });

  it('counts each report item category', () => {
    const project = makeProject();
    project.media = [
      makeAsset({ id: 'asset-missing', path: 'C:/Missing/missing.mp4', missing: true }),
      makeAsset({ id: 'asset-orphan', path: 'C:/Media/orphan.mp4' })
    ];
    project.timeline = makeTimeline([makeVideoClip({ mediaId: 'asset-missing' })]);

    expect(getProjectHealthIssueCount(runProjectHealthCheck(project))).toBe(2);
  });
});

function makeAsset(overrides: Partial<MediaAsset> = {}): MediaAsset {
  const path = overrides.path ?? 'C:/Media/source.mp4';
  return {
    id: overrides.id ?? 'asset',
    type: overrides.type ?? 'video',
    name: overrides.name ?? path.replace(/\\/g, '/').split('/').pop() ?? 'source.mp4',
    path,
    duration: overrides.duration ?? 10,
    width: overrides.width ?? 1920,
    height: overrides.height ?? 1080,
    missing: overrides.missing,
    size: overrides.size ?? 4096,
    mtimeMs: overrides.mtimeMs ?? 1000,
    proxyPath: overrides.proxyPath,
    proxyStatus: overrides.proxyStatus ?? (overrides.type === 'audio' ? undefined : 'none'),
    hasAudio: overrides.hasAudio,
    audioChannels: overrides.audioChannels,
    audioSampleRate: overrides.audioSampleRate,
    audioCodec: overrides.audioCodec,
    videoCodec: overrides.videoCodec
  };
}
