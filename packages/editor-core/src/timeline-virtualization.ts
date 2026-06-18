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

export interface TimelineVirtualTrackWindowInput {
  scrollTop: number;
  viewportHeight: number;
  rowHeight: number;
  trackCount: number;
  overscanRows?: number;
}

export interface TimelineVirtualTrackWindow {
  startIndex: number;
  endIndex: number;
  beforeHeight: number;
  afterHeight: number;
  totalHeight: number;
  renderedCount: number;
}

export interface TimelineLazyAssetInput {
  clipStart: number;
  clipDuration: number;
  zoom: number;
  scrollLeft: number;
  viewportWidth: number;
  labelWidth?: number;
  preloadPx?: number;
}

export interface TimelineLargeProjectModeInput {
  clipCount: number;
  threshold?: number;
}

export interface TimelineLargeProjectMode {
  enabled: boolean;
  disableAnimations: boolean;
  virtualOverscanScreens: number;
  waveformResolutionScale: number;
  previewFrameStep: number;
  minimapClipLimit: number | undefined;
}

export interface TimelineIncrementalRenderPlan {
  changedClipIds: string[];
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

export function getTimelineVirtualTrackWindow(input: TimelineVirtualTrackWindowInput): TimelineVirtualTrackWindow {
  const rowHeight = Math.max(1, input.rowHeight);
  const trackCount = Math.max(0, Math.floor(input.trackCount));
  const viewportHeight = Math.max(1, input.viewportHeight);
  const scrollTop = Math.max(0, input.scrollTop);
  const overscanRows = Math.max(0, Math.floor(input.overscanRows ?? 2));
  const visibleStart = Math.floor(scrollTop / rowHeight);
  const visibleEnd = Math.ceil((scrollTop + viewportHeight) / rowHeight);
  const startIndex = Math.max(0, visibleStart - overscanRows);
  const endIndex = Math.min(trackCount, visibleEnd + overscanRows);
  const renderedCount = Math.max(0, endIndex - startIndex);
  const totalHeight = trackCount * rowHeight;
  return {
    startIndex,
    endIndex,
    beforeHeight: startIndex * rowHeight,
    afterHeight: Math.max(0, totalHeight - endIndex * rowHeight),
    totalHeight,
    renderedCount
  };
}

export function filterTimelineVirtualTracks<TTrack>(tracks: TTrack[], window: TimelineVirtualTrackWindow): TTrack[] {
  return tracks.slice(window.startIndex, window.endIndex);
}

export function shouldLoadTimelineClipAssets(input: TimelineLazyAssetInput): boolean {
  const zoom = Math.max(0.001, input.zoom);
  const labelWidth = Math.max(0, input.labelWidth ?? 0);
  const preloadPx = Math.max(0, input.preloadPx ?? 100);
  const viewportStartPx = Math.max(0, input.scrollLeft - labelWidth);
  const viewportEndPx = viewportStartPx + Math.max(1, input.viewportWidth);
  const clipStartPx = Math.max(0, input.clipStart * zoom);
  const clipEndPx = Math.max(clipStartPx, (input.clipStart + Math.max(0, input.clipDuration)) * zoom);
  return clipStartPx <= viewportEndPx + preloadPx && clipEndPx >= viewportStartPx - preloadPx;
}

export function getTimelineLargeProjectMode(input: TimelineLargeProjectModeInput): TimelineLargeProjectMode {
  const threshold = Math.max(1, Math.floor(input.threshold ?? 200));
  const enabled = Math.max(0, input.clipCount) > threshold;
  return {
    enabled,
    disableAnimations: enabled,
    virtualOverscanScreens: enabled ? 0.5 : 2,
    waveformResolutionScale: enabled ? 0.5 : 1,
    previewFrameStep: enabled ? 2 : 1,
    minimapClipLimit: enabled ? 160 : undefined
  };
}

export function getTimelineIncrementalRenderPlan<TClip extends { id: string }>(previousClips: TClip[], nextClips: TClip[]): TimelineIncrementalRenderPlan {
  const previousById = new Map(previousClips.map((clip) => [clip.id, clip]));
  const changedClipIds: string[] = [];
  for (const clip of nextClips) {
    if (previousById.get(clip.id) !== clip) {
      changedClipIds.push(clip.id);
    }
  }
  return { changedClipIds };
}
