/**
 * 轨道高度独立调节模块
 * 允许每条轨道单独设置显示高度
 */
export const MIN_TRACK_HEIGHT = 24;
export const MAX_TRACK_HEIGHT = 200;
export const DEFAULT_TRACK_HEIGHT = 48;
export const WAVEFORM_HIDE_THRESHOLD = 32;
/**
 * 将高度值限制在合法范围内
 */
export function clampTrackHeight(height) {
    return Math.min(MAX_TRACK_HEIGHT, Math.max(MIN_TRACK_HEIGHT, Math.round(height)));
}
/**
 * 获取轨道的有效显示高度
 * 未设置 displayHeight 时返回默认值
 */
export function getEffectiveTrackHeight(displayHeight) {
    if (displayHeight == null || !Number.isFinite(displayHeight)) {
        return DEFAULT_TRACK_HEIGHT;
    }
    return clampTrackHeight(displayHeight);
}
/**
 * 判断在给定轨道高度下是否应显示波形/缩略图
 */
export function shouldShowWaveform(height) {
    return height >= WAVEFORM_HIDE_THRESHOLD;
}
//# sourceMappingURL=track-height.js.map