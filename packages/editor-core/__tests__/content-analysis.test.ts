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
