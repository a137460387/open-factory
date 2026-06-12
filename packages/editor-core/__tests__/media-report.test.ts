import { describe, expect, it } from 'vitest';
import {
  buildOfflineMediaReport,
  buildOfflineMediaReportHtml,
  buildProjectArchivePreflight,
  collectOfflineMediaReportPaths,
  createProject,
  createTrack,
  DEFAULT_COLOR_CORRECTION,
  DEFAULT_TRANSFORM,
  PRIMARY_SEQUENCE_ID,
  type MediaAsset
} from '../src';

function makeAsset(overrides: Partial<MediaAsset>): MediaAsset {
  return {
    id: overrides.id ?? 'media-video',
    type: overrides.type ?? 'video',
    name: overrides.name ?? 'clip.mp4',
    path: overrides.path ?? 'C:/Media/clip.mp4',
    duration: overrides.duration ?? 6,
    width: overrides.width ?? 1280,
    height: overrides.height ?? 720,
    ...overrides
  };
}

describe('offline media report', () => {
  it('renders required media fields and summary totals in the HTML report', () => {
    const project = createProject('Report Demo');
    const media = makeAsset({
      id: 'media-video',
      path: 'C:/Media/clip.mp4',
      size: 4096,
      proxyPath: 'C:/Cache/proxy.mp4',
      proxyStatus: 'ready'
    });
    const timeline = {
      markers: [],
      transitions: [],
      tracks: [
        createTrack({
          id: 'track-video',
          type: 'video',
          name: 'Video 1',
          clips: [
            {
              id: 'clip-video',
              type: 'video',
              name: 'clip.mp4',
              mediaId: 'media-video',
              trackId: 'track-video',
              start: 0,
              duration: 6,
              trimStart: 0,
              trimEnd: 0,
              speed: 1,
              colorCorrection: { ...DEFAULT_COLOR_CORRECTION },
              transform: { ...DEFAULT_TRANSFORM },
              volume: 1
            }
          ]
        }),
        createTrack({ id: 'track-audio', type: 'audio', name: 'Audio 1', clips: [] })
      ]
    };
    project.media = [media];
    project.timeline = timeline;
    project.sequences = [{ id: PRIMARY_SEQUENCE_ID, name: 'Main Sequence', timeline }];

    const html = buildOfflineMediaReportHtml(
      project,
      [
        { path: 'C:/Media/clip.mp4', exists: true, size: 4096 },
        { path: 'C:/Cache/proxy.mp4', exists: true, size: 1024 }
      ],
      { estimatedExportSizeBytes: 8192, generatedAt: '2026-06-12T00:00:00.000Z' }
    );

    expect(html).toContain('素材报告：Report Demo');
    expect(html).toContain('C:/Media/clip.mp4');
    expect(html).toContain('文件大小');
    expect(html).toContain('是否存在');
    expect(html).toContain('是否有 proxy');
    expect(html).toContain('<td>是</td>');
    expect(html).toContain('<td>1</td>');
    expect(html).toContain('项目总时长：0:06');
    expect(html).toContain('总媒体大小：4.0 KB');
    expect(html).toContain('导出预估大小：8.0 KB');
  });

  it('marks missing media rows for report and archive preflight', () => {
    const project = createProject('Missing Demo');
    project.media = [
      makeAsset({ id: 'missing-video', path: 'C:/Missing/clip.mp4', missing: true }),
      makeAsset({ id: 'present-audio', type: 'audio', name: 'audio.wav', path: 'C:/Media/audio.wav', width: 0, height: 0, size: 2048 })
    ];

    const statuses = [
      { path: 'C:/Missing/clip.mp4', exists: false },
      { path: 'C:/Media/audio.wav', exists: true, size: 2048 }
    ];
    const report = buildOfflineMediaReport(project, statuses);
    const html = buildOfflineMediaReportHtml(project, statuses);
    const preflight = buildProjectArchivePreflight(project, statuses);

    expect(report.totals.missingCount).toBe(1);
    expect(report.totals.mediaSizeBytes).toBe(2048);
    expect(html).toContain('class="missing-media"');
    expect(preflight.missingRows).toHaveLength(1);
    expect(preflight.missingPaths).toEqual(['C:/Missing/clip.mp4']);
  });

  it('collects unique source, image sequence, and proxy paths for filesystem status checks', () => {
    const project = createProject('Sequence Demo');
    project.media = [
      makeAsset({
        id: 'sequence',
        type: 'image',
        name: 'shot_0001.png',
        path: 'C:/Media/shot_0001.png',
        proxyPath: 'C:/Cache/sequence-proxy.mp4',
        imageSequence: {
          pattern: 'C:/Media/shot_%04d.png',
          startNumber: 1,
          frameCount: 3,
          frameRate: 24,
          paths: ['C:/Media/shot_0001.png', 'C:/Media/shot_0002.png', 'C:/Media/shot_0003.png']
        }
      }),
      makeAsset({
        id: 'duplicate',
        path: 'C:/Media/shot_0002.png',
        proxyPath: ' '
      })
    ];

    expect(collectOfflineMediaReportPaths(project)).toEqual([
      'C:/Media/shot_0001.png',
      'C:/Media/shot_0002.png',
      'C:/Media/shot_0003.png',
      'C:/Cache/sequence-proxy.mp4'
    ]);
  });

  it('reports image sequence frame rows, proxy failures, and escaped HTML safely', () => {
    const project = createProject('Unsafe <Project>');
    project.settings = { width: 3840, height: 2160, fps: 60 };
    project.media = [
      makeAsset({
        id: 'sequence',
        type: 'image',
        name: 'Frame & "Title"',
        path: 'C:/Media/frame_0001.png',
        size: 1.4 * 1024 * 1024,
        proxyPath: 'C:/Cache/bad-proxy.mp4',
        proxyStatus: 'error',
        imageSequence: {
          pattern: 'C:/Media/frame_%04d.png',
          startNumber: 1,
          frameCount: 2,
          frameRate: 24,
          paths: ['C:/Media/frame_0001.png', 'C:/Media/frame_0002.png']
        }
      }),
      makeAsset({
        id: 'huge',
        name: 'Huge.mov',
        path: 'C:/Media/huge.mov',
        size: 2.5 * 1024 * 1024 * 1024
      })
    ];

    const report = buildOfflineMediaReport(project, [
      { path: 'C:/Media/frame_0001.png', exists: true, size: 1.4 * 1024 * 1024 },
      { path: 'C:/Media/frame_0002.png', exists: true, size: 512 },
      { path: 'C:/Cache/bad-proxy.mp4', exists: true, size: 1024 },
      { path: 'C:/Media/huge.mov', exists: true, size: 2.5 * 1024 * 1024 * 1024 }
    ]);
    const html = buildOfflineMediaReportHtml(project, [
      { path: 'C:/Media/frame_0001.png', exists: true, size: 1.4 * 1024 * 1024 },
      { path: 'C:/Media/frame_0002.png', exists: true, size: 512 },
      { path: 'C:/Cache/bad-proxy.mp4', exists: true, size: 1024 },
      { path: 'C:/Media/huge.mov', exists: true, size: 2.5 * 1024 * 1024 * 1024 }
    ]);

    expect(report.rows.map((row) => row.path)).toEqual(['C:/Media/frame_0001.png', 'C:/Media/frame_0002.png', 'C:/Media/huge.mov']);
    expect(report.rows.find((row) => row.assetId === 'sequence')?.hasProxy).toBe(false);
    expect(report.totals.estimatedExportSizeBytes).toBeGreaterThanOrEqual(1024);
    expect(html).toContain('素材报告：Unsafe &lt;Project&gt;');
    expect(html).toContain('Frame &amp; &quot;Title&quot;');
    expect(html).toContain('1.4 MB');
    expect(html).toContain('2.5 GB');
    expect(html).toContain('512 B');
  });

  it('uses a minimum export estimate and formats hour-long project durations', () => {
    const project = createProject('Long Demo');
    project.settings = { width: 0, height: 0, fps: 0 };
    project.timeline = {
      markers: [],
      transitions: [],
      tracks: [
        createTrack({
          id: 'track-audio',
          type: 'audio',
          name: 'Audio',
          clips: [
            {
              id: 'clip-audio',
              type: 'audio',
              name: 'long.wav',
              mediaId: 'audio',
              trackId: 'track-audio',
              start: 3660,
              duration: 5,
              trimStart: 0,
              trimEnd: 0,
              speed: 1,
              volume: 1
            }
          ]
        })
      ]
    };
    project.sequences = [{ id: PRIMARY_SEQUENCE_ID, name: 'Main Sequence', timeline: project.timeline }];

    const html = buildOfflineMediaReportHtml(project);

    expect(html).toContain('项目总时长：1:01:05');
    expect(html).toContain('导出预估大小：');
  });
});
