import type { ExportSettings } from './export-types';

/**
 * 当前导出预设 schema 版本号。
 * 每次新增必填字段或废弃旧字段时递增。
 */
export const CURRENT_PRESET_SCHEMA_VERSION = 2;

/** 已废弃字段清单：key → 说明 */
export interface DeprecatedFieldRule {
  key: string;
  reason: string;
  /** 自动替换函数（可选） */
  transform?: (oldValue: unknown) => unknown;
}

/** 新增必填字段默认值规则 */
export interface RequiredFieldDefault {
  key: string;
  defaultValue: unknown;
}

/** 兼容性检查发现的单条问题 */
export interface PresetCompatibilityIssue {
  kind: 'deprecated-field' | 'missing-field';
  field: string;
  detail: string;
  oldValue?: unknown;
  newValue?: unknown;
}

/** 单个预设的兼容性报告 */
export interface PresetCompatibilityReport {
  presetId: string;
  presetName: string;
  currentVersion: number;
  checkedVersion: number;
  compatible: boolean;
  issues: PresetCompatibilityIssue[];
}

/** 升级日志条目 */
export interface PresetUpgradeLogEntry {
  timestamp: string;
  presetId: string;
  presetName: string;
  fromVersion: number;
  toVersion: number;
  changes: PresetCompatibilityIssue[];
}

/** 批量检查结果 */
export interface BatchPresetCompatibilityResult {
  totalChecked: number;
  needsUpgrade: number;
  reports: PresetCompatibilityReport[];
}

/** 带版本号的预设序列化数据 */
export interface VersionedPreset {
  id: string;
  name: string;
  presetSchemaVersion: number;
  settings: Record<string, unknown>;
}

// ---------- 版本规则注册表 ----------

const DEPRECATED_FIELDS_BY_VERSION: Map<number, DeprecatedFieldRule[]> = new Map([
  [
    2,
    [
      { key: 'legacyEncoder', reason: '字段 legacyEncoder 已废弃，请使用 videoCodec', transform: () => 'libx264' },
      { key: 'oldBitrateMode', reason: '字段 oldBitrateMode 已废弃，新版本使用 videoBitrate/audioBitrate' },
    ],
  ],
]);

const REQUIRED_DEFAULTS_BY_VERSION: Map<number, RequiredFieldDefault[]> = new Map([
  [
    2,
    [
      { key: 'scaleMode', defaultValue: 'none' },
      { key: 'hardwareEncoding', defaultValue: false },
    ],
  ],
  [1, []],
]);

// ---------- 核心函数 ----------

/**
 * 序列化预设时附加当前 schema 版本号。
 */
export function stampPresetVersion(settings: Record<string, unknown>): Record<string, unknown> {
  return { ...settings, presetSchemaVersion: CURRENT_PRESET_SCHEMA_VERSION };
}

/**
 * 检查单个预设的兼容性。
 */
export function checkPresetCompatibility(preset: VersionedPreset): PresetCompatibilityReport {
  const issues: PresetCompatibilityIssue[] = [];
  const checkedVersion = preset.presetSchemaVersion ?? 0;

  // 检查废弃字段
  for (let v = checkedVersion + 1; v <= CURRENT_PRESET_SCHEMA_VERSION; v++) {
    const rules = DEPRECATED_FIELDS_BY_VERSION.get(v) ?? [];
    for (const rule of rules) {
      if (rule.key in preset.settings) {
        const oldValue = preset.settings[rule.key];
        const newValue = rule.transform ? rule.transform(oldValue) : undefined;
        issues.push({
          kind: 'deprecated-field',
          field: rule.key,
          detail: rule.reason,
          oldValue,
          newValue,
        });
      }
    }
  }

  // 检查缺失必填字段
  for (let v = checkedVersion + 1; v <= CURRENT_PRESET_SCHEMA_VERSION; v++) {
    const defaults = REQUIRED_DEFAULTS_BY_VERSION.get(v) ?? [];
    for (const def of defaults) {
      if (!(def.key in preset.settings) || preset.settings[def.key] === undefined) {
        issues.push({
          kind: 'missing-field',
          field: def.key,
          detail: `新增必填字段 ${def.key} 缺失，将自动填充默认值`,
          newValue: def.defaultValue,
        });
      }
    }
  }

  return {
    presetId: preset.id,
    presetName: preset.name,
    currentVersion: CURRENT_PRESET_SCHEMA_VERSION,
    checkedVersion,
    compatible: checkedVersion >= CURRENT_PRESET_SCHEMA_VERSION && issues.length === 0,
    issues,
  };
}

/**
 * 自动升级预设：移除废弃字段、填充缺失字段、更新版本号。
 * 返回升级后的新 settings 对象和变更日志。
 */
export function upgradePreset(
  preset: VersionedPreset,
  now?: () => Date,
): { settings: Record<string, unknown>; log: PresetUpgradeLogEntry } {
  const report = checkPresetCompatibility(preset);
  const settings = { ...preset.settings };

  for (const issue of report.issues) {
    if (issue.kind === 'deprecated-field') {
      delete settings[issue.field];
      if (issue.newValue !== undefined) {
        settings[issue.field] = issue.newValue;
      }
    }
    if (issue.kind === 'missing-field') {
      settings[issue.field] = issue.newValue;
    }
  }

  settings.presetSchemaVersion = CURRENT_PRESET_SCHEMA_VERSION;

  const log: PresetUpgradeLogEntry = {
    timestamp: (now ?? (() => new Date()))().toISOString(),
    presetId: preset.id,
    presetName: preset.name,
    fromVersion: preset.presetSchemaVersion ?? 0,
    toVersion: CURRENT_PRESET_SCHEMA_VERSION,
    changes: report.issues,
  };

  return { settings, log };
}

/**
 * 批量检查所有预设兼容性。
 */
export function batchCheckPresetCompatibility(presets: VersionedPreset[]): BatchPresetCompatibilityResult {
  const reports = presets.map(checkPresetCompatibility);
  return {
    totalChecked: reports.length,
    needsUpgrade: reports.filter((r) => !r.compatible).length,
    reports,
  };
}

/**
 * 序列化升级日志为 JSON 字符串。
 */
export function serializeUpgradeLogs(logs: PresetUpgradeLogEntry[]): string {
  return JSON.stringify({ version: 1, entries: logs }, null, 2) + '\n';
}

/**
 * 从 JSON 字符串解析升级日志。
 */
export function parseUpgradeLogs(contents: string): PresetUpgradeLogEntry[] {
  try {
    const parsed = JSON.parse(contents);
    if (parsed && parsed.version === 1 && Array.isArray(parsed.entries)) {
      return parsed.entries.filter((e: unknown) => e && typeof (e as PresetUpgradeLogEntry).presetId === 'string');
    }
    return [];
  } catch {
    return [];
  }
}
