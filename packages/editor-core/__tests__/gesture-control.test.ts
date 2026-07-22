import { describe, it, expect } from 'vitest';
import {
  recognizeSwipe,
  recognizePinch,
  processGestureEvent,
  createGestureState,
  getGestureTutorialSteps,
  DEFAULT_GESTURE_MAPPINGS,
  DEFAULT_GESTURE_CONFIG,
} from '../src/gesture-control';

describe('recognizeSwipe', () => {
  it('detects left swipe', () => {
    const positions = [
      { x: 0.8, y: 0.5, timestamp: 0 },
      { x: 0.2, y: 0.5, timestamp: 200 },
    ];
    const result = recognizeSwipe(positions, 0.5);
    expect(result).not.toBeNull();
    expect(result?.gesture).toBe('swipe-left');
  });

  it('detects right swipe', () => {
    const positions = [
      { x: 0.2, y: 0.5, timestamp: 0 },
      { x: 0.8, y: 0.5, timestamp: 200 },
    ];
    const result = recognizeSwipe(positions, 0.5);
    expect(result).not.toBeNull();
    expect(result?.gesture).toBe('swipe-right');
  });

  it('returns null for slow movement', () => {
    const positions = [
      { x: 0.5, y: 0.5, timestamp: 0 },
      { x: 0.55, y: 0.5, timestamp: 1000 },
    ];
    const result = recognizeSwipe(positions, 0.5);
    expect(result).toBeNull();
  });

  it('returns null for single position', () => {
    expect(recognizeSwipe([{ x: 0.5, y: 0.5, timestamp: 0 }], 0.5)).toBeNull();
  });
});

describe('recognizePinch', () => {
  it('detects pinch in', () => {
    const distances = [
      { distance: 1.0, timestamp: 0 },
      { distance: 0.5, timestamp: 200 },
    ];
    const result = recognizePinch(distances, 0.15);
    expect(result).not.toBeNull();
    expect(result?.gesture).toBe('pinch-in');
  });

  it('detects pinch out', () => {
    const distances = [
      { distance: 0.5, timestamp: 0 },
      { distance: 1.0, timestamp: 200 },
    ];
    const result = recognizePinch(distances, 0.15);
    expect(result).not.toBeNull();
    expect(result?.gesture).toBe('pinch-out');
  });

  it('returns null for small change', () => {
    const distances = [
      { distance: 1.0, timestamp: 0 },
      { distance: 1.05, timestamp: 200 },
    ];
    const result = recognizePinch(distances, 0.15);
    expect(result).toBeNull();
  });

  it('returns null for single distance', () => {
    expect(recognizePinch([{ distance: 1.0, timestamp: 0 }], 0.15)).toBeNull();
  });
});

describe('processGestureEvent', () => {
  it('triggers action for open-palm gesture', () => {
    const state = createGestureState();
    const event = {
      gesture: 'open-palm' as const,
      confidence: 0.9,
      timestamp: 1000,
      position: { x: 0.5, y: 0.5 },
      duration: 0,
      params: {},
    };
    const { action, newState } = processGestureEvent(
      event, state, DEFAULT_GESTURE_MAPPINGS, DEFAULT_GESTURE_CONFIG,
    );
    expect(action).toBe('playback.toggle');
    expect(newState.lastGestureTime).toBe(1000);
  });

  it('respects cooldown', () => {
    let state = createGestureState();
    const event = {
      gesture: 'open-palm' as const,
      confidence: 0.9,
      timestamp: 1000,
      position: { x: 0.5, y: 0.5 },
      duration: 0,
      params: {},
    };

    // First trigger
    const { newState: state1 } = processGestureEvent(
      event, state, DEFAULT_GESTURE_MAPPINGS, DEFAULT_GESTURE_CONFIG,
    );

    // Second trigger within cooldown
    const { action } = processGestureEvent(
      { ...event, timestamp: 1100 }, state1, DEFAULT_GESTURE_MAPPINGS, DEFAULT_GESTURE_CONFIG,
    );
    expect(action).toBeNull();
  });

  it('ignores low-confidence gestures', () => {
    const state = createGestureState();
    const event = {
      gesture: 'open-palm' as const,
      confidence: 0.3,
      timestamp: 1000,
      position: { x: 0.5, y: 0.5 },
      duration: 0,
      params: {},
    };
    const { action } = processGestureEvent(
      event, state, DEFAULT_GESTURE_MAPPINGS, DEFAULT_GESTURE_CONFIG,
    );
    expect(action).toBeNull();
  });

  it('starts hold tracking for fist gesture', () => {
    const state = createGestureState();
    const event = {
      gesture: 'fist' as const,
      confidence: 0.9,
      timestamp: 1000,
      position: { x: 0.5, y: 0.5 },
      duration: 0,
      params: {},
    };
    const { action, newState } = processGestureEvent(
      event, state, DEFAULT_GESTURE_MAPPINGS, DEFAULT_GESTURE_CONFIG,
    );
    expect(action).toBeNull(); // First event doesn't trigger
    expect(newState.isHolding).toBe(true);
    expect(newState.activeGesture).toBe('fist');
  });

  it('triggers fist action after hold completes', () => {
    let state = createGestureState();
    const event1 = {
      gesture: 'fist' as const,
      confidence: 0.9,
      timestamp: 1000,
      position: { x: 0.5, y: 0.5 },
      duration: 0,
      params: {},
    };

    // Start hold
    const { newState: state1 } = processGestureEvent(
      event1, state, DEFAULT_GESTURE_MAPPINGS, DEFAULT_GESTURE_CONFIG,
    );

    // Hold completed (500ms later)
    const { action } = processGestureEvent(
      { ...event1, timestamp: 1600 }, state1, DEFAULT_GESTURE_MAPPINGS, DEFAULT_GESTURE_CONFIG,
    );
    expect(action).toBe('clip.delete');
  });
});

describe('createGestureState', () => {
  it('creates initial state', () => {
    const state = createGestureState();
    expect(state.activeGesture).toBe('none');
    expect(state.isHolding).toBe(false);
    expect(state.history).toEqual([]);
  });
});

describe('getGestureTutorialSteps', () => {
  it('returns tutorial steps for all core gestures', () => {
    const steps = getGestureTutorialSteps();
    expect(steps.length).toBeGreaterThanOrEqual(8);
    expect(steps[0]).toHaveProperty('gesture');
    expect(steps[0]).toHaveProperty('instruction');
    expect(steps[0]).toHaveProperty('tip');
  });
});
