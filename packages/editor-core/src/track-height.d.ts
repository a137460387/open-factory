/**
 * 轨道高度独立调节模块
 * 允许每条轨道单独设置显示高度
 */
export declare const MIN_TRACK_HEIGHT = 24;
export declare const MAX_TRACK_HEIGHT = 200;
export declare const DEFAULT_TRACK_HEIGHT = 48;
export declare const WAVEFORM_HIDE_THRESHOLD = 32;
/**
 * 将高度值限制在合法范围内
 */
export declare function clampTrackHeight(height: number): number;
/**
 * 获取轨道的有效显示高度
 * 未设置 displayHeight 时返回默认值
 */
export declare function getEffectiveTrackHeight(displayHeight?: number | null): number;
/**
 * 判断在给定轨道高度下是否应显示波形/缩略图
 */
export declare function shouldShowWaveform(height: number): boolean;
//# sourceMappingURL=track-height.d.ts.map