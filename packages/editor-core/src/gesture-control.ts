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

import { round } from './time';

// ==================== Types ====================

export type GestureType =
  | 'swipe-left'
  | 'swipe-right'
  | 'swipe-up'
  | 'swipe-down'
  | 'pinch-in'
  | 'pinch-out'
  | 'fist'
  | 'open-palm'
  | 'point'
  | 'two-finger-tap'
  | 'thumbs-up'
  | 'thumbs-down'
  | 'peace-sign'
  | 'grab'
  | 'release'
  | 'none';

export interface GestureEvent {
  /** Gesture type */
  gesture: GestureType;
  /** Confidence 0-1 */
  confidence: number;
  /** Timestamp (ms) */
  timestamp: number;
  /** Hand position (normalized 0-1) */
  position: { x: number; y: number };
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

export const DEFAULT_GESTURE_CONFIG: GestureConfig = {
  minConfidence: 0.7,
  swipeVelocityThreshold: 0.5,
  pinchThreshold: 0.15,
  holdWindowMs: 300,
  debounceMs: 200,
  enableHaptic: true,
};

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

// ==================== Default Mappings ====================

export const DEFAULT_GESTURE_MAPPINGS: GestureMapping[] = [
  {
    gesture: 'swipe-left',
    action: 'timeline.skip-forward',
    description: '向左滑动：时间线前进',
    requiresHold: false,
    minHoldMs: 0,
    cooldownMs: 100,
  },
  {
    gesture: 'swipe-right',
    action: 'timeline.skip-backward',
    description: '向右滑动：时间线后退',
    requiresHold: false,
    minHoldMs: 0,
    cooldownMs: 100,
  },
  {
    gesture: 'pinch-in',
    action: 'timeline.zoom-out',
    description: '捏合：缩小时间线',
    requiresHold: false,
    minHoldMs: 0,
    cooldownMs: 50,
  },
  {
    gesture: 'pinch-out',
    action: 'timeline.zoom-in',
    description: '张开：放大时间线',
    requiresHold: false,
    minHoldMs: 0,
    cooldownMs: 50,
  },
  {
    gesture: 'fist',
    action: 'clip.delete',
    description: '握拳：删除选中片段',
    requiresHold: true,
    minHoldMs: 500,
    cooldownMs: 1000,
  },
  {
    gesture: 'open-palm',
    action: 'playback.toggle',
    description: '张开手掌：播放/暂停',
    requiresHold: false,
    minHoldMs: 0,
    cooldownMs: 500,
  },
  {
    gesture: 'point',
    action: 'clip.select',
    description: '指向：选择片段',
    requiresHold: false,
    minHoldMs: 0,
    cooldownMs: 200,
  },
  {
    gesture: 'two-finger-tap',
    action: 'clip.split',
    description: '双指点击：在播放头处分割',
    requiresHold: false,
    minHoldMs: 0,
    cooldownMs: 300,
  },
  {
    gesture: 'thumbs-up',
    action: 'mark.highlight',
    description: '竖起大拇指：标记为高光',
    requiresHold: false,
    minHoldMs: 0,
    cooldownMs: 500,
  },
  {
    gesture: 'grab',
    action: 'clip.grab',
    description: '抓取：拾取片段',
    requiresHold: false,
    minHoldMs: 0,
    cooldownMs: 200,
  },
  {
    gesture: 'release',
    action: 'clip.release',
    description: '释放：放置片段',
    requiresHold: false,
    minHoldMs: 0,
    cooldownMs: 200,
  },
];

// ==================== Gesture Recognition ====================

/**
 * Recognize swipe gesture from a sequence of hand positions.
 */
export function recognizeSwipe(
  positions: Array<{ x: number; y: number; timestamp: number }>,
  velocityThreshold: number,
): { gesture: GestureType; velocity: number } | null {
  if (positions.length < 2) return null;

  const first = positions[0];
  const last = positions[positions.length - 1];
  const dt = (last.timestamp - first.timestamp) / 1000; // seconds
  if (dt <= 0) return null;

  const dx = last.x - first.x;
  const dy = last.y - first.y;
  const velocityX = Math.abs(dx / dt);
  const velocityY = Math.abs(dy / dt);

  if (velocityX > velocityThreshold && velocityX > velocityY * 1.5) {
    return {
      gesture: dx < 0 ? 'swipe-left' : 'swipe-right',
      velocity: round(velocityX),
    };
  }

  if (velocityY > velocityThreshold && velocityY > velocityX * 1.5) {
    return {
      gesture: dy < 0 ? 'swipe-up' : 'swipe-down',
      velocity: round(velocityY),
    };
  }

  return null;
}

/**
 * Recognize pinch gesture from two-finger distance changes.
 */
export function recognizePinch(
  distances: Array<{ distance: number; timestamp: number }>,
  threshold: number,
): { gesture: GestureType; scale: number } | null {
  if (distances.length < 2) return null;

  const first = distances[0].distance;
  const last = distances[distances.length - 1].distance;
  if (first <= 0) return null;

  const scale = last / first;
  const change = Math.abs(scale - 1);

  if (change < threshold) return null;

  return {
    gesture: scale < 1 ? 'pinch-in' : 'pinch-out',
    scale: round(scale),
  };
}

/**
 * Process a gesture event through the state machine.
 * Returns the action to trigger, or null if no action.
 */
export function processGestureEvent(
  event: GestureEvent,
  state: GestureState,
  mappings: GestureMapping[],
  config: GestureConfig,
): { action: string | null; newState: GestureState } {
  const now = event.timestamp;

  // Check confidence threshold
  if (event.confidence < config.minConfidence) {
    return {
      action: null,
      newState: {
        ...state,
        history: [...state.history.slice(-9), event],
      },
    };
  }

  // Find matching mapping
  const mapping = mappings.find((m) => m.gesture === event.gesture);
  if (!mapping) {
    return {
      action: null,
      newState: {
        ...state,
        activeGesture: event.gesture,
        history: [...state.history.slice(-9), event],
      },
    };
  }

  // Check cooldown
  if (now - state.lastGestureTime < mapping.cooldownMs) {
    return {
      action: null,
      newState: {
        ...state,
        history: [...state.history.slice(-9), event],
      },
    };
  }

  // Handle hold requirement
  if (mapping.requiresHold) {
    if (event.gesture !== state.activeGesture) {
      // Start tracking hold
      return {
        action: null,
        newState: {
          activeGesture: event.gesture,
          isHolding: true,
          holdStartTime: now,
          lastGestureTime: state.lastGestureTime,
          history: [...state.history.slice(-9), event],
        },
      };
    }

    if (state.isHolding && now - state.holdStartTime >= mapping.minHoldMs) {
      // Hold completed, trigger action
      return {
        action: mapping.action,
        newState: {
          activeGesture: event.gesture,
          isHolding: false,
          holdStartTime: 0,
          lastGestureTime: now,
          history: [...state.history.slice(-9), event],
        },
      };
    }

    return {
      action: null,
      newState: {
        ...state,
        history: [...state.history.slice(-9), event],
      },
    };
  }

  // Immediate gesture, trigger action
  return {
    action: mapping.action,
    newState: {
      activeGesture: event.gesture,
      isHolding: false,
      holdStartTime: 0,
      lastGestureTime: now,
      history: [...state.history.slice(-9), event],
    },
  };
}

/**
 * Create initial gesture state.
 */
export function createGestureState(): GestureState {
  return {
    activeGesture: 'none',
    isHolding: false,
    holdStartTime: 0,
    lastGestureTime: 0,
    history: [],
  };
}

/**
 * Get gesture tutorial steps for learning mode.
 */
export function getGestureTutorialSteps(): Array<{ gesture: GestureType; instruction: string; tip: string }> {
  return [
    { gesture: 'open-palm', instruction: '张开手掌', tip: '手掌面对摄像头，五指张开' },
    { gesture: 'point', instruction: '伸出食指', tip: '指向时间线上的片段即可选中' },
    { gesture: 'swipe-left', instruction: '向左滑动', tip: '食指快速向左移动' },
    { gesture: 'swipe-right', instruction: '向右滑动', tip: '食指快速向右移动' },
    { gesture: 'pinch-in', instruction: '捏合手势', tip: '拇指和食指靠近' },
    { gesture: 'pinch-out', instruction: '张开手势', tip: '拇指和食指远离' },
    { gesture: 'fist', instruction: '握拳', tip: '保持0.5秒以上触发删除' },
    { gesture: 'two-finger-tap', instruction: '双指点击', tip: '食指和中指同时轻点' },
    { gesture: 'thumbs-up', instruction: '竖起大拇指', tip: '标记当前时间为高光' },
  ];
}
