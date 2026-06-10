export const BASE_TIMELINE_ZOOM = 80;
export const MIN_TIMELINE_ZOOM = BASE_TIMELINE_ZOOM * 0.1;
export const MAX_TIMELINE_ZOOM = BASE_TIMELINE_ZOOM * 20;
export const DEFAULT_TIMELINE_ZOOM_STEP = 1.2;

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
