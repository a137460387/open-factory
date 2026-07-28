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
export declare const DEFAULT_TIMELINE_FEEDBACK_SETTINGS: TimelineFeedbackSettings;
export declare function normalizeTimelineFeedbackSettings(settings: Partial<TimelineFeedbackSettings> | undefined): TimelineFeedbackSettings;
export declare function shouldAnimateTimelineFeedback(settings: Partial<TimelineFeedbackSettings> | undefined): boolean;
export declare function formatTrimDurationBubble(deltaSeconds: number, precision?: number): string;
export declare function buildTrimDurationBubble(originalDuration: number, previewDuration: number, precision?: number): string;
export declare function createSnapHighlight(time: number, nowMs: number, durationMs?: number): TimelineSnapHighlight | undefined;
export declare function isSnapHighlightActive(highlight: TimelineSnapHighlight | undefined, nowMs: number): boolean;
export declare function buildSelectionMarqueeRect(start: PointerPoint, current: PointerPoint): SelectionRect;
export declare function getSelectionMarqueeBox(rect: SelectionRect): SelectionMarqueeBox;
//# sourceMappingURL=timeline-feedback.d.ts.map