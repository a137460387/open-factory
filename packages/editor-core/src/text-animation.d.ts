import { type ClipKeyframes, type Transform } from './model';
export declare const TEXT_ANIMATION_PRESETS: readonly ["fade", "fly-up", "slide-left", "typewriter", "bounce", "scale"];
export type TextAnimationPreset = (typeof TEXT_ANIMATION_PRESETS)[number];
export declare const TEXT_ANIMATION_DIRECTIONS: readonly ["in", "out", "both"];
export type TextAnimationDirection = (typeof TEXT_ANIMATION_DIRECTIONS)[number];
export interface TextAnimationInput {
    preset: TextAnimationPreset;
    direction: TextAnimationDirection;
    duration: number;
    clipDuration: number;
    transform: Partial<Transform>;
    text?: string;
}
export declare function normalizeTextAnimationDuration(duration: number): number;
export declare function normalizeTextAnimationPreset(preset: unknown): TextAnimationPreset;
export declare function normalizeTextAnimationDirection(direction: unknown): TextAnimationDirection;
export declare function buildTextAnimationKeyframes(input: TextAnimationInput): ClipKeyframes;
export declare function mergeTextAnimationKeyframes(existing: ClipKeyframes | undefined, generated: ClipKeyframes, clipDuration: number): ClipKeyframes | undefined;
//# sourceMappingURL=text-animation.d.ts.map