import { describe, expect, it } from 'vitest';
import {
  filterScenes,
  scoreCandidate,
  calculateTargetDuration,
  calculateBeatPoints,
  alignClipToBeat,
  generateEditPlan,
  generateTimelineElements,
  autoEdit,
  createDefaultAutoEditorConfig,
  type AutoEditorConfig,
  type ClipCandidate,
  type EditPlan,
} from '../src/automation/auto-editor';
import type { SceneAnalysis, AnalysisReport } from '../src/automation/scene-analyzer';
import type { EditTemplate } from '../src/automation/template-manager';
import type { PreferenceWeights } from '../src/automation/style-memory';
import {
  BUILTIN_SHORT_VIDEO_TEMPLATE,
  BUILTIN_PROMO_TEMPLATE,
  createDefaultRhythmParams,
  createDefaultClipFilterRule,
  createDefaultTransitionPreference,
  createDefaultSubtitleStyleConfig,
} from '../src/automation/template-manager';
import { createDefaultPreferenceWeights } from '../src/automation/style-memory';

// ============================================================
// 测试工具函数
// ============================================================

function makeScene(overrides: Partial<SceneAnalysis> = {}): SceneAnalysis {
  return {
    id: `scene-${Math.random().toString(36).slice(2)}`,
    mediaPath: '/test/video.mp4',
    startTime: 0,
    endTime: 5,
    duration: 5,
    sceneType: 'dialogue',
    sceneTypeConfidence: 0.8,
    tags: [],
    quality: {
      overall: 70,
      sharpness: 75,
      exposure: 70,
      colorSaturation: 65,
      stability: 80,
      audioQuality: 70,
      noiseLevel: 20,
    },
    keyframes: [0, 1, 2, 3, 4],
    analyzedAt: Date.now(),
    ...overrides,
  };
}

function makeReport(scenes: SceneAnalysis[]): AnalysisReport {
  return {
    id: 'report-1',
    mediaPaths: [...new Set(scenes.map((s) => s.mediaPath))],
    scenes,
    stats: {
      totalScenes: scenes.length,
      sceneTypeCounts: {} as any,
      averageQuality: 70,
      minQuality: 50,
      maxQuality: 90,
      lowQualityScenes: [],
      totalDuration: scenes.reduce((a, s) => a + s.duration, 0),
      topTags: [],
    },
    generatedAt: Date.now(),
  };
}

function makeTemplate(overrides: Partial<EditTemplate> = {}): EditTemplate {
  return {
    id: 'test-template',
    name: '测试模板',
    description: '',
    category: 'custom',
    version: 1,
    rhythm: createDefaultRhythmParams(),
    transition: createDefaultTransitionPreference(),
    subtitle: createDefaultSubtitleStyleConfig(),
    filter: createDefaultClipFilterRule(),
    maxClipsPerMedia: 10,
    shuffleOrder: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    builtin: false,
    tags: [],
    ...overrides,
  };
}

// ============================================================
// 筛选测试
// ============================================================

describe('filterScenes', () => {
  const filter = createDefaultClipFilterRule();

  it('排除黑场场景', () => {
    const scenes = [
      makeScene({ sceneType: 'black' }),
      makeScene({ sceneType: 'dialogue' }),
    ];
    const result = filterScenes(scenes, filter);
    expect(result).toHaveLength(1);
    expect(result[0].sceneType).toBe('dialogue');
  });

  it('排除低质量场景', () => {
    const scenes = [
      makeScene({ quality: { overall: 30 } as any }),
      makeScene({ quality: { overall: 80 } as any }),
    ];
    const result = filterScenes(scenes, filter);
    expect(result).toHaveLength(1);
    expect(result[0].quality.overall).toBe(80);
  });

  it('排除过短场景', () => {
    const scenes = [
      makeScene({ duration: 0.5 }),
      makeScene({ duration: 3 }),
    ];
    const result = filterScenes(scenes, filter);
    expect(result).toHaveLength(1);
    expect(result[0].duration).toBe(3);
  });

  it('排除过长场景', () => {
    const scenes = [
      makeScene({ duration: 60 }),
      makeScene({ duration: 10 }),
    ];
    const result = filterScenes(scenes, filter);
    expect(result).toHaveLength(1);
    expect(result[0].duration).toBe(10);
  });
});

// ============================================================
// 评分测试
// ============================================================

describe('scoreCandidate', () => {
  const rhythm = createDefaultRhythmParams();

  it('高质量场景得分更高', () => {
    const highQ = makeScene({ quality: { overall: 90 } as any });
    const lowQ = makeScene({ quality: { overall: 50 } as any });
    const highScore = scoreCandidate(highQ, rhythm, ['dialogue']);
    const lowScore = scoreCandidate(lowQ, rhythm, ['dialogue']);
    expect(highScore).toBeGreaterThan(lowScore);
  });

  it('偏好场景类型得分更高', () => {
    const scene = makeScene({ sceneType: 'dialogue' });
    const preferred = scoreCandidate(scene, rhythm, ['dialogue']);
    const notPreferred = scoreCandidate(scene, rhythm, ['landscape']);
    expect(preferred).toBeGreaterThan(notPreferred);
  });

  it('应用风格记忆权重', () => {
    const scene = makeScene({ sceneType: 'dialogue' });
    const weights: PreferenceWeights = {
      ...createDefaultPreferenceWeights(),
      sceneTypeWeights: { dialogue: 1, landscape: -1 },
    };
    const withWeights = scoreCandidate(scene, rhythm, [], weights);
    const withoutWeights = scoreCandidate(scene, rhythm, []);
    expect(withWeights).not.toBe(withoutWeights);
  });
});

// ============================================================
// 目标时长计算测试
// ============================================================

describe('calculateTargetDuration', () => {
  const rhythm = createDefaultRhythmParams();

  it('不超过场景实际时长', () => {
    const scene = makeScene({ duration: 3 });
    const target = calculateTargetDuration(scene, rhythm);
    expect(target).toBeLessThanOrEqual(3);
  });

  it('不低于最小值', () => {
    const scene = makeScene({ duration: 100 });
    const target = calculateTargetDuration(scene, rhythm);
    expect(target).toBeGreaterThanOrEqual(rhythm.clipDurationRange.min);
  });

  it('应用风格记忆的时长偏好', () => {
    const scene = makeScene({ duration: 20 });
    const weightsLonger: PreferenceWeights = {
      ...createDefaultPreferenceWeights(),
      sampleCount: 10,
      clipDurationBias: 0.5,
    };
    const weightsShorter: PreferenceWeights = {
      ...createDefaultPreferenceWeights(),
      sampleCount: 10,
      clipDurationBias: -0.5,
    };
    const longer = calculateTargetDuration(scene, rhythm, weightsLonger);
    const shorter = calculateTargetDuration(scene, rhythm, weightsShorter);
    expect(longer).toBeGreaterThan(shorter);
  });
});

// ============================================================
// BPM 卡点测试
// ============================================================

describe('calculateBeatPoints', () => {
  it('正确计算 120 BPM 的节拍点', () => {
    const beats = calculateBeatPoints(120, 2);
    expect(beats).toEqual([0, 0.5, 1.0, 1.5]);
  });

  it('空结果：BPM 为 0', () => {
    expect(calculateBeatPoints(0, 10)).toEqual([]);
  });

  it('空结果：时长为 0', () => {
    expect(calculateBeatPoints(120, 0)).toEqual([]);
  });

  it('支持偏移', () => {
    const beats = calculateBeatPoints(120, 2, 0.25);
    expect(beats[0]).toBe(0.25);
  });
});

describe('alignClipToBeat', () => {
  const beatPoints = [0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0];

  it('对齐到最近的节拍点', () => {
    const result = alignClipToBeat(0.1, 1.0, beatPoints);
    expect(result.start).toBe(0);
    expect(result.duration).toBeGreaterThan(0);
  });

  it('无节拍点时返回原值', () => {
    const result = alignClipToBeat(0.3, 1.0, []);
    expect(result.start).toBe(0.3);
    expect(result.duration).toBe(1.0);
  });

  it('时长不小于 0.5 秒', () => {
    const result = alignClipToBeat(0, 0.1, beatPoints);
    expect(result.duration).toBeGreaterThanOrEqual(0.5);
  });
});

// ============================================================
// 编辑计划生成测试
// ============================================================

describe('generateEditPlan', () => {
  const template = makeTemplate();
  const config = createDefaultAutoEditorConfig();

  it('生成包含选中片段的计划', () => {
    const scenes = [
      makeScene({ sceneType: 'dialogue', duration: 5, quality: { overall: 80 } as any }),
      makeScene({ sceneType: 'action', duration: 3, quality: { overall: 70 } as any }),
      makeScene({ sceneType: 'landscape', duration: 8, quality: { overall: 90 } as any }),
    ];
    const plan = generateEditPlan(scenes, template, config);
    expect(plan.selectedClips.length).toBeGreaterThan(0);
    expect(plan.totalDuration).toBeGreaterThan(0);
  });

  it('排除黑场场景', () => {
    const scenes = [
      makeScene({ sceneType: 'black', duration: 5 }),
      makeScene({ sceneType: 'dialogue', duration: 5, quality: { overall: 80 } as any }),
    ];
    const plan = generateEditPlan(scenes, template, config);
    expect(plan.selectedClips.every((c) => c.sceneType !== 'black')).toBe(true);
  });

  it('限制每个素材最大片段数', () => {
    const scenes = Array.from({ length: 20 }, (_, i) =>
      makeScene({
        mediaPath: '/same/video.mp4',
        duration: 3,
        startTime: i * 3,
        endTime: (i + 1) * 3,
        quality: { overall: 80 } as any,
      }),
    );
    const tpl = makeTemplate({ maxClipsPerMedia: 3 });
    const plan = generateEditPlan(scenes, tpl, config);
    expect(plan.selectedClips.length).toBeLessThanOrEqual(3);
  });

  it('BPM 卡点模式生成节拍点', () => {
    const scenes = Array.from({ length: 10 }, () =>
      makeScene({ duration: 3, quality: { overall: 80 } as any }),
    );
    const beatConfig: AutoEditorConfig = { ...config, enableBeatSync: true, customBpm: 120 };
    const tpl = makeTemplate({ rhythm: { ...createDefaultRhythmParams(), beatSync: true, targetBpm: 120 } });
    const plan = generateEditPlan(scenes, tpl, beatConfig);
    expect(plan.beatPoints).toBeDefined();
    expect(plan.beatPoints!.length).toBeGreaterThan(0);
  });

  it('限制总时长', () => {
    const scenes = Array.from({ length: 20 }, () =>
      makeScene({ duration: 10, quality: { overall: 80 } as any }),
    );
    const limitedConfig: AutoEditorConfig = { ...config, maxTotalDuration: 30 };
    const plan = generateEditPlan(scenes, template, limitedConfig);
    expect(plan.totalDuration).toBeLessThanOrEqual(32); // 允许 clipGap 误差
  });
});

// ============================================================
// 时间线生成测试
// ============================================================

describe('generateTimelineElements', () => {
  it('生成正确数量的片段', () => {
    const scenes = [
      makeScene({ duration: 5, quality: { overall: 80 } as any }),
      makeScene({ duration: 3, quality: { overall: 70 } as any }),
    ];
    const template = makeTemplate();
    const config = createDefaultAutoEditorConfig();
    const plan = generateEditPlan(scenes, template, config);
    const result = generateTimelineElements(plan, 'track-1', config);
    expect(result.generatedClips.length).toBe(plan.selectedClips.length);
  });

  it('片段分配到指定轨道', () => {
    const scenes = [makeScene({ duration: 5, quality: { overall: 80 } as any })];
    const template = makeTemplate();
    const config = createDefaultAutoEditorConfig();
    const plan = generateEditPlan(scenes, template, config);
    const result = generateTimelineElements(plan, 'custom-track', config);
    expect(result.trackId).toBe('custom-track');
    expect(result.generatedClips[0].trackId).toBe('custom-track');
  });

  it('转场关联正确的片段', () => {
    const scenes = [
      makeScene({ duration: 5, quality: { overall: 80 } as any }),
      makeScene({ duration: 3, quality: { overall: 70 } as any }),
    ];
    const template = makeTemplate();
    const config = createDefaultAutoEditorConfig();
    const plan = generateEditPlan(scenes, template, config);
    const result = generateTimelineElements(plan, 'track-1', config);
    if (result.generatedTransitions.length > 0) {
      const trans = result.generatedTransitions[0];
      expect(trans.fromClipId).toBe(result.generatedClips[0].id);
      expect(trans.toClipId).toBe(result.generatedClips[1].id);
    }
  });
});

// ============================================================
// 完整自动编辑流程测试
// ============================================================

describe('autoEdit', () => {
  it('端到端生成时间线元素', () => {
    const scenes = [
      makeScene({ sceneType: 'dialogue', duration: 5, quality: { overall: 80 } as any }),
      makeScene({ sceneType: 'action', duration: 3, quality: { overall: 70 } as any }),
      makeScene({ sceneType: 'landscape', duration: 8, quality: { overall: 90 } as any }),
    ];
    const report = makeReport(scenes);
    const result = autoEdit(report, BUILTIN_SHORT_VIDEO_TEMPLATE);
    expect(result.generatedClips.length).toBeGreaterThan(0);
    expect(result.trackId).toBeTruthy();
    expect(result.totalDuration).toBeGreaterThan(0);
  });

  it('使用内置宣传模板', () => {
    const scenes = [
      makeScene({ sceneType: 'wide-shot', duration: 10, quality: { overall: 85 } as any }),
      makeScene({ sceneType: 'close-up', duration: 4, quality: { overall: 75 } as any }),
    ];
    const report = makeReport(scenes);
    const result = autoEdit(report, BUILTIN_PROMO_TEMPLATE);
    expect(result.generatedClips.length).toBeGreaterThan(0);
  });

  it('空场景列表生成空结果', () => {
    const report = makeReport([]);
    const result = autoEdit(report, BUILTIN_SHORT_VIDEO_TEMPLATE);
    expect(result.generatedClips).toHaveLength(0);
  });
});
