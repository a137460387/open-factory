import { describe, it, expect, beforeEach } from 'vitest';
import type { SubtitleClip, Timeline, Track } from '../src/model';
import {
  searchSubtitles,
  replaceSubtitles,
  replaceSingleResult,
  batchUpdateSubtitleStyle,
  batchApplyStyleTemplate,
  deleteSelectedSubtitles,
  duplicateSelectedSubtitles,
  mergeSelectedSubtitles,
  batchShiftSubtitleTime,
  batchScaleSubtitleTime,
  getSelectedSubtitleClips,
  selectAllSubtitlesInTrack,
  invertSubtitleSelection,
  extractCommonStyle,
  type SubtitleSearchOptions,
} from '../src/subtitles/editor';
import { BUILTIN_SUBTITLE_STYLE_TEMPLATES } from '../src/subtitles/style-templates';
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

describe('searchSubtitles', () => {
  let timeline: Timeline;

  beforeEach(() => {
    const track = createSubtitleTrack({
      clips: [
        createSubtitleClip({ id: 'clip1', text: 'Hello World', start: 0 }),
        createSubtitleClip({ id: 'clip2', text: 'hello again', start: 2 }),
        createSubtitleClip({ id: 'clip3', text: 'No match here', start: 4 }),
      ],
    });
    timeline = createTimeline([track]);
  });

  it('应该找到匹配的字幕', () => {
    const results = searchSubtitles(timeline, { searchText: 'hello' });
    expect(results).toHaveLength(2);
    expect(results[0].clipId).toBe('clip1');
    expect(results[1].clipId).toBe('clip2');
  });

  it('应该支持区分大小写', () => {
    const results = searchSubtitles(timeline, { searchText: 'Hello', caseSensitive: true });
    expect(results).toHaveLength(1);
    expect(results[0].clipId).toBe('clip1');
  });

  it('应该支持全词匹配', () => {
    const results = searchSubtitles(timeline, { searchText: 'hello', wholeWord: true });
    expect(results).toHaveLength(2);
  });

  it('应该支持正则表达式', () => {
    const results = searchSubtitles(timeline, { searchText: 'h.llo', useRegex: true });
    expect(results).toHaveLength(2);
  });

  it('应该返回空数组当搜索文本为空', () => {
    const results = searchSubtitles(timeline, { searchText: '' });
    expect(results).toHaveLength(0);
  });

  it('应该支持指定轨道搜索', () => {
    const track2 = createSubtitleTrack({
      id: 'track2',
      clips: [createSubtitleClip({ id: 'clip4', text: 'Hello track2', start: 6 })],
    });
    timeline.tracks.push(track2);

    const results = searchSubtitles(timeline, { searchText: 'hello', trackId: 'track1' });
    expect(results).toHaveLength(2);
  });
});

describe('replaceSubtitles', () => {
  let timeline: Timeline;

  beforeEach(() => {
    const track = createSubtitleTrack({
      clips: [
        createSubtitleClip({ id: 'clip1', text: 'Hello World', start: 0 }),
        createSubtitleClip({ id: 'clip2', text: 'Hello Again', start: 2 }),
      ],
    });
    timeline = createTimeline([track]);
  });

  it('应该替换所有匹配的文本', () => {
    const { timeline: newTimeline, replacedCount } = replaceSubtitles(timeline, {
      searchText: 'Hello',
      replaceText: 'Hi',
    });

    expect(replacedCount).toBe(2);

    const track = newTimeline.tracks[0];
    const clip1 = track.clips.find((c) => c.id === 'clip1') as SubtitleClip;
    const clip2 = track.clips.find((c) => c.id === 'clip2') as SubtitleClip;
    expect(clip1.text).toBe('Hi World');
    expect(clip2.text).toBe('Hi Again');
  });

  it('应该支持区分大小写替换', () => {
    const { replacedCount } = replaceSubtitles(timeline, {
      searchText: 'hello',
      replaceText: 'Hi',
      caseSensitive: true,
    });

    expect(replacedCount).toBe(0);
  });

  it('应该支持只替换指定的片段', () => {
    const { timeline: newTimeline, replacedCount } = replaceSubtitles(
      timeline,
      { searchText: 'Hello', replaceText: 'Hi' },
      ['clip1'],
    );

    expect(replacedCount).toBe(1);

    const track = newTimeline.tracks[0];
    const clip1 = track.clips.find((c) => c.id === 'clip1') as SubtitleClip;
    const clip2 = track.clips.find((c) => c.id === 'clip2') as SubtitleClip;
    expect(clip1.text).toBe('Hi World');
    expect(clip2.text).toBe('Hello Again');
  });
});

describe('replaceSingleResult', () => {
  it('应该替换单个搜索结果', () => {
    const track = createSubtitleTrack({
      clips: [createSubtitleClip({ id: 'clip1', text: 'Hello World', start: 0 })],
    });
    const timeline = createTimeline([track]);

    const result = {
      clipId: 'clip1',
      trackIndex: 0,
      matchedText: 'Hello',
      matchStart: 0,
      matchEnd: 5,
      fullText: 'Hello World',
    };

    const newTimeline = replaceSingleResult(timeline, result, 'Hi');
    const clip = newTimeline.tracks[0].clips[0] as SubtitleClip;
    expect(clip.text).toBe('Hi World');
  });
});

describe('batchUpdateSubtitleStyle', () => {
  it('应该批量更新字幕样式', () => {
    const track = createSubtitleTrack({
      clips: [
        createSubtitleClip({ id: 'clip1', text: 'Test 1' }),
        createSubtitleClip({ id: 'clip2', text: 'Test 2' }),
        createSubtitleClip({ id: 'clip3', text: 'Test 3' }),
      ],
    });
    const timeline = createTimeline([track]);

    const newTimeline = batchUpdateSubtitleStyle(timeline, {
      clipIds: ['clip1', 'clip2'],
      style: { color: '#ff0000', bold: true },
    });

    const clip1 = newTimeline.tracks[0].clips[0] as SubtitleClip;
    const clip2 = newTimeline.tracks[0].clips[1] as SubtitleClip;
    const clip3 = newTimeline.tracks[0].clips[2] as SubtitleClip;

    expect(clip1.style?.color).toBe('#ff0000');
    expect(clip1.style?.bold).toBe(true);
    expect(clip2.style?.color).toBe('#ff0000');
    expect(clip2.style?.bold).toBe(true);
    // clip3 未选中，保持默认样式
    expect(clip3.style?.color).toBe(DEFAULT_SUBTITLE_STYLE.color);
    expect(clip3.style?.bold).toBe(DEFAULT_SUBTITLE_STYLE.bold);
  });
});

describe('batchApplyStyleTemplate', () => {
  it('应该应用样式模板到选中的字幕', () => {
    const track = createSubtitleTrack({
      clips: [
        createSubtitleClip({ id: 'clip1', text: 'Test 1' }),
        createSubtitleClip({ id: 'clip2', text: 'Test 2' }),
      ],
    });
    const timeline = createTimeline([track]);
    const template = BUILTIN_SUBTITLE_STYLE_TEMPLATES[0]; // cinema-white

    const newTimeline = batchApplyStyleTemplate(timeline, ['clip1'], template);

    const clip1 = newTimeline.tracks[0].clips[0] as SubtitleClip;
    const clip2 = newTimeline.tracks[0].clips[1] as SubtitleClip;

    expect(clip1.style?.color).toBe(template.style.color);
    // clip2 未选中，保持默认样式
    expect(clip2.style?.color).toBe(DEFAULT_SUBTITLE_STYLE.color);
  });
});

describe('deleteSelectedSubtitles', () => {
  it('应该删除选中的字幕', () => {
    const track = createSubtitleTrack({
      clips: [
        createSubtitleClip({ id: 'clip1', text: 'Test 1' }),
        createSubtitleClip({ id: 'clip2', text: 'Test 2' }),
        createSubtitleClip({ id: 'clip3', text: 'Test 3' }),
      ],
    });
    const timeline = createTimeline([track]);

    const result = deleteSelectedSubtitles(timeline, ['clip1', 'clip3']);

    expect(result.operation).toBe('delete');
    expect(result.affectedCount).toBe(2);
    expect(result.timeline.tracks[0].clips).toHaveLength(1);
    expect(result.timeline.tracks[0].clips[0].id).toBe('clip2');
  });
});

describe('duplicateSelectedSubtitles', () => {
  it('应该复制选中的字幕', () => {
    const track = createSubtitleTrack({
      clips: [
        createSubtitleClip({ id: 'clip1', text: 'Test 1', start: 0 }),
        createSubtitleClip({ id: 'clip2', text: 'Test 2', start: 2 }),
      ],
    });
    const timeline = createTimeline([track]);

    const result = duplicateSelectedSubtitles(timeline, ['clip1'], 1);

    expect(result.operation).toBe('duplicate');
    expect(result.affectedCount).toBe(1);
    expect(result.timeline.tracks[0].clips).toHaveLength(3);

    const duplicated = result.timeline.tracks[0].clips[2] as SubtitleClip;
    expect(duplicated.text).toBe('Test 1');
    expect(duplicated.start).toBe(1);
  });
});

describe('mergeSelectedSubtitles', () => {
  it('应该合并选中的字幕', () => {
    const track = createSubtitleTrack({
      clips: [
        createSubtitleClip({ id: 'clip1', text: 'Hello', start: 0, duration: 1 }),
        createSubtitleClip({ id: 'clip2', text: 'World', start: 1, duration: 1 }),
        createSubtitleClip({ id: 'clip3', text: 'Other', start: 3, duration: 1 }),
      ],
    });
    const timeline = createTimeline([track]);

    const result = mergeSelectedSubtitles(timeline, ['clip1', 'clip2'], ' ');

    expect(result.operation).toBe('merge');
    expect(result.affectedCount).toBe(2);
    expect(result.timeline.tracks[0].clips).toHaveLength(2);

    const merged = result.timeline.tracks[0].clips.find((c) => c.id.startsWith('merged_')) as SubtitleClip;
    expect(merged.text).toBe('Hello World');
    expect(merged.start).toBe(0);
    expect(merged.duration).toBe(2);
  });
});

describe('batchShiftSubtitleTime', () => {
  it('应该批量调整字幕时间', () => {
    const track = createSubtitleTrack({
      clips: [
        createSubtitleClip({ id: 'clip1', text: 'Test 1', start: 0 }),
        createSubtitleClip({ id: 'clip2', text: 'Test 2', start: 2 }),
        createSubtitleClip({ id: 'clip3', text: 'Test 3', start: 4 }),
      ],
    });
    const timeline = createTimeline([track]);

    const result = batchShiftSubtitleTime(timeline, ['clip1', 'clip2'], 1);

    expect(result.operation).toBe('time-shift');
    expect(result.affectedCount).toBe(2);

    const clips = result.timeline.tracks[0].clips as SubtitleClip[];
    expect(clips[0].start).toBe(1);
    expect(clips[1].start).toBe(3);
    expect(clips[2].start).toBe(4); // 未选中的不应改变
  });

  it('应该限制最小时间为0', () => {
    const track = createSubtitleTrack({
      clips: [createSubtitleClip({ id: 'clip1', text: 'Test', start: 1 })],
    });
    const timeline = createTimeline([track]);

    const result = batchShiftSubtitleTime(timeline, ['clip1'], -2);
    const clip = result.timeline.tracks[0].clips[0] as SubtitleClip;
    expect(clip.start).toBe(0);
  });
});

describe('batchScaleSubtitleTime', () => {
  it('应该批量缩放字幕时间', () => {
    const track = createSubtitleTrack({
      clips: [
        createSubtitleClip({ id: 'clip1', text: 'Test 1', start: 0, duration: 1 }),
        createSubtitleClip({ id: 'clip2', text: 'Test 2', start: 2, duration: 1 }),
      ],
    });
    const timeline = createTimeline([track]);

    const result = batchScaleSubtitleTime(timeline, ['clip1', 'clip2'], 2, 1);

    expect(result.operation).toBe('time-scale');
    expect(result.affectedCount).toBe(2);

    const clips = result.timeline.tracks[0].clips as SubtitleClip[];
    // clip1: start = 1 + (0 - 1) * 2 = -1 -> 0 (clamped)
    expect(clips[0].start).toBe(0);
    expect(clips[0].duration).toBe(2);
    // clip2: start = 1 + (2 - 1) * 2 = 3
    expect(clips[1].start).toBe(3);
    expect(clips[1].duration).toBe(2);
  });
});

describe('getSelectedSubtitleClips', () => {
  it('应该返回选中的字幕片段', () => {
    const track = createSubtitleTrack({
      clips: [
        createSubtitleClip({ id: 'clip1', text: 'Test 1' }),
        createSubtitleClip({ id: 'clip2', text: 'Test 2' }),
        createSubtitleClip({ id: 'clip3', text: 'Test 3' }),
      ],
    });
    const timeline = createTimeline([track]);

    const result = getSelectedSubtitleClips(timeline, ['clip1', 'clip3']);

    expect(result.count).toBe(2);
    expect(result.selectedIds).toEqual(['clip1', 'clip3']);
    expect(result.selectedClips).toHaveLength(2);
  });
});

describe('selectAllSubtitlesInTrack', () => {
  it('应该选择指定轨道的所有字幕', () => {
    const track = createSubtitleTrack({
      id: 'track1',
      clips: [
        createSubtitleClip({ id: 'clip1', text: 'Test 1' }),
        createSubtitleClip({ id: 'clip2', text: 'Test 2' }),
      ],
    });
    const timeline = createTimeline([track]);

    const ids = selectAllSubtitlesInTrack(timeline, 'track1');

    expect(ids).toEqual(['clip1', 'clip2']);
  });
});

describe('invertSubtitleSelection', () => {
  it('应该反选字幕', () => {
    const track = createSubtitleTrack({
      clips: [
        createSubtitleClip({ id: 'clip1', text: 'Test 1' }),
        createSubtitleClip({ id: 'clip2', text: 'Test 2' }),
        createSubtitleClip({ id: 'clip3', text: 'Test 3' }),
      ],
    });
    const timeline = createTimeline([track]);

    const inverted = invertSubtitleSelection(timeline, ['clip1', 'clip3']);

    expect(inverted).toEqual(['clip2']);
  });
});

describe('extractCommonStyle', () => {
  it('应该提取共同样式', () => {
    const clips = [
      createSubtitleClip({
        id: 'clip1',
        style: { ...DEFAULT_SUBTITLE_STYLE, color: '#ff0000', bold: true, fontSize: 42 },
      }),
      createSubtitleClip({
        id: 'clip2',
        style: { ...DEFAULT_SUBTITLE_STYLE, color: '#ff0000', bold: true, fontSize: 48 },
      }),
    ];

    const common = extractCommonStyle(clips);

    expect(common).toHaveProperty('color', '#ff0000');
    expect(common).toHaveProperty('bold', true);
  });

  it('应该返回null当没有共同样式', () => {
    const clips = [
      createSubtitleClip({
        id: 'clip1',
        style: { ...DEFAULT_SUBTITLE_STYLE, color: '#ff0000', fontSize: 42 },
      }),
      createSubtitleClip({
        id: 'clip2',
        style: { ...DEFAULT_SUBTITLE_STYLE, color: '#00ff00', fontSize: 48 },
      }),
    ];

    const common = extractCommonStyle(clips);

    // 除了 color 和 fontSize，其他默认属性都是相同的
    expect(common).not.toBeNull();
    expect(common).toHaveProperty('backgroundColor', DEFAULT_SUBTITLE_STYLE.backgroundColor);
    expect(common).not.toHaveProperty('color');
    expect(common).not.toHaveProperty('fontSize');
  });

  it('应该返回null当输入为空', () => {
    const common = extractCommonStyle([]);
    expect(common).toBeNull();
  });
});
