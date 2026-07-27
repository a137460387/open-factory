import type { ClipKeyframes, PathPoint, TextPathOptions } from './model';
export interface TextPathSample {
    x: number;
    y: number;
    distance: number;
    angle: number;
}
export interface TextPathCharacterLayout {
    char: string;
    index: number;
    x: number;
    y: number;
    angle: number;
    distance: number;
}
export interface TextPathLayoutInput {
    text: string;
    path: PathPoint[] | undefined;
    width: number;
    height: number;
    fontSize: number;
    startOffset: number;
    letterSpacing: number;
    rotateCharacters: boolean;
    offsetX?: number;
    offsetY?: number;
    measureCharacter?: (char: string, index: number) => number;
}
export interface PathTextFrameLayoutInput extends Omit<TextPathLayoutInput, 'startOffset'> {
    duration: number;
    fps: number;
    keyframes?: ClipKeyframes | null;
    pathText: TextPathOptions;
}
export interface PathTextFrameLayout {
    time: number;
    chars: TextPathCharacterLayout[];
}
export declare function sampleTextPath(points: PathPoint[] | undefined, width?: number, height?: number, segmentsPerCurve?: number): TextPathSample[];
export declare function getTextPathLength(points: PathPoint[] | undefined, width?: number, height?: number): number;
export declare function layoutTextAlongPath(input: TextPathLayoutInput): TextPathCharacterLayout[];
export declare function buildPathTextFrameLayouts(input: PathTextFrameLayoutInput): PathTextFrameLayout[];
export declare function resolvePathTextStartOffset(pathText: TextPathOptions, keyframes: ClipKeyframes | null | undefined, localTime: number): number;
//# sourceMappingURL=text-path.d.ts.map