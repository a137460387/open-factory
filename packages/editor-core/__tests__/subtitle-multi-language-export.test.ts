import { describe, it, expect, beforeEach } from 'vitest';
import type { SubtitleClip, Timeline, Track } from '../src/model';
import {
  exportMultiLanguageSubtitles,
  groupSubtitlesByLanguage,
  getAvailableLanguages,
  exportSubtitlesAsSeparateFiles,
  exportSubtitlesAsMergedFile,
  buildSubtitleEmbedArgs,
} from '../src/subtitles/multi-language-export';
import { DEFAULT_SUBTITLE_STYLE } from '../src/model/defaults';

// ---------------------------------------------------------------------------
// Test Helpers
// ---------------------------------------------------------------------------

function createSubtitleClip(overrides: Partial<SubtitleClip> = {}): SubtitleClip {
  return {
    id: `clip_${Math.random().toString(36).substring(7)}`,
    name: 'Subtitle Clip',
    type: 'subtitle',
    start: 0,
    duration: 2,
    trimStart: 0,
    trimEnd: 0,
    speed: 1,
    text: 'Test subtitle',
    trackId: 'track1',
    colorCorrection: { brightness: 0, contrast: 0, saturation: 0, hue: 0 },
    transform: { x: 0, y: 0, scale: 1, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 },
    style: { ...DEFAULT_SUBTITLE_STYLE },
    subtitleMode: 'soft-sub',
    ...overrides,
  };
}

function createSubtitleTrack(overrides: Partial<Track> = {}): Track {
  return {
    id: 'track1',
    name: 'Subtitles',
    type: 'subtitle',
    language: 'en',
    clips: [],
    ...overrides,
  };
}

function createTimeline(tracks: Track[] = []): Timeline {
  return {
    tracks,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('groupSubtitlesByLanguage', () => {
  it('应该按语言分组字幕', () => {
    const timeline = createTimeline([
      createSubtitleTrack({
        id: 'track1',
        language: 'en',
        clips: [
          createSubtitleClip({ id: 'clip1', text: 'Hello', start: 0 }),
          createSubtitleClip({ id: 'clip2', text: 'World', start: 2 }),
        ],
      }),
      createSubtitleTrack({
        id: 'track2',
        language: 'zh',
        clips: [createSubtitleClip({ id: 'clip3', text: '你好', start: 0 })],
      }),
    ]);

    const groups = groupSubtitlesByLanguage(timeline);

    expect(groups).toHaveLength(2);
    expect(groups[0].language).toBe('en');
    expect(groups[0].clips).toHaveLength(2);
    expect(groups[1].language).toBe('zh');
    expect(groups[1].clips).toHaveLength(1);
  });

  it('应该处理未指定语言的轨道（默认为zh）', () => {
    const timeline = createTimeline([
      createSubtitleTrack({
        id: 'track1',
        language: undefined as unknown as string,
        clips: [createSubtitleClip({ text: 'Test' })],
      }),
    ]);

    const groups = groupSubtitlesByLanguage(timeline);

    expect(groups).toHaveLength(1);
    // DEFAULT_SUBTITLE_LANGUAGE 是 'zh'
    expect(groups[0].language).toBe('zh');
  });

  it('应该忽略非字幕轨道', () => {
    const timeline = createTimeline([
      {
        id: 'track1',
        name: 'Video',
        type: 'video',
        clips: [],
      },
      createSubtitleTrack({
        id: 'track2',
        language: 'en',
        clips: [createSubtitleClip({ text: 'Test' })],
      }),
    ]);

    const groups = groupSubtitlesByLanguage(timeline);

    expect(groups).toHaveLength(1);
    expect(groups[0].language).toBe('en');
  });
});

describe('getAvailableLanguages', () => {
  it('应该返回可用的语言列表', () => {
    const timeline = createTimeline([
      createSubtitleTrack({
        id: 'track1',
        language: 'en',
        clips: [
          createSubtitleClip({ text: 'Hello', start: 0 }),
          createSubtitleClip({ text: 'World', start: 2 }),
        ],
      }),
      createSubtitleTrack({
        id: 'track2',
        language: 'zh',
        clips: [createSubtitleClip({ text: '你好', start: 0 })],
      }),
    ]);

    const languages = getAvailableLanguages(timeline);

    expect(languages).toHaveLength(2);
    expect(languages[0]).toEqual({ code: 'en', name: 'English', count: 2 });
    expect(languages[1]).toEqual({ code: 'zh', name: '中文', count: 1 });
  });
});

describe('exportMultiLanguageSubtitles', () => {
  let timeline: Timeline;

  beforeEach(() => {
    timeline = createTimeline([
      createSubtitleTrack({
        id: 'track1',
        language: 'en',
        clips: [
          createSubtitleClip({ id: 'clip1', text: 'Hello', start: 0, duration: 1 }),
          createSubtitleClip({ id: 'clip2', text: 'World', start: 2, duration: 1 }),
        ],
      }),
      createSubtitleTrack({
        id: 'track2',
        language: 'zh',
        clips: [
          createSubtitleClip({ id: 'clip3', text: '你好', start: 0, duration: 1 }),
          createSubtitleClip({ id: 'clip4', text: '世界', start: 2, duration: 1 }),
        ],
      }),
    ]);
  });

  it('应该导出所有语言的字幕', () => {
    const result = exportMultiLanguageSubtitles(timeline, { format: 'srt' });

    expect(result.languageCount).toBe(2);
    expect(result.totalCues).toBe(4);
    expect(result.files).toHaveLength(2);
  });

  it('应该只导出指定的语言', () => {
    const result = exportMultiLanguageSubtitles(timeline, {
      format: 'srt',
      languages: ['en'],
    });

    expect(result.languageCount).toBe(1);
    expect(result.totalCues).toBe(2);
    expect(result.files).toHaveLength(1);
    expect(result.files[0].language).toBe('en');
  });

  it('应该支持合并为单个文件', () => {
    const result = exportMultiLanguageSubtitles(timeline, {
      format: 'srt',
      mergeIntoSingleFile: true,
    });

    expect(result.files).toHaveLength(1);
    expect(result.files[0].language).toBe('multi');
    expect(result.languageCount).toBe(2);
  });

  it('应该支持不同的导出格式', () => {
    const resultSrt = exportMultiLanguageSubtitles(timeline, { format: 'srt' });
    const resultVtt = exportMultiLanguageSubtitles(timeline, { format: 'vtt' });
    const resultAss = exportMultiLanguageSubtitles(timeline, { format: 'ass' });

    expect(resultSrt.files[0].filename).toContain('.srt');
    expect(resultVtt.files[0].filename).toContain('.vtt');
    expect(resultAss.files[0].filename).toContain('.ass');
  });

  it('应该返回空结果当没有字幕', () => {
    const emptyTimeline = createTimeline([]);
    const result = exportMultiLanguageSubtitles(emptyTimeline, { format: 'srt' });

    expect(result.files).toHaveLength(0);
    expect(result.totalCues).toBe(0);
    expect(result.languageCount).toBe(0);
  });
});

describe('exportSubtitlesAsSeparateFiles', () => {
  it('应该导出为独立文件', () => {
    const timeline = createTimeline([
      createSubtitleTrack({
        id: 'track1',
        language: 'en',
        clips: [createSubtitleClip({ text: 'Hello', start: 0 })],
      }),
      createSubtitleTrack({
        id: 'track2',
        language: 'zh',
        clips: [createSubtitleClip({ text: '你好', start: 0 })],
      }),
    ]);

    const files = exportSubtitlesAsSeparateFiles(timeline, 'srt');

    expect(files).toHaveLength(2);
    expect(files[0].language).toBe('en');
    expect(files[1].language).toBe('zh');
  });
});

describe('exportSubtitlesAsMergedFile', () => {
  it('应该导出为合并文件', () => {
    const timeline = createTimeline([
      createSubtitleTrack({
        id: 'track1',
        language: 'en',
        clips: [createSubtitleClip({ text: 'Hello', start: 0 })],
      }),
      createSubtitleTrack({
        id: 'track2',
        language: 'zh',
        clips: [createSubtitleClip({ text: '你好', start: 0 })],
      }),
    ]);

    const file = exportSubtitlesAsMergedFile(timeline, 'srt');

    expect(file).not.toBeNull();
    expect(file!.language).toBe('multi');
    expect(file!.cueCount).toBe(2);
    expect(file!.content).toContain('English');
    expect(file!.content).toContain('中文');
  });

  it('应该返回null当没有字幕', () => {
    const emptyTimeline = createTimeline([]);
    const file = exportSubtitlesAsMergedFile(emptyTimeline, 'srt');

    expect(file).toBeNull();
  });

  it('应该支持自定义分隔符', () => {
    const timeline = createTimeline([
      createSubtitleTrack({
        id: 'track1',
        language: 'en',
        clips: [createSubtitleClip({ text: 'Hello', start: 0 })],
      }),
      createSubtitleTrack({
        id: 'track2',
        language: 'zh',
        clips: [createSubtitleClip({ text: '你好', start: 0 })],
      }),
    ]);

    const file = exportSubtitlesAsMergedFile(timeline, 'srt', {
      separator: '\n\n===\n\n',
    });

    expect(file!.content).toContain('===');
  });
});

describe('buildSubtitleEmbedArgs', () => {
  let timeline: Timeline;

  beforeEach(() => {
    timeline = createTimeline([
      createSubtitleTrack({
        id: 'track1',
        language: 'en',
        clips: [
          createSubtitleClip({ text: 'Hello', start: 0 }),
          createSubtitleClip({ text: 'World', start: 2 }),
        ],
      }),
      createSubtitleTrack({
        id: 'track2',
        language: 'zh',
        clips: [createSubtitleClip({ text: '你好', start: 0 })],
      }),
    ]);
  });

  it('应该生成嵌入参数', () => {
    const result = buildSubtitleEmbedArgs(timeline, { format: 'srt' });

    expect(result.files).toHaveLength(2);
    expect(result.args.length).toBeGreaterThan(0);
  });

  it('应该支持硬字幕', () => {
    const result = buildSubtitleEmbedArgs(timeline, {
      format: 'srt',
      burnIn: true,
      defaultLanguage: 'en',
    });

    expect(result.burnInFilter).toContain('subtitle_en.srt');
  });

  it('应该支持指定默认语言', () => {
    const result = buildSubtitleEmbedArgs(timeline, {
      format: 'srt',
      defaultLanguage: 'zh',
    });

    // 默认语言应该是中文
    const defaultFile = result.files.find((f) => f.language === 'zh');
    expect(defaultFile).toBeDefined();
  });

  it('应该只嵌入指定的语言', () => {
    const result = buildSubtitleEmbedArgs(timeline, {
      format: 'srt',
      languages: ['en'],
    });

    expect(result.files).toHaveLength(1);
    expect(result.files[0].language).toBe('en');
  });
});
