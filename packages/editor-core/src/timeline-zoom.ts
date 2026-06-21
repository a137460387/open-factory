import type { ZoomEditMode } from './model-types';

export const BASE_TIMELINE_ZOOM = 80;
export const MIN_TIMELINE_ZOOM = BASE_TIMELINE_ZOOM * 0.1;
export const MAX_TIMELINE_ZOOM = BASE_TIMELINE_ZOOM * 20;
export const DEFAULT_TIMELINE_ZOOM_STEP = 1.2;

/** 各编辑模式的默认缩放偏好 */
export const ZOOM_MODE_DEFAULTS: Record<ZoomEditMode, number> = {
  editing: BASE_TIMELINE_ZOOM * 3,
  browsing: BASE_TIMELINE_ZOOM * 0.8,
  audio: BASE_TIMELINE_ZOOM * 1.5,
};

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

export function clampTimelineZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) {
    return BASE_TIMELINE_ZOOM;
  }
  return Math.min(MAX_TIMELINE_ZOOM, Math.max(MIN_TIMELINE_ZOOM, zoom));
}

export function zoomTimelineByWheel(currentZoom: number, deltaY: number, step = DEFAULT_TIMELINE_ZOOM_STEP): number {
  const safeStep = Math.max(1.01, step || DEFAULT_TIMELINE_ZOOM_STEP);
  if (deltaY < 0) {
    return clampTimelineZoom(currentZoom * safeStep);
  }
  if (deltaY > 0) {
    return clampTimelineZoom(currentZoom / safeStep);
  }
  return clampTimelineZoom(currentZoom);
}

export function calculateAnchoredScrollLeft(input: AnchoredZoomInput): number {
  const oldZoom = clampTimelineZoom(input.oldZoom);
  const newZoom = clampTimelineZoom(input.newZoom);
  const anchorTimelineX = Math.max(0, input.scrollLeft + input.anchorViewportX - input.labelWidth);
  const anchorTime = anchorTimelineX / oldZoom;
  return Math.max(0, input.labelWidth + anchorTime * newZoom - input.anchorViewportX);
}

export function ensurePlayheadVisible(input: PlayheadVisibilityInput): number {
  const padding = input.paddingPx ?? 40;
  const playheadX = input.labelWidth + input.playheadTime * input.zoom;
  const left = input.scrollLeft + input.labelWidth + padding;
  const right = input.scrollLeft + input.viewportWidth - padding;
  if (playheadX < left) {
    return Math.max(0, playheadX - input.labelWidth - padding);
  }
  if (playheadX > right) {
    return Math.max(0, playheadX - input.viewportWidth + padding);
  }
  return Math.max(0, input.scrollLeft);
}

export function fitTimelineZoomToWindow(duration: number, viewportWidth: number, labelWidth: number): number {
  const visibleWidth = Math.max(1, viewportWidth - labelWidth);
  return clampTimelineZoom(visibleWidth / Math.max(1, duration));
}
export const LONG_PRESS_PAN_THRESHOLD_MS = 300;

export function zoomTimelineByGesture(currentZoom: number, gestureScale: number): number {
  if (!Number.isFinite(gestureScale) || gestureScale <= 0) {
    return clampTimelineZoom(currentZoom);
  }
  return clampTimelineZoom(currentZoom * gestureScale);
}

/**
 * 构建缩放记忆的上下文 key。
 * 格式: "{sequenceId}:{editMode}"
 * 每个序列/复合剪辑独立记忆自己的缩放偏好。
 */
export function buildZoomContextKey(sequenceId: string, editMode: ZoomEditMode): string {
  return `${sequenceId}:${editMode}`;
}

/**
 * 从 zoomMemory 记忆中恢复指定上下文的缩放级别。
 * 优先级：记忆值 > 模式默认值 > BASE_TIMELINE_ZOOM
 */
export function resolveZoomForContext(
  zoomMemory: Record<string, number> | undefined,
  sequenceId: string,
  editMode: ZoomEditMode
): number {
  const key = buildZoomContextKey(sequenceId, editMode);
  if (zoomMemory && typeof zoomMemory[key] === 'number' && Number.isFinite(zoomMemory[key])) {
    return clampTimelineZoom(zoomMemory[key]);
  }
  return clampTimelineZoom(ZOOM_MODE_DEFAULTS[editMode]);
}

/**
 * 保存一条缩放记忆条目，返回新的 zoomMemory 记录。
 */
export function saveZoomMemoryEntry(
  zoomMemory: Record<string, number> | undefined,
  sequenceId: string,
  editMode: ZoomEditMode,
  zoomLevel: number
): Record<string, number> {
  const key = buildZoomContextKey(sequenceId, editMode);
  return { ...(zoomMemory ?? {}), [key]: clampTimelineZoom(zoomLevel) };
}

/**
 * 根据当前 UI 状态推断应使用的缩放编辑模式。
 * - 有选中关键帧或正在编辑属性面板 => 'editing'
 * - 当前序列的轨道包含音频片段且选中音频clip => 'audio'
 * - 其他 => 'browsing'
 */
export function detectZoomEditMode(context: {
  hasSelectedKeyframe?: boolean;
  isInspectorKeyframeOpen?: boolean;
  selectedClipType?: string;
  activeTrackTypes?: string[];
}): ZoomEditMode {
  if (context.hasSelectedKeyframe || context.isInspectorKeyframeOpen) {
    return 'editing';
  }
  if (context.selectedClipType === 'audio') {
    return 'audio';
  }
  return 'browsing';
}

/**
 * 清理 zoomMemory 中不属于当前项目序列的孤立条目。
 */
export function pruneZoomMemory(
  zoomMemory: Record<string, number> | undefined,
  validSequenceIds: string[]
): Record<string, number> | undefined {
  if (!zoomMemory) {
    return undefined;
  }
  const validSet = new Set(validSequenceIds);
  const result: Record<string, number> = {};
  let hasEntries = false;
  for (const [key, value] of Object.entries(zoomMemory)) {
    const seqId = key.split(':')[0];
    if (validSet.has(seqId)) {
      result[key] = value;
      hasEntries = true;
    }
  }
  return hasEntries ? result : undefined;
}
