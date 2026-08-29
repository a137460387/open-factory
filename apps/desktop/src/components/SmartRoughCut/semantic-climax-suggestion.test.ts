// 覆盖目标：apps/desktop/src/components/SmartRoughCut/semantic-climax-suggestion.ts
// 策略：纯函数直调（成熟测试模式 4）。锁定：源域→绝对时间域换算
// （trimStart/speed≠1 形态）、top-K 组内互斥与 confidence=score 契约、
// label/source/id/markerType 契约、窗口过滤与越窗 clamp、极短保护、
// 空输入边界。
import { describe, expect, it } from 'vitest';
import type { Clip, ClipContentAnalysis, ContentEmotionPoint } from '@open-factory/editor-core';
import { makeClip } from '../Timeline/hooks/timeline/__tests__/test-fixtures';
import { deriveEmotionalClimaxSuggestions } from './semantic-climax-suggestion';

// ── Fixture ─────────────────────────────────────────────────

function makePoint(time: number, value: number): ContentEmotionPoint {
  return { time, value, brightness: value };
}

function makeAnalysis(emotionCurve: ContentEmotionPoint[]): ClipContentAnalysis {
  return {
    version: 1,
    analyzedAt: '2026-08-28T00:00:00.000Z',
    sceneTypes: ['dialogue'],
    primarySceneType: 'dialogue',
    segments: [],
    emotionCurve,
    dialogueTurns: [],
  };
}

// ── deriveEmotionalClimaxSuggestions ────────────────────────

describe('deriveEmotionalClimaxSuggestions derivation', () => {
  it('derives top-K highlight intervals with label/source/markerType contract (identity mapping)', () => {
    const clip = makeClip({ id: 'clip-1', start: 0, duration: 12, trimStart: 0 });
    // 两个互斥高潮点：1（0.9）→ [1,6]；7（0.8）→ [7,12]（末端恰为 clip 末端）
    const suggestions = deriveEmotionalClimaxSuggestions(
      makeAnalysis([makePoint(1, 0.9), makePoint(7, 0.8)]),
      clip,
    );

    expect(suggestions).toHaveLength(2);
    expect(suggestions[0]).toMatchObject({
      id: 'semantic-emotional-climax-0',
      timeRange: { start: 1, end: 6 },
      markerType: 'climax',
      confidence: 0.9,
      label: '情感高潮',
      source: 'emotional-climax',
    });
    expect(suggestions[0].reason).toContain('top-K');
    expect(suggestions[1]).toMatchObject({
      id: 'semantic-emotional-climax-1',
      timeRange: { start: 7, end: 12 },
      confidence: 0.8,
    });
  });

  it('converts source-domain intervals to timeline absolute time via trimStart and speed', () => {
    // 时间线 [5, 11)，trimStart=1，speed=2 → 源域窗口 [1, 13)
    const clip = makeClip({ id: 'clip-1', start: 5, duration: 6, trimStart: 1, speed: 2 });
    // 源域高潮点 3（0.9）→ [3, 8] → abs = 5 + (3−1)/2 = 6，end = 5 + (8−1)/2 = 8.5
    const suggestions = deriveEmotionalClimaxSuggestions(makeAnalysis([makePoint(3, 0.9)]), clip);

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].timeRange).toEqual({ start: 6, end: 8.5 });
  });

  it('filters out-of-window curve points and clamps interval end to the clip source window', () => {
    // 窗口 [0, 12]：窗外点 20（0.95）剔除；点 9（0.85）延伸 [9,14] → clamp [9,12]
    const clip = makeClip({ id: 'clip-1', start: 0, duration: 12, trimStart: 0 });
    const suggestions = deriveEmotionalClimaxSuggestions(
      makeAnalysis([makePoint(20, 0.95), makePoint(9, 0.85)]),
      clip,
    );

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].timeRange).toEqual({ start: 9, end: 12 });
  });

  it('keeps mutual exclusion within the top-K group (overlapping candidates skipped)', () => {
    // 点 1（0.9）与点 2（0.85）区间重叠 → 仅取高分者；点 8（0.7）不重叠可并存
    const clip = makeClip({ id: 'clip-1', start: 0, duration: 14, trimStart: 0 });
    const suggestions = deriveEmotionalClimaxSuggestions(
      makeAnalysis([makePoint(1, 0.9), makePoint(2, 0.85), makePoint(8, 0.7)]),
      clip,
    );

    expect(suggestions.map((item) => item.timeRange)).toEqual([
      { start: 1, end: 6 },
      { start: 8, end: 13 },
    ]);
  });

  it('drops intervals shorter than the min keep duration after clamping (极短保护)', () => {
    // 高潮点 11.8 延伸 [11.8, 16.8] → clamp [11.8, 12] 仅 0.2s < 1 → 剔除
    const clip = makeClip({ id: 'clip-1', start: 0, duration: 12, trimStart: 0 });
    expect(deriveEmotionalClimaxSuggestions(makeAnalysis([makePoint(11.8, 0.9)]), clip)).toEqual([]);
  });

  it('returns empty array without analysis, clip, or with an empty curve', () => {
    const clip = makeClip({ id: 'clip-1' });
    expect(deriveEmotionalClimaxSuggestions(undefined, clip)).toEqual([]);
    expect(deriveEmotionalClimaxSuggestions(makeAnalysis([makePoint(1, 0.9)]), undefined)).toEqual([]);
    expect(deriveEmotionalClimaxSuggestions(makeAnalysis([]), clip)).toEqual([]);
  });

  it('returns empty array for an all-zero emotion curve (minScore 严格大于 0)', () => {
    const clip = makeClip({ id: 'clip-1', duration: 12 });
    expect(
      deriveEmotionalClimaxSuggestions(makeAnalysis([makePoint(1, 0), makePoint(7, 0)]), clip),
    ).toEqual([]);
  });
});
