import type { ExportRange, Timeline, TimelineBookmark, TimelineMarker } from './model-types';
import { getTimelineLabelColorHex } from './timeline-color-labels';

export const TIMELINE_MINIMAP_WIDTH = 120;
export const TIMELINE_MINIMAP_MIN_VIEWPORT_HEIGHT = 12;

export interface TimelineMinimapViewportInput {
  scrollLeft: number;
  viewportWidth: number;
  labelWidth: number;
  zoom: number;
  duration: number;
  minimapHeight: number;
}

export interface TimelineMinimapViewportRect {
  y: number;
  height: number;
  start: number;
  end: number;
}

export interface TimelineMinimapScrollInput {
  y: number;
  viewportWidth: number;
  labelWidth: number;
  zoom: number;
  duration: number;
  minimapHeight: number;
  mode?: 'top' | 'center';
}

export interface TimelineMinimapClipRect {
  id: string;
  trackId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

export interface TimelineMinimapTrackRect {
  id: string;
  x: number;
  width: number;
  color: string;
}

export interface TimelineMinimapMarkerLine {
  id: string;
  y: number;
  color: string;
  kind: 'marker' | 'bookmark' | 'export-range-start' | 'export-range-end';
}

export interface TimelineMinimapLayout {
  tracks: TimelineMinimapTrackRect[];
  clips: TimelineMinimapClipRect[];
  markers: TimelineMinimapMarkerLine[];
}

export function calculateTimelineMinimapViewportRect(input: TimelineMinimapViewportInput): TimelineMinimapViewportRect {
  const duration = sanitizeDuration(input.duration);
  const zoom = sanitizeZoom(input.zoom);
  const viewportDuration = calculateViewportDuration(input.viewportWidth, input.labelWidth, zoom, duration);
  const start = clamp((input.scrollLeft - input.labelWidth) / zoom, 0, Math.max(0, duration - viewportDuration));
  const end = clamp(start + viewportDuration, start, duration);
  const height = Math.max(TIMELINE_MINIMAP_MIN_VIEWPORT_HEIGHT, (viewportDuration / duration) * Math.max(1, input.minimapHeight));
  return {
    y: clamp((start / duration) * Math.max(1, input.minimapHeight), 0, Math.max(0, input.minimapHeight - height)),
    height,
    start,
    end
  };
}

export function calculateTimelineScrollLeftFromMinimapY(input: TimelineMinimapScrollInput): number {
  const duration = sanitizeDuration(input.duration);
  const zoom = sanitizeZoom(input.zoom);
  const viewportDuration = calculateViewportDuration(input.viewportWidth, input.labelWidth, zoom, duration);
  const rawTime = clamp(input.y / Math.max(1, input.minimapHeight), 0, 1) * duration;
  const targetStart = input.mode === 'top' ? rawTime : rawTime - viewportDuration / 2;
  const clampedStart = clamp(targetStart, 0, Math.max(0, duration - viewportDuration));
  return input.labelWidth + clampedStart * zoom;
}

export function buildTimelineMinimapLayout(
  timeline: Timeline,
  options: {
    duration: number;
    width?: number;
    height: number;
    markers?: TimelineMarker[];
    bookmarks?: TimelineBookmark[];
    exportRanges?: Array<Pick<ExportRange, 'id' | 'start' | 'end'>>;
  }
): TimelineMinimapLayout {
  const width = Math.max(1, options.width ?? TIMELINE_MINIMAP_WIDTH);
  const height = Math.max(1, options.height);
  const duration = sanitizeDuration(options.duration);
  const trackCount = Math.max(1, timeline.tracks.length);
  const gutter = 6;
  const laneGap = 3;
  const laneWidth = Math.max(5, (width - gutter * 2 - laneGap * (trackCount - 1)) / trackCount);
  const tracks = timeline.tracks.map((track, index) => ({
    id: track.id,
    x: gutter + index * (laneWidth + laneGap),
    width: laneWidth,
    color: track.color ? getTimelineLabelColorHex(track.color) : '#94a3b8'
  }));
  const trackById = new Map(tracks.map((track) => [track.id, track]));
  const clips = timeline.tracks.flatMap((track) => {
    const lane = trackById.get(track.id);
    if (!lane) {
      return [];
    }
    const color = track.color ? getTimelineLabelColorHex(track.color) : '#64748b';
    return track.clips.map((clip) => ({
      id: clip.id,
      trackId: track.id,
      x: lane.x,
      y: timeToMinimapY(clip.start, duration, height),
      width: lane.width,
      height: Math.max(2, ((Math.max(0, clip.duration) || 0) / duration) * height),
      color
    }));
  });
  const markers: TimelineMinimapMarkerLine[] = [
    ...(options.exportRanges ?? []).flatMap((range) => [
      { id: `${range.id}-start`, y: timeToMinimapY(range.start, duration, height), color: '#0ea5e9', kind: 'export-range-start' as const },
      { id: `${range.id}-end`, y: timeToMinimapY(range.end, duration, height), color: '#0284c7', kind: 'export-range-end' as const }
    ]),
    ...(options.markers ?? []).map((marker) => ({ id: marker.id, y: timeToMinimapY(marker.time, duration, height), color: marker.color || '#f97316', kind: 'marker' as const })),
    ...(options.bookmarks ?? []).map((bookmark) => ({ id: bookmark.id, y: timeToMinimapY(bookmark.time, duration, height), color: '#a855f7', kind: 'bookmark' as const }))
  ];
  return { tracks, clips, markers };
}

function calculateViewportDuration(viewportWidth: number, labelWidth: number, zoom: number, duration: number): number {
  const contentWidth = Math.max(1, viewportWidth - labelWidth);
  return clamp(contentWidth / zoom, 0, duration);
}

function timeToMinimapY(time: number, duration: number, height: number): number {
  return clamp((time / duration) * height, 0, height);
}

function sanitizeDuration(duration: number): number {
  return Number.isFinite(duration) && duration > 0 ? duration : 1;
}

function sanitizeZoom(zoom: number): number {
  return Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
