export declare const TOUCH_LONG_PRESS_MS = 500;
export declare const TOUCH_DOUBLE_TAP_MS = 300;
export declare const TOUCH_GESTURE_DISCRIMINATION_THRESHOLD_PX = 10;
export declare const TOUCH_TRIM_HANDLE_SCALE = 1.6;
export declare const TOUCH_UI_SPACING_MULTIPLIER = 1.3;
export type InputDeviceType = 'touch' | 'mouse' | 'pen' | 'unknown';
export type TouchGestureType = 'pinch-zoom' | 'single-pan' | 'long-press' | 'double-tap' | 'unknown';
export interface TouchPoint {
    id: number;
    x: number;
    y: number;
    timestamp: number;
}
export interface TouchGestureState {
    type: TouchGestureType;
    startPointCount: number;
    currentPointCount: number;
    startTime: number;
    elapsedMs: number;
    scale?: number;
    deltaX?: number;
    deltaY?: number;
}
export interface TouchOptimizationSettings {
    enabled: boolean;
    autoDetect: boolean;
    trimHandleScale: number;
    uiSpacingMultiplier: number;
    longPressMs: number;
    doubleTapMs: number;
}
export declare const DEFAULT_TOUCH_OPTIMIZATION_SETTINGS: TouchOptimizationSettings;
export declare function detectInputDevice(event: {
    pointerType?: string;
    sourceCapabilities?: {
        firesTouchEvents?: boolean;
    };
}): InputDeviceType;
export declare function classifyTouchGesture(startPoints: TouchPoint[], currentPoints: TouchPoint[], elapsedMs: number, longPressThresholdMs?: number): TouchGestureType;
export declare function isDoubleTap(lastTapTime: number, currentTime: number, lastTapPosition: {
    x: number;
    y: number;
}, currentPosition: {
    x: number;
    y: number;
}, maxMs?: number, maxDistancePx?: number): boolean;
export declare function calculatePinchScale(startPoints: [TouchPoint, TouchPoint], currentPoints: [TouchPoint, TouchPoint]): number;
export declare function calculateTouchTrimHandleSize(baseSize: number, deviceType: InputDeviceType, settings?: Partial<TouchOptimizationSettings>): number;
export declare function calculateTouchUISpacing(baseSpacing: number, touchMode: boolean, multiplier?: number): number;
export declare function normalizeTouchOptimizationSettings(input: Partial<TouchOptimizationSettings> | undefined, hasTouchHardware?: boolean): TouchOptimizationSettings;
//# sourceMappingURL=touch-interaction.d.ts.map