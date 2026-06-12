export const TIMELINE_MIN_HEIGHT_PX = 120;
export const TIMELINE_DEFAULT_HEIGHT_PX = 260;
export const TIMELINE_MAX_VIEWPORT_RATIO = 0.6;
export const INSPECTOR_AUTO_COLLAPSE_WIDTH_PX = 1200;

export interface EditorLayoutSettings {
  timelineHeightPx: number;
  leftPanelCollapsed: boolean;
  rightPanelCollapsed: boolean;
}

export interface EffectivePanelState {
  leftPanelCollapsed: boolean;
  rightPanelCollapsed: boolean;
  rightPanelAutoCollapsed: boolean;
}

export const DEFAULT_EDITOR_LAYOUT_SETTINGS: EditorLayoutSettings = {
  timelineHeightPx: TIMELINE_DEFAULT_HEIGHT_PX,
  leftPanelCollapsed: false,
  rightPanelCollapsed: false
};

export function clampTimelineHeight(heightPx: number, viewportHeightPx: number): number {
  const maxHeight = Math.max(TIMELINE_MIN_HEIGHT_PX, Math.floor(viewportHeightPx * TIMELINE_MAX_VIEWPORT_RATIO));
  const height = Number.isFinite(heightPx) ? heightPx : TIMELINE_DEFAULT_HEIGHT_PX;
  return Math.min(maxHeight, Math.max(TIMELINE_MIN_HEIGHT_PX, Math.round(height)));
}

export function normalizeStoredLayoutSettings(input: unknown): EditorLayoutSettings | undefined {
  if (!input || typeof input !== 'object') {
    return undefined;
  }
  const value = input as Partial<Record<keyof EditorLayoutSettings, unknown>>;
  return {
    timelineHeightPx: normalizeStoredTimelineHeight(value.timelineHeightPx),
    leftPanelCollapsed: value.leftPanelCollapsed === true,
    rightPanelCollapsed: value.rightPanelCollapsed === true
  };
}

export function getEffectivePanelState(settings: EditorLayoutSettings, viewportWidthPx: number): EffectivePanelState {
  const rightPanelAutoCollapsed = viewportWidthPx > 0 && viewportWidthPx < INSPECTOR_AUTO_COLLAPSE_WIDTH_PX;
  return {
    leftPanelCollapsed: settings.leftPanelCollapsed,
    rightPanelCollapsed: settings.rightPanelCollapsed || rightPanelAutoCollapsed,
    rightPanelAutoCollapsed
  };
}

function normalizeStoredTimelineHeight(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return TIMELINE_DEFAULT_HEIGHT_PX;
  }
  return Math.max(TIMELINE_MIN_HEIGHT_PX, Math.round(value));
}
