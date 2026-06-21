import { describe, expect, it } from 'vitest';
import {
  calculateQuickActionPosition,
  filterActionsForSelection,
  normalizeQuickActionOrder,
  getBatchSupportedActions,
  serializeQuickActionOrder,
  deserializeQuickActionOrder,
  DEFAULT_QUICK_ACTION_ORDER,
  MAX_QUICK_ACTIONS,
  ALL_QUICK_ACTIONS
} from '../src/quick-actions';

describe('quick action position', () => {
  it('places toolbar above clip when space is available', () => {
    const pos = calculateQuickActionPosition(
      { x: 100, y: 200, width: 300, height: 60 },
      200, 40, 1920, 1080
    );
    expect(pos.placement).toBe('above');
    expect(pos.y).toBe(152);
  });

  it('places toolbar below clip when above does not fit', () => {
    const pos = calculateQuickActionPosition(
      { x: 100, y: 10, width: 300, height: 60 },
      200, 40, 1920, 1080
    );
    expect(pos.placement).toBe('below');
    expect(pos.y).toBe(78);
  });

  it('clamps toolbar x to left edge', () => {
    const pos = calculateQuickActionPosition(
      { x: 0, y: 200, width: 100, height: 60 },
      200, 40, 1920, 1080
    );
    expect(pos.x).toBe(8);
  });

  it('clamps toolbar x to right edge', () => {
    const pos = calculateQuickActionPosition(
      { x: 1800, y: 200, width: 100, height: 60 },
      200, 40, 1920, 1080
    );
    expect(pos.x).toBe(1712);
  });

  it('centers toolbar on clip', () => {
    const pos = calculateQuickActionPosition(
      { x: 500, y: 200, width: 400, height: 60 },
      200, 40, 1920, 1080
    );
    expect(pos.x).toBe(600);
  });
});

describe('quick action filtering', () => {
  it('returns all actions for single selection', () => {
    const order: typeof DEFAULT_QUICK_ACTION_ORDER = ['mute', 'delete', 'copy', 'solo', 'volume', 'add-marker', 'split-here', 'inspector'];
    const filtered = filterActionsForSelection(order, 1);
    expect(filtered).toEqual(order);
  });

  it('filters to batch-supported actions for multi-selection', () => {
    const filtered = filterActionsForSelection(DEFAULT_QUICK_ACTION_ORDER, 3);
    for (const id of filtered) {
      const action = ALL_QUICK_ACTIONS.find((a) => a.id === id);
      expect(action?.batchSupported).toBe(true);
    }
  });

  it('returns mute, copy, delete for default multi-selection', () => {
    const filtered = filterActionsForSelection(DEFAULT_QUICK_ACTION_ORDER, 5);
    expect(filtered).toContain('mute');
    expect(filtered).toContain('copy');
    expect(filtered).toContain('delete');
    expect(filtered).not.toContain('split-here');
    expect(filtered).not.toContain('inspector');
  });
});

describe('quick action order normalization', () => {
  it('returns default order for invalid input', () => {
    expect(normalizeQuickActionOrder(null)).toEqual(DEFAULT_QUICK_ACTION_ORDER);
    expect(normalizeQuickActionOrder(undefined)).toEqual(DEFAULT_QUICK_ACTION_ORDER);
    expect(normalizeQuickActionOrder([])).toEqual(DEFAULT_QUICK_ACTION_ORDER);
  });

  it('filters out invalid action ids', () => {
    const result = normalizeQuickActionOrder(['mute', 'invalid-id', 'delete']);
    expect(result).toEqual(['mute', 'delete']);
  });

  it('limits to MAX_QUICK_ACTIONS', () => {
    const tooMany = Array.from({ length: 15 }, (_, i) => ALL_QUICK_ACTIONS[i % ALL_QUICK_ACTIONS.length].id);
    const result = normalizeQuickActionOrder(tooMany);
    expect(result.length).toBeLessThanOrEqual(MAX_QUICK_ACTIONS);
  });

  it('serializes and deserializes order', () => {
    const order: typeof DEFAULT_QUICK_ACTION_ORDER = ['delete', 'mute', 'copy', 'solo', 'volume', 'add-marker', 'split-here', 'inspector'];
    const json = serializeQuickActionOrder(order);
    const restored = deserializeQuickActionOrder(json);
    expect(restored).toEqual(order);
  });

  it('deserializes invalid JSON gracefully', () => {
    expect(deserializeQuickActionOrder('not-json')).toEqual(DEFAULT_QUICK_ACTION_ORDER);
  });
});

describe('batch supported actions', () => {
  it('returns only batch-supported actions', () => {
    const batch = getBatchSupportedActions(DEFAULT_QUICK_ACTION_ORDER);
    expect(batch).toContain('mute');
    expect(batch).toContain('copy');
    expect(batch).toContain('delete');
    expect(batch).not.toContain('solo');
    expect(batch).not.toContain('split-here');
  });
});
