import { describe, expect, it } from 'vitest';
import {
  applyConformMedia,
  buildConformFilenameKey,
  buildConformMediaReplacements,
  buildConformPreflight,
  buildConformReport,
  buildManualConformMatches,
  ConformMediaCommand,
  matchConformByFilename,
  matchConformByTimecode,
  stripProxySuffix,
  type MediaAsset,
  type Project
} from '../src';
import { makeProject } from './test-utils';

function makeProxyAsset(overrides: Partial<MediaAsset> = {}): MediaAsset {
  return {
    id: 'proxy-1',
    type: 'video',
    name: 'scene01_proxy_1080p.mp4',
    path: 'C:/Proxy/scene01_proxy_1080p.mp4',
    duration: 10,
    width: 1920,
    height: 1080,
    frameRate: 25,
    ...overrides
  };
}

describe('conform media workflow', () => {
  it('matches original media by filename after stripping proxy suffixes', () => {
    const asset = makeProxyAsset();
    const matches = matchConformByFilename([asset], [{ path: 'D:/Originals/scene01.mov' }]);

    expect(stripProxySuffix('C:/Proxy/Scene_01.proxy.mov')).toBe('Scene_01');
    expect(stripProxySuffix('scene01')).toBe('scene01');
    expect(buildConformFilenameKey('Scene01_PROXY_1080p.mp4')).toBe('scene01');
    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({
      assetId: 'proxy-1',
      strategy: 'filename',
      candidate: { path: 'D:/Originals/scene01.mov' }
    });
    expect(matches[0].failureReason).toBeUndefined();
  });

  it('reports filename no-match and duplicate-candidate failures', () => {
    const asset = makeProxyAsset({ name: 'scene01_proxy.mp4' });
    const noMatch = matchConformByFilename([asset], [{ path: 'D:/Originals/other.mov' }]);
    const duplicate = matchConformByFilename([asset], [{ path: 'D:/A/scene01.mov' }, { path: 'D:/B/scene01.mxf' }]);
    const caseSensitive = matchConformByFilename([asset], [{ path: 'D:/Originals/SCENE01.mov' }], { caseInsensitive: false });

    expect(noMatch[0]).toMatchObject({ assetId: asset.id, strategy: 'filename', failureReason: 'not-found', candidatePaths: [] });
    expect(duplicate[0]).toMatchObject({
      assetId: asset.id,
      strategy: 'filename',
      failureReason: 'duplicate-candidates',
      candidatePaths: ['D:/A/scene01.mov', 'D:/B/scene01.mxf']
    });
    expect(caseSensitive[0].failureReason).toBe('not-found');
  });

  it('matches originals by embedded start timecode when available', () => {
    const asset = makeProxyAsset({ startTimecode: '01:00:00:00' } as Partial<MediaAsset>);
    const matches = matchConformByTimecode([asset], [{ path: 'D:/Originals/camera-a.mov', timecode: '01:00:00:00' }]);

    expect(matches[0]).toMatchObject({
      assetId: 'proxy-1',
      strategy: 'timecode',
      candidate: { path: 'D:/Originals/camera-a.mov' }
    });
  });

  it('reports timecode no-match and duplicate-candidate failures', () => {
    const asset = makeProxyAsset({ timecode: '01:00:00:00' } as Partial<MediaAsset>);
    const noTimecode = matchConformByTimecode([makeProxyAsset()], [{ path: 'D:/Originals/camera-a.mov' }]);
    const duplicate = matchConformByTimecode(
      [asset],
      [
        { path: 'D:/A/camera-a.mov', startTimecode: '01:00:00:00' },
        { path: 'D:/B/camera-a.mov', timecode: '01:00:00:00' }
      ]
    );

    expect(noTimecode[0]).toMatchObject({ strategy: 'timecode', failureReason: 'not-found' });
    expect(duplicate[0]).toMatchObject({
      strategy: 'timecode',
      failureReason: 'duplicate-candidates',
      candidatePaths: ['D:/A/camera-a.mov', 'D:/B/camera-a.mov']
    });
  });

  it('warns only when duration differs by more than one frame', () => {
    const asset = makeProxyAsset({ duration: 10, frameRate: 25 });
    const withinOneFrame = buildConformPreflight(
      [asset],
      [{ assetId: asset.id, strategy: 'filename', candidate: { path: 'D:/Originals/scene01.mov', duration: 10.04 } }]
    );
    const beyondOneFrame = buildConformPreflight(
      [asset],
      [{ assetId: asset.id, strategy: 'filename', candidate: { path: 'D:/Originals/scene01.mov', duration: 10.041 } }]
    );

    expect(withinOneFrame[0].warnings).toEqual([]);
    expect(beyondOneFrame[0].warnings).toMatchObject([{ reason: 'duration-mismatch', threshold: 0.04 }]);
    expect(beyondOneFrame[0].status).toBe('warning');
  });

  it('warns for frame-rate and resolution differences without blocking replacements', () => {
    const asset = makeProxyAsset({ avgFrameRate: '24000/1001', frameRate: undefined, width: 1280, height: 720 });
    const preflight = buildConformPreflight(
      [asset],
      [
        {
          assetId: asset.id,
          strategy: 'filename',
          candidate: { path: 'D:/Originals/scene01.mov', realFrameRate: '25', width: 3840, height: 2160 }
        }
      ]
    );

    expect(preflight[0].status).toBe('warning');
    expect(preflight[0].warnings.map((warning) => warning.reason)).toEqual(['frame-rate-mismatch', 'resolution-mismatch']);
    expect(buildConformMediaReplacements(preflight)).toEqual([{ assetId: asset.id, replacementPath: 'D:/Originals/scene01.mov', strategy: 'filename' }]);
  });

  it('falls back to project frame rate when media frame-rate metadata is unavailable', () => {
    const asset = makeProxyAsset({ duration: 10, frameRate: undefined, avgFrameRate: undefined, realFrameRate: undefined });
    const preflight = buildConformPreflight(
      [asset],
      [{ assetId: asset.id, strategy: 'filename', candidate: { path: 'D:/Originals/scene01.mov', duration: 10.05 } }],
      { fallbackFrameRate: 24 }
    );

    expect(preflight[0].warnings[0]).toMatchObject({ reason: 'duration-mismatch', threshold: 1 / 24 });
  });

  it('keeps a complete conform report for success, warnings, and failures', () => {
    const first = makeProxyAsset({ id: 'proxy-1', path: 'C:/Proxy/scene01_proxy.mp4', duration: 10, frameRate: 25 });
    const second = makeProxyAsset({ id: 'proxy-2', path: 'C:/Proxy/scene02_proxy.mp4', name: 'scene02_proxy.mp4', duration: 8, frameRate: 25 });
    const preflight = buildConformPreflight(
      [first, second],
      [
        { assetId: first.id, strategy: 'filename', candidate: { path: 'D:/Originals/scene01.mov', duration: 10.1 } },
        { assetId: second.id, strategy: 'filename', failureReason: 'not-found', candidatePaths: [] }
      ]
    );
    const report = buildConformReport(preflight);

    expect(report).toMatchObject({
      totalCount: 2,
      successCount: 1,
      warningCount: 1,
      failureCount: 1
    });
    expect(report.successes[0]).toEqual({
      assetId: first.id,
      fromPath: 'C:/Proxy/scene01_proxy.mp4',
      toPath: 'D:/Originals/scene01.mov',
      strategy: 'filename'
    });
    expect(report.warnings[0]).toMatchObject({ assetId: first.id, reason: 'duration-mismatch', originalPath: 'D:/Originals/scene01.mov' });
    expect(report.failures[0]).toEqual({ assetId: second.id, proxyPath: 'C:/Proxy/scene02_proxy.mp4', reason: 'not-found', candidatePaths: [] });
  });

  it('only applies selected media when doing partial conform', () => {
    const first = makeProxyAsset({ id: 'proxy-1', path: 'C:/Proxy/scene01_proxy.mp4' });
    const second = makeProxyAsset({ id: 'proxy-2', name: 'scene02_proxy.mp4', path: 'C:/Proxy/scene02_proxy.mp4' });
    const project = { ...makeProject(), media: [first, second] };
    const preflight = buildConformPreflight(
      project.media,
      [
        { assetId: first.id, strategy: 'filename', candidate: { path: 'D:/Originals/scene01.mov' } },
        { assetId: second.id, strategy: 'filename', candidate: { path: 'D:/Originals/scene02.mov' } }
      ],
      { selectedAssetIds: [first.id] }
    );
    const conformed = applyConformMedia(project, buildConformMediaReplacements(preflight));

    expect(conformed.media.find((asset) => asset.id === first.id)?.path).toBe('D:/Originals/scene01.mov');
    expect(conformed.media.find((asset) => asset.id === second.id)?.path).toBe('C:/Proxy/scene02_proxy.mp4');
  });

  it('supports selected-only reports and missing project assets', () => {
    const asset = makeProxyAsset();
    const preflight = buildConformPreflight(
      [asset],
      [
        { assetId: asset.id, strategy: 'filename', candidate: { path: 'D:/Originals/scene01.mov' } },
        { assetId: 'missing-asset', strategy: 'manual', candidate: { path: 'D:/Originals/missing.mov' } }
      ],
      { selectedAssetIds: [asset.id] }
    );
    const selectedReport = buildConformReport(preflight, { selectedOnly: true });
    const fullReport = buildConformReport(preflight);

    expect(selectedReport.totalCount).toBe(1);
    expect(selectedReport.successCount).toBe(1);
    expect(fullReport.failures[0]).toMatchObject({ assetId: 'missing-asset', proxyPath: '', reason: 'not-found', candidatePaths: ['D:/Originals/missing.mov'] });
  });

  it('creates manual pairing matches for user-specified originals', () => {
    const matches = buildManualConformMatches([{ assetId: 'proxy-1', candidate: { path: 'D:/Originals/manual.mov' } }, { assetId: 'proxy-2' }]);

    expect(matches[0]).toEqual({ assetId: 'proxy-1', strategy: 'manual', candidate: { path: 'D:/Originals/manual.mov' }, candidatePaths: ['D:/Originals/manual.mov'], failureReason: undefined });
    expect(matches[1]).toEqual({ assetId: 'proxy-2', strategy: 'manual', candidate: undefined, candidatePaths: [], failureReason: 'not-found' });
  });

  it('returns the same project when no conform replacements are present', () => {
    const project = makeProject();

    expect(applyConformMedia(project, [])).toBe(project);
  });

  it('undoes ConformMediaCommand path replacement as one project command', () => {
    let project: Project = { ...makeProject(), media: [makeProxyAsset({ id: 'asset-1', path: 'C:/Proxy/scene01_proxy.mp4' })] };
    const accessor = {
      getProject: () => project,
      setProject: (next: Project) => {
        project = next;
      }
    };
    const command = new ConformMediaCommand(accessor, [{ assetId: 'asset-1', replacementPath: 'D:/Originals/scene01.mov', strategy: 'filename' }]);

    command.execute();
    expect(project.media[0].path).toBe('D:/Originals/scene01.mov');

    command.undo();
    expect(project.media[0].path).toBe('C:/Proxy/scene01_proxy.mp4');
  });
});
