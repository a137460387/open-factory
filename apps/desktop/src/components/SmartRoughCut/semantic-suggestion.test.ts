// 覆盖目标：apps/desktop/src/components/SmartRoughCut/semantic-suggestion.ts
// 策略：纯函数直调（成熟测试模式 4）。锁定：多 marker 区间推导
// （含最后 marker → clip 末端）、climax 优先排序（confidence 降序，
// 其余时间升序殿后）、空 markers / undefined understanding → []、
// 单 marker 边界、label/reason/confidence/timeRange 透传契约、
// clip 范围外 marker 剔除、maxSuggestions 截断。
import { describe, expect, it } from 'vitest';
import type { Clip, NarrativeMarker, SpeechUnderstandingResult } from '@open-factory/editor-core';
import { makeClip } from '../Timeline/hooks/timeline/__tests__/test-fixtures';
import { generateSemanticRoughCutSuggestions, type SemanticRoughCutSuggestion } from './semantic-suggestion';

// ── Fixture ─────────────────────────────────────────────────

function makeMarker(overrides: Partial<NarrativeMarker> & { time: number; type: NarrativeMarker['type'] }): NarrativeMarker {
  return {
    confidence: 0.7,
    description: '重点内容',
    ...overrides,
  } as NarrativeMarker;
}

function makeUnderstanding(markers: NarrativeMarker[]): SpeechUnderstandingResult {
  return {
    keywords: [],
    topics: [],
    narrativeMarkers: markers,
    summary: '',
  };
}

/** clip 范围 [5, 20) */
function makeTargetClip(): Clip {
  return makeClip({ id: 'clip-1', type: 'video', start: 5, duration: 15 });
}

// ── 区间推导 ────────────────────────────────────────────────

describe('generateSemanticRoughCutSuggestions interval derivation', () => {
  it('derives each interval from marker.time to the next marker.time', () => {
    const markers = [
      makeMarker({ time: 6, type: 'opening', confidence: 0.8, description: '开场白' }),
      makeMarker({ time: 10, type: 'climax', confidence: 0.7, description: '重点内容' }),
      makeMarker({ time: 15, type: 'ending', confidence: 0.8, description: '结尾总结' }),
    ];

    const suggestions = generateSemanticRoughCutSuggestions(makeUnderstanding(markers), makeTargetClip());

    // climax 优先排序：climax 项在前，其余按时间升序殿后
    expect(suggestions.map((item) => item.markerType)).toEqual(['climax', 'opening', 'ending']);
    const opening = suggestions.find((item) => item.markerType === 'opening');
    const climax = suggestions.find((item) => item.markerType === 'climax');
    const ending = suggestions.find((item) => item.markerType === 'ending');
    // 区间 = 当前 marker.time → 下一个 marker.time
    expect(opening?.timeRange).toEqual({ start: 6, end: 10 });
    expect(climax?.timeRange).toEqual({ start: 10, end: 15 });
    // 最后一个 marker → clip 末端（5 + 15 = 20）
    expect(ending?.timeRange).toEqual({ start: 15, end: 20 });
  });

  it('extends the last marker to the clip end when it is the only marker', () => {
    const suggestions = generateSemanticRoughCutSuggestions(
      makeUnderstanding([makeMarker({ time: 8, type: 'climax' })]),
      makeTargetClip(),
    );

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].timeRange).toEqual({ start: 8, end: 20 });
  });
});

// ── 排序 ────────────────────────────────────────────────────

describe('generateSemanticRoughCutSuggestions ordering', () => {
  it('sorts multiple climax items by confidence descending, non-climax by time ascending after them', () => {
    const markers = [
      makeMarker({ time: 6, type: 'opening' }),
      makeMarker({ time: 18, type: 'climax', confidence: 0.6 }),
      makeMarker({ time: 12, type: 'climax', confidence: 0.9 }),
      makeMarker({ time: 9, type: 'rising' }),
      makeMarker({ time: 16, type: 'ending' }),
    ];

    const suggestions = generateSemanticRoughCutSuggestions(makeUnderstanding(markers), makeTargetClip());

    // climax confidence 降序在前
    expect(suggestions.map((item) => item.markerType)).toEqual(['climax', 'climax', 'opening', 'rising', 'ending']);
    expect(suggestions[0].confidence).toBe(0.9);
    expect(suggestions[1].confidence).toBe(0.6);
    // 非 climax 按时间升序殿后
    expect(suggestions.slice(2).map((item) => item.timeRange.start)).toEqual([6, 9, 16]);
  });

  it('orders purely by time when no climax marker exists', () => {
    const markers = [
      makeMarker({ time: 16, type: 'ending' }),
      makeMarker({ time: 6, type: 'opening' }),
      makeMarker({ time: 10, type: 'rising' }),
    ];

    const suggestions = generateSemanticRoughCutSuggestions(makeUnderstanding(markers), makeTargetClip());

    expect(suggestions.map((item) => item.markerType)).toEqual(['opening', 'rising', 'ending']);
  });
});

// ── 边界 ────────────────────────────────────────────────────

describe('generateSemanticRoughCutSuggestions boundaries', () => {
  it('returns empty array for undefined understanding', () => {
    expect(generateSemanticRoughCutSuggestions(undefined, makeTargetClip())).toEqual([]);
  });

  it('returns empty array for empty markers', () => {
    expect(generateSemanticRoughCutSuggestions(makeUnderstanding([]), makeTargetClip())).toEqual([]);
  });

  it('returns empty array for undefined clip', () => {
    expect(
      generateSemanticRoughCutSuggestions(makeUnderstanding([makeMarker({ time: 8, type: 'climax' })]), undefined),
    ).toEqual([]);
  });

  it('excludes markers outside the clip range', () => {
    const markers = [
      makeMarker({ time: 2, type: 'opening' }), // clip 前（clipStart=5 之外）
      makeMarker({ time: 8, type: 'climax' }),
      makeMarker({ time: 25, type: 'ending' }), // clip 后（clipEnd=20 之外）
    ];

    const suggestions = generateSemanticRoughCutSuggestions(makeUnderstanding(markers), makeTargetClip());

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].markerType).toBe('climax');
    expect(suggestions[0].timeRange).toEqual({ start: 8, end: 20 });
  });

  it('keeps markers exactly at the clip boundaries', () => {
    const markers = [makeMarker({ time: 5, type: 'opening' }), makeMarker({ time: 20, type: 'ending' })];

    const suggestions = generateSemanticRoughCutSuggestions(makeUnderstanding(markers), makeTargetClip());

    expect(suggestions.map((item) => item.markerType)).toEqual(['opening', 'ending']);
    expect(suggestions[0].timeRange).toEqual({ start: 5, end: 20 });
    expect(suggestions[1].timeRange).toEqual({ start: 20, end: 20 });
  });

  it('returns empty array when all markers fall outside the clip', () => {
    const markers = [makeMarker({ time: 1, type: 'opening' }), makeMarker({ time: 30, type: 'ending' })];

    expect(generateSemanticRoughCutSuggestions(makeUnderstanding(markers), makeTargetClip())).toEqual([]);
  });

  it('re-sorts markers defensively even if the upstream order is not ascending', () => {
    const markers = [
      makeMarker({ time: 15, type: 'ending' }),
      makeMarker({ time: 6, type: 'opening' }),
      makeMarker({ time: 10, type: 'climax' }),
    ];

    const suggestions = generateSemanticRoughCutSuggestions(makeUnderstanding(markers), makeTargetClip());

    // 区间推导依赖升序：opening [6,10) / climax [10,15) / ending [15,20)
    const opening = suggestions.find((item) => item.markerType === 'opening');
    expect(opening?.timeRange).toEqual({ start: 6, end: 10 });
  });

  it('truncates to maxSuggestions when provided', () => {
    const markers = [
      makeMarker({ time: 6, type: 'opening' }),
      makeMarker({ time: 10, type: 'climax' }),
      makeMarker({ time: 15, type: 'ending' }),
    ];

    const suggestions = generateSemanticRoughCutSuggestions(makeUnderstanding(markers), makeTargetClip(), {
      maxSuggestions: 1,
    });

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].markerType).toBe('climax');
  });
});

// ── 透传契约 ────────────────────────────────────────────────

describe('generateSemanticRoughCutSuggestions passthrough contract', () => {
  it('passes through confidence/reason and maps label per marker type', () => {
    const markers = [
      makeMarker({ time: 6, type: 'opening', confidence: 0.8, description: '开场白' }),
      makeMarker({ time: 10, type: 'climax', confidence: 0.7, description: '重点内容' }),
      makeMarker({ time: 12, type: 'rising', confidence: 0.6, description: '内容递增' }),
      makeMarker({ time: 14, type: 'falling', confidence: 0.6, description: '内容递减' }),
      makeMarker({ time: 16, type: 'ending', confidence: 0.8, description: '结尾总结' }),
    ];

    const suggestions = generateSemanticRoughCutSuggestions(makeUnderstanding(markers), makeTargetClip());
    const byType = new Map(suggestions.map((item: SemanticRoughCutSuggestion) => [item.markerType, item]));

    expect(byType.get('opening')).toMatchObject({ confidence: 0.8, reason: '开场白', label: '开场' });
    expect(byType.get('climax')).toMatchObject({ confidence: 0.7, reason: '重点内容', label: '高潮片段' });
    expect(byType.get('rising')).toMatchObject({ confidence: 0.6, reason: '内容递增', label: '铺垫' });
    expect(byType.get('falling')).toMatchObject({ confidence: 0.6, reason: '内容递减', label: '回落' });
    expect(byType.get('ending')).toMatchObject({ confidence: 0.8, reason: '结尾总结', label: '收尾' });
    // id 唯一且稳定（按升序索引生成）
    expect(new Set(suggestions.map((item) => item.id)).size).toBe(suggestions.length);
    expect(suggestions.map((item) => item.id)).toContain('semantic-0');
  });
});
