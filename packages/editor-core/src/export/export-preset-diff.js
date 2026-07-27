const DIFF_FIELD_DEFINITIONS = [
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
    { key: 'audioVisualization', label: '音频可视化', type: 'audioVisualization' },
];
export function extractPresetDiffFields(settingsA, settingsB, presetIdA, presetIdB, presetNameA, presetNameB) {
    const fields = [];
    const recordA = settingsA;
    const recordB = settingsB;
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
            equal,
        });
    }
    const diffCount = fields.filter((f) => !f.equal).length;
    return { presetIdA, presetIdB, presetNameA, presetNameB, fields, diffCount };
}
export function mergePresetDiffs(baseSettings, sourceSettings, selectedKeys) {
    const merged = { ...baseSettings };
    const sourceRecord = sourceSettings;
    for (const key of selectedKeys) {
        if (key in sourceRecord) {
            merged[key] = sourceRecord[key];
        }
    }
    return merged;
}
export function buildPresetChangeLog(oldSettings, newSettings, now) {
    const entries = [];
    const timestamp = (now ?? (() => new Date()))().toISOString();
    const oldRecord = oldSettings;
    const newRecord = newSettings;
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
export function serializePresetChangeLog(entries) {
    return JSON.stringify({ version: 1, entries }, null, 2) + '\n';
}
export function parsePresetChangeLog(contents) {
    try {
        const parsed = JSON.parse(contents);
        if (parsed && parsed.version === 1 && Array.isArray(parsed.entries)) {
            return parsed.entries.filter((e) => e && typeof e.field === 'string');
        }
        return [];
    }
    catch {
        return [];
    }
}
export function buildPresetInheritance(existingInheritances, parentId, childId) {
    const next = new Map(existingInheritances);
    const parentEntry = next.get(parentId) ?? { childPresetIds: [] };
    if (!parentEntry.childPresetIds.includes(childId)) {
        next.set(parentId, { ...parentEntry, childPresetIds: [...parentEntry.childPresetIds, childId] });
    }
    const childEntry = next.get(childId) ?? { childPresetIds: [] };
    next.set(childId, { ...childEntry, parentPresetId: parentId });
    return next;
}
export function getChildPresetIds(inheritances, parentId) {
    return inheritances.get(parentId)?.childPresetIds ?? [];
}
function valuesEqual(a, b) {
    if (a === b)
        return true;
    if (a == null && b == null)
        return true;
    if (a == null || b == null)
        return false;
    return stableStringify(a) === stableStringify(b);
}
function stableStringify(value) {
    if (Array.isArray(value)) {
        return `[${value.map(stableStringify).join(',')}]`;
    }
    if (value && typeof value === 'object') {
        return `{${Object.entries(value)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`)
            .join(',')}}`;
    }
    return JSON.stringify(value);
}
//# sourceMappingURL=export-preset-diff.js.map