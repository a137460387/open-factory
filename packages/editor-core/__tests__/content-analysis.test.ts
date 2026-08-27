import { describe, expect, it } from 'vitest';
import {
  buildClipContentAnalysis,
  classifySceneTypes,
  detectDialogueTurns,
  normalizeClipContentAnalysis,
  sampleEmotionCurve,
  serializeClipContentAnalysisJson,
  type ClipContentAnalysis
} from '../src';

describe('content analysis', () => {
  it('classifies scene types from brightness, color, motion, faces, and audio cadence', () => {
    expect(classifySceneTypes({ brightness: 0.18, saturation: 0.25, motion: 0.1 })).toContain('night');
    expect(classifySceneTypes({ brightness: 0.72, saturation: 0.55, motion: 0.2, colorTemperature: 6200 })).toContain('outdoor');
    expect(classifySceneTypes({ brightness: 0.44, saturation: 0.28, motion: 0.08 })).toContain('indoor');
    expect(classifySceneTypes({ brightness: 0.56, saturation: 0.44, motion: 0.82 })).toContain('action');
    expect(classifySceneTypes({ brightness: 0.52, saturation: 0.35, motion: 0.12, faceRatio: 0.46 })).toContain('close-up');
    expect(classifySceneTypes({ brightness: 0.5, saturation: 0.33, motion: 0.14, loudnessVariance: 0.2, silenceRatio: 0.4 })).toContain('dialogue');
  });

  it('samples an emotion curve from brightness change per time segment', () => {
    const curve = sampleEmotionCurve(
      [
        { time: 0, brightness: 0.2, saturation: 0.2, motion: 0.1 },
        { time: 0.5, brightness: 0.4, saturation: 0.3, motion: 0.1 },
        { time: 1.2, brightness: 0.9, saturation: 0.4, motion: 0.3 },
        { time: 1.7, brightness: 0.7, saturation: 0.4, motion: 0.3 }
      ],
      1
    );

    expect(curve).toEqual([
      { time: 0, brightness: 0.3, value: 0.195 },
      { time: 1, brightness: 0.8, value: 1 }
    ]);
  });

  it('detects dialogue turns from non-silent loudness separated by silence', () => {
    const turns = detectDialogueTurns([
      { time: 0, loudness: 0.58 },
      { time: 0.5, loudness: 0.62 },
      { time: 1.0, loudness: 0.01 },
      { time: 1.4, loudness: 0.02 },
      { time: 2.0, loudness: 0.5 },
      { time: 2.5, loudness: 0.55 }
    ]);

    expect(turns).toEqual([
      { start: 0, end: 1, loudness: 0.6 },
      { start: 2, end: 3, loudness: 0.525 }
    ]);
  });

  it('drops short dialogue turns and infers duration for single-sample turns', () => {
    expect(
      detectDialogueTurns(
        [
          { time: Number.NaN, loudness: 0.7 },
          { time: 0, loudness: 0.5 },
          { time: 0.1, loudness: 0.01 }
        ],
        { minTurnDuration: 0.35 }
      )
    ).toEqual([]);

    expect(detectDialogueTurns([{ time: 3, loudness: 0.6 }], { minTurnDuration: 0.1 })).toEqual([{ start: 3, end: 3.25, loudness: 0.6 }]);
  });

  it('skips empty visual buckets between sparse samples', () => {
    const curve = sampleEmotionCurve(
      [
        { time: 0, brightness: 0.25, saturation: 0.2, motion: 0.1 },
        { time: 3, brightness: 0.75, saturation: 0.4, motion: 0.2 }
      ],
      1
    );

    expect(curve.map((point) => point.time)).toEqual([0, 3]);
    expect(curve[1]?.value).toBe(1);
  });

  it('builds a default local analysis when samples are empty', () => {
    const analysis = buildClipContentAnalysis({ duration: -1, visualSamples: [] });

    expect(analysis.primarySceneType).toBe('indoor');
    expect(analysis.segments).toEqual([{ start: 0, end: 1, sceneTypes: ['indoor'], brightness: 0.45, motion: 0.1 }]);
    expect(analysis.emotionCurve).toEqual([{ time: 0, brightness: 0.45, value: 0.293 }]);
    expect(analysis.dialogueTurns).toEqual([]);
    expect(analysis.summary).toBe('indoor:1:0');
  });

  it('builds and normalizes clip content analysis results', () => {
    const analysis = buildClipContentAnalysis({
      duration: 3,
      analyzedAt: '2026-06-16T00:00:00.000Z',
      segmentDuration: 1,
      visualSamples: [
        { time: 0, brightness: 0.68, saturation: 0.52, motion: 0.2, colorTemperature: 6200 },
        { time: 1, brightness: 0.22, saturation: 0.22, motion: 0.18 },
        { time: 2, brightness: 0.5, saturation: 0.4, motion: 0.76, faceRatio: 0.38 }
      ],
      audioSamples: [
        { time: 0, loudness: 0.02 },
        { time: 1, loudness: 0.4 },
        { time: 1.5, loudness: 0.02 },
        { time: 2, loudness: 0.5 }
      ]
    });

    expect(analysis.version).toBe(1);
    expect(analysis.sceneTypes).toEqual(expect.arrayContaining(['outdoor', 'night', 'action', 'close-up']));
    expect(analysis.segments).toHaveLength(3);
    expect(normalizeClipContentAnalysis({ ...analysis, version: 99 })?.version).toBe(1);
  });

  it('normalizes malformed persisted analysis defensively', () => {
    expect(normalizeClipContentAnalysis(null)).toBeUndefined();

    expect(
      normalizeClipContentAnalysis({
        analyzedAt: ' ',
        primarySceneType: 'not-a-scene',
        sceneTypes: ['dialogue', 'bad-scene'],
        segments: [
          null,
          { start: 2, end: 1, sceneTypes: ['outdoor'] },
          { start: -0.5, end: 0.5, sceneTypes: ['bad-scene'], brightness: Number.POSITIVE_INFINITY, motion: -0.2, loudness: 1.2 }
        ],
        emotionCurve: [null, { time: 'bad' }, { time: -1, value: 2 }],
        dialogueTurns: [undefined, { start: 2, end: 1 }, { start: -2, end: 3, loudness: Number.POSITIVE_INFINITY }],
        summary: '  Local only  '
      })
    ).toEqual({
      version: 1,
      analyzedAt: '1970-01-01T00:00:00.000Z',
      sceneTypes: ['indoor', 'dialogue'],
      primarySceneType: 'indoor',
      segments: [{ start: 0, end: 0.5, sceneTypes: ['indoor'], brightness: 0, motion: 0, loudness: 1 }],
      emotionCurve: [{ time: 0, value: 1, brightness: 1 }],
      dialogueTurns: [{ start: 0, end: 3, loudness: 0 }],
      summary: 'Local only'
    });
  });

  it('serializes analysis as stable JSON for export', () => {
    const analysis: ClipContentAnalysis = {
      version: 1,
      analyzedAt: '2026-06-16T00:00:00.000Z',
      sceneTypes: ['dialogue'],
      primarySceneType: 'dialogue',
      segments: [{ start: 0, end: 1, sceneTypes: ['dialogue'], brightness: 0.5, motion: 0.1, loudness: 0.4 }],
      emotionCurve: [{ time: 0, value: 0.3, brightness: 0.5 }],
      dialogueTurns: [{ start: 0, end: 1, loudness: 0.4 }]
    };

    expect(JSON.parse(serializeClipContentAnalysisJson({ id: 'clip-1', name: 'Interview', contentAnalysis: analysis }))).toEqual({
      clipId: 'clip-1',
      clipName: 'Interview',
      contentAnalysis: analysis
    });
  });

  it('defaults segmentDuration to 1 when duration is zero', () => {
    const analysis = buildClipContentAnalysis({ duration: 0, visualSamples: [] });
    expect(analysis.segments).toEqual([{ start: 0, end: 1, sceneTypes: ['indoor'], brightness: 0.45, motion: 0.1 }]);
  });

  it('normalizes content analysis with non-array fields gracefully', () => {
    const result = normalizeClipContentAnalysis({
      analyzedAt: 42,
      primarySceneType: 123,
      sceneTypes: 'not-an-array',
      segments: 'not-an-array',
      emotionCurve: 'not-an-array',
      dialogueTurns: 'not-an-array'
    });
    expect(result).toBeDefined();
    expect(result?.segments).toEqual([]);
    expect(result?.emotionCurve).toEqual([]);
    expect(result?.dialogueTurns).toEqual([]);
    expect(result?.sceneTypes).toEqual(['indoor']);
    expect(result?.primarySceneType).toBe('indoor');
  });
});

// -- 六形态回归矩阵（复刻 P2 勘察合成口径：2Hz loudness，默认阈值） --
describe('detectDialogueTurns 六形态回归矩阵', () => {
  function music30(): Array<{ time: number; loudness: number }> {
    const out = [];
    for (let i = 0; i <= 60; i++) out.push({ time: +(i * 0.5).toFixed(3), loudness: 0.55 + 0.02 * (i % 3) });
    return out;
  }

  function nearSilent30(): Array<{ time: number; loudness: number }> {
    const out = [];
    for (let i = 0; i <= 60; i++) out.push({ time: +(i * 0.5).toFixed(3), loudness: i % 2 ? 0.01 : 0.03 });
    return out;
  }

  function interview60(): Array<{ time: number; loudness: number }> {
    const out = [];
    let t = 0;
    for (const b of [5, 6, 4, 7, 5, 6, 5]) {
      for (let i = 0; i < b * 2; i++) out.push({ time: +(t + i * 0.5).toFixed(3), loudness: 0.4 + 0.03 * ((i * 7) % 10) });
      t += b;
      for (let i = 0; i < 2; i++) out.push({ time: +(t + i * 0.5).toFixed(3), loudness: i % 2 ? 0.02 : 0.04 });
      t += 1;
    }
    return out;
  }

  function vlog45(): Array<{ time: number; loudness: number }> {
    const out = [];
    let t = 0;
    for (const b of [9, 11, 10]) {
      for (let i = 0; i < b * 2; i++) {
        out.push({ time: +(t + i * 0.5).toFixed(3), loudness: i % 8 === 0 ? 0.06 : 0.5 + 0.02 * ((i * 5) % 6) });
      }
      t += b;
      for (let i = 0; i < 2; i++) out.push({ time: +(t + i * 0.5).toFixed(3), loudness: 0.03 });
      t += 1;
    }
    return out;
  }

  function filmDialogue90(): Array<{ time: number; loudness: number }> {
    const out = [];
    let t = 0;
    for (let r = 0; r < 14; r++) {
      const len = 2 + (r % 3);
      for (let i = 0; i < len * 2; i++) {
        out.push({ time: +(t + i * 0.5).toFixed(3), loudness: 0.45 + 0.04 * ((i * 3) % 8) });
      }
      t += len;
      // 0.6~0.9s 清晰停顿 → 2Hz 下 2-3 个静音采样点，保证 mergeGap 切分生效
      const gapSamples = 2 + (r % 2);
      for (let i = 0; i < gapSamples; i++) out.push({ time: +(t + i * 0.5).toFixed(3), loudness: 0.03 });
      t += gapSamples * 0.5;
    }
    return out;
  }

  function covered(turns: Array<{ start: number; end: number }>): number {
    return round(turns.reduce((total, turn) => total + (turn.end - turn.start), 0));
  }

  function round(value: number): number {
    return Math.round(value * 1000) / 1000;
  }

  it('纯音乐连续高能量不再误报为对话式长 turn（治理目标）', () => {
    expect(detectDialogueTurns(music30())).toEqual([]);
  });

  it('近静音素材保持零检出', () => {
    expect(detectDialogueTurns(nearSilent30())).toEqual([]);
  });

  it('无音频轨保持零检出', () => {
    expect(detectDialogueTurns([])).toEqual([]);
  });

  it('访谈多轮形态行为不变（7 轮 / 覆盖 38s，与勘察基线一致）', () => {
    const turns = detectDialogueTurns(interview60());
    expect(turns).toHaveLength(7);
    expect(covered(turns)).toBe(38);
    for (const turn of turns) {
      expect(turn.end - turn.start).toBeLessThanOrEqual(15);
    }
  });

  it('vlog 独白长块形态行为不变（3 轮 / 覆盖 28.5s）', () => {
    const turns = detectDialogueTurns(vlog45());
    expect(turns).toHaveLength(3);
    expect(covered(turns)).toBe(28.5);
    expect(turns.map((turn) => turn.end - turn.start)).toEqual([8.5, 10.5, 9.5]);
  });

  it('电影对白清晰停顿形态行为不变（14 轮 / 覆盖 41s）', () => {
    const turns = detectDialogueTurns(filmDialogue90());
    expect(turns).toHaveLength(14);
    expect(covered(turns)).toBe(41);
    for (const turn of turns) {
      expect(turn.end - turn.start).toBeLessThanOrEqual(15);
    }
  });

  it('maxTurnDuration 可配置收紧（10s 上限剔除 vlog 10.5s 块）', () => {
    const turns = detectDialogueTurns(vlog45(), { maxTurnDuration: 10 });
    expect(turns).toHaveLength(2);
    for (const turn of turns) {
      expect(turn.end - turn.start).toBeLessThanOrEqual(10);
    }
  });
});
