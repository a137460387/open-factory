import type { ZoomEditMode } from './model-types';
export declare const BASE_TIMELINE_ZOOM = 80;
export declare const MIN_TIMELINE_ZOOM: number;
export declare const MAX_TIMELINE_ZOOM: number;
export declare const DEFAULT_TIMELINE_ZOOM_STEP = 1.2;
/** 各编辑模式的默认缩放偏好 */
export declare const ZOOM_MODE_DEFAULTS: Record<ZoomEditMode, number>;
export interface AnchoredZoomInput {
    scrollLeft: number;
    anchorViewportX: number;
    oldZoom: number;
    newZoom: number;
    labelWidth: number;
}
export interface PlayheadVisibilityInput {
    scrollLeft: number;
    viewportWidth: number;
    playheadTime: number;
    zoom: number;
    labelWidth: number;
    paddingPx?: number;
}
export declare function clampTimelineZoom(zoom: number): number;
export declare function zoomTimelineByWheel(currentZoom: number, deltaY: number, step?: number): number;
export declare function calculateAnchoredScrollLeft(input: AnchoredZoomInput): number;
export declare function ensurePlayheadVisible(input: PlayheadVisibilityInput): number;
export declare function fitTimelineZoomToWindow(duration: number, viewportWidth: number, labelWidth: number): number;
export declare const LONG_PRESS_PAN_THRESHOLD_MS = 300;
export declare function zoomTimelineByGesture(currentZoom: number, gestureScale: number): number;
/**
 * 构建缩放记忆的上下文 key。
 * 格式: "{sequenceId}:{editMode}"
 * 每个序列/复合剪辑独立记忆自己的缩放偏好。
 */
export declare function buildZoomContextKey(sequenceId: string, editMode: ZoomEditMode): string;
/**
 * 从 zoomMemory 记忆中恢复指定上下文的缩放级别。
 * 优先级：记忆值 > 模式默认值 > BASE_TIMELINE_ZOOM
 */
export declare function resolveZoomForContext(zoomMemory: Record<string, number> | undefined, sequenceId: string, editMode: ZoomEditMode): number;
/**
 * 保存一条缩放记忆条目，返回新的 zoomMemory 记录。
 */
export declare function saveZoomMemoryEntry(zoomMemory: Record<string, number> | undefined, sequenceId: string, editMode: ZoomEditMode, zoomLevel: number): Record<string, number>;
/**
 * 根据当前 UI 状态推断应使用的缩放编辑模式。
 * - 有选中关键帧或正在编辑属性面板 => 'editing'
 * - 当前序列的轨道包含音频片段且选中音频clip => 'audio'
 * - 其他 => 'browsing'
 */
export declare function detectZoomEditMode(context: {
    hasSelectedKeyframe?: boolean;
    isInspectorKeyframeOpen?: boolean;
    selectedClipType?: string;
    activeTrackTypes?: string[];
}): ZoomEditMode;
/**
 * 清理 zoomMemory 中不属于当前项目序列的孤立条目。
 */
export declare function pruneZoomMemory(zoomMemory: Record<string, number> | undefined, validSequenceIds: string[]): Record<string, number> | undefined;
//# sourceMappingURL=timeline-zoom.d.ts.map