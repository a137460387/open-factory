import { describe, expect, it } from 'vitest';
import {
  COLOR_CORRECTION_COMPLEXITY_FACTOR,
  EXPORT_COST_EFFECT_COMPLEXITY_FACTORS,
  VMAF_QUALITY_COMPLEXITY_FACTOR,
  assertExportCostEffectCoverage,
  calculateFilterComplexityFactor,
  calculateHistoricalEstimateErrorPercent,
  calculateHistoricalExportSpeed,
  estimateExportCost,
  estimateExportFileSizeMb,
  normalizeExportMasterProcessing,
  parseExportBitrate
} from '../src';
import { EFFECT_TYPES } from '../src/effects';
import { makeProject, makeTimeline, makeVideoClip } from './test-utils';

describe('export cost estimate', () => {
  it('calculates weighted filter complexity from effects and color correction', () => {
    const timeline = makeTimeline([
      makeVideoClip({
        id: 'clip-a',
        start: 0,
        duration: 5,
        effects: [{ id: 'fx-blur', type: 'blur', enabled: true, params: {} }],
        colorCorrection: { saturation: 1.2 }
      }),
      makeVideoClip({
        id: 'clip-b',
        start: 5,
        duration: 5,
        effects: [{ id: 'fx-shader', type: 'custom-shader', enabled: true, params: {} }]
      })
    ]);

    const result = calculateFilterComplexityFactor(timeline);

    const expected =
      1 +
      (EXPORT_COST_EFFECT_COMPLEXITY_FACTORS.blur - 1) * 0.5 +
      (COLOR_CORRECTION_COMPLEXITY_FACTOR - 1) * 0.5 +
      (EXPORT_COST_EFFECT_COMPLEXITY_FACTORS['custom-shader'] - 1) * 0.5;
    expect(result.factor).toBeCloseTo(expected, 2);
    expect(result.breakdown.map((item) => item.id)).toEqual(expect.arrayContaining(['effect:blur', 'color-correction', 'effect:custom-shader']));
  });

  it('includes quality evaluation as a VMAF complexity factor', () => {
    const result = calculateFilterComplexityFactor(makeTimeline([makeVideoClip()]), {}, true);

    expect(result.factor).toBe(VMAF_QUALITY_COMPLEXITY_FACTOR);
    expect(result.breakdown).toContainEqual({ id: 'vmaf-quality-evaluation', factor: VMAF_QUALITY_COMPLEXITY_FACTOR, weight: 1 });
  });

  it('estimates disk usage from bitrate and duration in MB', () => {
    expect(parseExportBitrate('8M')).toBe(8_000_000);
    expect(parseExportBitrate('192k')).toBe(192_000);
    expect(
      estimateExportFileSizeMb({
        durationSeconds: 10,
        width: 1920,
        height: 1080,
        fps: 30,
        format: 'mp4',
        videoBitrate: '8M',
        audioBitrate: '192k'
      })
    ).toBe(10.2);
  });

  it('accounts for clip processing and export setting factors', () => {
    const timeline = makeTimeline([
      makeVideoClip({
        frameInterpolation: { enabled: true, targetFps: 60 },
        videoRestoration: {
          deinterlace: { enabled: true, mode: 0 },
          temporalDenoise: { preset: 'medium', lumaSpatial: 4, chromaSpatial: 3, lumaTmp: 6 },
          spatialDenoise: { enabled: true, strength: 2, patchSize: 7, researchSize: 15 }
        },
        masks: [{ id: 'mask-1', type: 'rect', x: 0, y: 0, w: 1, h: 1, inverted: false, feather: 0, enabled: true }],
        blendMode: 'overlay'
      })
    ]);
    const result = calculateFilterComplexityFactor(
      timeline,
      {
        loudnessNormalization: 'youtube',
        masterProcessing: normalizeExportMasterProcessing({
          eq: { enabled: true, bands: [] },
          stereoEnhancer: { enabled: true, amount: 0.3 },
          limiter: { enabled: true, levelOutDb: -1 }
        }),
        scaleMode: 'fit',
        targetAspectRatio: '9:16',
        watermark: { enabled: true, type: 'text', text: 'Draft', fontFamily: 'Arial', color: '#ffffff', fontSize: 24, position: 'bottom-right' },
        outputMode: 'audio-visualization'
      },
      true
    );

    expect(result.breakdown.map((item) => item.id)).toEqual(
      expect.arrayContaining([
        'frame-interpolation',
        'video-restoration',
        'mask',
        'blend-mode',
        'loudness-normalization',
        'master-processing',
        'scale-reframe',
        'watermark',
        'audio-visualization-output',
        'vmaf-quality-evaluation'
      ])
    );
    expect(result.factor).toBeGreaterThan(5);
  });

  it('calculates historical speed and last estimate error', () => {
    expect(
      calculateHistoricalExportSpeed([
        { timelineDurationSeconds: 10, exportDurationSeconds: 5 },
        { timelineDurationSeconds: 20, exportDurationSeconds: 14 }
      ])
    ).toBe(0.6);
    expect(calculateHistoricalEstimateErrorPercent(10, 12.5)).toBe(25);
    expect(calculateHistoricalExportSpeed([{ exportDurationSeconds: 5 }])).toBeUndefined();
    expect(calculateHistoricalEstimateErrorPercent(0, 12.5)).toBeUndefined();
  });

  it('updates estimated duration when output preset dimensions change', () => {
    const project = makeProject();
    const hd = estimateExportCost({
      project,
      settings: { width: 1920, height: 1080, fps: 30, videoBitrate: '8M', audioBitrate: '192k', format: 'mp4' },
      now: '2026-06-16T00:00:00.000Z'
    });
    const fourK = estimateExportCost({
      project,
      settings: { width: 3840, height: 2160, fps: 30, videoBitrate: '35M', audioBitrate: '320k', format: 'mp4' },
      now: '2026-06-16T00:00:00.000Z'
    });

    expect(fourK.estimatedDurationSeconds).toBeGreaterThan(hd.estimatedDurationSeconds);
    expect(fourK.estimatedFileSizeMb).toBeGreaterThan(hd.estimatedFileSizeMb);
    expect(Date.parse(fourK.estimatedCompletionIso)).toBeGreaterThan(Date.parse(hd.estimatedCompletionIso));
  });

  it('classifies audio, animated image, hardware encoder, and history estimate branches', () => {
    const project = makeProject();
    const audio = estimateExportCost({
      project,
      settings: { outputMode: 'audio', format: 'm4a', audioBitrate: '256k' },
      now: new Date('2026-06-16T00:00:00.000Z'),
      history: [{ timelineDurationSeconds: 10, exportDurationSeconds: 2, estimatedDurationSeconds: 3 }]
    });
    const gif = estimateExportCost({
      project,
      settings: { format: 'gif', width: 640, height: 360, fps: 12 },
      now: 0
    });
    const hevcHardware = estimateExportCost({
      project,
      settings: { videoCodec: 'libx265', hardwareEncoding: true, width: 1920, height: 1080, fps: 30 },
      now: 'bad date'
    });
    const av1 = estimateExportCost({
      project,
      settings: { videoCodec: 'libaom-av1', width: 3840, height: 2160, fps: 60 },
      now: '2026-06-16T00:00:00.000Z'
    });

    expect(audio.cpuLoad).toBe('light');
    expect(audio.lastErrorPercent).toBe(33.3);
    expect(gif.cpuLoad).toBe('medium');
    expect(gif.estimatedFileSizeMb).toBeGreaterThan(0);
    expect(hevcHardware.complexityFactor).toBeLessThan(1);
    expect(av1.cpuLoad).toBe('heavy');
  });

  it('covers every clip effect type in the cost factor table', () => {
    expect(assertExportCostEffectCoverage()).toBe(true);
    expect(Object.keys(EXPORT_COST_EFFECT_COMPLEXITY_FACTORS).sort()).toEqual([...EFFECT_TYPES].sort());
  });
});
