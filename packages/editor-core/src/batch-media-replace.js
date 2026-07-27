/**
 * 检查单个 clip 与新媒体资产的兼容性。
 */
export function checkClipCompatibility(clip, oldAsset, newAsset, durationStrategy = 'keep') {
    const issues = [];
    if (!oldAsset) {
        issues.push({
            type: 'missing',
            severity: 'warning',
            message: `原始媒体资产未找到`,
        });
    }
    // 分辨率检查
    if (oldAsset && (oldAsset.width !== newAsset.width || oldAsset.height !== newAsset.height)) {
        issues.push({
            type: 'resolution',
            severity: 'error',
            message: `分辨率不匹配: ${newAsset.width}x${newAsset.height} (原 ${oldAsset.width}x${oldAsset.height})`,
            expected: `${oldAsset.width}x${oldAsset.height}`,
            actual: `${newAsset.width}x${newAsset.height}`,
        });
    }
    // 时长检查
    if (durationStrategy !== 'stretch' && oldAsset) {
        if (newAsset.duration < clip.duration) {
            const severity = durationStrategy === 'trim' ? 'warning' : 'error';
            issues.push({
                type: 'duration',
                severity,
                message: `新媒体时长不足: ${newAsset.duration.toFixed(2)}s < clip ${clip.duration.toFixed(2)}s`,
                expected: `>= ${clip.duration.toFixed(2)}s`,
                actual: `${newAsset.duration.toFixed(2)}s`,
            });
        }
    }
    // 编解码器检查
    if (oldAsset) {
        const oldCodec = oldAsset.videoCodec;
        const newCodec = newAsset.videoCodec;
        if (oldCodec && newCodec && oldCodec !== newCodec) {
            issues.push({
                type: 'codec',
                severity: 'warning',
                message: `编解码器变更: ${newCodec} (原 ${oldCodec})`,
                expected: oldCodec,
                actual: newCodec,
            });
        }
    }
    const severity = summarizeSeverity(issues);
    return { clipId: clip.id, clipName: clip.name, severity, issues };
}
/**
 * 按文件名匹配规则，在新目录中寻找同名文件。
 */
export function matchByFilename(oldAsset, newAssets) {
    const oldBase = stripExtension(oldAsset.name).toLowerCase();
    return newAssets.find((a) => stripExtension(a.name).toLowerCase() === oldBase);
}
function stripExtension(name) {
    const lastDot = name.lastIndexOf('.');
    return lastDot > 0 ? name.slice(0, lastDot) : name;
}
/**
 * 构建批量替换预检报告。
 */
export function buildBatchReplacePrecheckReport(mappings, getOldAsset) {
    const results = mappings.map((mapping) => {
        const oldAsset = getOldAsset(mapping.oldAssetId);
        return checkClipCompatibility({ id: mapping.clipId, name: '', duration: 0 }, oldAsset, mapping.newAsset, mapping.durationStrategy);
    });
    return {
        totalClips: results.length,
        compatibleClips: results.filter((r) => r.severity === 'ok').length,
        warningClips: results.filter((r) => r.severity === 'warning').length,
        errorClips: results.filter((r) => r.severity === 'error').length,
        results,
        canProceed: results.every((r) => r.severity !== 'error'),
    };
}
/**
 * 检测替换后关键帧/特效因新媒体属性差异而失效的情况。
 */
export function detectPostReplaceWarnings(clip, newAsset) {
    const warnings = [];
    if (!clip.keyframes)
        return warnings;
    const maxTime = newAsset.duration;
    const props = [
        'opacity',
        'volume',
        'x',
        'y',
        'scaleX',
        'scaleY',
        'speed',
        'yaw',
        'pitch',
        'roll',
        'spatialX',
        'spatialY',
        'spatialAzimuth',
        'spatialElevation',
        'spatialDistanceMeters',
        'pathStartOffset',
    ];
    for (const prop of props) {
        const kfs = clip.keyframes[prop];
        if (!kfs || kfs.length === 0)
            continue;
        const outOfRange = kfs.filter((kf) => kf.time > maxTime);
        if (outOfRange.length > 0) {
            warnings.push({
                clipId: clip.id,
                clipName: clip.name,
                warningType: 'keyframe-out-of-range',
                message: `关键帧属性 "${prop}" 有 ${outOfRange.length} 个超出新媒体时长 (${maxTime.toFixed(2)}s)`,
                detail: outOfRange.map((kf) => `${prop}@${kf.time.toFixed(2)}s`).join(', '),
            });
        }
    }
    return warnings;
}
function summarizeSeverity(issues) {
    if (issues.some((i) => i.severity === 'error'))
        return 'error';
    if (issues.some((i) => i.severity === 'warning'))
        return 'warning';
    return 'ok';
}
//# sourceMappingURL=batch-media-replace.js.map