import { type ClipPrivacyRedaction, type PrivacyRedactionType, type RedactionKeyframe } from './model';
export interface PrivacyDetectionRegion {
    type: PrivacyRedactionType;
    box: {
        x: number;
        y: number;
        w: number;
        h: number;
    };
}
export interface PrivacyDetectionFrame {
    time: number;
    regions: PrivacyDetectionRegion[];
}
export interface PrivacyDetectionResponse {
    frames: PrivacyDetectionFrame[];
}
export interface MatchedRegion {
    type: PrivacyRedactionType;
    trackId: number;
    frames: Array<{
        time: number;
        x: number;
        y: number;
        w: number;
        h: number;
    }>;
}
export declare function computeIOU(a: {
    x: number;
    y: number;
    w: number;
    h: number;
}, b: {
    x: number;
    y: number;
    w: number;
    h: number;
}): number;
export declare function matchRegionsAcrossFrames(frames: PrivacyDetectionFrame[]): MatchedRegion[];
export declare function smoothRedactionKeyframes(keyframes: RedactionKeyframe[], windowSize?: number): RedactionKeyframe[];
export declare function buildRedactionsFromDetection(response: PrivacyDetectionResponse, idPrefix?: string): ClipPrivacyRedaction[];
export declare function parsePrivacyDetectionResponse(json: unknown): PrivacyDetectionResponse;
export declare function buildPrivacyRedactionFFmpegExpressions(redactions: ClipPrivacyRedaction[], videoWidth: number, videoHeight: number, filterType?: 'delogo' | 'boxblur'): string[];
export declare function normalizePrivacyRedaction(input: Partial<ClipPrivacyRedaction>): ClipPrivacyRedaction;
export declare function normalizeRedactionKeyframes(kfs: unknown): RedactionKeyframe[];
//# sourceMappingURL=privacy-redaction.d.ts.map