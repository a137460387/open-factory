import { describe, expect, it } from 'vitest';
import {
  buildMediaHealthDashboard,
  buildRecentImportTrend,
  calculateMediaHealthRingProgress,
  createTrack,
  planMediaHealthRepairTasks,
  runProjectHealthCheck,
  shouldAutoShowMediaHealthDashboard,
  type Clip,
  type MediaAsset,
  type Project
} from '../src';
import { makeProject } from './test-utils';

const nowMs = Date.UTC(2026, 5, 18, 12);

describe('media health dashboard', () => {
  it('calculates proxy coverage card data', () => {
    const { dashboard } = dashboardFixture();

    expect(dashboard.proxyCoverage).toMatchObject({
      ready: 2,
      total: 4,
      progress: expect.objectContaining({ percent: 50, dashArray: '50 50' })
    });
  });

  it('calculates missing media card data', () => {
    const { dashboard } = dashboardFixture();

    expect(dashboard.missingMedia).toEqual({ count: 1, assetIds: ['missing'] });
  });

  it('calculates expired proxy card data from source and proxy mtimes', () => {
    const { dashboard } = dashboardFixture();

    expect(dashboard.expiredProxies).toEqual({ count: 1, assetIds: ['expired'] });
  });

  it('calculates unused media card data from project health orphan rows', () => {
    const { dashboard } = dashboardFixture();

    expect(dashboard.unusedMedia).toEqual({ count: 1, assetIds: ['unused-audio'] });
  });

  it('calculates storage occupancy card data', () => {
    const { dashboard } = dashboardFixture();

    expect(dashboard.storage).toMatchObject({
      mediaBytes: 4000,
      proxyBytes: 1536,
      cacheBytes: 300,
      totalBytes: 5836
    });
    expect(dashboard.storage.segments.map((segment) => segment.kind)).toEqual(['media', 'proxy', 'cache']);
    expect(dashboard.storage.segments.reduce((total, segment) => total + segment.bytes, 0)).toBe(5836);
  });

  it('calculates recent import card data', () => {
    const { dashboard } = dashboardFixture();

    expect(dashboard.recentImports.points).toHaveLength(7);
    expect(dashboard.recentImports.points.at(-1)).toEqual({ day: '2026-06-18', count: 2 });
    expect(dashboard.recentImports.points.find((point) => point.day === '2026-06-15')).toEqual({ day: '2026-06-15', count: 1 });
  });

  it('calculates ring progress values for the donut chart', () => {
    expect(calculateMediaHealthRingProgress(3, 4)).toEqual({
      value: 3,
      total: 4,
      ratio: 0.75,
      percent: 75,
      dashArray: '75 25'
    });
    expect(calculateMediaHealthRingProgress(0, 0)).toMatchObject({ ratio: 1, percent: 100 });
  });

  it('keeps recent import trend to seven points', () => {
    const trend = buildRecentImportTrend([
      { ...asset('a', 'C:/Media/a.mp4'), importedAt: '2026-06-18T01:00:00.000Z' },
      asset('no-date', 'C:/Media/no-date.mp4'),
      { ...asset('old', 'C:/Media/old.mp4'), importedAt: '2026-01-01T01:00:00.000Z' },
      { ...asset('invalid', 'C:/Media/invalid.mp4'), importedAt: 'not-a-date' }
    ], nowMs);
    expect(trend).toHaveLength(7);
    expect(trend.find((p) => p.day === '2026-06-18')?.count).toBe(1);
  });

  it('plans one-click repair task groups', () => {
    const { dashboard, report } = dashboardFixture();

    expect(planMediaHealthRepairTasks(report, dashboard.expiredProxies.assetIds)).toEqual([
      { type: 'generate-missing-proxies', count: 1, assetIds: ['needs-proxy'] },
      { type: 'clean-unused-media', count: 1, assetIds: ['unused-audio'] },
      { type: 'rebuild-damaged-cache', count: 1, assetIds: ['expired'] }
    ]);
  });

  it('decides startup auto-show only when enabled and issues exist', () => {
    expect(shouldAutoShowMediaHealthDashboard({ enabled: true, issueCount: 1 })).toBe(true);
    expect(shouldAutoShowMediaHealthDashboard({ enabled: true, issueCount: 0 })).toBe(false);
    expect(shouldAutoShowMediaHealthDashboard({ enabled: false, issueCount: 4 })).toBe(false);
  });
});

function dashboardFixture() {
  const project = makeHealthProject();
  const report = runProjectHealthCheck(project, { missingMediaAssetIds: ['missing'] });
  const dashboard = buildMediaHealthDashboard(project, report, {
    sourceStats: {
      'C:/Media/ready.mp4': { size: 1000, mtimeMs: 1000 },
      'C:/Missing/missing.mp4': { size: 400, mtimeMs: 1000 },
      'C:/Media/expired.mp4': { size: 2000, mtimeMs: 3000 },
      'C:/Media/unused.wav': { size: 100, mtimeMs: 1000 },
      'C:/Media/needs-proxy.mov': { size: 500, mtimeMs: 1000 }
    },
    proxyStats: {
      'C:/Proxy/ready.mp4': { size: 1024, mtimeMs: 2000 },
      'C:/Proxy/expired.mp4': { size: 512, mtimeMs: 1000 }
    },
    cacheBytes: 300,
    nowMs
  });
  return { project, report, dashboard };
}

function makeHealthProject(): Project {
  const project = makeProject();
  const media = [
    asset('ready', 'C:/Media/ready.mp4', { proxyPath: 'C:/Proxy/ready.mp4', proxyStatus: 'ready', importedAt: '2026-06-18T05:00:00.000Z' }),
    asset('missing', 'C:/Missing/missing.mp4', { missing: true, importedAt: '2026-06-17T05:00:00.000Z' }),
    asset('expired', 'C:/Media/expired.mp4', { proxyPath: 'C:/Proxy/expired.mp4', proxyStatus: 'ready', importedAt: '2026-06-15T05:00:00.000Z' }),
    asset('unused-audio', 'C:/Media/unused.wav', { type: 'audio', width: 0, height: 0, importedAt: '2026-06-12T05:00:00.000Z' }),
    asset('needs-proxy', 'C:/Media/needs-proxy.mov', { width: 3840, height: 2160, proxyStatus: 'none', importedAt: '2026-06-18T06:00:00.000Z' })
  ];
  const timeline = {
    transitions: [],
    markers: [],
    tracks: [
      createTrack({
        id: 'track-video',
        type: 'video',
        name: 'Video 1',
        clips: [
          clip('clip-ready', 'ready'),
          clip('clip-missing', 'missing'),
          clip('clip-expired', 'expired'),
          clip('clip-needs-proxy', 'needs-proxy')
        ]
      })
    ]
  };
  return {
    ...project,
    media,
    timeline,
    sequences: [{ id: project.activeSequenceId, name: 'Main Sequence', timeline }]
  };
}

function asset(id: string, path: string, overrides: Partial<MediaAsset> = {}): MediaAsset {
  return {
    id,
    type: overrides.type ?? 'video',
    name: path.replace(/\\/g, '/').split('/').pop() ?? id,
    path,
    duration: 6,
    width: overrides.width ?? 1280,
    height: overrides.height ?? 720,
    missing: overrides.missing,
    size: 100,
    mtimeMs: 1000,
    importedAt: overrides.importedAt,
    proxyPath: overrides.proxyPath,
    proxyStatus: overrides.proxyStatus,
    hasAudio: true,
    audioChannels: 2,
    audioSampleRate: 44_100,
    audioCodec: 'aac',
    videoCodec: overrides.type === 'audio' ? undefined : 'h264'
  };
}

function clip(id: string, mediaId: string): Extract<Clip, { type: 'video' }> {
  return {
    id,
    type: 'video',
    name: id,
    mediaId,
    trackId: 'track-video',
    start: 0,
    duration: 1,
    trimStart: 0,
    trimEnd: 0,
    speed: 1,
    colorCorrection: {},
    transform: { x: 0, y: 0, scale: 1, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 },
    volume: 1
  };
}
