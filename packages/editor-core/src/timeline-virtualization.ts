import { round } from './time';

export interface TimelineVirtualRenderWindowInput {
  scrollLeft: number;
  viewportWidth: number;
  zoom: number;
  labelWidth?: number;
  overscanScreens?: number;
}

export interface TimelineVirtualRenderWindow {
  start: number;
  end: number;
}

export function getTimelineVirtualRenderWindow(input: TimelineVirtualRenderWindowInput): TimelineVirtualRenderWindow {
  const zoom = Math.max(0.001, input.zoom);
  const viewportWidth = Math.max(1, input.viewportWidth);
  const labelWidth = Math.max(0, input.labelWidth ?? 0);
  const overscanScreens = Math.max(0, input.overscanScreens ?? 2);
  const viewportStartPx = Math.max(0, input.scrollLeft - labelWidth);
  const startPx = Math.max(0, viewportStartPx - viewportWidth * overscanScreens);
  const endPx = viewportStartPx + viewportWidth * (1 + overscanScreens);
  return {
    start: round(startPx / zoom),
    end: round(Math.max(endPx, startPx + viewportWidth) / zoom)
  };
}

export function filterTimelineVirtualClips<TClip extends { start: number; duration: number }>(
  clips: TClip[],
  window: TimelineVirtualRenderWindow
): TClip[] {
  return clips.filter((clip) => clip.start < window.end && clip.start + clip.duration > window.start);
}
