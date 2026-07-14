import type { SelectionRect } from './timeline-selection';

export interface TimelineFeedbackSettings {
  reduceMotion: boolean;
}

export interface PointerPoint {
  x: number;
  y: number;
}

export interface SelectionMarqueeBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface TimelineSnapHighlight {
  time: number;
  expiresAtMs: number;
}

export const DEFAULT_TIMELINE_FEEDBACK_SETTINGS: TimelineFeedbackSettings = {
  reduceMotion: false,
};

export function normalizeTimelineFeedbackSettings(
  settings: Partial<TimelineFeedbackSettings> | undefined,
): TimelineFeedbackSettings {
  return {
    reduceMotion: settings?.reduceMotion === true,
  };
}

export function shouldAnimateTimelineFeedback(settings: Partial<TimelineFeedbackSettings> | undefined): boolean {
  return !normalizeTimelineFeedbackSettings(settings).reduceMotion;
}

export function formatTrimDurationBubble(deltaSeconds: number, precision = 1): string {
  const safePrecision = Math.min(3, Math.max(0, Math.round(precision)));
  const normalizedDelta = Number.isFinite(deltaSeconds) ? deltaSeconds : 0;
  const rounded = Number(normalizedDelta.toFixed(safePrecision));
  const sign = rounded >= 0 ? '+' : '-';
  return `${sign}${Math.abs(rounded).toFixed(safePrecision)}s`;
}

export function buildTrimDurationBubble(originalDuration: number, previewDuration: number, precision = 1): string {
  const original = Number.isFinite(originalDuration) ? originalDuration : 0;
  const preview = Number.isFinite(previewDuration) ? previewDuration : original;
  return formatTrimDurationBubble(preview - original, precision);
}

export function createSnapHighlight(time: number, nowMs: number, durationMs = 200): TimelineSnapHighlight | undefined {
  if (!Number.isFinite(time) || time < 0 || !Number.isFinite(nowMs)) {
    return undefined;
  }
  return {
    time,
    expiresAtMs: nowMs + Math.max(0, durationMs),
  };
}

export function isSnapHighlightActive(highlight: TimelineSnapHighlight | undefined, nowMs: number): boolean {
  return Boolean(highlight && Number.isFinite(nowMs) && nowMs <= highlight.expiresAtMs);
}

export function buildSelectionMarqueeRect(start: PointerPoint, current: PointerPoint): SelectionRect {
  return {
    left: start.x,
    top: start.y,
    right: current.x,
    bottom: current.y,
  };
}

export function getSelectionMarqueeBox(rect: SelectionRect): SelectionMarqueeBox {
  return {
    left: Math.min(rect.left, rect.right),
    top: Math.min(rect.top, rect.bottom),
    width: Math.abs(rect.right - rect.left),
    height: Math.abs(rect.bottom - rect.top),
  };
}
