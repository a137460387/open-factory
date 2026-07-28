/**
 * Gesture Control Integration
 *
 * Defines gesture recognition patterns for video editing via MediaPipe.
 * Maps hand gestures to editor commands.
 *
 * Core gestures:
 * - Swipe left/right: navigate timeline
 * - Pinch: zoom timeline
 * - Fist: delete selected clip
 * - Open palm: play/pause
 * - Point: select clip
 * - Two-finger tap: split at playhead
 */
export type GestureType = 'swipe-left' | 'swipe-right' | 'swipe-up' | 'swipe-down' | 'pinch-in' | 'pinch-out' | 'fist' | 'open-palm' | 'point' | 'two-finger-tap' | 'thumbs-up' | 'thumbs-down' | 'peace-sign' | 'grab' | 'release' | 'none';
export interface GestureEvent {
    /** Gesture type */
    gesture: GestureType;
    /** Confidence 0-1 */
    confidence: number;
    /** Timestamp (ms) */
    timestamp: number;
    /** Hand position (normalized 0-1) */
    position: {
        x: number;
        y: number;
    };
    /** Gesture duration in ms (for held gestures) */
    duration: number;
    /** Associated parameters (e.g., pinch scale, swipe velocity) */
    params: Record<string, number>;
}
export interface GestureMapping {
    /** Gesture type */
    gesture: GestureType;
    /** Editor action to trigger */
    action: string;
    /** Description */
    description: string;
    /** Whether gesture needs to be held */
    requiresHold: boolean;
    /** Minimum hold duration (ms) */
    minHoldMs: number;
    /** Cooldown between triggers (ms) */
    cooldownMs: number;
}
export interface GestureConfig {
    /** Minimum confidence to accept a gesture */
    minConfidence: number;
    /** Swipe velocity threshold (normalized units/sec) */
    swipeVelocityThreshold: number;
    /** Pinch scale threshold */
    pinchThreshold: number;
    /** Gesture hold detection window (ms) */
    holdWindowMs: number;
    /** Debounce interval (ms) */
    debounceMs: number;
    /** Enable haptic feedback */
    enableHaptic: boolean;
}
export declare const DEFAULT_GESTURE_CONFIG: GestureConfig;
export interface GestureState {
    /** Currently active gesture */
    activeGesture: GestureType;
    /** Is a gesture being held */
    isHolding: boolean;
    /** Hold start time */
    holdStartTime: number;
    /** Last gesture timestamp */
    lastGestureTime: number;
    /** Gesture history (for multi-step gestures) */
    history: GestureEvent[];
}
export declare const DEFAULT_GESTURE_MAPPINGS: GestureMapping[];
/**
 * Recognize swipe gesture from a sequence of hand positions.
 */
export declare function recognizeSwipe(positions: Array<{
    x: number;
    y: number;
    timestamp: number;
}>, velocityThreshold: number): {
    gesture: GestureType;
    velocity: number;
} | null;
/**
 * Recognize pinch gesture from two-finger distance changes.
 */
export declare function recognizePinch(distances: Array<{
    distance: number;
    timestamp: number;
}>, threshold: number): {
    gesture: GestureType;
    scale: number;
} | null;
/**
 * Process a gesture event through the state machine.
 * Returns the action to trigger, or null if no action.
 */
export declare function processGestureEvent(event: GestureEvent, state: GestureState, mappings: GestureMapping[], config: GestureConfig): {
    action: string | null;
    newState: GestureState;
};
/**
 * Create initial gesture state.
 */
export declare function createGestureState(): GestureState;
/**
 * Get gesture tutorial steps for learning mode.
 */
export declare function getGestureTutorialSteps(): Array<{
    gesture: GestureType;
    instruction: string;
    tip: string;
}>;
//# sourceMappingURL=gesture-control.d.ts.map