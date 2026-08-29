// @vitest-environment jsdom
// 覆盖目标：apps/desktop/src/components/SmartRoughCut/useRoughCutAnalysis.ts
// 策略：纯函数 deriveRoughCutAnalysis 直调（hook 零 store 依赖）+ renderHook 壳验证。
// 锁定：contentAnalysis → highlights/onsets 派生（MediaBin 先例阈值）、
// trimStart/speed 窗口换算、未分析 clip 空输入。
import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { Clip, ClipContentAnalysis } from '@open-factory/editor-core';
import { makeClip } from '../Timeline/hooks/timeline/__tests__/test-fixtures';
import { deriveRoughCutAnalysis, useRoughCutAnalysis } from './useRoughCutAnalysis';

function makeAnalysis(overrides: Partial<ClipContentAnalysis> = {}): ClipContentAnalysis {
  return {
    version: 1,
    analyzedAt: '2026-08-25T00:00:00.000Z',
    sceneTypes: ['indoor'],
    primarySceneType: 'indoor',
    segments: [],
    emotionCurve: [],
    dialogueTurns: [],
    ...overrides,
  } as ClipContentAnalysis;
}

describe('deriveRoughCutAnalysis', () => {
  it('returns empty inputs and hasAnalysis=false for unanalyzed or missing clips', () => {
    expect(deriveRoughCutAnalysis(undefined)).toEqual({
      highlights: [],
      onsets: [],
      sourceDuration: 0,
      hasAnalysis: false,
    });
    expect(deriveRoughCutAnalysis(makeClip({ id: 'c1' }))).toEqual({
      highlights: [],
      onsets: [],
      sourceDuration: 0,
      hasAnalysis: false,
    });
  });

  it('derives motion-peak and combined highlights at MediaBin thresholds', () => {
    const clip = makeClip({
      id: 'c1',
      type: 'video',
      duration: 4,
      contentAnalysis: makeAnalysis({
        segments: [
          { start: 0, end: 1, sceneTypes: [], brightness: 0.5, motion: 0.7 },
          { start: 1, end: 2, sceneTypes: [], brightness: 0.5, motion: 0.4 },
        ],
        emotionCurve: [{ time: 1.5, value: 0.8, brightness: 0.5 }],
      }),
    });

    const result = deriveRoughCutAnalysis(clip);

    expect(result.hasAnalysis).toBe(true);
    expect(result.sourceDuration).toBe(4);
    expect(result.highlights).toHaveLength(2);
    expect(result.highlights[0]).toMatchObject({ time: 0, score: 0.7, type: 'motion-peak' });
    expect(result.highlights[1]).toMatchObject({ time: 1.5, score: 0.8, type: 'combined', duration: 1 });
  });

  it('filters highlights outside the clip source window and converts to local time', () => {
    // trimStart=10 speed=2 duration=2 → source 窗口 [10, 14]
    // segment [8,9] 在窗口外；segment [12,13] → local [1,1.5]
    const clip = makeClip({
      id: 'c1',
      type: 'video',
      duration: 2,
      trimStart: 10,
      speed: 2,
      contentAnalysis: makeAnalysis({
        segments: [
          { start: 8, end: 9, sceneTypes: [], brightness: 0.5, motion: 0.9 },
          { start: 12, end: 13, sceneTypes: [], brightness: 0.5, motion: 0.8 },
        ],
      }),
    });

    const result = deriveRoughCutAnalysis(clip);

    expect(result.highlights).toHaveLength(1);
    expect(result.highlights[0]).toMatchObject({ time: 1, duration: 0.5, type: 'motion-peak' });
  });

  it('derives onsets from loudness rising edges and dialogue turn starts', () => {
    const clip = makeClip({
      id: 'c1',
      type: 'video',
      duration: 4,
      contentAnalysis: makeAnalysis({
        segments: [
          { start: 0, end: 1, sceneTypes: [], brightness: 0.5, motion: 0.1, loudness: 0.2 },
          { start: 1, end: 2, sceneTypes: [], brightness: 0.5, motion: 0.1, loudness: 0.6 },
          { start: 2, end: 3, sceneTypes: [], brightness: 0.5, motion: 0.1, loudness: 0.65 },
        ],
        dialogueTurns: [{ start: 2.5, end: 3, loudness: 0.7 }],
      }),
    });

    const result = deriveRoughCutAnalysis(clip);

    // segment 2 loudness 0.6 vs 0.2（delta 0.4 > 0.2）→ onset；
    // segment 3 delta 0.05 不触发；dialogueTurn 2.5 → onset
    expect(result.onsets).toHaveLength(2);
    expect(result.onsets[0]).toMatchObject({ time: 1, strength: 0.8, band: 'mid' });
    expect(result.onsets[1]).toMatchObject({ time: 2.5, strength: 0.7 });
  });

  it('skips loudness onsets below the loudness floor', () => {
    const clip = makeClip({
      id: 'c1',
      type: 'video',
      duration: 4,
      contentAnalysis: makeAnalysis({
        segments: [
          { start: 0, end: 1, sceneTypes: [], brightness: 0.5, motion: 0.1, loudness: 0.05 },
          { start: 1, end: 2, sceneTypes: [], brightness: 0.5, motion: 0.1, loudness: 0.2 },
        ],
      }),
    });

    const result = deriveRoughCutAnalysis(clip);

    // delta 0.15 < 0.2 不触发；且 current.loudness 0.2 < 0.25 也低于下限
    expect(result.onsets).toHaveLength(0);
  });

  it('sorts highlights and onsets by time', () => {
    const clip = makeClip({
      id: 'c1',
      type: 'video',
      duration: 4,
      contentAnalysis: makeAnalysis({
        segments: [{ start: 2, end: 3, sceneTypes: [], brightness: 0.5, motion: 0.9 }],
        emotionCurve: [{ time: 1, value: 0.9, brightness: 0.5 }],
        dialogueTurns: [{ start: 0.5, end: 1, loudness: 0.6 }],
      }),
    });

    const result = deriveRoughCutAnalysis(clip);

    expect(result.highlights.map((marker) => marker.time)).toEqual([1, 2]);
    expect(result.onsets.map((onset) => onset.time)).toEqual([0.5]);
  });
});

describe('useRoughCutAnalysis', () => {
  it('wraps the derivation with memoization on the clip reference', () => {
    const clip = makeClip({
      id: 'c1',
      type: 'video',
      duration: 2,
      contentAnalysis: makeAnalysis({
        segments: [{ start: 0, end: 1, sceneTypes: [], brightness: 0.5, motion: 0.8 }],
      }),
    });
    const { result, rerender } = renderHook(() => useRoughCutAnalysis(clip));

    expect(result.current.hasAnalysis).toBe(true);
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });
});
