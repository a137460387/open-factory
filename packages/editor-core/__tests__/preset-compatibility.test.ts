import { describe, it, expect } from 'vitest';
import {
  CURRENT_PRESET_SCHEMA_VERSION,
  stampPresetVersion,
  checkPresetCompatibility,
  upgradePreset,
  batchCheckPresetCompatibility,
  serializeUpgradeLogs,
  parseUpgradeLogs,
  type VersionedPreset,
  type PresetUpgradeLogEntry,
} from '../src/export/preset-compatibility';

function makePreset(overrides: Partial<VersionedPreset> = {}): VersionedPreset {
  return {
    id: 'preset-1',
    name: 'Test Preset',
    presetSchemaVersion: 1,
    settings: { width: 1920, height: 1080, fps: 30, videoCodec: 'libx264' },
    ...overrides,
  };
}

describe('preset-compatibility', () => {
  describe('stampPresetVersion', () => {
    it('should stamp current schema version', () => {
      const stamped = stampPresetVersion({ width: 1920 });
      expect(stamped.presetSchemaVersion).toBe(CURRENT_PRESET_SCHEMA_VERSION);
      expect(stamped.width).toBe(1920);
    });

    it('should overwrite existing version', () => {
      const stamped = stampPresetVersion({ presetSchemaVersion: 0 });
      expect(stamped.presetSchemaVersion).toBe(CURRENT_PRESET_SCHEMA_VERSION);
    });
  });

  describe('checkPresetCompatibility', () => {
    it('should report compatible when version matches current', () => {
      const preset = makePreset({ presetSchemaVersion: CURRENT_PRESET_SCHEMA_VERSION });
      const report = checkPresetCompatibility(preset);
      expect(report.compatible).toBe(true);
      expect(report.issues).toHaveLength(0);
    });

    it('should detect deprecated fields', () => {
      const preset = makePreset({
        presetSchemaVersion: 1,
        settings: { legacyEncoder: 'libx265', videoCodec: 'libx264' },
      });
      const report = checkPresetCompatibility(preset);
      expect(report.compatible).toBe(false);
      const deprecatedIssues = report.issues.filter((i) => i.kind === 'deprecated-field');
      expect(deprecatedIssues.length).toBeGreaterThanOrEqual(1);
      expect(deprecatedIssues.some((i) => i.field === 'legacyEncoder')).toBe(true);
    });

    it('should detect missing required fields', () => {
      const preset = makePreset({
        presetSchemaVersion: 1,
        settings: { width: 1920 },
      });
      const report = checkPresetCompatibility(preset);
      const missingIssues = report.issues.filter((i) => i.kind === 'missing-field');
      expect(missingIssues.some((i) => i.field === 'scaleMode')).toBe(true);
      expect(missingIssues.some((i) => i.field === 'hardwareEncoding')).toBe(true);
    });

    it('should handle preset with no version (version 0)', () => {
      const preset = makePreset({
        presetSchemaVersion: 0,
        settings: { width: 1920 },
      });
      const report = checkPresetCompatibility(preset);
      expect(report.compatible).toBe(false);
      expect(report.checkedVersion).toBe(0);
    });
  });

  describe('upgradePreset', () => {
    it('should remove deprecated fields and fill missing defaults', () => {
      const preset = makePreset({
        presetSchemaVersion: 1,
        settings: { legacyEncoder: 'libx265', oldBitrateMode: 'cbr', width: 1920 },
      });
      const { settings, log } = upgradePreset(preset, () => new Date('2025-01-01'));
      expect(settings.presetSchemaVersion).toBe(CURRENT_PRESET_SCHEMA_VERSION);
      expect(settings).not.toHaveProperty('oldBitrateMode');
      expect(settings.scaleMode).toBe('none');
      expect(settings.hardwareEncoding).toBe(false);
      expect(log.fromVersion).toBe(1);
      expect(log.toVersion).toBe(CURRENT_PRESET_SCHEMA_VERSION);
      expect(log.changes.length).toBeGreaterThan(0);
    });

    it('should use transform for deprecated fields with transform', () => {
      const preset = makePreset({
        presetSchemaVersion: 1,
        settings: { legacyEncoder: 'libx265' },
      });
      const { settings } = upgradePreset(preset);
      // legacyEncoder gets deleted then re-added with transform value
      expect(settings.legacyEncoder).toBe('libx264');
    });

    it('should produce valid upgrade log format', () => {
      const preset = makePreset({ presetSchemaVersion: 1 });
      const { log } = upgradePreset(preset, () => new Date('2025-06-01'));
      expect(log.timestamp).toBe('2025-06-01T00:00:00.000Z');
      expect(log.presetId).toBe('preset-1');
      expect(log.presetName).toBe('Test Preset');
    });
  });

  describe('batchCheckPresetCompatibility', () => {
    it('should count presets needing upgrade', () => {
      const presets: VersionedPreset[] = [
        makePreset({ id: 'p1', presetSchemaVersion: CURRENT_PRESET_SCHEMA_VERSION }),
        makePreset({ id: 'p2', presetSchemaVersion: 1 }),
        makePreset({ id: 'p3', presetSchemaVersion: 0 }),
      ];
      const result = batchCheckPresetCompatibility(presets);
      expect(result.totalChecked).toBe(3);
      expect(result.needsUpgrade).toBe(2);
    });

    it('should return 0 needsUpgrade when all presets are current', () => {
      const presets: VersionedPreset[] = [
        makePreset({ presetSchemaVersion: CURRENT_PRESET_SCHEMA_VERSION }),
      ];
      const result = batchCheckPresetCompatibility(presets);
      expect(result.needsUpgrade).toBe(0);
    });

    it('should handle empty list', () => {
      const result = batchCheckPresetCompatibility([]);
      expect(result.totalChecked).toBe(0);
      expect(result.needsUpgrade).toBe(0);
    });
  });

  describe('upgrade log serialization', () => {
    it('should round-trip serialize and parse', () => {
      const logs: PresetUpgradeLogEntry[] = [
        {
          timestamp: '2025-01-01T00:00:00.000Z',
          presetId: 'p1',
          presetName: 'YouTube',
          fromVersion: 1,
          toVersion: 2,
          changes: [
            { kind: 'deprecated-field', field: 'legacyEncoder', detail: '已废弃' },
          ],
        },
      ];
      const json = serializeUpgradeLogs(logs);
      const parsed = parseUpgradeLogs(json);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].presetId).toBe('p1');
      expect(parsed[0].changes[0].field).toBe('legacyEncoder');
    });

    it('should return empty array for invalid JSON', () => {
      expect(parseUpgradeLogs('not json')).toEqual([]);
    });

    it('should return empty array for missing version', () => {
      expect(parseUpgradeLogs(JSON.stringify({ entries: [] }))).toEqual([]);
    });
  });
});
