import { describe, expect, it } from 'vitest';
import {
  buildSummaryFrameTimestamps,
  buildSummaryDataPack,
  buildSummarySystemPrompt,
  buildSummaryUserPrompt,
  parseVideoSummaryResponse,
  generateSummaryHtml,
  generateSummaryFilename,
  formatTimeShort,
  SUMMARY_FRAME_COUNT,
  SUMMARY_MAX_SUBTITLE_CHARS
} from '../src';
import { makeProject, makeVideoClip, makeSubtitleClip, makeTimeline } from './test-utils';
import type { Project, Clip, Track } from '../src';

function projectWith(overrides: { clips?: Clip[]; markers?: Project['timeline']['markers']; media?: Project['media'] }): Project {
  const base = makeProject();
  const clips = overrides.clips ?? base.timeline.tracks.flatMap((t) => t.clips);
  return {
    ...base,
    media: overrides.media ?? base.media,
    timeline: {
      ...base.timeline,
      markers: overrides.markers ?? base.timeline.markers,
      tracks: [
        {
          id: 'track-video',
          type: 'video',
          name: 'Video 1',
          clips
        } as unknown as Track
      ]
    }
  };
}

describe('buildSummaryFrameTimestamps', () => {
  it('returns 8 evenly spaced timestamps for a 100s video', () => {
    const result = buildSummaryFrameTimestamps(100, 8);
    expect(result).toHaveLength(8);
    expect(result[0]).toBeCloseTo(11.11, 1);
    expect(result[7]).toBeCloseTo(88.89, 1);
  });

  it('returns zeros for zero duration', () => {
    const result = buildSummaryFrameTimestamps(0, 5);
    expect(result).toEqual([0, 0, 0, 0, 0]);
  });

  it('clamps count between 1 and 24', () => {
    expect(buildSummaryFrameTimestamps(100, 0)).toHaveLength(1);
    expect(buildSummaryFrameTimestamps(100, 50)).toHaveLength(24);
  });

  it('returns zeros for NaN duration', () => {
    const result = buildSummaryFrameTimestamps(Number.NaN, 3);
    expect(result).toEqual([0, 0, 0]);
  });

  it('defaults to SUMMARY_FRAME_COUNT when count omitted', () => {
    const result = buildSummaryFrameTimestamps(60);
    expect(result).toHaveLength(SUMMARY_FRAME_COUNT);
  });
});

describe('buildSummaryDataPack', () => {
  it('packs project duration, tracks, clips', () => {
    const project = projectWith({});
    const pack = buildSummaryDataPack(project);
    expect(pack.trackCount).toBe(1);
    expect(pack.clipCount).toBeGreaterThan(0);
    expect(pack.duration).toBeGreaterThanOrEqual(0);
  });

  it('includes markers from timeline', () => {
    const project = projectWith({
      markers: [
        { id: 'm1', time: 10, label: '开场', color: '#fff' },
        { id: 'm2', time: 30, label: '高潮', color: '#f00' }
      ]
    });
    const pack = buildSummaryDataPack(project);
    expect(pack.markers).toEqual([
      { time: 10, label: '开场' },
      { time: 30, label: '高潮' }
    ]);
  });

  it('extracts subtitle text from subtitle clips', () => {
    const subClip = makeSubtitleClip({ text: '你好世界' });
    const videoClip = makeVideoClip({ id: 'v1', start: 0, duration: 10 });
    const project = projectWith({ clips: [videoClip, subClip] });
    const pack = buildSummaryDataPack(project);
    expect(pack.subtitleText).toContain('你好世界');
  });

  it('truncates subtitle text to SUMMARY_MAX_SUBTITLE_CHARS', () => {
    const longText = '字'.repeat(2000);
    const subClip = makeSubtitleClip({ text: longText });
    const project = projectWith({ clips: [subClip] });
    const pack = buildSummaryDataPack(project);
    expect(pack.subtitleText.length).toBeLessThanOrEqual(SUMMARY_MAX_SUBTITLE_CHARS);
  });

  it('extracts aiAnalysis scene descriptions', () => {
    const project = projectWith({
      media: [
        {
          id: 'asset-1',
          type: 'video',
          name: 'sample.mp4',
          path: 'C:\\Videos\\sample.mp4',
          duration: 20,
          width: 1920,
          height: 1080,
          size: 4096,
          mtimeMs: 1000,
          hasAudio: true,
          audioChannels: 2,
          audioSampleRate: 48000,
          audioCodec: 'aac',
          aiAnalysis: { tags: ['风景'], scene: '美丽的日落', mood: '宁静', objects: ['太阳', '海'], analysisTime: '', providerId: 'openai' }
        }
      ]
    });
    const pack = buildSummaryDataPack(project);
    expect(pack.aiSummaries).toEqual(['美丽的日落']);
  });
});

describe('buildSummarySystemPrompt', () => {
  it('returns a string containing JSON format instructions', () => {
    const prompt = buildSummarySystemPrompt();
    expect(prompt).toContain('title');
    expect(prompt).toContain('scenes');
    expect(prompt).toContain('emotionArc');
    expect(prompt).toContain('keyMoments');
    expect(prompt).toContain('tags');
    expect(prompt).toContain('JSON');
  });
});

describe('buildSummaryUserPrompt', () => {
  it('includes duration, tracks, clips info', () => {
    const prompt = buildSummaryUserPrompt({
      duration: 120,
      trackCount: 2,
      clipCount: 5,
      markers: [],
      subtitleText: '',
      aiSummaries: []
    });
    expect(prompt).toContain('02:00');
    expect(prompt).toContain('2');
    expect(prompt).toContain('5');
  });

  it('includes markers when present', () => {
    const prompt = buildSummaryUserPrompt({
      duration: 60,
      trackCount: 1,
      clipCount: 3,
      markers: [{ time: 10, label: '开场' }],
      subtitleText: '',
      aiSummaries: []
    });
    expect(prompt).toContain('章节标记');
    expect(prompt).toContain('开场');
  });

  it('includes subtitle text when present', () => {
    const prompt = buildSummaryUserPrompt({
      duration: 60,
      trackCount: 1,
      clipCount: 1,
      markers: [],
      subtitleText: '这是字幕内容',
      aiSummaries: []
    });
    expect(prompt).toContain('字幕文本片段');
    expect(prompt).toContain('这是字幕内容');
  });
});

describe('parseVideoSummaryResponse', () => {
  it('parses valid response', () => {
    const result = parseVideoSummaryResponse({
      title: '测试标题',
      summary: '这是摘要',
      scenes: [{ time: 10, description: '开场' }],
      emotionArc: '从平静到激动',
      keyMoments: [{ time: 30, description: '转折点' }],
      tags: ['测试', '视频']
    });
    expect(result.title).toBe('测试标题');
    expect(result.summary).toBe('这是摘要');
    expect(result.scenes).toHaveLength(1);
    expect(result.scenes[0].time).toBe(10);
    expect(result.emotionArc).toBe('从平静到激动');
    expect(result.keyMoments).toHaveLength(1);
    expect(result.tags).toEqual(['测试', '视频']);
  });

  it('returns empty for null/undefined input', () => {
    const result = parseVideoSummaryResponse(null);
    expect(result.title).toBe('');
    expect(result.scenes).toEqual([]);
    expect(result.tags).toEqual([]);
  });

  it('filters out scenes without time or description', () => {
    const result = parseVideoSummaryResponse({
      title: 't',
      summary: 's',
      scenes: [
        { time: 10, description: 'ok' },
        { time: 'bad', description: 'no' },
        { time: 20, description: '' }
      ],
      emotionArc: '',
      keyMoments: [],
      tags: []
    });
    expect(result.scenes).toHaveLength(1);
    expect(result.scenes[0].description).toBe('ok');
  });

  it('handles partial response with missing fields', () => {
    const result = parseVideoSummaryResponse({ title: '只有标题' });
    expect(result.title).toBe('只有标题');
    expect(result.summary).toBe('');
    expect(result.scenes).toEqual([]);
  });
});

describe('generateSummaryHtml', () => {
  it('produces HTML with all required sections', () => {
    const html = generateSummaryHtml(
      {
        title: '测试视频',
        summary: '第一段摘要\n第二段摘要',
        scenes: [{ time: 10, description: '开场场景' }],
        emotionArc: '从平静到激动',
        keyMoments: [{ time: 30, description: '关键时刻' }],
        tags: ['标签1', '标签2']
      },
      '项目名',
      ['base64data']
    );
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('测试视频');
    expect(html).toContain('内容摘要');
    expect(html).toContain('场景时间线');
    expect(html).toContain('情绪弧线');
    expect(html).toContain('关键时刻');
    expect(html).toContain('标签');
    expect(html).toContain('开场场景');
    expect(html).toContain('base64data');
    expect(html).toContain('从平静到激动');
  });

  it('escapes HTML entities in result data', () => {
    const html = generateSummaryHtml(
      {
        title: '<script>alert("xss")</script>',
        summary: 'safe',
        scenes: [],
        emotionArc: '',
        keyMoments: [],
        tags: ['<b>tag</b>']
      },
      'project',
      []
    );
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});

describe('generateSummaryFilename', () => {
  it('generates filename with project name and date', () => {
    const name = generateSummaryFilename('我的项目');
    expect(name).toMatch(/^我的项目_摘要_\d{8}\.html$/);
  });

  it('uses default name for empty input', () => {
    const name = generateSummaryFilename('');
    expect(name).toMatch(/^未命名项目_摘要_\d{8}\.html$/);
  });

  it('sanitizes special characters', () => {
    const name = generateSummaryFilename('项目<>:"/\\|?*名');
    expect(name).not.toContain('<');
    expect(name).not.toContain('>');
    expect(name).toMatch(/^项目_+名_摘要_\d{8}\.html$/);
  });
});

describe('formatTimeShort', () => {
  it('formats 0 as 00:00', () => {
    expect(formatTimeShort(0)).toBe('00:00');
  });

  it('formats seconds under 1 minute', () => {
    expect(formatTimeShort(45)).toBe('00:45');
  });

  it('formats minutes and seconds', () => {
    expect(formatTimeShort(125)).toBe('02:05');
  });

  it('formats hours, minutes, and seconds', () => {
    expect(formatTimeShort(3661)).toBe('61:01');
  });

  it('returns 00:00 for negative values', () => {
    expect(formatTimeShort(-5)).toBe('00:00');
  });

  it('returns 00:00 for NaN', () => {
    expect(formatTimeShort(Number.NaN)).toBe('00:00');
  });

  it('floors fractional seconds', () => {
    expect(formatTimeShort(65.9)).toBe('01:05');
  });
});
