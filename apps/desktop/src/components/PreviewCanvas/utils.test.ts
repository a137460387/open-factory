import { describe, it, expect } from 'vitest';
import type { CanvasPoint, ClipTransformBox, PathPoint } from '@open-factory/editor-core';
import {
  clampPathUnit,
  canvasPointStyle,
  canvasBoxStyle,
  canvasHandleCursor,
  rgbCss,
  isFrameJumpLikeQuery,
  clonePathPoints,
  resolvePathHandle,
  buildReviewAnnotationGeometry,
  buildPathMaskDragPatch,
  getAdaptiveQualityIndicatorClass,
  buildCanvasPathMaskSvgPath,
  canvasPointToPathPoint,
  pathPointToCanvasPoint,
} from './utils';
import type { EditableCanvasClip, PathMaskDrag, ReviewAnnotationDrag } from './types';
import { PREVIEW_CANVAS_WIDTH, PREVIEW_CANVAS_HEIGHT } from './types';

describe('clampPathUnit', () => {
  it('clamps values to [0, 1]', () => {
    expect(clampPathUnit(-0.5)).toBe(0);
    expect(clampPathUnit(1.5)).toBe(1);
    expect(clampPathUnit(0.5)).toBe(0.5);
  });

  it('returns 0 for non-finite values', () => {
    expect(clampPathUnit(Infinity)).toBe(0);
    expect(clampPathUnit(-Infinity)).toBe(0);
    expect(clampPathUnit(NaN)).toBe(0);
  });

  it('rounds to 4 decimal places', () => {
    expect(clampPathUnit(0.12345)).toBe(0.1235);
    expect(clampPathUnit(0.99999)).toBe(1);
  });

  it('handles boundary values', () => {
    expect(clampPathUnit(0)).toBe(0);
    expect(clampPathUnit(1)).toBe(1);
  });
});

describe('canvasPointStyle', () => {
  it('returns CSSProperties with percentage positioning', () => {
    const style = canvasPointStyle({ x: 640, y: 360 });
    expect(style.left).toBe('50%');
    expect(style.top).toBe('50%');
    expect(style.transform).toBe('translate(-50%, -50%)');
  });

  it('handles origin point', () => {
    const style = canvasPointStyle({ x: 0, y: 0 });
    expect(style.left).toBe('0%');
    expect(style.top).toBe('0%');
  });

  it('handles max point', () => {
    const style = canvasPointStyle({ x: PREVIEW_CANVAS_WIDTH, y: PREVIEW_CANVAS_HEIGHT });
    expect(style.left).toBe('100%');
    expect(style.top).toBe('100%');
  });
});

describe('canvasBoxStyle', () => {
  it('returns CSSProperties for a transform box', () => {
    const box: ClipTransformBox = {
      center: { x: 640, y: 360 },
      width: 320,
      height: 180,
      rotation: 0,
      corners: { topLeft: { x: 480, y: 270 }, topRight: { x: 800, y: 270 }, bottomRight: { x: 800, y: 450 }, bottomLeft: { x: 480, y: 450 } },
    };
    const style = canvasBoxStyle(box);
    expect(style.left).toBe('50%');
    expect(style.top).toBe('50%');
    expect(style.width).toBe('25%');
    expect(style.height).toBe('25%');
    expect(style.transform).toContain('rotate(0deg)');
  });

  it('includes rotation in transform', () => {
    const box: ClipTransformBox = {
      center: { x: 0, y: 0 },
      width: 100,
      height: 100,
      rotation: 45,
      corners: { topLeft: { x: -50, y: -50 }, topRight: { x: 50, y: -50 }, bottomRight: { x: 50, y: 50 }, bottomLeft: { x: -50, y: 50 } },
    };
    const style = canvasBoxStyle(box);
    expect(style.transform).toContain('rotate(45deg)');
  });
});

describe('canvasHandleCursor', () => {
  it('returns ns-resize for n and s', () => {
    expect(canvasHandleCursor('n')).toBe('ns-resize');
    expect(canvasHandleCursor('s')).toBe('ns-resize');
  });

  it('returns ew-resize for e and w', () => {
    expect(canvasHandleCursor('e')).toBe('ew-resize');
    expect(canvasHandleCursor('w')).toBe('ew-resize');
  });

  it('returns nesw-resize for ne and sw', () => {
    expect(canvasHandleCursor('ne')).toBe('nesw-resize');
    expect(canvasHandleCursor('sw')).toBe('nesw-resize');
  });

  it('returns nwse-resize for nw and se', () => {
    expect(canvasHandleCursor('nw')).toBe('nwse-resize');
    expect(canvasHandleCursor('se')).toBe('nwse-resize');
  });
});

describe('rgbCss', () => {
  it('formats RGB color string', () => {
    expect(rgbCss([255, 128, 0])).toBe('rgb(255, 128, 0)');
    expect(rgbCss([0, 0, 0])).toBe('rgb(0, 0, 0)');
    expect(rgbCss([255, 255, 255])).toBe('rgb(255, 255, 255)');
  });
});

describe('isFrameJumpLikeQuery', () => {
  it('detects timecode queries', () => {
    expect(isFrameJumpLikeQuery('1:30:00')).toBe(true);
    expect(isFrameJumpLikeQuery('0:15')).toBe(true);
    expect(isFrameJumpLikeQuery('10:20:30')).toBe(true);
  });

  it('detects frame queries', () => {
    expect(isFrameJumpLikeQuery('f100')).toBe(true);
    expect(isFrameJumpLikeQuery('F100')).toBe(true);
  });

  it('rejects non-frame queries', () => {
    expect(isFrameJumpLikeQuery('hello')).toBe(false);
    expect(isFrameJumpLikeQuery('scene 1')).toBe(false);
  });

  it('trims whitespace', () => {
    expect(isFrameJumpLikeQuery('  1:30  ')).toBe(true);
  });
});

describe('clonePathPoints', () => {
  it('creates deep clone of path points', () => {
    const points: PathPoint[] = [
      { x: 0, y: 0, handleIn: { x: -0.1, y: 0 }, handleOut: { x: 0.1, y: 0 } },
      { x: 1, y: 1 },
    ];
    const cloned = clonePathPoints(points);
    expect(cloned).toEqual(points);
    expect(cloned[0]).not.toBe(points[0]);
    if (cloned[0].handleIn) {
      expect(cloned[0].handleIn).not.toBe(points[0].handleIn);
    }
  });

  it('handles points without handles', () => {
    const points: PathPoint[] = [{ x: 0.5, y: 0.5 }];
    const cloned = clonePathPoints(points);
    expect(cloned[0].x).toBe(0.5);
    expect(cloned[0].handleIn).toBeUndefined();
  });
});

describe('resolvePathHandle', () => {
  it('returns existing handleIn', () => {
    const point: PathPoint = { x: 0.5, y: 0.5, handleIn: { x: 0.3, y: 0.4 } };
    expect(resolvePathHandle(point, 'handleIn')).toEqual({ x: 0.3, y: 0.4 });
  });

  it('returns existing handleOut', () => {
    const point: PathPoint = { x: 0.5, y: 0.5, handleOut: { x: 0.7, y: 0.6 } };
    expect(resolvePathHandle(point, 'handleOut')).toEqual({ x: 0.7, y: 0.6 });
  });

  it('falls back to offset for missing handleIn', () => {
    const point: PathPoint = { x: 0.5, y: 0.5 };
    const result = resolvePathHandle(point, 'handleIn');
    expect(result.x).toBeCloseTo(0.42, 2);
    expect(result.y).toBe(0.5);
  });

  it('falls back to offset for missing handleOut', () => {
    const point: PathPoint = { x: 0.5, y: 0.5 };
    const result = resolvePathHandle(point, 'handleOut');
    expect(result.x).toBeCloseTo(0.58, 2);
    expect(result.y).toBe(0.5);
  });
});

describe('getAdaptiveQualityIndicatorClass', () => {
  it('returns amber for degraded', () => {
    expect(getAdaptiveQualityIndicatorClass('degraded')).toBe('bg-amber-400');
  });

  it('returns rose for low', () => {
    expect(getAdaptiveQualityIndicatorClass('low')).toBe('bg-rose-500');
  });

  it('returns emerald for good/normal', () => {
    expect(getAdaptiveQualityIndicatorClass('normal')).toBe('bg-emerald-400');
  });
});

describe('buildReviewAnnotationGeometry', () => {
  const baseDrag: ReviewAnnotationDrag = {
    pointerId: 1,
    type: 'box',
    startPoint: { x: 100, y: 100 },
    canvasWidth: 1280,
    canvasHeight: 720,
  };

  it('builds box geometry', () => {
    const geo = buildReviewAnnotationGeometry(baseDrag, { x: 300, y: 300 });
    expect(geo.x).toBeCloseTo(100 / 1280);
    expect(geo.y).toBeCloseTo(100 / 720);
    expect(geo.width).toBeGreaterThan(0);
    expect(geo.height).toBeGreaterThan(0);
  });

  it('builds arrow geometry with minimum size', () => {
    const arrowDrag: ReviewAnnotationDrag = { ...baseDrag, type: 'arrow' };
    const geo = buildReviewAnnotationGeometry(arrowDrag, { x: 100, y: 100 });
    // Near-zero delta should give minimum 0.12
    expect(geo.width).toBeCloseTo(0.12);
    expect(geo.height).toBeCloseTo(0.12);
  });

  it('builds arrow geometry with real delta', () => {
    const arrowDrag: ReviewAnnotationDrag = { ...baseDrag, type: 'arrow' };
    const geo = buildReviewAnnotationGeometry(arrowDrag, { x: 400, y: 300 });
    expect(geo.width).toBeCloseTo((400 - 100) / 1280);
    expect(geo.height).toBeCloseTo((300 - 100) / 720);
  });
});

describe('buildPathMaskDragPatch', () => {
  const startPath: PathPoint[] = [
    { x: 0.2, y: 0.3, handleIn: { x: 0.1, y: 0.3 }, handleOut: { x: 0.3, y: 0.3 } },
    { x: 0.8, y: 0.7 },
  ];

  it('moves anchor point', () => {
    const drag: PathMaskDrag = {
      pointerId: 1,
      clipId: 'c1',
      maskId: 'm1',
      pointIndex: 0,
      target: 'anchor',
      startPoint: { x: 0.2, y: 0.3 },
      startPath,
    };
    const result = buildPathMaskDragPatch(drag, { x: 0.4, y: 0.5 });
    expect(result.path[0].x).toBeCloseTo(0.4);
    expect(result.path[0].y).toBeCloseTo(0.5);
  });

  it('updates handleIn', () => {
    const drag: PathMaskDrag = {
      pointerId: 1,
      clipId: 'c1',
      maskId: 'm1',
      pointIndex: 0,
      target: 'handleIn',
      startPoint: { x: 0.1, y: 0.3 },
      startPath,
    };
    const result = buildPathMaskDragPatch(drag, { x: 0.05, y: 0.25 });
    expect(result.path[0].handleIn?.x).toBeCloseTo(0.05);
    expect(result.path[0].handleIn?.y).toBeCloseTo(0.25);
  });

  it('updates handleOut', () => {
    const drag: PathMaskDrag = {
      pointerId: 1,
      clipId: 'c1',
      maskId: 'm1',
      pointIndex: 0,
      target: 'handleOut',
      startPoint: { x: 0.3, y: 0.3 },
      startPath,
    };
    const result = buildPathMaskDragPatch(drag, { x: 0.35, y: 0.35 });
    expect(result.path[0].handleOut?.x).toBeCloseTo(0.35);
    expect(result.path[0].handleOut?.y).toBeCloseTo(0.35);
  });

  it('returns unchanged path for invalid pointIndex', () => {
    const drag: PathMaskDrag = {
      pointerId: 1,
      clipId: 'c1',
      maskId: 'm1',
      pointIndex: 99,
      target: 'anchor',
      startPoint: { x: 0, y: 0 },
      startPath,
    };
    const result = buildPathMaskDragPatch(drag, { x: 1, y: 1 });
    expect(result.path).toHaveLength(startPath.length);
  });
});

describe('canvasPointToPathPoint / pathPointToCanvasPoint', () => {
  const mockBox: ClipTransformBox = {
    center: { x: 640, y: 360 },
    width: 320,
    height: 180,
    rotation: 0,
    corners: { topLeft: { x: 480, y: 270 }, topRight: { x: 800, y: 270 }, bottomRight: { x: 800, y: 450 }, bottomLeft: { x: 480, y: 450 } },
  };

  const mockClip: EditableCanvasClip = {
    clip: {} as never,
    box: mockBox,
    sourceWidth: 1920,
    sourceHeight: 1080,
  };

  it('converts center canvas point to path point', () => {
    const result = canvasPointToPathPoint({ x: 640, y: 360 }, mockClip);
    expect(result.x).toBeCloseTo(0.5, 2);
    expect(result.y).toBeCloseTo(0.5, 2);
  });

  it('converts path point back to canvas point', () => {
    const canvas = pathPointToCanvasPoint({ x: 0.5, y: 0.5 }, mockClip);
    expect(canvas.x).toBeCloseTo(640, 0);
    expect(canvas.y).toBeCloseTo(360, 0);
  });
});
