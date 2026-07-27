import { describe, it, expect } from 'vitest';
import {
  createId,
  normalizeClipBeatMarkers,
  normalizeDetectedBpm,
  clampClipSpeed,
  normalizeColorCorrection,
  normalizeChromaKey,
  isChromaKeyEnabled,
  normalizeStabilization,
  isStabilizationExportable,
  normalizeFrameInterpolation,
  normalizeSlowMotionMode,
  normalizeClipProjection,
  normalizeClipPanoramaView,
  normalizeVideoDenoisePreset,
  normalizeVideoRestoration,
  suggestDeinterlaceMode,
  normalizeQualityEnhancement,
  normalizeMotionTrack,
  normalizeAudioDenoise,
  normalizeAILocalDenoise,
  normalizeAudioChannelRouting,
  normalizeAudioPitchSemitones,
  normalizeAudioFadeCurve,
  normalizeAudioFadeDuration,
  createMask,
  normalizeMask,
  normalizeMaskKeyframes,
  normalizePrivacyBlur,
  normalizeMulticamSequence,
  normalizeTextPath,
} from '../src/model/clip-normalize';

describe('clip-normalize', () => {
  describe('createId', () => {
    it('generates id with default prefix', () => {
      const id = createId();
      expect(id).toBeTruthy();
      expect(typeof id).toBe('string');
    });

    it('generates id with custom prefix', () => {
      const id = createId('clip');
      expect(id).toBeTruthy();
    });

    it('generates unique ids', () => {
      const ids = new Set(Array.from({ length: 100 }, () => createId()));
      expect(ids.size).toBe(100);
    });
  });

  describe('normalizeClipBeatMarkers', () => {
    it('returns undefined for non-array', () => {
      expect(normalizeClipBeatMarkers(undefined)).toBeUndefined();
    });

    it('returns undefined for empty array', () => {
      expect(normalizeClipBeatMarkers([])).toBeUndefined();
    });

    it('filters invalid markers', () => {
      const markers = [
        { id: 'a', time: 1 },
        { id: 'b', time: NaN },
        null,
        { id: 'd', time: 2 },
      ] as any[];
      const result = normalizeClipBeatMarkers(markers);
      expect(result).toHaveLength(2);
    });

    it('sorts by time', () => {
      const markers = [
        { id: 'a', time: 3 },
        { id: 'b', time: 1 },
        { id: 'c', time: 2 },
      ];
      const result = normalizeClipBeatMarkers(markers);
      expect(result!.map((m) => m.time)).toEqual([1, 2, 3]);
    });

    it('clamps to maxTime', () => {
      const markers = [{ id: 'a', time: 10 }];
      const result = normalizeClipBeatMarkers(markers, 5);
      expect(result![0].time).toBe(5);
    });

    it('generates id for markers without id', () => {
      const markers = [{ time: 1 }];
      const result = normalizeClipBeatMarkers(markers);
      expect(result![0].id).toBeTruthy();
    });
  });

  describe('normalizeDetectedBpm', () => {
    it('returns undefined for non-finite', () => {
      expect(normalizeDetectedBpm(NaN)).toBeUndefined();
      expect(normalizeDetectedBpm(Infinity)).toBeUndefined();
    });

    it('returns undefined for non-number', () => {
      expect(normalizeDetectedBpm(undefined)).toBeUndefined();
    });

    it('returns undefined for zero or negative', () => {
      expect(normalizeDetectedBpm(0)).toBeUndefined();
      expect(normalizeDetectedBpm(-1)).toBeUndefined();
    });

    it('clamps to valid range', () => {
      expect(normalizeDetectedBpm(500)).toBe(400);
      expect(normalizeDetectedBpm(0.5)).toBe(1);
    });

    it('returns valid bpm', () => {
      expect(normalizeDetectedBpm(120)).toBe(120);
    });
  });

  describe('clampClipSpeed', () => {
    it('returns default for undefined', () => {
      expect(clampClipSpeed(undefined)).toBe(1);
    });

    it('returns default for NaN', () => {
      expect(clampClipSpeed(NaN)).toBe(1);
    });

    it('clamps to min', () => {
      const result = clampClipSpeed(0.001);
      expect(result).toBeGreaterThanOrEqual(0.01);
    });

    it('clamps to max', () => {
      const result = clampClipSpeed(100);
      expect(result).toBeLessThanOrEqual(100);
    });

    it('returns valid speed', () => {
      expect(clampClipSpeed(2)).toBe(2);
    });
  });

  describe('normalizeColorCorrection', () => {
    it('returns defaults for undefined', () => {
      const cc = normalizeColorCorrection(undefined);
      expect(cc.brightness).toBe(0);
      expect(cc.contrast).toBe(1);
      expect(cc.saturation).toBe(1);
      expect(cc.hue).toBe(0);
    });

    it('clamps values', () => {
      const cc = normalizeColorCorrection({ brightness: 5, contrast: -1, saturation: 10, hue: 200 });
      expect(cc.brightness).toBe(1);
      expect(cc.contrast).toBe(0);
      expect(cc.saturation).toBe(2);
      expect(cc.hue).toBe(180);
    });

    it('preserves valid values', () => {
      const cc = normalizeColorCorrection({ brightness: 0.5, contrast: 1.5, saturation: 0.8, hue: -30 });
      expect(cc.brightness).toBe(0.5);
      expect(cc.contrast).toBe(1.5);
      expect(cc.saturation).toBe(0.8);
      expect(cc.hue).toBe(-30);
    });
  });

  describe('normalizeChromaKey', () => {
    it('returns defaults for undefined', () => {
      const ck = normalizeChromaKey(undefined);
      expect(ck.enabled).toBe(false);
      expect(ck.similarity).toBeGreaterThanOrEqual(0);
      expect(ck.blend).toBeGreaterThanOrEqual(0);
    });

    it('sets enabled from input', () => {
      expect(normalizeChromaKey({ enabled: true }).enabled).toBe(true);
      expect(normalizeChromaKey({ enabled: false }).enabled).toBe(false);
    });

    it('clamps similarity and blend', () => {
      const ck = normalizeChromaKey({ similarity: 5, blend: -1 });
      expect(ck.similarity).toBe(1);
      expect(ck.blend).toBe(0);
    });
  });

  describe('isChromaKeyEnabled', () => {
    it('returns false for undefined', () => {
      expect(isChromaKeyEnabled(undefined)).toBe(false);
    });

    it('returns true when enabled', () => {
      expect(isChromaKeyEnabled({ enabled: true })).toBe(true);
    });
  });

  describe('normalizeStabilization', () => {
    it('returns defaults for undefined', () => {
      const s = normalizeStabilization(undefined);
      expect(s.enabled).toBe(false);
      expect(s.smoothing).toBeGreaterThanOrEqual(1);
      expect(s.zoom).toBeGreaterThanOrEqual(0);
    });

    it('clamps smoothing', () => {
      const s = normalizeStabilization({ smoothing: 200 });
      expect(s.smoothing).toBe(100);
    });

    it('clamps zoom', () => {
      const s = normalizeStabilization({ zoom: 10 });
      expect(s.zoom).toBe(5);
    });
  });

  describe('isStabilizationExportable', () => {
    it('returns false for undefined', () => {
      expect(isStabilizationExportable(undefined)).toBe(false);
    });

    it('returns false when not analyzed', () => {
      expect(isStabilizationExportable({ enabled: true, analyzed: false, trfPath: 'x.trf' })).toBe(false);
    });

    it('returns false when no trfPath', () => {
      expect(isStabilizationExportable({ enabled: true, analyzed: true })).toBe(false);
    });
  });

  describe('normalizeFrameInterpolation', () => {
    it('returns defaults for undefined', () => {
      const fi = normalizeFrameInterpolation(undefined);
      expect(fi.enabled).toBe(false);
      expect(fi.targetFps).toBeDefined();
      expect(fi.mode).toBeDefined();
    });

    it('preserves valid targetFps', () => {
      const fi = normalizeFrameInterpolation({ targetFps: 60 });
      expect(fi.targetFps).toBe(60);
    });

    it('falls back for invalid targetFps', () => {
      const fi = normalizeFrameInterpolation({ targetFps: 999 as any });
      expect(fi.targetFps).toBeDefined();
    });
  });

  describe('normalizeSlowMotionMode', () => {
    it('returns default for undefined', () => {
      expect(normalizeSlowMotionMode(undefined)).toBeDefined();
    });

    it('returns valid mode', () => {
      expect(normalizeSlowMotionMode('optical-flow')).toBe('optical-flow');
    });

    it('returns default for invalid', () => {
      expect(normalizeSlowMotionMode('invalid')).toBeDefined();
    });
  });

  describe('normalizeClipProjection', () => {
    it('returns default for undefined', () => {
      expect(normalizeClipProjection(undefined)).toBe('flat');
    });

    it('returns valid projection', () => {
      expect(normalizeClipProjection('equirectangular')).toBe('equirectangular');
      expect(normalizeClipProjection('cubemap')).toBe('cubemap');
      expect(normalizeClipProjection('flat')).toBe('flat');
    });

    it('returns default for invalid', () => {
      expect(normalizeClipProjection('invalid')).toBe('flat');
    });
  });

  describe('normalizeClipPanoramaView', () => {
    it('returns defaults for undefined', () => {
      const pv = normalizeClipPanoramaView(undefined);
      expect(pv.yaw).toBeDefined();
      expect(pv.pitch).toBeDefined();
      expect(pv.fov).toBeDefined();
    });

    it('clamps pitch to [-90, 90]', () => {
      const pv = normalizeClipPanoramaView({ pitch: 200 });
      expect(pv.pitch).toBe(90);
    });

    it('clamps fov to [60, 120]', () => {
      const pv = normalizeClipPanoramaView({ fov: 200 });
      expect(pv.fov).toBe(120);
    });
  });

  describe('normalizeVideoDenoisePreset', () => {
    it('returns off for undefined', () => {
      expect(normalizeVideoDenoisePreset(undefined)).toBe('off');
    });

    it('returns valid preset', () => {
      expect(normalizeVideoDenoisePreset('low')).toBe('low');
      expect(normalizeVideoDenoisePreset('medium')).toBe('medium');
      expect(normalizeVideoDenoisePreset('high')).toBe('high');
      expect(normalizeVideoDenoisePreset('custom')).toBe('custom');
      expect(normalizeVideoDenoisePreset('off')).toBe('off');
    });

    it('returns off for invalid', () => {
      expect(normalizeVideoDenoisePreset('invalid')).toBe('off');
    });
  });

  describe('normalizeVideoRestoration', () => {
    it('returns defaults for undefined', () => {
      const vr = normalizeVideoRestoration(undefined);
      expect(vr.deinterlace.enabled).toBe(false);
      expect(vr.temporalDenoise.preset).toBe('off');
      expect(vr.spatialDenoise.enabled).toBe(false);
    });
  });

  describe('suggestDeinterlaceMode', () => {
    it('returns null for undefined', () => {
      expect(suggestDeinterlaceMode(undefined)).toBeNull();
    });

    it('returns null for progressive', () => {
      expect(suggestDeinterlaceMode('progressive')).toBeNull();
    });

    it('returns null for unknown', () => {
      expect(suggestDeinterlaceMode('unknown')).toBeNull();
    });

    it('returns 0 for field orders', () => {
      expect(suggestDeinterlaceMode('tt')).toBe(0);
      expect(suggestDeinterlaceMode('bb')).toBe(0);
      expect(suggestDeinterlaceMode('tb')).toBe(0);
      expect(suggestDeinterlaceMode('bt')).toBe(0);
    });

    it('returns 0 for field-containing strings', () => {
      expect(suggestDeinterlaceMode('top_field_first')).toBe(0);
    });
  });

  describe('normalizeQualityEnhancement', () => {
    it('returns defaults for undefined', () => {
      const qe = normalizeQualityEnhancement(undefined);
      expect(qe.superResolution).toBe(false);
      expect(qe.deblock).toBe(false);
      expect(qe.colorBoost).toBe(false);
      expect(qe.frameCompensation).toBe(false);
    });

    it('preserves true values', () => {
      const qe = normalizeQualityEnhancement({
        superResolution: true,
        deblock: true,
        colorBoost: true,
        frameCompensation: true,
      });
      expect(qe.superResolution).toBe(true);
    });
  });

  describe('normalizeMotionTrack', () => {
    it('returns undefined for non-array', () => {
      expect(normalizeMotionTrack(undefined)).toBeUndefined();
    });

    it('returns undefined for empty', () => {
      expect(normalizeMotionTrack([])).toBeUndefined();
    });

    it('filters invalid points', () => {
      const points = [
        { time: 1, dx: 10, dy: 20 },
        { time: NaN, dx: 0, dy: 0 },
        { time: 2, dx: NaN, dy: 0 },
      ];
      const result = normalizeMotionTrack(points);
      expect(result).toHaveLength(1);
    });

    it('sorts by time', () => {
      const points = [
        { time: 3, dx: 0, dy: 0 },
        { time: 1, dx: 0, dy: 0 },
      ];
      const result = normalizeMotionTrack(points);
      expect(result![0].time).toBe(1);
    });

    it('clamps to duration', () => {
      const points = [{ time: 10, dx: 0, dy: 0 }];
      const result = normalizeMotionTrack(points, 5);
      expect(result![0].time).toBe(5);
    });
  });

  describe('normalizeAudioDenoise', () => {
    it('returns defaults for undefined', () => {
      const ad = normalizeAudioDenoise(undefined);
      expect(ad.enabled).toBe(false);
      expect(ad.strength).toBeGreaterThanOrEqual(0);
    });

    it('clamps strength', () => {
      const ad = normalizeAudioDenoise({ strength: 5 });
      expect(ad.strength).toBe(1);
    });
  });

  describe('normalizeAILocalDenoise', () => {
    it('returns defaults for undefined', () => {
      const ad = normalizeAILocalDenoise(undefined);
      expect(ad.enabled).toBe(false);
    });
  });

  describe('normalizeAudioChannelRouting', () => {
    it('returns normal for undefined', () => {
      expect(normalizeAudioChannelRouting(undefined)).toBe('normal');
    });

    it('returns valid modes', () => {
      expect(normalizeAudioChannelRouting('mono-left')).toBe('mono-left');
      expect(normalizeAudioChannelRouting('swap-stereo')).toBe('swap-stereo');
      expect(normalizeAudioChannelRouting('stereo-to-mono')).toBe('stereo-to-mono');
    });

    it('returns normal for invalid', () => {
      expect(normalizeAudioChannelRouting('invalid' as any)).toBe('normal');
    });
  });

  describe('normalizeAudioPitchSemitones', () => {
    it('returns default for undefined', () => {
      expect(normalizeAudioPitchSemitones(undefined)).toBe(0);
    });

    it('clamps to [-12, 12]', () => {
      expect(normalizeAudioPitchSemitones(20)).toBe(12);
      expect(normalizeAudioPitchSemitones(-20)).toBe(-12);
    });

    it('preserves valid value', () => {
      expect(normalizeAudioPitchSemitones(5)).toBe(5);
    });
  });

  describe('normalizeAudioFadeCurve', () => {
    it('returns default for undefined', () => {
      expect(normalizeAudioFadeCurve(undefined)).toBeDefined();
    });

    it('returns valid curves', () => {
      expect(normalizeAudioFadeCurve('linear')).toBe('linear');
      expect(normalizeAudioFadeCurve('ease-in')).toBe('ease-in');
      expect(normalizeAudioFadeCurve('ease-out')).toBe('ease-out');
      expect(normalizeAudioFadeCurve('ease-in-out')).toBe('ease-in-out');
    });

    it('returns default for invalid', () => {
      expect(normalizeAudioFadeCurve('invalid' as any)).toBeDefined();
    });
  });

  describe('normalizeAudioFadeDuration', () => {
    it('returns default for undefined', () => {
      expect(normalizeAudioFadeDuration(undefined)).toBeGreaterThanOrEqual(0);
    });

    it('clamps to clip duration', () => {
      const result = normalizeAudioFadeDuration(10, 5);
      expect(result).toBe(5);
    });

    it('clamps negative to 0', () => {
      expect(normalizeAudioFadeDuration(-1)).toBe(0);
    });
  });

  describe('normalizePrivacyBlur', () => {
    it('returns undefined for undefined', () => {
      const pb = normalizePrivacyBlur(undefined);
      expect(pb).toBeUndefined();
    });
  });

  describe('normalizeMask', () => {
    it('returns defaults with enabled=true when undefined', () => {
      const mask = normalizeMask(undefined);
      expect(mask.enabled).toBe(true);
      expect(mask.type).toBe('rect');
    });
  });

  describe('normalizeTextPath', () => {
    it('returns defaults for undefined', () => {
      const tp = normalizeTextPath(undefined);
      expect(tp.enabled).toBe(false);
    });
  });

  describe('normalizeMaskKeyframes', () => {
    it('returns undefined for undefined input', () => {
      expect(normalizeMaskKeyframes(undefined)).toBeUndefined();
    });

    it('returns undefined for empty array', () => {
      expect(normalizeMaskKeyframes([])).toBeUndefined();
    });
  });
});
