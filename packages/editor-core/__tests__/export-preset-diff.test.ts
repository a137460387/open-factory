import { describe, expect, it } from 'vitest';
import {
  extractPresetDiffFields,
  mergePresetDiffs,
  buildPresetChangeLog,
  serializePresetChangeLog,
  parsePresetChangeLog,
  buildPresetInheritance,
  getChildPresetIds,
  type ExportPresetSettings
} from '../src/export/export-preset-diff';

const presetA: ExportPresetSettings = {
  width: 1920,
  height: 1080,
  fps: 30,
  videoCodec: 'libx264',
  audioCodec: 'aac',
  videoBitrate: '8M',
  audioBitrate: '192k',
  format: 'mp4',
  outputMode: 'video',
  scaleMode: 'none',
  hardwareEncoding: false,
  loudnessNormalization: 'off'
};

const presetB: ExportPresetSettings = {
  width: 3840,
  height: 2160,
  fps: 60,
  videoCodec: 'libx264',
  audioCodec: 'aac',
  videoBitrate: '35M',
  audioBitrate: '320k',
  format: 'mp4',
  outputMode: 'video',
  scaleMode: 'none',
  hardwareEncoding: true,
  loudnessNormalization: 'youtube'
};

describe('export preset diff', () => {
  describe('extractPresetDiffFields', () => {
    it('identifies differences in width, height, fps, bitrates', () => {
      const result = extractPresetDiffFields(presetA, presetB, 'a', 'b', 'Preset A', 'Preset B');
      expect(result.presetIdA).toBe('a');
      expect(result.presetIdB).toBe('b');
      expect(result.diffCount).toBeGreaterThan(0);

      const widthField = result.fields.find((f) => f.key === 'width');
      expect(widthField?.equal).toBe(false);
      expect(widthField?.valueA).toBe(1920);
      expect(widthField?.valueB).toBe(3840);

      const videoCodecField = result.fields.find((f) => f.key === 'videoCodec');
      expect(videoCodecField?.equal).toBe(true);
      expect(videoCodecField?.valueA).toBe('libx264');
    });

    it('detects bitrate differences', () => {
      const result = extractPresetDiffFields(presetA, presetB, 'a', 'b', 'A', 'B');
      const bitrateField = result.fields.find((f) => f.key === 'videoBitrate');
      expect(bitrateField?.equal).toBe(false);
      expect(bitrateField?.valueA).toBe('8M');
      expect(bitrateField?.valueB).toBe('35M');
    });

    it('detects hardware encoding difference', () => {
      const result = extractPresetDiffFields(presetA, presetB, 'a', 'b', 'A', 'B');
      const hwField = result.fields.find((f) => f.key === 'hardwareEncoding');
      expect(hwField?.equal).toBe(false);
      expect(hwField?.valueA).toBe(false);
      expect(hwField?.valueB).toBe(true);
    });

    it('reports 0 diffs for identical presets', () => {
      const result = extractPresetDiffFields(presetA, presetA, 'a', 'a', 'Same', 'Same');
      expect(result.diffCount).toBe(0);
      expect(result.fields.every((f) => f.equal)).toBe(true);
    });

    it('covers all field types including watermark and color management', () => {
      const withWatermark: ExportPresetSettings = {
        ...presetA,
        watermark: { enabled: true, type: 'text', text: 'Test', fontFamily: 'Arial', color: '#ffffff', fontSize: 36, position: 'bottom-right' }
      };
      const result = extractPresetDiffFields(presetA, withWatermark, 'a', 'b', 'A', 'B');
      const wmField = result.fields.find((f) => f.key === 'watermark');
      expect(wmField?.equal).toBe(false);
      expect(wmField?.type).toBe('watermark');
    });
  });

  describe('mergePresetDiffs', () => {
    it('merges selected fields from source onto base', () => {
      const merged = mergePresetDiffs(presetA, presetB, ['videoBitrate', 'height']);
      expect(merged.videoBitrate).toBe('35M');
      expect(merged.height).toBe(2160);
      expect(merged.width).toBe(1920);
      expect(merged.fps).toBe(30);
    });

    it('preserves base fields not in selectedKeys', () => {
      const merged = mergePresetDiffs(presetA, presetB, ['audioBitrate']);
      expect(merged.audioBitrate).toBe('320k');
      expect(merged.width).toBe(1920);
    });
  });

  describe('buildPresetChangeLog', () => {
    it('records changes between preset versions', () => {
      const entries = buildPresetChangeLog(presetA, presetB, () => new Date('2026-01-01'));
      expect(entries.length).toBeGreaterThan(0);
      const widthEntry = entries.find((e) => e.field === 'width');
      expect(widthEntry).toBeDefined();
      expect(widthEntry?.oldValue).toBe(1920);
      expect(widthEntry?.newValue).toBe(3840);
      expect(widthEntry?.timestamp).toBe('2026-01-01T00:00:00.000Z');
    });

    it('returns empty log for identical presets', () => {
      const entries = buildPresetChangeLog(presetA, presetA);
      expect(entries.length).toBe(0);
    });
  });

  describe('serializePresetChangeLog / parsePresetChangeLog', () => {
    it('round-trips change log entries', () => {
      const entries = buildPresetChangeLog(presetA, presetB, () => new Date('2026-01-01'));
      const serialized = serializePresetChangeLog(entries);
      const parsed = parsePresetChangeLog(serialized);
      expect(parsed.length).toBe(entries.length);
      expect(parsed[0].field).toBe(entries[0].field);
    });

    it('returns empty array for invalid JSON', () => {
      expect(parsePresetChangeLog('not json')).toEqual([]);
    });
  });

  describe('buildPresetInheritance', () => {
    it('records parent-child relationship', () => {
      const inheritances = buildPresetInheritance(new Map(), 'parent-1', 'child-1');
      expect(getChildPresetIds(inheritances, 'parent-1')).toEqual(['child-1']);
      expect(inheritances.get('child-1')?.parentPresetId).toBe('parent-1');
    });

    it('accumulates multiple children', () => {
      let inheritances = buildPresetInheritance(new Map(), 'p', 'c1');
      inheritances = buildPresetInheritance(inheritances, 'p', 'c2');
      expect(getChildPresetIds(inheritances, 'p')).toEqual(['c1', 'c2']);
    });

    it('does not duplicate children', () => {
      let inheritances = buildPresetInheritance(new Map(), 'p', 'c1');
      inheritances = buildPresetInheritance(inheritances, 'p', 'c1');
      expect(getChildPresetIds(inheritances, 'p')).toEqual(['c1']);
    });
  });
});
