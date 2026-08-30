// 覆盖目标：apps/desktop/src/components/SmartRoughCut/semantic-tighten-suggestion.ts
// 策略：纯函数直调（成熟测试模式 4）。锁定：源域→绝对时间域换算
// （trimStart/speed≠0/1 形态）、head/tail 单区间产出与 label/source/id 契约、
// onset 兜底链、无可剪区间空产出、合并排序（climax→时间升序→head→tail）、
// 同区间去重共存规则（narrative 优先，派生项剔除；同区间重复=缺陷断言）。
import { describe, expect, it } from 'vitest';
import type { Clip, ClipContentAnalysis, ContentAnalysisSegment, ContentDialogueTurn } from '@open-factory/editor-core';
import { makeClip } from '../Timeline/hooks/timeline/__tests__/test-fixtures';
import { deriveTightenSuggestions, mergeSemanticSuggestions } from './semantic-tighten-suggestion';
import type { SemanticRoughCutSuggestion } from './semantic-suggestion';

// ── Fixture ─────────────────────────────────────────────────

function makeSegment(start: number, end: number, loudness: number): ContentAnalysisSegment {
  return { start, end, sceneTypes: ['dialogue'], brightness: 0.5, motion: 0.2, loudness };
}

function makeTurn(start: number, end: number): ContentDialogueTurn {
  return { start, end, loudness: 0.5 };
}

function makeAnalysis(overrides: Partial<ClipContentAnalysis> = {}): ClipContentAnalysis {
  return {
    version: 1,
    analyzedAt: '2026-08-27T00:00:00.000Z',
    sceneTypes: ['dialogue'],
    primarySceneType: 'dialogue',
    segments: [],
    emotionCurve: [],
    dialogueTurns: [],
    ...overrides,
  };
}

/** 常规可剪形态：首 turn 0.6 起 + 尾部低能量段 1.8 起（源域） */
function makeTightenableAnalysis(): ClipContentAnalysis {
  return makeAnalysis({
    segments: [
      makeSegment(0, 0.6, 0.05),
      makeSegment(0.6, 1.2, 0.6),
      makeSegment(1.2, 1.8, 0.55),
      makeSegment(1.8, 2.5, 0.04),
    ],
    dialogueTurns: [makeTurn(0.6, 1.2), makeTurn(1.2, 1.8)],
  });
}

// ── deriveTightenSuggestions ────────────────────────────────

describe('deriveTightenSuggestions derivation', () => {
  it('derives head-trim and tail-trim keep-ranges from contentAnalysis (identity mapping)', () => {
    const clip = makeClip({ id: 'clip-1', start: 0, duration: 2.5, trimStart: 0 });
    const suggestions = deriveTightenSuggestions(makeTightenableAnalysis(), clip);

    expect(suggestions.map((item) => item.source)).toEqual(['head-trim', 'tail-trim']);
    const head = suggestions[0];
    // 首内容点 0.6 − margin 0.3 = 0.3；keep [0.3, 2.5]
    expect(head.id).toBe('semantic-head-trim');
    expect(head.label).toBe('掐头收紧');
    expect(head.markerType).toBe('opening');
    expect(head.timeRange).toEqual({ start: 0.3, end: 2.5 });
    expect(head.reason).toContain('启发式');
    const tail = suggestions[1];
    // 尾部低能量 run 起点 1.8 + margin 0.2 = 2.0；keep [0, 2.0]
    expect(tail.id).toBe('semantic-tail-trim');
    expect(tail.label).toBe('收尾收紧');
    expect(tail.timeRange).toEqual({ start: 0, end: 2 });
    // 启发式固定置信度 0.6
    expect(new Set(suggestions.map((item) => item.confidence))).toEqual(new Set([0.6]));
  });

  it('converts source-domain detection to timeline absolute time via trimStart and speed', () => {
    // 时间线 [5, 9)，trimStart=1，speed=2 → 源域窗口 [1, 9)
    const clip = makeClip({ id: 'clip-1', start: 5, duration: 4, trimStart: 1, speed: 2 });
    const analysis = makeAnalysis({
      segments: [makeSegment(1, 2, 0.05), makeSegment(2, 7, 0.6), makeSegment(7, 9, 0.04)],
      dialogueTurns: [makeTurn(2, 7)],
    });

    const suggestions = deriveTightenSuggestions(analysis, clip);

    // head：首内容点（源域 2）− 0.3 = 1.7 → abs = 5 + (1.7−1)/2 = 5.35
    const head = suggestions.find((item) => item.source === 'head-trim');
    expect(head?.timeRange).toEqual({ start: 5.35, end: 9 });
    // tail：run 起点 7 + 0.2 = 7.2 → abs = 5 + (7.2−1)/2 = 8.1
    const tail = suggestions.find((item) => item.source === 'tail-trim');
    expect(tail?.timeRange).toEqual({ start: 5, end: 8.1 });
  });

  it('returns empty array without analysis or clip', () => {
    expect(deriveTightenSuggestions(undefined, makeClip({ id: 'clip-1' }))).toEqual([]);
    expect(deriveTightenSuggestions(makeTightenableAnalysis(), undefined)).toEqual([]);
  });

  it('returns empty array when neither head nor tail has a trimmable range', () => {
    // 首 turn 贴近起点（无可掐余量）+ 尾段高能量
    const analysis = makeAnalysis({
      segments: [makeSegment(0, 2.5, 0.6)],
      dialogueTurns: [makeTurn(0.1, 2.5)],
    });
    expect(deriveTightenSuggestions(analysis, makeClip({ id: 'clip-1', duration: 2.5 }))).toEqual([]);
  });

  it('falls back to loudness rising-edge onsets when no dialogue turns exist (纯音乐形态)', () => {
    // 无 turns；segments 上升沿 0.05→0.6（delta 0.55 > 0.2，0.6 > 0.25）→ onset @0.6
    const analysis = makeAnalysis({
      segments: [makeSegment(0, 0.6, 0.05), makeSegment(0.6, 2.5, 0.6)],
      dialogueTurns: [],
    });
    const suggestions = deriveTightenSuggestions(analysis, makeClip({ id: 'clip-1', duration: 2.5 }));

    expect(suggestions.map((item) => item.source)).toEqual(['head-trim']);
    expect(suggestions[0].timeRange).toEqual({ start: 0.3, end: 2.5 });
  });

  it('filters turns and segments to the clip source window before detection', () => {
    // clip 源域窗口 [1, 5)：窗口外 turn（0.2）与窗口外尾段（5.5-6 低能量）不参与
    const clip = makeClip({ id: 'clip-1', start: 0, duration: 4, trimStart: 1 });
    const analysis = makeAnalysis({
      segments: [
        makeSegment(0.8, 1.2, 0.05),
        makeSegment(1.2, 4.8, 0.6),
        makeSegment(4.8, 5, 0.5),
        makeSegment(5.5, 6, 0.04),
      ],
      dialogueTurns: [makeTurn(0.2, 0.6), makeTurn(1.6, 4.8)],
    });

    const suggestions = deriveTightenSuggestions(analysis, clip);

    // 首个窗口内 turn（源域 1.6）− 0.3 = 1.3 → abs = 0 + (1.3−1) = 0.3 → keep [0.3, 4]
    // （窗口外低能量段不计入尾部回溯）
    expect(suggestions.map((item) => item.source)).toEqual(['head-trim']);
    expect(suggestions[0].timeRange).toEqual({ start: 0.3, end: 4 });
  });

  it('produces only tail-trim when content starts at the clip start', () => {
    const analysis = makeAnalysis({
      segments: [makeSegment(0, 1.8, 0.6), makeSegment(1.8, 2.5, 0.04)],
      dialogueTurns: [makeTurn(0, 1.8)],
    });
    const suggestions = deriveTightenSuggestions(analysis, makeClip({ id: 'clip-1', duration: 2.5 }));

    expect(suggestions.map((item) => item.source)).toEqual(['tail-trim']);
  });

  it('drops head-trim when remaining content after trim is too short (极短 clip 保护)', () => {
    // 首内容点 1.9 → trimStart 1.6；窗口 2.2 − 1.6 = 0.6 < 1
    const analysis = makeAnalysis({
      segments: [makeSegment(0, 1.9, 0.05), makeSegment(1.9, 2.2, 0.6)],
      dialogueTurns: [makeTurn(1.9, 2.2)],
    });
    const suggestions = deriveTightenSuggestions(analysis, makeClip({ id: 'clip-1', duration: 2.2 }));

    expect(suggestions).toEqual([]);
  });
});

// ── mergeSemanticSuggestions ────────────────────────────────

function makeNarrativeSuggestion(
  id: string,
  timeRange: { start: number; end: number },
  markerType: SemanticRoughCutSuggestion['markerType'],
  confidence = 0.7,
): SemanticRoughCutSuggestion {
  return {
    id,
    timeRange,
    markerType,
    confidence,
    label: '叙事',
    reason: '叙事标记',
    source: 'narrative',
  };
}

function makeTightenSuggestion(
  source: 'head-trim' | 'tail-trim',
  timeRange: { start: number; end: number },
): SemanticRoughCutSuggestion {
  return {
    id: source === 'head-trim' ? 'semantic-head-trim' : 'semantic-tail-trim',
    timeRange,
    markerType: source === 'head-trim' ? 'opening' : 'ending',
    confidence: 0.6,
    label: source === 'head-trim' ? '掐头收紧' : '收尾收紧',
    reason: '启发式',
    source,
  };
}

describe('mergeSemanticSuggestions ordering and dedup', () => {
  it('orders climax first (confidence desc), then narrative by time asc, then head-trim, then tail-trim', () => {
    const narrative = [
      makeNarrativeSuggestion('semantic-0', { start: 1.5, end: 2 }, 'climax', 0.6),
      makeNarrativeSuggestion('semantic-1', { start: 3, end: 4 }, 'climax', 0.9),
      makeNarrativeSuggestion('semantic-2', { start: 4, end: 5 }, 'opening'),
      makeNarrativeSuggestion('semantic-3', { start: 2, end: 3 }, 'rising'),
    ];
    const tighten = [
      makeTightenSuggestion('tail-trim', { start: 0, end: 4.6 }),
      makeTightenSuggestion('head-trim', { start: 0.3, end: 5 }),
    ];

    const merged = mergeSemanticSuggestions(narrative, tighten);

    expect(merged.map((item) => item.id)).toEqual([
      'semantic-1', // climax 0.9
      'semantic-0', // climax 0.6
      'semantic-3', // 非 climax 时间升序（start 2）
      'semantic-2', // start 4
      'semantic-head-trim',
      'semantic-tail-trim',
    ]);
  });

  it('drops a tighten suggestion whose range exactly equals a narrative suggestion (narrative 优先)', () => {
    const narrative = [
      // opening [0, 2] 与 tail-trim keep-range 完全相等 → 派生项剔除
      makeNarrativeSuggestion('semantic-0', { start: 0, end: 2 }, 'opening'),
    ];
    const tighten = [
      makeTightenSuggestion('head-trim', { start: 0.3, end: 5 }),
      makeTightenSuggestion('tail-trim', { start: 0, end: 2 }),
    ];

    const merged = mergeSemanticSuggestions(narrative, tighten);

    expect(merged.map((item) => item.id)).toEqual(['semantic-0', 'semantic-head-trim']);
  });

  it('treats near-equal ranges within the 1e-6 tolerance as duplicates', () => {
    const narrative = [makeNarrativeSuggestion('semantic-0', { start: 0.3, end: 5 }, 'ending')];
    const tighten = [makeTightenSuggestion('head-trim', { start: 0.3 + 0.0000005, end: 5 - 0.0000005 })];

    expect(mergeSemanticSuggestions(narrative, tighten)).toHaveLength(1);
  });

  it('never emits duplicate ranges in the merged output (同区间重复=缺陷)', () => {
    const narrative = [
      makeNarrativeSuggestion('semantic-0', { start: 0, end: 2 }, 'opening'),
      makeNarrativeSuggestion('semantic-1', { start: 2, end: 5 }, 'climax'),
    ];
    const tighten = [
      makeTightenSuggestion('head-trim', { start: 0.3, end: 5 }),
      makeTightenSuggestion('tail-trim', { start: 0, end: 4.6 }),
    ];

    const merged = mergeSemanticSuggestions(narrative, tighten);

    const ranges = merged.map((item) => `${item.timeRange.start.toFixed(6)}-${item.timeRange.end.toFixed(6)}`);
    expect(new Set(ranges).size).toBe(merged.length);
  });

  it('returns empty array when both sources are empty', () => {
    expect(mergeSemanticSuggestions([], [])).toEqual([]);
  });

  it('keeps tighten suggestions when narrative list is empty (仅分析就绪形态)', () => {
    const tighten = [
      makeTightenSuggestion('head-trim', { start: 0.3, end: 2.5 }),
      makeTightenSuggestion('tail-trim', { start: 0, end: 2 }),
    ];
    expect(mergeSemanticSuggestions([], tighten)).toEqual(tighten);
  });
});

// ── mergeSemanticSuggestions 第三源：emotional-climax ────────

function makeClimaxSuggestion(
  id: string,
  timeRange: { start: number; end: number },
  confidence: number,
): SemanticRoughCutSuggestion {
  return {
    id,
    timeRange,
    markerType: 'climax',
    confidence,
    label: '情感高潮',
    reason: 'top-K',
    source: 'emotional-climax',
  };
}

describe('mergeSemanticSuggestions emotional-climax integration', () => {
  it('sorts the climax group (narrative + emotional) by confidence desc before other items', () => {
    const narrative = [
      makeNarrativeSuggestion('semantic-0', { start: 0, end: 2 }, 'climax', 0.7),
      makeNarrativeSuggestion('semantic-1', { start: 4, end: 5 }, 'opening'),
    ];
    const climax = [
      makeClimaxSuggestion('semantic-emotional-climax-0', { start: 6, end: 11 }, 0.9),
      makeClimaxSuggestion('semantic-emotional-climax-1', { start: 12, end: 17 }, 0.5),
    ];

    const merged = mergeSemanticSuggestions(narrative, [], climax);

    expect(merged.map((item) => item.id)).toEqual([
      'semantic-emotional-climax-0', // 0.9
      'semantic-0', // narrative climax 0.7
      'semantic-emotional-climax-1', // 0.5
      'semantic-1', // 非 climax narrative
    ]);
  });

  it('drops an emotional-climax suggestion whose range exactly equals a narrative suggestion', () => {
    const narrative = [makeNarrativeSuggestion('semantic-0', { start: 6, end: 11 }, 'climax', 0.7)];
    const climax = [makeClimaxSuggestion('semantic-emotional-climax-0', { start: 6, end: 11 }, 0.9)];

    const merged = mergeSemanticSuggestions(narrative, [], climax);

    expect(merged.map((item) => item.id)).toEqual(['semantic-0']);
  });

  it('places emotional-climax items before head/tail tighten suggestions', () => {
    const tighten = [
      makeTightenSuggestion('head-trim', { start: 0.3, end: 5 }),
      makeTightenSuggestion('tail-trim', { start: 0, end: 4.6 }),
    ];
    const climax = [makeClimaxSuggestion('semantic-emotional-climax-0', { start: 1, end: 6 }, 0.8)];

    const merged = mergeSemanticSuggestions([], tighten, climax);

    expect(merged.map((item) => item.id)).toEqual([
      'semantic-emotional-climax-0',
      'semantic-head-trim',
      'semantic-tail-trim',
    ]);
  });

  it('remains backward compatible with two-argument calls (climax defaults to empty)', () => {
    const narrative = [makeNarrativeSuggestion('semantic-0', { start: 0, end: 2 }, 'opening')];
    expect(mergeSemanticSuggestions(narrative, [])).toEqual(narrative);
  });

  it('never emits duplicate ranges across all three sources', () => {
    const narrative = [makeNarrativeSuggestion('semantic-0', { start: 0, end: 2 }, 'climax', 0.7)];
    const tighten = [makeTightenSuggestion('head-trim', { start: 0.3, end: 5 })];
    const climax = [makeClimaxSuggestion('semantic-emotional-climax-0', { start: 2.5, end: 7.5 }, 0.8)];

    const merged = mergeSemanticSuggestions(narrative, tighten, climax);

    const ranges = merged.map((item) => `${item.timeRange.start.toFixed(6)}-${item.timeRange.end.toFixed(6)}`);
    expect(new Set(ranges).size).toBe(merged.length);
  });
});
