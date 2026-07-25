import { describe, it, expect } from 'vitest';
import {
  generateId,
  computeIoU,
  getBoundingBoxCenter,
  computePointDistance,
  createDefaultSceneUnderstandingConfig,
  validateSceneUnderstandingConfig,
} from './scene-understanding';

describe('generateId', () => {
  it('returns a string', () => {
    expect(typeof generateId()).toBe('string');
  });

  it('returns unique values', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()));
    expect(ids.size).toBe(100);
  });

  it('returns non-empty string', () => {
    expect(generateId().length).toBeGreaterThan(0);
  });
});

describe('computeIoU', () => {
  it('returns 1 for identical boxes', () => {
    const box = { x: 0, y: 0, width: 1, height: 1 };
    expect(computeIoU(box, box)).toBe(1);
  });

  it('returns 0 for non-overlapping boxes', () => {
    const box1 = { x: 0, y: 0, width: 0.5, height: 0.5 };
    const box2 = { x: 0.5, y: 0.5, width: 0.5, height: 0.5 };
    expect(computeIoU(box1, box2)).toBe(0);
  });

  it('returns partial overlap', () => {
    const box1 = { x: 0, y: 0, width: 0.6, height: 0.6 };
    const box2 = { x: 0.4, y: 0.4, width: 0.6, height: 0.6 };
    const iou = computeIoU(box1, box2);
    expect(iou).toBeGreaterThan(0);
    expect(iou).toBeLessThan(1);
  });

  it('returns 0 for touching but not overlapping', () => {
    const box1 = { x: 0, y: 0, width: 0.5, height: 1 };
    const box2 = { x: 0.5, y: 0, width: 0.5, height: 1 };
    expect(computeIoU(box1, box2)).toBe(0);
  });

  it('handles nested boxes', () => {
    const outer = { x: 0, y: 0, width: 1, height: 1 };
    const inner = { x: 0.25, y: 0.25, width: 0.5, height: 0.5 };
    const iou = computeIoU(outer, inner);
    expect(iou).toBeCloseTo(0.25);
  });
});

describe('getBoundingBoxCenter', () => {
  it('returns center for unit box', () => {
    const center = getBoundingBoxCenter({ x: 0, y: 0, width: 1, height: 1 });
    expect(center.x).toBeCloseTo(0.5);
    expect(center.y).toBeCloseTo(0.5);
  });

  it('returns center for offset box', () => {
    const center = getBoundingBoxCenter({ x: 0.2, y: 0.3, width: 0.4, height: 0.6 });
    expect(center.x).toBeCloseTo(0.4);
    expect(center.y).toBeCloseTo(0.6);
  });
});

describe('computePointDistance', () => {
  it('returns 0 for same point', () => {
    expect(computePointDistance({ x: 1, y: 1 }, { x: 1, y: 1 })).toBe(0);
  });

  it('computes horizontal distance', () => {
    expect(computePointDistance({ x: 0, y: 0 }, { x: 3, y: 0 })).toBe(3);
  });

  it('computes vertical distance', () => {
    expect(computePointDistance({ x: 0, y: 0 }, { x: 0, y: 4 })).toBe(4);
  });

  it('computes diagonal distance', () => {
    expect(computePointDistance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });
});

describe('createDefaultSceneUnderstandingConfig', () => {
  it('returns valid config', () => {
    const config = createDefaultSceneUnderstandingConfig();
    expect(config).toBeDefined();
    expect(typeof config.enableObjectDetection).toBe('boolean');
    expect(typeof config.enableFaceDetection).toBe('boolean');
    expect(typeof config.objectConfidenceThreshold).toBe('number');
  });
});

describe('validateSceneUnderstandingConfig', () => {
  it('returns true for valid config', () => {
    expect(validateSceneUnderstandingConfig(createDefaultSceneUnderstandingConfig())).toBe(true);
  });

  it('returns false for empty object', () => {
    expect(validateSceneUnderstandingConfig({} as any)).toBe(false);
  });

  it('returns false for wrong types', () => {
    const config = { ...createDefaultSceneUnderstandingConfig(), enableObjectDetection: 'yes' as any };
    expect(validateSceneUnderstandingConfig(config)).toBe(false);
  });
});
