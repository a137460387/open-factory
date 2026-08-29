// 覆盖目标：apps/desktop/src/components/SmartRoughCut/semantic-suggestion-review.ts
// 策略：纯函数直调（成熟测试模式 4）。锁定：时间线绝对时间 → 源素材时间
// 换算矩阵（speed=1 基准 / speed≠1 / trimStart≠0 复合）、单元素 segments
// 产出契约（score 族透传 confidence）、审阅视图模型（before/after/保留
// 比例、speed 抵消）、整 clip 覆盖判定（含 1e-6 容差边界）。
import { describe, expect, it } from 'vitest';
import type { Clip } from '@open-factory/editor-core';
import { makeClip } from '../Timeline/hooks/timeline/__tests__/test-fixtures';
import type { SemanticRoughCutSuggestion } from './semantic-suggestion';
import {
  buildSuggestionReviewModel,
  suggestionCoversEntireClip,
  suggestionToSegments,
} from './semantic-suggestion-review';

// ── Fixture ─────────────────────────────────────────────────

function makeSuggestion(
  overrides: Partial<SemanticRoughCutSuggestion> & { timeRange: { start: number; end: number } },
): SemanticRoughCutSuggestion {
  return {
    id: 'semantic-0',
    markerType: 'climax',
    confidence: 0.7,
    label: '高潮片段',
    reason: '重点内容',
    source: 'narrative',
    ...overrides,
  };
}

// ── suggestionToSegments：abs → source 换算 ─────────────────

describe('suggestionToSegments', () => {
  it('maps absolute timeline range to source range at speed=1 with zero trimStart', () => {
    // clip 占据时间线 [5, 20)，建议区间 [8, 12) → 源域 [3, 7)
    const clip = makeClip({ id: 'clip-1', start: 5, duration: 15 });
    const segments = suggestionToSegments(
      makeSuggestion({ timeRange: { start: 8, end: 12 } }),
      clip,
    );

    expect(segments).toHaveLength(1);
    expect(segments[0].sourceStart).toBe(3);
    expect(segments[0].sourceEnd).toBe(7);
    expect(segments[0].duration).toBe(4);
  });

  it('applies trimStart offset (source = trimStart + local)', () => {
    // clip 时间线 [0, 10)，trimStart=30 → 建议区间 [2, 5) → 源域 [32, 35)
    const clip = makeClip({ id: 'clip-1', start: 0, duration: 10, trimStart: 30 });
    const segments = suggestionToSegments(
      makeSuggestion({ timeRange: { start: 2, end: 5 } }),
      clip,
    );

    expect(segments[0].sourceStart).toBe(32);
    expect(segments[0].sourceEnd).toBe(35);
  });

  it('scales by clip speed (source delta = absolute delta × speed)', () => {
    // speed=2：绝对区间宽 3s → 源域宽 6s；起点 = trimStart + local × 2
    const clip = makeClip({ id: 'clip-1', start: 10, duration: 5, trimStart: 100, speed: 2 });
    const segments = suggestionToSegments(
      makeSuggestion({ timeRange: { start: 12, end: 15 } }),
      clip,
    );

    expect(segments[0].sourceStart).toBe(104);
    expect(segments[0].sourceEnd).toBe(110);
    expect(segments[0].duration).toBe(6);
  });

  it('passes suggestion confidence through to all score fields', () => {
    const clip = makeClip({ id: 'clip-1', start: 0, duration: 10 });
    const segments = suggestionToSegments(
      makeSuggestion({ timeRange: { start: 2, end: 4 }, confidence: 0.85 }),
      clip,
    );

    expect(segments[0].score).toBe(0.85);
    expect(segments[0].visualScore).toBe(0.85);
    expect(segments[0].audioScore).toBe(0.85);
  });
});

// ── buildSuggestionReviewModel：before/after 审阅模型 ────────

describe('buildSuggestionReviewModel', () => {
  it('builds before from clip trim window and after from suggestion range', () => {
    // clip trimStart=10、duration=8、speed=1 → before 源域 [10, 18)
    const clip = makeClip({ id: 'clip-1', start: 0, duration: 8, trimStart: 10 });
    const model = buildSuggestionReviewModel(
      makeSuggestion({ timeRange: { start: 2, end: 6 } }),
      clip,
    );

    expect(model.before).toEqual({ start: 10, end: 18 });
    expect(model.after).toEqual({ start: 12, end: 16 });
    expect(model.originalDuration).toBe(8);
    expect(model.keptDuration).toBe(4);
    expect(model.retentionRatio).toBeCloseTo(0.5, 10);
  });

  it('keeps retentionRatio speed-invariant (speed cancels out)', () => {
    const base = { id: 'clip-1', start: 0, duration: 8 };
    const suggestion = makeSuggestion({ timeRange: { start: 2, end: 6 } });
    const speedOne = buildSuggestionReviewModel(suggestion, makeClip({ ...base, speed: 1 }));
    const speedTwo = buildSuggestionReviewModel(
      suggestion,
      makeClip({ ...base, trimStart: 20, speed: 2 }),
    );

    // 时间线上同为 4s/8s，保留比例与播放速率无关
    expect(speedTwo.retentionRatio).toBeCloseTo(speedOne.retentionRatio, 10);
    expect(speedTwo.keptDuration).toBeCloseTo(8, 10);
    expect(speedTwo.originalDuration).toBeCloseTo(16, 10);
  });

  it('scales before window end by speed (trimEnd = trimStart + duration × speed)', () => {
    // duration=5、speed=2 → 源域覆盖宽 10s；trimStart=0 → before [0, 10)
    const clip = makeClip({ id: 'clip-1', start: 0, duration: 5, speed: 2 });
    const model = buildSuggestionReviewModel(
      makeSuggestion({ timeRange: { start: 0, end: 2.5 } }),
      clip,
    );

    expect(model.before).toEqual({ start: 0, end: 10 });
    expect(model.after).toEqual({ start: 0, end: 5 });
  });
});

// ── suggestionCoversEntireClip：整 clip 覆盖判定 ─────────────

describe('suggestionCoversEntireClip', () => {
  it('detects a suggestion spanning the whole clip', () => {
    const clip = makeClip({ id: 'clip-1', start: 5, duration: 15 });
    const whole = makeSuggestion({ timeRange: { start: 5, end: 20 } });

    expect(suggestionCoversEntireClip(whole, clip)).toBe(true);
  });

  it('returns false for a partial suggestion', () => {
    const clip = makeClip({ id: 'clip-1', start: 5, duration: 15 });
    const partial = makeSuggestion({ timeRange: { start: 8, end: 20 } });

    expect(suggestionCoversEntireClip(partial, clip)).toBe(false);
  });

  it('honors the 1e-6 tolerance on both boundaries', () => {
    const clip = makeClip({ id: 'clip-1', start: 5, duration: 15 });
    // 起点超容差 2e-6 → 非整覆盖
    const startBeyond = makeSuggestion({ timeRange: { start: 5.000002, end: 20 } });
    // 终点差 2e-6 → 非整覆盖
    const endBeyond = makeSuggestion({ timeRange: { start: 5, end: 19.999998 } });
    // 起点在容差内（0.5e-6）→ 整覆盖
    const startWithin = makeSuggestion({ timeRange: { start: 5.0000005, end: 20 } });

    expect(suggestionCoversEntireClip(startBeyond, clip)).toBe(false);
    expect(suggestionCoversEntireClip(endBeyond, clip)).toBe(false);
    expect(suggestionCoversEntireClip(startWithin, clip)).toBe(true);
  });

  it('matches the command-side guard: single full-clip range would be rejected', () => {
    // ApplyRoughCutProposalCommand 对「单区间覆盖整 clip」抛错（换算至
    // clip 本地域后钳制判定）；本函数在绝对域预判定，全域情形两口径一致。
    const clip: Clip = makeClip({ id: 'clip-1', start: 0, duration: 10 });
    expect(suggestionCoversEntireClip(makeSuggestion({ timeRange: { start: 0, end: 10 } }), clip)).toBe(true);
    expect(suggestionCoversEntireClip(makeSuggestion({ timeRange: { start: 0, end: 9.999998 } }), clip)).toBe(false);
  });
});
