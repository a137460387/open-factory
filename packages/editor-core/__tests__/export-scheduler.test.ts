import { describe, expect, it, vi } from 'vitest';
import {
  analyzeProjectComplexity,
  calculateExportComplexityScore,
  selectOptimalPreset,
  calculateOptimalThreads,
  calculateOptimalCrf,
  estimateSpeedMultiplier,
  estimateFileSizeMb,
  scheduleExport,
  applySchedulerDecision,
  getRecommendedExportConfig,
  type ExportSchedulerConfig,
  type ExportSchedulerDecision,
  type ProjectComplexityMetrics,
} from '../src/export/export-scheduler';
import type { ExportProject, FfmpegExportPlan, ExportSettings } from '../src/export/export-types';

// ─── 测试数据工厂 ──────────────────────────────────────────

function createSimpleProject(): ExportProject {
  return {
    name: '简单项目',
    settings: {
      width: 1920,
      height: 1080,
      fps: 30,
      sampleRate: 44100,
      videoCodec: 'libx264',
      audioCodec: 'aac',
      format: 'mp4',
      outputPath: '/output/test.mp4',
    },
    masterVolume: 1,
    timeline: {
      duration: 30,
      tracks: [
        {
          index: 0,
          type: 'video',
          muted: false,
          solo: false,
          locked: false,
          volume: 1,
          pan: 0,
          clips: [
            {
              id: 'clip-1',
              type: 'video',
              mediaPath: '/media/video1.mp4',
              sourceColorProfile: null,
              nestedSequenceId: null,
              start: 0,
              duration: 30,
              trimStart: 0,
              trimEnd: 0,
              speed: 1,
              slowMotionMode: 'none',
              sourceDuration: 30,
              trackIndex: 0,
              transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
              border: { enabled: false, width: 0, color: '#000000' },
              colorCorrection: {
                brightness: 0,
                contrast: 1,
                saturation: 1,
                hue: 0,
              },
              chromaKey: { enabled: false, color: [0, 255, 0], colors: [[0, 255, 0]], similarity: 0.3, blend: 0.1, spillSuppression: false, erosion: 0 },
              stabilization: { enabled: false, smoothing: 10, zoom: 0, analyzed: false },
              frameInterpolation: { enabled: false, targetFps: 30, mode: 'adaptive', protectionFrames: 0 },
              audioDenoise: { enabled: false, strength: 0 },
              aiLocalDenoise: { enabled: false, strength: 0 },
              audioRestoration: 'none',
              spatialAudio: { enabled: false },
              videoRestoration: { deinterlace: { enabled: false, mode: 0 }, temporalDenoise: { preset: 'off', lumaSpatial: 0, chromaSpatial: 0, lumaTmp: 0 }, spatialDenoise: { enabled: false, strength: 0, patchSize: 0, researchSize: 0 } },
              qualityEnhancement: { superResolution: false, deblock: false, colorBoost: false, frameCompensation: false },
              projection: 'none',
              panorama: { yaw: 0, pitch: 0, roll: 0, fov: 90, outputProjection: 'equirectangular' },
              masks: [],
              imageSequence: null,
              effects: [],
              blendMode: 'normal',
              keyframes: null,
              kenBurns: false,
              volume: 1,
              audioChannelRouting: 'stereo',
              pan: 0,
              eq: { enabled: false, bands: [] },
              compressor: { enabled: false, threshold: -20, ratio: 4, attack: 5, release: 50 },
              muted: false,
              pitchSemitones: 0,
              reverseAudio: false,
              fadeInDuration: 0,
              fadeOutDuration: 0,
              fadeInCurve: 'linear',
              fadeOutCurve: 'linear',
              hasEmbeddedAudio: true,
              audioChannels: 2,
              audioSampleRate: 44100,
              textStyle: null,
              textPath: null,
              subtitleStyle: null,
              subtitleType: null,
              speaker: null,
              soundDesc: null,
              subtitleMode: null,
              dataSubtitle: null,
              creditsStyle: null,
              motionGraphic: null,
            },
          ],
        },
      ],
      transitions: [],
    },
    sequences: [],
  };
}

function createComplexProject(): ExportProject {
  const simpleProject = createSimpleProject();
  const clips = [];

  // 创建多个片段
  for (let i = 0; i < 20; i++) {
    clips.push({
      ...simpleProject.timeline.tracks[0].clips[0],
      id: `clip-${i}`,
      start: i * 5,
      duration: 5,
    });
  }

  // 添加特效
  clips[0].effects = [{ id: 'effect-1', type: 'blur', params: { radius: 5 } }];
  clips[1].effects = [{ id: 'effect-2', type: 'sharpen', params: { amount: 1 } }];
    clips[2].frameInterpolation = { enabled: true, targetFps: 60, mode: 'mci', protectionFrames: 0 };
  clips[3].colorCorrection = {
    brightness: 0.1,
    contrast: 1.2,
    saturation: 1.1,
    hue: 10,
  };
  clips[4].masks = [{ id: 'mask-1', type: 'rect', x: 0, y: 0, w: 100, h: 100, inverted: false, feather: 10, enabled: true }];

  return {
    ...simpleProject,
    name: '复杂项目',
    settings: {
      ...simpleProject.settings,
      width: 3840,
      height: 2160,
      fps: 60,
    },
    timeline: {
      duration: 100,
      tracks: [
        {
          ...simpleProject.timeline.tracks[0],
          clips,
        },
      ],
      transitions: [
        { id: 'trans-1', type: 'crossfade', duration: 1, fromClipId: 'clip-0', toClipId: 'clip-1' },
        { id: 'trans-2', type: 'dissolve', duration: 0.5, fromClipId: 'clip-1', toClipId: 'clip-2' },
      ],
    },
    sequences: [{ id: 'seq-1', name: '嵌套序列', timeline: { duration: 10, tracks: [], transitions: [] } }],
  };
}

function createSimpleExportPlan(): FfmpegExportPlan {
  return {
    projectName: '测试项目',
    settings: {
      width: 1920,
      height: 1080,
      fps: 30,
      sampleRate: 44100,
      videoCodec: 'libx264',
      audioCodec: 'aac',
      format: 'mp4',
      outputPath: '/output/test.mp4',
    },
    inputs: [{ index: 0, path: '/media/video1.mp4', args: [] }],
    filterComplex: '[0:v]scale=1920:1080[v]',
    maps: ['-map', '[v]', '-map', '0:a'],
    outputArgs: ['-c:v', 'libx264', '-preset', 'medium', '-crf', '23', '-c:a', 'aac'],
    fullArgs: [
      '-i', '/media/video1.mp4',
      '-filter_complex', '[0:v]scale=1920:1080[v]',
      '-map', '[v]', '-map', '0:a',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '23', '-c:a', 'aac',
      '/output/test.mp4',
    ],
    warnings: [],
    textArtifacts: [],
    nestedPlans: [],
    duration: 30,
  };
}

function createDefaultConfig(): ExportSchedulerConfig {
  return {
    qualityTarget: 'balanced',
    hardwareConcurrency: 8,
    availableMemoryMb: 8192,
    hardwareAccelerationEnabled: false,
  };
}

// ─── 测试用例 ──────────────────────────────────────────────

describe('analyzeProjectComplexity', () => {
  it('应该正确分析简单项目', () => {
    const project = createSimpleProject();
    const metrics = analyzeProjectComplexity(project);

    expect(metrics.totalClips).toBe(1);
    expect(metrics.videoClips).toBe(1);
    expect(metrics.imageClips).toBe(0);
    expect(metrics.textClips).toBe(0);
    expect(metrics.effectCount).toBe(0);
    expect(metrics.transitionCount).toBe(0);
    expect(metrics.resolutionFactor).toBeCloseTo(1, 1);
    expect(metrics.fpsFactor).toBeCloseTo(1, 1);
    expect(metrics.durationSeconds).toBe(30);
    expect(metrics.hasComplexEffects).toBe(false);
    expect(metrics.hasTemporalInterpolation).toBe(false);
    expect(metrics.hasColorCorrection).toBe(false);
    expect(metrics.hasMasks).toBe(false);
  });

  it('应该正确分析复杂项目', () => {
    const project = createComplexProject();
    const metrics = analyzeProjectComplexity(project);

    expect(metrics.totalClips).toBe(20);
    expect(metrics.videoClips).toBe(20);
    expect(metrics.effectCount).toBeGreaterThan(0);
    expect(metrics.transitionCount).toBe(2);
    expect(metrics.resolutionFactor).toBeCloseTo(4, 0);
    expect(metrics.fpsFactor).toBeCloseTo(2, 0);
    expect(metrics.durationSeconds).toBe(100);
    expect(metrics.hasComplexEffects).toBe(true);
    expect(metrics.hasTemporalInterpolation).toBe(true);
    expect(metrics.hasColorCorrection).toBe(true);
    expect(metrics.hasMasks).toBe(true);
    expect(metrics.nestedSequences).toBe(1);
  });
});

describe('calculateExportComplexityScore', () => {
  it('简单项目应该有低复杂度分数', () => {
    const project = createSimpleProject();
    const metrics = analyzeProjectComplexity(project);
    const score = calculateExportComplexityScore(metrics);

    expect(score).toBeLessThan(30);
  });

  it('复杂项目应该有高复杂度分数', () => {
    const project = createComplexProject();
    const metrics = analyzeProjectComplexity(project);
    const score = calculateExportComplexityScore(metrics);

    expect(score).toBeGreaterThan(50);
  });

  it('分数应该在 0-100 范围内', () => {
    const project = createSimpleProject();
    const metrics = analyzeProjectComplexity(project);
    const score = calculateExportComplexityScore(metrics);

    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});

describe('selectOptimalPreset', () => {
  it('硬件加速时应该返回 medium', () => {
    const preset = selectOptimalPreset(50, 'balanced', true);
    expect(preset).toBe('medium');
  });

  it('低复杂度 + 质量目标应该返回较慢的 preset', () => {
    const preset = selectOptimalPreset(10, 'quality', false);
    expect(['slow', 'slower', 'veryslow']).toContain(preset);
  });

  it('高复杂度 + 速度目标应该返回较快的 preset', () => {
    const preset = selectOptimalPreset(90, 'speed', false);
    expect(['ultrafast', 'superfast', 'veryfast']).toContain(preset);
  });

  it('中等复杂度 + 平衡目标应该返回 medium', () => {
    const preset = selectOptimalPreset(50, 'balanced', false);
    expect(['fast', 'medium', 'slow']).toContain(preset);
  });
});

describe('calculateOptimalThreads', () => {
  it('应该根据 CPU 核心数限制线程数', () => {
    const resourceEstimate = {
      cpuCost: 1,
      memoryMb: 1000,
      diskMb: 500,
      effectCount: 0,
      memoryClass: 'light' as const,
      parallelEligible: true,
      reasons: [],
    };

    const threads = calculateOptimalThreads(30, 8, 8192, resourceEstimate);
    expect(threads).toBeLessThanOrEqual(8);
    expect(threads).toBeGreaterThanOrEqual(1);
  });

  it('高复杂度应该限制线程数', () => {
    const resourceEstimate = {
      cpuCost: 2,
      memoryMb: 3000,
      diskMb: 1000,
      effectCount: 15,
      memoryClass: 'heavy' as const,
      parallelEligible: false,
      reasons: [],
    };

    const threads = calculateOptimalThreads(80, 8, 8192, resourceEstimate);
    expect(threads).toBeLessThanOrEqual(4);
  });

  it('应该尊重最大线程数限制', () => {
    const resourceEstimate = {
      cpuCost: 1,
      memoryMb: 500,
      diskMb: 200,
      effectCount: 0,
      memoryClass: 'light' as const,
      parallelEligible: true,
      reasons: [],
    };

    const threads = calculateOptimalThreads(30, 16, 16384, resourceEstimate, 4);
    expect(threads).toBeLessThanOrEqual(4);
  });
});

describe('calculateOptimalCrf', () => {
  it('速度目标应该使用较高 CRF', () => {
    const crf = calculateOptimalCrf(50, 'speed');
    expect(crf).toBeGreaterThan(23);
  });

  it('质量目标应该使用较低 CRF', () => {
    const crf = calculateOptimalCrf(50, 'quality');
    expect(crf).toBeLessThan(23);
  });

  it('低复杂度应该使用较低 CRF', () => {
    const crf = calculateOptimalCrf(10, 'balanced');
    expect(crf).toBeLessThan(23);
  });

  it('高复杂度应该使用较高 CRF', () => {
    const crf = calculateOptimalCrf(90, 'balanced');
    expect(crf).toBeGreaterThan(23);
  });

  it('CRF 应该在合理范围内', () => {
    const crf = calculateOptimalCrf(50, 'balanced');
    expect(crf).toBeGreaterThanOrEqual(15);
    expect(crf).toBeLessThanOrEqual(35);
  });
});

describe('estimateSpeedMultiplier', () => {
  it('应该根据 preset 估算速度', () => {
    const fastSpeed = estimateSpeedMultiplier('ultrafast', 4, 50);
    const slowSpeed = estimateSpeedMultiplier('veryslow', 4, 50);

    expect(fastSpeed).toBeGreaterThan(slowSpeed);
  });

  it('应该根据线程数估算速度', () => {
    const singleThread = estimateSpeedMultiplier('medium', 1, 50);
    const multiThread = estimateSpeedMultiplier('medium', 8, 50);

    expect(multiThread).toBeGreaterThan(singleThread);
  });

  it('高复杂度应该降低速度', () => {
    const lowComplexity = estimateSpeedMultiplier('medium', 4, 20);
    const highComplexity = estimateSpeedMultiplier('medium', 4, 80);

    expect(lowComplexity).toBeGreaterThan(highComplexity);
  });
});

describe('estimateFileSizeMb', () => {
  it('应该根据分辨率估算文件大小', () => {
    const settings1080p: ExportSettings = {
      width: 1920,
      height: 1080,
      fps: 30,
      sampleRate: 44100,
      videoCodec: 'libx264',
      audioCodec: 'aac',
      format: 'mp4',
      outputPath: '/output/test.mp4',
    };

    const settings4k: ExportSettings = {
      ...settings1080p,
      width: 3840,
      height: 2160,
    };

    const size1080p = estimateFileSizeMb(settings1080p, 60, 23);
    const size4k = estimateFileSizeMb(settings4k, 60, 23);

    expect(size4k).toBeGreaterThan(size1080p);
  });

  it('应该根据 CRF 估算文件大小', () => {
    const settings: ExportSettings = {
      width: 1920,
      height: 1080,
      fps: 30,
      sampleRate: 44100,
      videoCodec: 'libx264',
      audioCodec: 'aac',
      format: 'mp4',
      outputPath: '/output/test.mp4',
    };

    const highQuality = estimateFileSizeMb(settings, 60, 18);
    const lowQuality = estimateFileSizeMb(settings, 60, 28);

    expect(highQuality).toBeGreaterThan(lowQuality);
  });
});

describe('scheduleExport', () => {
  it('应该返回完整的调度决策', () => {
    const plan = createSimpleExportPlan();
    const project = createSimpleProject();
    const config = createDefaultConfig();

    const decision = scheduleExport(plan, project, config);

    expect(decision.preset).toBeDefined();
    expect(decision.threads).toBeGreaterThanOrEqual(1);
    expect(decision.crf).toBeGreaterThanOrEqual(15);
    expect(decision.crf).toBeLessThanOrEqual(35);
    expect(decision.reasons.length).toBeGreaterThan(0);
    expect(decision.resourceEstimate).toBeDefined();
    expect(decision.estimatedSpeedMultiplier).toBeGreaterThan(0);
    expect(decision.estimatedFileSizeMb).toBeGreaterThan(0);
  });

  it('应该根据质量目标调整参数', () => {
    const plan = createSimpleExportPlan();
    const project = createSimpleProject();

    const speedConfig: ExportSchedulerConfig = {
      ...createDefaultConfig(),
      qualityTarget: 'speed',
    };

    const qualityConfig: ExportSchedulerConfig = {
      ...createDefaultConfig(),
      qualityTarget: 'quality',
    };

    const speedDecision = scheduleExport(plan, project, speedConfig);
    const qualityDecision = scheduleExport(plan, project, qualityConfig);

    expect(speedDecision.crf).toBeGreaterThan(qualityDecision.crf);
  });

  it('应该尊重用户自定义 preset', () => {
    const plan = createSimpleExportPlan();
    const project = createSimpleProject();
    const config: ExportSchedulerConfig = {
      ...createDefaultConfig(),
      presetOverride: 'ultrafast',
    };

    const decision = scheduleExport(plan, project, config);
    expect(decision.preset).toBe('ultrafast');
  });
});

describe('applySchedulerDecision', () => {
  it('应该正确应用调度决策到导出计划', () => {
    const plan = createSimpleExportPlan();
    const decision: ExportSchedulerDecision = {
      preset: 'slow',
      threads: 4,
      crf: 18,
      useHardwareAcceleration: false,
      reasons: [],
      resourceEstimate: {
        cpuCost: 1,
        memoryMb: 1000,
        diskMb: 500,
        effectCount: 0,
        memoryClass: 'light',
        parallelEligible: true,
        reasons: [],
      },
      estimatedSpeedMultiplier: 0.5,
      estimatedFileSizeMb: 100,
    };

    const updatedPlan = applySchedulerDecision(plan, decision);

    expect(updatedPlan.outputArgs).toContain('-preset');
    expect(updatedPlan.outputArgs).toContain('slow');
    expect(updatedPlan.outputArgs).toContain('-threads');
    expect(updatedPlan.outputArgs).toContain('4');
    expect(updatedPlan.outputArgs).toContain('-crf');
    expect(updatedPlan.outputArgs).toContain('18');
  });

  it('硬件加速时不应该应用 CRF', () => {
    const plan = createSimpleExportPlan();
    const decision: ExportSchedulerDecision = {
      preset: 'medium',
      threads: 4,
      crf: 23,
      useHardwareAcceleration: true,
      reasons: [],
      resourceEstimate: {
        cpuCost: 1,
        memoryMb: 1000,
        diskMb: 500,
        effectCount: 0,
        memoryClass: 'light',
        parallelEligible: true,
        reasons: [],
      },
      estimatedSpeedMultiplier: 1,
      estimatedFileSizeMb: 100,
    };

    const updatedPlan = applySchedulerDecision(plan, decision);
    expect(updatedPlan.outputArgs).not.toContain('-crf');
  });
});

describe('getRecommendedExportConfig', () => {
  it('应该根据项目复杂度推荐配置', () => {
    const simpleProject = createSimpleProject();
    const complexProject = createComplexProject();

    const simpleConfig = getRecommendedExportConfig(simpleProject);
    const complexConfig = getRecommendedExportConfig(complexProject);

    expect(simpleConfig.qualityTarget).toBe('quality');
    expect(complexConfig.qualityTarget).toBe('speed');
  });

  it('应该使用默认硬件参数', () => {
    const project = createSimpleProject();
    const config = getRecommendedExportConfig(project);

    expect(config.hardwareConcurrency).toBeGreaterThan(0);
    expect(config.availableMemoryMb).toBeGreaterThan(0);
    expect(config.hardwareAccelerationEnabled).toBe(false);
  });
});