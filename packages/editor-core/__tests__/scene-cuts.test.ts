import { describe, expect, it } from 'vitest';
import {
  buildSceneMarkerInputs,
  buildScdetFilterArg,
  buildYoutubeChapterLines,
  estimateSceneCutCountForThreshold,
  filterShortSceneCuts,
  getSceneDetectionAnalysisLimit,
  mapSceneDetectThreshold,
  normalizeSceneCutTimes
} from '../src';

describe('scene cut helpers', () => {
  it('maps scene detection threshold to scdet filter args', () => {
    expect(mapSceneDetectThreshold(undefined)).toBe(10);
    expect(mapSceneDetectThreshold(-4)).toBe(0);
    expect(mapSceneDetectThreshold(101)).toBe(100);
    expect(buildScdetFilterArg(12.5)).toBe('scdet=threshold=12.5');
  });

  it('normalizes and filters short scene cuts', () => {
    expect(normalizeSceneCutTimes([2, Number.NaN, -1, 2, 9], 4)).toEqual([0, 2, 4]);
    expect(normalizeSceneCutTimes(undefined)).toBeUndefined();
    expect(normalizeSceneCutTimes([])).toBeUndefined();
    expect(filterShortSceneCuts([0.4, 1.2, 1.8, 3.5, 4.7], 5, 1)).toEqual([1.2, 3.5]);
    expect(filterShortSceneCuts([0.4, 1.2, 1.8, 3.5, 4.7], 5, 0)).toEqual([0.4, 1.2, 1.8, 3.5, 4.7]);
    expect(filterShortSceneCuts([1, 2], Number.NaN, Number.NaN)).toEqual([]);
  });

  it('builds numbered scene marker inputs', () => {
    expect(buildSceneMarkerInputs([1.25, 2.5], 10, { idPrefix: 'clip-a-scene' })).toEqual([
      { id: 'clip-a-scene-1', time: 11.25, label: '场景 1', color: '#f97316' },
      { id: 'clip-a-scene-2', time: 12.5, label: '场景 2', color: '#f97316' }
    ]);
    expect(buildSceneMarkerInputs([2], Number.NaN, { labelPrefix: 'Scene', color: '#ffaa00' })).toEqual([
      { time: 2, label: 'Scene 1', color: '#ffaa00' }
    ]);
  });

  it('formats scene markers as YouTube chapter lines', () => {
    expect(
      buildYoutubeChapterLines([
        { time: 65.2, label: '场景 2' },
        { time: 0, label: '场景 1' },
        { time: 3661.1, label: '片尾' },
        { time: Number.NaN, label: '忽略' },
        { time: 12, label: '  ' }
      ])
    ).toEqual(['00:00 场景 1', '01:05 场景 2', '1:01:01 片尾']);
  });

  it('limits analysis duration for clips longer than 60 minutes', () => {
    expect(getSceneDetectionAnalysisLimit(120)).toEqual({ analysisDuration: 120, limited: false, maxDuration: 3600 });
    expect(getSceneDetectionAnalysisLimit(3700)).toEqual({ analysisDuration: 3600, limited: true, maxDuration: 3600 });
  });

  it('estimates scene count from previous cuts and threshold', () => {
    expect(estimateSceneCutCountForThreshold([1, 2, 3], 20, 10)).toBe(2);
    expect(estimateSceneCutCountForThreshold(undefined, 10, 120)).toBe(4);
    expect(estimateSceneCutCountForThreshold(undefined, 10, 0)).toBe(0);
    expect(estimateSceneCutCountForThreshold([1, 2, 3], 0, 10)).toBe(30);
  });
});
