import { describe, expect, it } from 'vitest';
import { normalizeSelectionRect, rectsIntersect } from '../src';

describe('timeline selection geometry', () => {
  it('normalizes drag rectangles regardless of direction', () => {
    expect(normalizeSelectionRect({ left: 20, top: 30, right: 5, bottom: 10 })).toEqual({ left: 5, top: 10, right: 20, bottom: 30 });
  });

  it('detects overlapping selection and clip bounds', () => {
    expect(rectsIntersect({ left: 10, top: 10, right: 40, bottom: 40 }, { left: 30, top: 30, right: 60, bottom: 60 })).toBe(true);
  });

  it('treats edge-touching rectangles as selected', () => {
    expect(rectsIntersect({ left: 0, top: 0, right: 10, bottom: 10 }, { left: 10, top: 10, right: 20, bottom: 20 })).toBe(true);
  });

  it('rejects non-overlapping rectangles', () => {
    expect(rectsIntersect({ left: 0, top: 0, right: 10, bottom: 10 }, { left: 11, top: 0, right: 20, bottom: 10 })).toBe(false);
  });
});
