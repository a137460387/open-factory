/**
 * 当前导出预设 schema 版本号。
 * 每次新增必填字段或废弃旧字段时递增。
 */
export declare const CURRENT_PRESET_SCHEMA_VERSION = 2;
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
/**
 * 序列化预设时附加当前 schema 版本号。
 */
export declare function stampPresetVersion(settings: Record<string, unknown>): Record<string, unknown>;
/**
 * 检查单个预设的兼容性。
 */
export declare function checkPresetCompatibility(preset: VersionedPreset): PresetCompatibilityReport;
/**
 * 自动升级预设：移除废弃字段、填充缺失字段、更新版本号。
 * 返回升级后的新 settings 对象和变更日志。
 */
export declare function upgradePreset(preset: VersionedPreset, now?: () => Date): {
    settings: Record<string, unknown>;
    log: PresetUpgradeLogEntry;
};
/**
 * 批量检查所有预设兼容性。
 */
export declare function batchCheckPresetCompatibility(presets: VersionedPreset[]): BatchPresetCompatibilityResult;
/**
 * 序列化升级日志为 JSON 字符串。
 */
export declare function serializeUpgradeLogs(logs: PresetUpgradeLogEntry[]): string;
/**
 * 从 JSON 字符串解析升级日志。
 */
export declare function parseUpgradeLogs(contents: string): PresetUpgradeLogEntry[];
//# sourceMappingURL=preset-compatibility.d.ts.map