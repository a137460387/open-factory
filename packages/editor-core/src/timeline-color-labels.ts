import type { Clip, Timeline, TimelineLabelColor, Track } from './model-types';
export type { TimelineLabelColor } from './model-types';

export const TIMELINE_LABEL_COLORS = ['red', 'orange', 'amber', 'yellow', 'lime', 'green', 'teal', 'cyan', 'blue', 'indigo', 'purple', 'pink'] as const;

export const TIMELINE_LABEL_COLOR_HEX: Record<TimelineLabelColor, string> = {
  red: '#ef4444',
  orange: '#f97316',
  amber: '#f59e0b',
  yellow: '#eab308',
  lime: '#84cc16',
  green: '#22c55e',
  teal: '#14b8a6',
  cyan: '#06b6d4',
  blue: '#3b82f6',
  indigo: '#6366f1',
  purple: '#a855f7',
  pink: '#ec4899'
};

export const DEFAULT_TIMELINE_LABEL_COLOR_HEX = '#94a3b8';

export function isTimelineLabelColor(value: unknown): value is TimelineLabelColor {
  return typeof value === 'string' && (TIMELINE_LABEL_COLORS as readonly string[]).includes(value);
}

export function normalizeTimelineLabelColor(value: unknown): TimelineLabelColor | null {
  return isTimelineLabelColor(value) ? value : null;
}

export function getEffectiveClipColorLabel(clip: Pick<Clip, 'colorLabel'>, track: Pick<Track, 'color'> | undefined): TimelineLabelColor | null {
  return normalizeTimelineLabelColor(clip.colorLabel) ?? normalizeTimelineLabelColor(track?.color);
}

export function getTimelineLabelColorHex(color: TimelineLabelColor | null | undefined): string {
  return color ? TIMELINE_LABEL_COLOR_HEX[color] : DEFAULT_TIMELINE_LABEL_COLOR_HEX;
}

export function filterTimelineClipsByColor(timeline: Timeline, color: TimelineLabelColor | null): Clip[] {
  return timeline.tracks.flatMap((track) =>
    track.clips.filter((clip) => {
      if (!color) {
        return true;
      }
      return getEffectiveClipColorLabel(clip, track) === color;
    })
  );
}
