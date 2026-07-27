/**
 * 标准 FFmpeg xfade 转场参数生成。
 * @module transitions/xfade-params
 */
import { formatFfmpegSeconds } from '../ffmpeg-escape';
import { getTransitionDefinition, isCustomTransition } from './transition-registry';
/**
 * 为标准 xfade 转场生成 FFmpeg 滤镜参数。
 * 仅处理直接映射到 FFmpeg xfade 的转场类型。
 * 自定义转场请使用 custom-filters.ts。
 */
export function buildXfadeParams(options) {
    const { type, duration, offset, label } = options;
    if (isCustomTransition(type)) {
        return null;
    }
    const def = getTransitionDefinition(type);
    if (!def?.xfadeName) {
        return null;
    }
    const durationArg = formatFfmpegSeconds(duration);
    const offsetArg = formatFfmpegSeconds(offset);
    const fromLabel = `${label}_from`;
    const toLabel = `${label}_to`;
    const outputLabel = `${label}_raw`;
    const filter = `[${fromLabel}][${toLabel}]xfade=transition=${def.xfadeName}:duration=${durationArg}:offset=${offsetArg}[${outputLabel}]`;
    return {
        filters: [filter],
        outputLabel,
    };
}
/**
 * 获取转场类型的 FFmpeg xfade 名称。
 * 对于自定义转场返回 null。
 */
export function getXfadeName(type) {
    const def = getTransitionDefinition(type);
    return def?.xfadeName ?? null;
}
//# sourceMappingURL=xfade-params.js.map