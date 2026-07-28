import type { ClipAILookMatch, WheelAdjustments } from './model-types';
import type { ColorCurves, ThreeWayColor } from './color-grading';
export interface AILookMatchResponse {
    warmth: number;
    contrast: number;
    saturation: number;
    shadowsTint: {
        r: number;
        g: number;
        b: number;
    };
    highlightsTint: {
        r: number;
        g: number;
        b: number;
    };
    reason: string;
}
export declare function parseAILookMatchResponse(json: unknown): AILookMatchResponse | null;
export declare function mapLookMatchToWheelAdjustments(response: AILookMatchResponse): WheelAdjustments;
export declare function mapLookMatchToCurveControlPoints(response: AILookMatchResponse): ColorCurves;
export declare function buildAILookMatch(response: AILookMatchResponse, sourceImageHash: string, confidence?: number): ClipAILookMatch;
export declare function blendWheelAdjustments(original: Partial<ThreeWayColor>, adjustments: WheelAdjustments, blendStrength: number): ThreeWayColor;
export declare function blendCurveControlPoints(original: Partial<ColorCurves>, target: ColorCurves, blendStrength: number): ColorCurves;
//# sourceMappingURL=ai-look-match.d.ts.map