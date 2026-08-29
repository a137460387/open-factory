// @vitest-environment jsdom
// 覆盖目标：apps/desktop/src/components/SmartRoughCut/useTranscriptForClip.ts
// 策略：renderHook + spy 包装真实 understandSpeech（partial mock importOriginal），
// 同时覆盖纯函数 collectSubtitleTranscriptForClip。锁定：subtitle 轨文本收集
// （范围过滤/乱序排序/空文本跳过/仅认 subtitle 轨）、时间对齐组装、
// understandSpeech(transcript, timeAlignment) 调用契约、ready 就绪信号与
// 语义产出（keywords/topics/narrativeMarkers 含 climax）。
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { Clip, SpeechUnderstandingResult, Timeline } from '@open-factory/editor-core';
import { makeClip, makeProject, makeTrack } from '../Timeline/hooks/timeline/__tests__/test-fixtures';

const understandSpeechSpy = vi.hoisted(() => vi.fn());
vi.mock('@open-factory/editor-core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@open-factory/editor-core')>();
  understandSpeechSpy.mockImplementation(
    (transcript: string, timeAlignment?: { start: number; end: number }[]) =>
      actual.understandSpeech(transcript, timeAlignment),
  );
  return { ...actual, understandSpeech: understandSpeechSpy };
});

import { useTranscriptForClip } from './useTranscriptForClip';
import { collectSubtitleTranscriptForClip } from './smart-rough-cut-utils';

// ── Fixture ─────────────────────────────────────────────────

function makeSubtitleClip(overrides: { id: string; start: number; duration: number; text: string }): Clip {
  return makeClip({
    id: overrides.id,
    type: 'subtitle',
    trackId: 'track-subtitle',
    start: overrides.start,
    duration: overrides.duration,
    text: overrides.text,
  });
}

/** 目标 clip 范围 [5, 15)；subtitle 轨含前后越界段、空文本段与乱序 */
function makeTimeline(): Timeline {
  return makeProject({
    tracks: [
      makeTrack({ id: 'track-video', clips: [makeClip({ id: 'clip-video', type: 'video', start: 5, duration: 10 })] }),
      makeTrack({
        id: 'track-subtitle',
        type: 'subtitle',
        // 乱序：中段在前，验证按 start 排序
        clips: [
          makeSubtitleClip({ id: 'sub-2', start: 4, duration: 3, text: ' 大家好，欢迎观看。' }),
          makeSubtitleClip({ id: 'sub-3', start: 10, duration: 2, text: '这是最重要的核心内容。' }),
          makeSubtitleClip({ id: 'sub-1', start: 0, duration: 2, text: '前面的内容' }),
          makeSubtitleClip({ id: 'sub-4', start: 20, duration: 2, text: '后面的内容' }),
          makeSubtitleClip({ id: 'sub-empty', start: 8, duration: 1, text: '   ' }),
        ],
      }),
    ],
  }).timeline;
}

beforeEach(() => {
  understandSpeechSpy.mockClear();
});

// ── 纯函数：文本收集 + 时间对齐组装 ──────────────────────────

describe('collectSubtitleTranscriptForClip', () => {
  it('collects only overlapping subtitle clips, sorted by start and joined with newline', () => {
    const timeline = makeTimeline();
    const clip = timeline.tracks[0].clips[0];

    const source = collectSubtitleTranscriptForClip(timeline, clip);

    expect(source.transcript).toBe('大家好，欢迎观看。\n这是最重要的核心内容。');
    expect(source.segmentCount).toBe(2);
  });

  it('assembles timeAlignment from each collected clip start and end', () => {
    const timeline = makeTimeline();
    const clip = timeline.tracks[0].clips[0];

    const source = collectSubtitleTranscriptForClip(timeline, clip);

    expect(source.timeAlignment).toEqual([
      { start: 4, end: 7 },
      { start: 10, end: 12 },
    ]);
  });

  it('returns an empty source when the clip is undefined', () => {
    expect(collectSubtitleTranscriptForClip(makeTimeline(), undefined)).toEqual({
      transcript: '',
      timeAlignment: [],
      segmentCount: 0,
    });
  });

  it('ignores clips outside the subtitle track', () => {
    const misplaced = makeSubtitleClip({ id: 'sub-video', start: 6, duration: 1, text: '视频轨里的伪字幕' });
    const timeline = makeProject({
      tracks: [
        makeTrack({ id: 'track-video', clips: [makeClip({ id: 'clip-video', type: 'video', start: 5, duration: 10 }), misplaced] }),
        makeTrack({ id: 'track-subtitle', type: 'subtitle', clips: [] }),
      ],
    }).timeline;

    const source = collectSubtitleTranscriptForClip(timeline, timeline.tracks[0].clips[0]);

    expect(source.transcript).toBe('');
    expect(source.segmentCount).toBe(0);
  });
});

// ── hook：understandSpeech 调用契约 + 语义产出 ────────────────

describe('useTranscriptForClip', () => {
  it('signals ready and calls understandSpeech with the collected transcript and timeAlignment', () => {
    const timeline = makeTimeline();
    const clip = timeline.tracks[0].clips[0];

    const { result } = renderHook(() => useTranscriptForClip(clip, timeline));

    expect(result.current.ready).toBe(true);
    expect(understandSpeechSpy).toHaveBeenCalledTimes(1);
    expect(understandSpeechSpy).toHaveBeenCalledWith('大家好，欢迎观看。\n这是最重要的核心内容。', [
      { start: 4, end: 7 },
      { start: 10, end: 12 },
    ]);
  });

  it('returns undefined understanding and skips understandSpeech when nothing overlaps', () => {
    const timeline = makeTimeline();
    const outsideClip = makeClip({ id: 'clip-outside', type: 'video', start: 30, duration: 5 });

    const { result } = renderHook(() => useTranscriptForClip(outsideClip, timeline));

    expect(result.current.ready).toBe(false);
    expect(result.current.understanding).toBeUndefined();
    expect(understandSpeechSpy).not.toHaveBeenCalled();
  });

  it('produces keywords, topics, narrativeMarkers (incl. climax) and summary from the real engine', () => {
    const timeline = makeProject({
      tracks: [
        makeTrack({ id: 'track-video', clips: [makeClip({ id: 'clip-video', type: 'video', start: 0, duration: 10 })] }),
        makeTrack({
          id: 'track-subtitle',
          type: 'subtitle',
          clips: [
            makeSubtitleClip({ id: 'sub-1', start: 0, duration: 5, text: '大家好，欢迎观看项目介绍。' }),
            makeSubtitleClip({ id: 'sub-2', start: 5, duration: 5, text: '这个项目很关键，项目核心是最重要的项目。' }),
          ],
        }),
      ],
    }).timeline;
    const clip = timeline.tracks[0].clips[0];

    const { result } = renderHook(() => useTranscriptForClip(clip, timeline));
    const understanding: SpeechUnderstandingResult | undefined = result.current.understanding;

    expect(understanding).toBeDefined();
    // '项目' 在转写中出现 3 次，超过默认 minKeywordFrequency=2
    expect(understanding?.keywords.map((keyword) => keyword.word)).toContain('项目');
    expect(Array.isArray(understanding?.topics)).toBe(true);
    expect(typeof understanding?.summary).toBe('string');
    const markerTypes = understanding?.narrativeMarkers.map((marker) => marker.type);
    expect(markerTypes).toContain('opening');
    // '最'/'关键' 命中 climax 检测，时间对齐到第二段 subtitle 的 start
    const climax = understanding?.narrativeMarkers.find((marker) => marker.type === 'climax');
    expect(climax?.time).toBe(5);
  });
});
