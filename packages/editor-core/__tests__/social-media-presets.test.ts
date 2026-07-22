import { describe, it, expect } from 'vitest';
import {
  SOCIAL_MEDIA_PRESETS,
  getPresetsByPlatform,
  getPresetById,
  getAllPlatforms,
  buildFfmpegArgsForPreset,
  createCustomPreset,
  resolvePresetWithCustom,
  estimateOutputFileSizeMb,
  validateDurationForPlatform,
} from '../src/export/social-media-presets';

describe('social-media-presets', () => {
  describe('SOCIAL_MEDIA_PRESETS', () => {
    it('contains presets for all platforms', () => {
      const platforms = getAllPlatforms();
      for (const platform of platforms) {
        const presets = getPresetsByPlatform(platform);
        expect(presets.length).toBeGreaterThanOrEqual(1);
      }
    });

    it('all presets have valid dimensions', () => {
      for (const preset of SOCIAL_MEDIA_PRESETS) {
        expect(preset.width).toBeGreaterThan(0);
        expect(preset.height).toBeGreaterThan(0);
        expect(preset.videoBitrateKbps).toBeGreaterThan(0);
        expect(preset.audioBitrateKbps).toBeGreaterThan(0);
        expect(preset.fps).toBeGreaterThan(0);
      }
    });
  });

  describe('getPresetsByPlatform', () => {
    it('returns bilibili presets', () => {
      const presets = getPresetsByPlatform('bilibili');
      expect(presets.length).toBeGreaterThanOrEqual(3);
      expect(presets.every((p) => p.platform === 'bilibili')).toBe(true);
    });

    it('returns youtube presets', () => {
      const presets = getPresetsByPlatform('youtube');
      expect(presets.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('getPresetById', () => {
    it('finds preset by id', () => {
      const preset = getPresetById('bili-1080p');
      expect(preset).toBeDefined();
      expect(preset!.platform).toBe('bilibili');
      expect(preset!.width).toBe(1920);
    });

    it('returns undefined for unknown id', () => {
      expect(getPresetById('nonexistent')).toBeUndefined();
    });
  });

  describe('buildFfmpegArgsForPreset', () => {
    it('generates valid ffmpeg args', () => {
      const preset = getPresetById('yt-1080p')!;
      const args = buildFfmpegArgsForPreset(preset, 'input.mp4', 'output.mp4');
      expect(args).toContain('-i');
      expect(args).toContain('input.mp4');
      // scale filter contains dimensions
      const vfArg = args.find((a) => a.includes('scale='));
      expect(vfArg).toContain('1920');
      expect(vfArg).toContain('1080');
      expect(args).toContain('-c:v');
      expect(args).toContain('libx264');
      expect(args[args.length - 1]).toBe('output.mp4');
    });

    it('uses h265 for 4K presets', () => {
      const preset = getPresetById('bili-4k')!;
      const args = buildFfmpegArgsForPreset(preset, 'i.mp4', 'o.mp4');
      expect(args).toContain('libx265');
    });

    it('adds duration limit when maxDurationSeconds is set', () => {
      const preset = getPresetById('yt-shorts')!;
      const args = buildFfmpegArgsForPreset(preset, 'i.mp4', 'o.mp4');
      const tIndex = args.indexOf('-t');
      expect(tIndex).toBeGreaterThanOrEqual(0);
      expect(args[tIndex + 1]).toBe('60');
    });
  });

  describe('createCustomPreset', () => {
    it('creates custom preset from base', () => {
      const custom = createCustomPreset('bili-1080p', '我的B站预设', { videoBitrateKbps: 10000 });
      expect(custom).toBeDefined();
      expect(custom!.name).toBe('我的B站预设');
      expect(custom!.basePresetId).toBe('bili-1080p');
      expect(custom!.overrides.videoBitrateKbps).toBe(10000);
    });

    it('returns undefined for invalid base id', () => {
      expect(createCustomPreset('nonexistent', 'test', {})).toBeUndefined();
    });
  });

  describe('resolvePresetWithCustom', () => {
    it('applies overrides to base preset', () => {
      const base = getPresetById('bili-1080p')!;
      const custom = createCustomPreset('bili-1080p', 'test', { videoBitrateKbps: 10000 })!;
      const resolved = resolvePresetWithCustom(base, custom);
      expect(resolved.videoBitrateKbps).toBe(10000);
      expect(resolved.width).toBe(1920); // unchanged
    });

    it('returns base when no custom', () => {
      const base = getPresetById('bili-1080p')!;
      const resolved = resolvePresetWithCustom(base);
      expect(resolved).toEqual(base);
    });
  });

  describe('estimateOutputFileSizeMb', () => {
    it('estimates file size correctly', () => {
      const preset = getPresetById('bili-1080p')!;
      const size = estimateOutputFileSizeMb(preset, 60);
      expect(size).toBeGreaterThan(0);
      // 6000 + 320 = 6320 kbps, 60s => ~45MB
      expect(size).toBeGreaterThan(30);
      expect(size).toBeLessThan(60);
    });
  });

  describe('validateDurationForPlatform', () => {
    it('passes when under limit', () => {
      const preset = getPresetById('yt-shorts')!;
      const result = validateDurationForPlatform(preset, 30);
      expect(result.valid).toBe(true);
    });

    it('fails when over limit', () => {
      const preset = getPresetById('yt-shorts')!;
      const result = validateDurationForPlatform(preset, 120);
      expect(result.valid).toBe(false);
      expect(result.message).toContain('60');
    });

    it('passes when no limit', () => {
      const preset = getPresetById('bili-1080p')!;
      const result = validateDurationForPlatform(preset, 9999);
      expect(result.valid).toBe(true);
    });
  });
});
