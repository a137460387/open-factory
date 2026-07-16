import { describe, expect, it } from 'vitest';
import {
  orchestrateSmartRoughCut,
  buildOrchestrationInput,
  toggleSuggestionSelection,
  setAllSuggestionSelection,
  selectSuggestionsByType,
  getSelectedSuggestions,
  reorderSuggestions,
  buildSmartRoughCutReport,
  type SmartRoughCutAnalysisData,
  type SmartRoughCutSuggestion,
} from '../src';

// ─── 测试数据工厂 ──────────────────────────────────────────

function createSceneData(): SmartRoughCutAnalysisData {
  return {
    scenes: [
      {
        mediaId: 'media-1',
        result: {
          boundaries: [
            { time: 5, score: 0.8, histogramDiff: 0.7, motionDiff: 0.3, threshold: 0.35 },
            { time: 15, score: 0.6, histogramDiff: 0.4, motionDiff: 0.6, threshold: 0.35 },
            { time: 0.1, score: 0.2, histogramDiff: 0.1, motionDiff: 0.1, threshold: 0.35 },
          ],
          segments: [
            { start: 0, end: 5, sceneType: 'indoor', avgBrightness: 0.5, avgMotion: 0.2 },
            { start: 5, end: 15, sceneType: 'outdoor', avgBrightness: 0.8, avgMotion: 0.4 },
            { start: 15, end: 30, sceneType: 'action', avgBrightness: 0.6, avgMotion: 0.7 },
          ],
          thresholdCurve: [],
          sampleCount: 100,
        },
      },
    ],
  };
}

function createSilenceData(): SmartRoughCutAnalysisData {
  return {
    silences: [
      {
        mediaId: 'media-1',
        clipId: 'clip-1',
        ranges: [
          { start: 2, end: 3.5, duration: 1.5 },
          { start: 10, end: 10.3, duration: 0.3 },
          { start: 20, end: 22, duration: 2 },
        ],
      },
    ],
  };
}

function createDialogueData(): SmartRoughCutAnalysisData {
  return {
    dialogues: [
      {
        mediaId: 'media-1',
        clipId: 'clip-1',
        intervals: [
          { id: 'd1', start: 0, end: 5, duration: 5, confidence: 0.9 },
          { id: 'd2', start: 8, end: 15, duration: 7, confidence: 0.7 },
        ],
      },
    ],
  };
}

function createBeatData(): SmartRoughCutAnalysisData {
  return {
    beats: {
      beatTimes: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      bpm: 120,
    },
  };
}

function createEmotionData(): SmartRoughCutAnalysisData {
  return {
    emotions: {
      result: {
        curve: [],
        peaks: [
          { time: 3, value: 0.8, type: 'positive' },
          { time: 10, value: -0.6, type: 'negative' },
          { time: 15, value: 0.2, type: 'neutral' },
        ],
        overallMood: 'mixed',
        emotionalArc: 'peak',
      },
    },
  };
}

function createNarrativeData(): SmartRoughCutAnalysisData {
  return {
    narrative: {
      result: {
        structure: {
          acts: [
            { label: 'setup', start: 0, end: 10, segmentIndices: [0, 1] },
            { label: 'development', start: 10, end: 25, segmentIndices: [2, 3] },
            { label: 'climax', start: 25, end: 35, segmentIndices: [4] },
            { label: 'resolution', start: 35, end: 45, segmentIndices: [5] },
          ],
          peakIndex: 4,
          troughIndex: 1,
          hasClimax: true,
        },
        arc: { points: [], peakTime: 30, troughTime: 10 },
        score: 0.8,
        suggestions: [],
      },
    },
  };
}

function createFullData(): SmartRoughCutAnalysisData {
  return {
    ...createSceneData(),
    ...createSilenceData(),
    ...createDialogueData(),
    ...createBeatData(),
    ...createEmotionData(),
    ...createNarrativeData(),
  };
}

// ─── 编排主函数测试 ──────────────────────────────────────────

describe('orchestrateSmartRoughCut', () => {
  it('空输入返回空结果', () => {
    const result = orchestrateSmartRoughCut({});
    expect(result.suggestions).toEqual([]);
    expect(result.report.totalSuggestions).toBe(0);
    expect(result.report.generatedAt).toBeTruthy();
  });

  it('场景检测生成分割建议', () => {
    const result = orchestrateSmartRoughCut(createSceneData());
    // 2 个边界 score >= 0.3 (默认 minConfidence)
    const sceneSuggestions = result.suggestions.filter((s) => s.type === 'scene_split');
    expect(sceneSuggestions).toHaveLength(2);
    expect(sceneSuggestions[0].action).toBe('split');
    expect(sceneSuggestions[0].selected).toBe(true);
  });

  it('低置信度场景边界被过滤', () => {
    const result = orchestrateSmartRoughCut(createSceneData(), { minConfidence: 0.7 });
    const sceneSuggestions = result.suggestions.filter((s) => s.type === 'scene_split');
    expect(sceneSuggestions).toHaveLength(1);
    expect(sceneSuggestions[0].timeStart).toBe(5);
  });

  it('静音检测生成删除建议，过滤短静音', () => {
    const result = orchestrateSmartRoughCut(createSilenceData());
    const silenceSuggestions = result.suggestions.filter((s) => s.type === 'silence_remove');
    // 0.3s < 0.5s 默认最小静音时长
    expect(silenceSuggestions).toHaveLength(2);
    expect(silenceSuggestions[0].action).toBe('remove');
  });

  it('对话检测生成提取建议', () => {
    const result = orchestrateSmartRoughCut(createDialogueData());
    const dialogueSuggestions = result.suggestions.filter((s) => s.type === 'dialogue_extract');
    expect(dialogueSuggestions).toHaveLength(1);
    expect(dialogueSuggestions[0].action).toBe('extract');
    expect(dialogueSuggestions[0].metadata['intervalCount']).toBe(2);
  });

  it('节拍数据生成节奏剪辑建议', () => {
    const result = orchestrateSmartRoughCut(createBeatData());
    const rhythmSuggestions = result.suggestions.filter((s) => s.type === 'rhythm_cut');
    expect(rhythmSuggestions).toHaveLength(1);
    expect(rhythmSuggestions[0].action).toBe('reorder');
    expect(rhythmSuggestions[0].metadata['beatCount']).toBe(11);
    expect(rhythmSuggestions[0].metadata['bpm']).toBe(120);
  });

  it('情感峰值生成高亮建议', () => {
    const result = orchestrateSmartRoughCut(createEmotionData());
    const emotionSuggestions = result.suggestions.filter((s) => s.type === 'emotion_highlight');
    // |0.2| < 0.5 被过滤
    expect(emotionSuggestions).toHaveLength(2);
    expect(emotionSuggestions[0].selected).toBe(false); // 默认不选中
  });

  it('叙事结构生成结构建议', () => {
    const result = orchestrateSmartRoughCut(createNarrativeData());
    const narrativeSuggestions = result.suggestions.filter((s) => s.type === 'narrative_structure');
    expect(narrativeSuggestions).toHaveLength(4);
    expect(narrativeSuggestions[0].selected).toBe(false);
  });

  it('完整数据生成所有类型建议', () => {
    const result = orchestrateSmartRoughCut(createFullData());
    expect(result.suggestions.length).toBeGreaterThan(0);
    // 优先级降序排列
    for (let i = 1; i < result.suggestions.length; i++) {
      expect(result.suggestions[i].priority).toBeLessThanOrEqual(result.suggestions[i - 1].priority);
    }
  });

  it('禁用特定功能不生成对应建议', () => {
    const result = orchestrateSmartRoughCut(createFullData(), {
      enableSceneSplit: false,
      enableSilenceRemoval: false,
      enableEmotionHighlight: false,
    });
    expect(result.suggestions.filter((s) => s.type === 'scene_split')).toHaveLength(0);
    expect(result.suggestions.filter((s) => s.type === 'silence_remove')).toHaveLength(0);
    expect(result.suggestions.filter((s) => s.type === 'emotion_highlight')).toHaveLength(0);
    expect(result.suggestions.filter((s) => s.type === 'dialogue_extract').length).toBeGreaterThan(0);
  });

  it('maxSuggestions 限制结果数量', () => {
    const result = orchestrateSmartRoughCut(createFullData(), { maxSuggestions: 3 });
    expect(result.suggestions).toHaveLength(3);
  });

  it('报告包含正确的统计信息', () => {
    const result = orchestrateSmartRoughCut(createFullData());
    const report = result.report;
    expect(report.sceneBoundaries).toBe(3);
    expect(report.silenceRangesFound).toBe(3);
    expect(report.silenceDurationRemoved).toBeCloseTo(3.8, 1);
    expect(report.dialogueIntervalsFound).toBe(2);
    expect(report.beatCount).toBe(11);
    expect(report.estimatedBpm).toBe(120);
    expect(report.emotionPeaks).toBe(3);
    expect(report.narrativeActs).toBe(4);
    expect(report.totalSuggestions).toBe(result.suggestions.length);
    expect(report.selectedSuggestions).toBe(getSelectedSuggestions(result.suggestions).length);
  });
});

// ─── 建议选择管理测试 ──────────────────────────────────────────

describe('建议选择管理', () => {
  const suggestions: SmartRoughCutSuggestion[] = [
    { id: 'a', type: 'scene_split', action: 'split', priority: 80, confidence: 0.9, timeStart: 0, timeEnd: 5, reason: '', metadata: {}, selected: true },
    { id: 'b', type: 'silence_remove', action: 'remove', priority: 70, confidence: 0.8, timeStart: 5, timeEnd: 7, reason: '', metadata: {}, selected: false },
    { id: 'c', type: 'scene_split', action: 'split', priority: 60, confidence: 0.7, timeStart: 10, timeEnd: 10, reason: '', metadata: {}, selected: true },
  ];

  it('toggleSuggestionSelection 切换单个选中状态', () => {
    const result = toggleSuggestionSelection(suggestions, 'b');
    expect(result[1].selected).toBe(true);
    expect(result[0].selected).toBe(true); // 其他不变
  });

  it('setAllSuggestionSelection 全选/全不选', () => {
    const allSelected = setAllSuggestionSelection(suggestions, true);
    expect(allSelected.every((s) => s.selected)).toBe(true);

    const noneSelected = setAllSuggestionSelection(suggestions, false);
    expect(noneSelected.every((s) => !s.selected)).toBe(true);
  });

  it('selectSuggestionsByType 按类型选择', () => {
    const result = selectSuggestionsByType(suggestions, 'scene_split', false);
    expect(result.filter((s) => s.type === 'scene_split').every((s) => !s.selected)).toBe(true);
    expect(result[1].selected).toBe(false); // 其他类型不变
  });

  it('getSelectedSuggestions 返回选中项', () => {
    expect(getSelectedSuggestions(suggestions)).toHaveLength(2);
  });

  it('reorderSuggestions 重排序', () => {
    const result = reorderSuggestions(suggestions, 2, 0);
    expect(result[0].id).toBe('c');
    expect(result[1].id).toBe('a');
    expect(result[2].id).toBe('b');
  });
});

// ─── 报告生成测试 ──────────────────────────────────────────

describe('buildSmartRoughCutReport', () => {
  it('空数据返回零值报告', () => {
    const report = buildSmartRoughCutReport({}, []);
    expect(report.totalSuggestions).toBe(0);
    expect(report.selectedSuggestions).toBe(0);
    expect(report.sceneBoundaries).toBe(0);
    expect(report.silenceRangesFound).toBe(0);
    expect(report.beatCount).toBe(0);
    expect(report.generatedAt).toBeTruthy();
  });

  it('按类型统计建议数量', () => {
    const suggestions: SmartRoughCutSuggestion[] = [
      { id: '1', type: 'scene_split', action: 'split', priority: 80, confidence: 0.9, timeStart: 0, timeEnd: 0, reason: '', metadata: {}, selected: true },
      { id: '2', type: 'scene_split', action: 'split', priority: 70, confidence: 0.8, timeStart: 5, timeEnd: 5, reason: '', metadata: {}, selected: true },
      { id: '3', type: 'silence_remove', action: 'remove', priority: 60, confidence: 0.7, timeStart: 10, timeEnd: 12, reason: '', metadata: {}, selected: false },
    ];
    const report = buildSmartRoughCutReport(createFullData(), suggestions);
    expect(report.suggestionsByType.scene_split).toBe(2);
    expect(report.suggestionsByType.silence_remove).toBe(1);
    expect(report.totalSuggestions).toBe(3);
    expect(report.selectedSuggestions).toBe(2);
  });
});

// ─── buildOrchestrationInput 测试 ──────────────────────────

describe('buildOrchestrationInput', () => {
  it('从原始数据构建输入', () => {
    const input = buildOrchestrationInput(
      'media-1',
      {
        boundaries: [{ time: 5, score: 0.8, histogramDiff: 0.7, motionDiff: 0.3, threshold: 0.35 }],
        segments: [{ start: 0, end: 5, sceneType: 'indoor', avgBrightness: 0.5, avgMotion: 0.2 }],
        thresholdCurve: [],
        sampleCount: 50,
      },
      [{ start: 2, end: 3, duration: 1 }],
      'clip-1',
      [{ id: 'd1', start: 0, end: 5, duration: 5, confidence: 0.9 }],
      [0, 1, 2, 3],
      120,
    );
    expect(input.scenes).toHaveLength(1);
    expect(input.silences).toHaveLength(1);
    expect(input.dialogues).toHaveLength(1);
    expect(input.beats?.beatTimes).toHaveLength(4);
    expect(input.beats?.bpm).toBe(120);
  });

  it('可选字段省略时不报错', () => {
    const input = buildOrchestrationInput('media-1');
    expect(input.scenes).toBeUndefined();
    expect(input.silences).toBeUndefined();
    expect(input.dialogues).toBeUndefined();
    expect(input.beats).toBeUndefined();
  });

  it('空静音区间不生成输入', () => {
    const input = buildOrchestrationInput('media-1', undefined, [], 'clip-1');
    expect(input.silences).toBeUndefined();
  });

  it('不足两个节拍点不生成输入', () => {
    const input = buildOrchestrationInput('media-1', undefined, undefined, undefined, undefined, [0]);
    expect(input.beats).toBeUndefined();
  });
});
