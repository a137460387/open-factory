import { type Clip, type ClipKeyframes, type Keyframe, type KeyframeEasing, type KeyframeHandle, type KeyframeHandleMode, type KeyframeProperty, type Transform } from './model';
/** Min/max limits for each keyframe property. */
export declare const KEYFRAME_PROPERTY_LIMITS: Record<KeyframeProperty, {
    min: number;
    max: number;
}>;
export interface KeyframeInput {
    id?: string;
    time: number;
    value: number;
    easing?: KeyframeEasing;
    inHandle?: KeyframeHandle;
    outHandle?: KeyframeHandle;
    handleMode?: KeyframeHandleMode;
}
export interface KeyframeHandlePoint extends KeyframeHandle {
    time: number;
    value: number;
}
export interface KeyframeBezierHandleCoordinates {
    inHandle?: KeyframeHandlePoint;
    outHandle?: KeyframeHandlePoint;
    mode: KeyframeHandleMode;
}
export interface KeyframeSpeedSample {
    time: number;
    value: number;
}
export interface KeyframeExpressionContext {
    prev?: number;
    current?: number;
    next?: number;
    min?: number;
    max?: number;
}
export declare function interpolateKeyframes(keyframes: Keyframe<number>[] | undefined, time: number, fallback: number): number;
export declare function applyEasing(progress: number, easing: KeyframeEasing): number;
export declare function normalizeClipKeyframes(keyframes: ClipKeyframes | undefined, duration: number): ClipKeyframes | undefined;
export declare function normalizeKeyframes(keyframes: Keyframe<number>[] | undefined, duration: number, fallback: number, property?: KeyframeProperty): Keyframe<number>[];
export declare function normalizeEasing(easing: unknown): KeyframeEasing;
export declare function getClipKeyframeValue(clip: Clip, property: KeyframeProperty, localTime: number): number;
export declare function getClipStaticKeyframeValue(clip: Clip, property: KeyframeProperty): number;
export declare function resolveAnimatedTransform(clip: Clip, localTime: number): Transform;
export declare function resolveAnimatedVolume(clip: Clip, localTime: number): number;
export declare function applyClipKeyframes<TClip extends Clip>(clip: TClip, localTime: number): TClip;
export declare function createKeyframe(property: KeyframeProperty, input: KeyframeInput, clipDuration: number): Keyframe<number>;
export declare function setKeyframeForProperty(keyframes: ClipKeyframes | undefined, property: KeyframeProperty, keyframe: Keyframe<number>, clipDuration: number): ClipKeyframes;
export declare function removeKeyframeForProperty(keyframes: ClipKeyframes | undefined, property: KeyframeProperty, keyframeId: string): ClipKeyframes | undefined;
export declare function cloneClipKeyframes(keyframes: ClipKeyframes | undefined): ClipKeyframes | undefined;
export declare function cloneKeyframe<T>(frame: Keyframe<T>): Keyframe<T>;
export declare function normalizeKeyframeHandle(handle: KeyframeHandle | undefined): KeyframeHandle | undefined;
export declare function normalizeKeyframeHandleMode(mode: unknown): KeyframeHandleMode | undefined;
export declare function calculateBezierHandleCoordinates(frame: Keyframe<number>, previous?: Keyframe<number>, next?: Keyframe<number>, mode?: KeyframeHandleMode): KeyframeBezierHandleCoordinates;
export declare function applyKeyframeHandlePatch(frame: Keyframe<number>, handle: 'in' | 'out', value: KeyframeHandle, mode?: KeyframeHandleMode): Keyframe<number>;
export declare function calculateKeyframeSpeedSamples(frames: Keyframe<number>[] | undefined, duration: number, fallback: number, sampleCount?: number): KeyframeSpeedSample[];
export declare function applyBatchKeyframeEasing(frames: Keyframe<number>[], easing: KeyframeEasing): Keyframe<number>[];
export declare function distributeKeyframeTimes(frames: Keyframe<number>[], start?: number, end?: number): Keyframe<number>[];
export declare function alignKeyframeValues(frames: Keyframe<number>[], value?: number): Keyframe<number>[];
export declare function parseKeyframeExpression(expression: string, context?: KeyframeExpressionContext): number;
/**
 * 将连续进度值转换为离散步进值。
 * 例如 steps=3 时：0→0, 0.33→0.33, 0.34→0.33, 0.66→0.66, 0.67→0.66, 1→1
 */
export declare function applyStepsEasing(progress: number, steps: number): number;
export declare function createKenBurnsKeyframes(duration: number, startScale?: number, endScale?: number): ClipKeyframes;
export declare function setKenBurnsEndScaleKeyframes(keyframes: ClipKeyframes | undefined, duration: number, scale: number): ClipKeyframes;
export interface ClipboardKeyframeGroup {
    sourceClipId: string;
    sourceClipStart: number;
    property: KeyframeProperty;
    keyframes: Keyframe<number>[];
}
export type PasteMode = 'relative' | 'absolute';
export declare function normalizeCrossPropertyValue(value: number, sourceProperty: KeyframeProperty, targetProperty: KeyframeProperty): number;
export declare function normalizePastedKeyframes(groups: ClipboardKeyframeGroup[], targetClipStart: number, targetClipDuration: number, mode: PasteMode, targetProperty?: KeyframeProperty): Array<{
    property: KeyframeProperty;
    keyframes: Keyframe<number>[];
}>;
//# sourceMappingURL=keyframes.d.ts.map