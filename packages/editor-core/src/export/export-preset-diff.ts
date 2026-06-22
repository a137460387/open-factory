import type { ExportSettings } from './export-types';

export type ExportPresetDiffFieldType =
  | 'number'
  | 'string'
  | 'boolean'
  | 'watermark'
  | 'timecodeBurnIn'
  | 'slate'
  | 'colorManagement'
  | 'postExportScript'
  | 'masterProcessing'
  | 'audioVisualization';

export interface ExportPresetDiffField {
  key: string;
  label: string;
  type: ExportPresetDiffFieldType;
  valueA: unknown;
  valueB: unknown;
  equal: boolean;
}

export interface ExportPresetDiffResult {
  presetIdA: string;
  presetIdB: string;
  presetNameA: string;
  presetNameB: string;
  fields: ExportPresetDiffField[];
  diffCount: number;
}

export interface ExportPresetChangeLogEntry {
  timestamp: string;
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

export interface ExportPresetInheritance {
  parentPresetId?: string;
  childPresetIds: string[];
}

export type ExportPresetSettings = Partial<Omit<ExportSettings, 'outputPath'>>;

const DIFF_FIELD_DEFINITIONS: Array<{ key: string; label: string; type: ExportPresetDiffFieldType }> = [
  { key: 'width', label: '宽度', type: 'number' },
  { key: 'height', label: '高度', type: 'number' },
  { key: 'fps', label: '帧率', type: 'number' },
  { key: 'sampleRate', label: '采样率', type: 'number' },
  { key: 'videoCodec', label: '视频编码', type: 'string' },
  { key: 'audioCodec', label: '音频编码', type: 'string' },
  { key: 'format', label: '格式', type: 'string' },
  { key: 'videoBitrate', label: '视频码率', type: 'string' },
  { key: 'audioBitrate', label: '音频码率', type: 'string' },
  { key: 'outputMode', label: '输出模式', type: 'string' },
  { key: 'scaleMode', label: '缩放模式', type: 'string' },
  { key: 'targetAspectRatio', label: '目标宽高比', type: 'string' },
  { key: 'reframeOffsetX', label: '水平偏移', type: 'number' },
  { key: 'reframeOffsetY', label: '垂直偏移', type: 'number' },
  { key: 'subtitleMode', label: '字幕模式', type: 'string' },
  { key: 'subtitleFormat', label: '字幕格式', type: 'string' },
  { key: 'exportSidecarSubtitle', label: '导出字幕文件', type: 'boolean' },
  { key: 'hardwareEncoding', label: '硬件加速', type: 'boolean' },
  { key: 'loudnessNormalization', label: '响度标准化', type: 'string' },
  { key: 'platformPreset', label: '平台预设', type: 'string' },
  { key: 'videoProfile', label: '视频配置', type: 'string' },
  { key: 'watermark', label: '水印', type: 'watermark' },
  { key: 'timecodeBurnIn', label: '时间码叠加', type: 'timecodeBurnIn' },
  { key: 'slate', label: '片头信息', type: 'slate' },
  { key: 'colorPipeline', label: '色彩管线', type: 'string' },
  { key: 'colorManagement', label: '色彩管理', type: 'colorManagement' },
  { key: 'postExportScript', label: '导出后脚本', type: 'postExportScript' },
  { key: 'masterProcessing', label: '母带处理', type: 'masterProcessing' },
  { key: 'audioVisualization', label: '音频可视化', type: 'audioVisualization' }
];

export function extractPresetDiffFields(
  settingsA: ExportPresetSettings,
  settingsB: ExportPresetSettings,
  presetIdA: string,
  presetIdB: string,
  presetNameA: string,
  presetNameB: string
): ExportPresetDiffResult {
  const fields: ExportPresetDiffField[] = [];
  const recordA = settingsA as Record<string, unknown>;
  const recordB = settingsB as Record<string, unknown>;

  for (const def of DIFF_FIELD_DEFINITIONS) {
    const valueA = recordA[def.key];
    const valueB = recordB[def.key];
    const equal = valuesEqual(valueA, valueB);
    fields.push({
      key: def.key,
      label: def.label,
      type: def.type,
      valueA,
      valueB,
      equal
    });
  }

  const diffCount = fields.filter((f) => !f.equal).length;
  return { presetIdA, presetIdB, presetNameA, presetNameB, fields, diffCount };
}

export function mergePresetDiffs(
  baseSettings: ExportPresetSettings,
  sourceSettings: ExportPresetSettings,
  selectedKeys: string[]
): ExportPresetSettings {
  const merged: Record<string, unknown> = { ...baseSettings };
  const sourceRecord = sourceSettings as Record<string, unknown>;
  for (const key of selectedKeys) {
    if (key in sourceRecord) {
      merged[key] = sourceRecord[key];
    }
  }
  return merged as ExportPresetSettings;
}

export function buildPresetChangeLog(
  oldSettings: ExportPresetSettings,
  newSettings: ExportPresetSettings,
  now?: () => Date
): ExportPresetChangeLogEntry[] {
  const entries: ExportPresetChangeLogEntry[] = [];
  const timestamp = (now ?? (() => new Date()))().toISOString();
  const oldRecord = oldSettings as Record<string, unknown>;
  const newRecord = newSettings as Record<string, unknown>;

  const allKeys = new Set([...Object.keys(oldRecord), ...Object.keys(newRecord)]);
  for (const key of allKeys) {
    const oldVal = oldRecord[key];
    const newVal = newRecord[key];
    if (!valuesEqual(oldVal, newVal)) {
      entries.push({ timestamp, field: key, oldValue: oldVal, newValue: newVal });
    }
  }
  return entries;
}

export function serializePresetChangeLog(entries: ExportPresetChangeLogEntry[]): string {
  return JSON.stringify({ version: 1, entries }, null, 2) + '\n';
}

export function parsePresetChangeLog(contents: string): ExportPresetChangeLogEntry[] {
  try {
    const parsed = JSON.parse(contents);
    if (parsed && parsed.version === 1 && Array.isArray(parsed.entries)) {
      return parsed.entries.filter((e: unknown) => e && typeof (e as ExportPresetChangeLogEntry).field === 'string');
    }
    return [];
  } catch {
    return [];
  }
}

export function buildPresetInheritance(
  existingInheritances: Map<string, ExportPresetInheritance>,
  parentId: string,
  childId: string
): Map<string, ExportPresetInheritance> {
  const next = new Map(existingInheritances);
  const parentEntry = next.get(parentId) ?? { childPresetIds: [] };
  if (!parentEntry.childPresetIds.includes(childId)) {
    next.set(parentId, { ...parentEntry, childPresetIds: [...parentEntry.childPresetIds, childId] });
  }
  const childEntry = next.get(childId) ?? { childPresetIds: [] };
  next.set(childId, { ...childEntry, parentPresetId: parentId });
  return next;
}

export function getChildPresetIds(
  inheritances: Map<string, ExportPresetInheritance>,
  parentId: string
): string[] {
  return inheritances.get(parentId)?.childPresetIds ?? [];
}

function valuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return stableStringify(a) === stableStringify(b);
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}
