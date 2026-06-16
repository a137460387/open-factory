import { describe, expect, it } from 'vitest';
import { buildClipReport, buildClipReportHtml, createProject, createTrack, DEFAULT_COLOR_CORRECTION, DEFAULT_TRANSFORM, PRIMARY_SEQUENCE_ID, type BaseClip, type Clip, type MediaAsset } from '../src';

describe('clip report', () => {
  it('renders the clip list HTML structure with effects and keyframe counts', () => {
    const project = makeClipReportProject();

    const html = buildClipReportHtml(project, { exportPresetName: 'Web 1080p', generatedAt: '2026-06-15T00:00:00.000Z' });

    expect(html).toContain('剪辑报告：Clip Report Demo');
    expect(html).toContain('data-section="project-overview"');
    expect(html).toContain('data-section="clip-list"');
    expect(html).toContain('<th>序号</th><th>名称</th><th>轨道</th><th>入点</th><th>出点</th><th>时长</th><th>特效列表</th><th>关键帧数</th>');
    expect(html).toContain('Web 1080p');
    expect(html).toContain('Hero &amp; Cut');
    expect(html).toContain('motion-blur, blur');
    expect(html).toContain('<td>2</td>');
    expect(html).toContain('标记点列表');
    expect(html).toContain('Review point');
    expect(html).toContain('字幕列表');
    expect(html).toContain('Hello &lt;subtitle&gt;');
  });

  it('deduplicates used media rows by file path and sums usage counts', () => {
    const project = makeClipReportProject();
    project.media.push(makeAsset({ id: 'asset-video-copy', name: 'same-source-copy.mp4', path: 'C:/Media/SAME-SOURCE.MP4' }));
    const videoTrack = project.timeline.tracks[0];
    videoTrack.clips.push(makeVideoClip({ id: 'clip-video-copy', name: 'Copy Use', mediaId: 'asset-video-copy', start: 6, duration: 1 }));

    const report = buildClipReport(project, { exportPresetName: 'Review' });

    expect(report.media).toEqual([
      {
        mediaId: 'asset-video',
        fileName: 'same-source.mp4',
        format: 'mp4',
        resolution: '1920 x 1080',
        duration: 12,
        useCount: 2
      }
    ]);
  });

  it('renders empty report tables without media, subtitles, or markers', () => {
    const project = createProject('Empty Report');
    project.timeline = { transitions: [], markers: [], tracks: [createTrack({ id: 'track-video', type: 'video', name: 'Video 1', clips: [] })] };
    project.media = [];
    project.sequences = [{ id: PRIMARY_SEQUENCE_ID, name: 'Main Sequence', timeline: project.timeline }];

    const html = buildClipReportHtml(project, { generatedAt: '2026-06-15T00:00:00.000Z' });

    expect(html).toContain('未指定');
    expect(html).toContain('无 clip。');
    expect(html).toContain('无使用媒体。');
    expect(html).toContain('无字幕。');
    expect(html).toContain('无标记点。');
  });

  it('renders English labels and localized durations when locale is en', () => {
    const project = makeClipReportProject();

    const html = buildClipReportHtml(project, {
      exportPresetName: 'Web 1080p',
      generatedAt: '2026-06-16T00:00:00.000Z',
      locale: 'en'
    });

    expect(html).toContain('<html lang="en">');
    expect(html).toContain('Clip Report：Clip Report Demo');
    expect(html).toContain('Generated At');
    expect(html).toContain('Project');
    expect(html).toContain('Duration');
    expect(html).toContain('00:06');
  });
});

function makeClipReportProject() {
  const project = createProject('Clip Report Demo');
  const media = [makeAsset({ id: 'asset-video', name: 'same-source.mp4', path: 'C:/Media/same-source.mp4' })];
  const video = makeVideoClip({
    id: 'clip-video',
    name: 'Hero & Cut',
    mediaId: 'asset-video',
    start: 2,
    duration: 4,
    trimStart: 1,
    trimEnd: 5,
    effects: [
      { id: 'effect-motion', type: 'motion-blur', enabled: true, params: { intensity: 0.5, angle: 0, samples: 8 } },
      { id: 'effect-blur', type: 'blur', enabled: true, params: { radius: 4 } }
    ],
    keyframes: {
      opacity: [{ id: 'kf-1', time: 0, value: 1, easing: 'linear' }],
      scaleX: [{ id: 'kf-2', time: 1, value: 1.2, easing: 'ease-in-out' }]
    }
  });
  const subtitle: Extract<Clip, { type: 'subtitle' }> = {
    ...makeBaseClip({ id: 'clip-subtitle', name: 'Caption', trackId: 'track-subtitle', start: 1, duration: 2 }),
    type: 'subtitle',
    text: 'Hello <subtitle>',
    style: {
      fontFamily: 'Inter',
      fontSize: 32,
      color: '#ffffff',
      backgroundColor: '#000000',
      backgroundOpacity: 0.4,
      position: 'bottom'
    },
    subtitleMode: 'burn-in'
  };
  const timeline = {
    transitions: [],
    markers: [{ id: 'marker-review', time: 3, label: 'Review point', color: '#f97316' }],
    tracks: [
      createTrack({ id: 'track-video', type: 'video', name: 'Video 1', clips: [video] }),
      createTrack({ id: 'track-subtitle', type: 'subtitle', name: 'Subtitles', clips: [subtitle] })
    ]
  };
  return {
    ...project,
    settings: { fps: 24, timecodeFormat: 'ndf' as const, width: 1920, height: 1080 },
    media,
    timeline,
    sequences: [{ id: PRIMARY_SEQUENCE_ID, name: 'Main Sequence', timeline }]
  };
}

function makeAsset(overrides: Partial<MediaAsset>): MediaAsset {
  return {
    id: 'asset-video',
    type: 'video',
    name: 'source.mp4',
    path: 'C:/Media/source.mp4',
    duration: 12,
    width: 1920,
    height: 1080,
    ...overrides
  };
}

function makeVideoClip(overrides: Partial<Extract<Clip, { type: 'video' }>>): Extract<Clip, { type: 'video' }> {
  return {
    ...makeBaseClip({ trackId: 'track-video', ...overrides }),
    type: 'video',
    mediaId: overrides.mediaId ?? 'asset-video',
    volume: 1
  };
}

function makeBaseClip(overrides: Partial<BaseClip> & { trackId: string }): BaseClip {
  return {
    id: overrides.id ?? 'clip',
    name: overrides.name ?? 'Clip',
    trackId: overrides.trackId,
    start: overrides.start ?? 0,
    duration: overrides.duration ?? 1,
    trimStart: overrides.trimStart ?? 0,
    trimEnd: overrides.trimEnd ?? 0,
    speed: overrides.speed ?? 1,
    colorCorrection: { ...DEFAULT_COLOR_CORRECTION },
    transform: { ...DEFAULT_TRANSFORM },
    effects: overrides.effects,
    keyframes: overrides.keyframes
  };
}
