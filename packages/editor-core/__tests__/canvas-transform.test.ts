import { describe, expect, it } from 'vitest';
import {
  buildClipTransformBox,
  canvasPointToNormalizedPoint,
  hitTestClipTransformBox,
  moveTransformByCanvasDelta,
  normalizeCanvasRotation,
  normalizedPointToCanvasPoint,
  resizeClipTransform,
  rotateClipTransform,
  screenDeltaToCanvasDelta,
  screenPointToCanvasPoint
} from '../src';

describe('canvas transform helpers', () => {
  it('converts screen points and canvas points through normalized coordinates', () => {
    const viewport = { left: 100, top: 50, width: 640, height: 360, canvasWidth: 1280, canvasHeight: 720 };

    const point = screenPointToCanvasPoint({ x: 420, y: 230 }, viewport);
    expect(point).toEqual({ x: 640, y: 360 });
    expect(canvasPointToNormalizedPoint(point, { width: 1280, height: 720 })).toEqual({ x: 0, y: 0 });
    expect(normalizedPointToCanvasPoint({ x: 0.5, y: -0.5 }, { width: 1280, height: 720 })).toEqual({ x: 960, y: 180 });
    expect(screenDeltaToCanvasDelta({ x: 64, y: -36 }, viewport)).toEqual({ x: 128, y: -72 });
  });

  it('guards zero-sized viewports and normalizes rotation bounds', () => {
    const viewport = { left: 10, top: 10, width: 0, height: 0, canvasWidth: 1280, canvasHeight: 720 };

    expect(screenPointToCanvasPoint({ x: 11, y: 11 }, viewport)).toEqual({ x: 1280, y: 720 });
    expect(screenDeltaToCanvasDelta({ x: 1, y: -1 }, viewport)).toEqual({ x: 1280, y: -720 });
    expect(normalizeCanvasRotation(181)).toBe(-179);
    expect(normalizeCanvasRotation(-181)).toBe(179);
    expect(normalizeCanvasRotation(Number.NaN)).toBe(0);
  });

  it('builds rotated transform boxes and hit tests in local clip space', () => {
    const box = buildClipTransformBox({
      transform: { x: 10, y: -20, scale: 1, scaleX: 0.5, scaleY: 0.25, rotation: 30, opacity: 1 },
      sourceWidth: 400,
      sourceHeight: 200,
      canvasWidth: 1280,
      canvasHeight: 720
    });

    expect(box.center).toEqual({ x: 650, y: 340 });
    expect(box.width).toBe(200);
    expect(box.height).toBe(50);
    expect(hitTestClipTransformBox(box.center, box)).toBe(true);
    expect(hitTestClipTransformBox({ x: 20, y: 20 }, box)).toBe(false);
  });

  it('moves, resizes, and rotates transforms with normalized output bounds', () => {
    const moved = moveTransformByCanvasDelta({ x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 }, { x: 50, y: -25 });
    expect(moved).toMatchObject({ x: 50, y: -25 });

    const resized = resizeClipTransform({
      transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
      sourceWidth: 200,
      sourceHeight: 100,
      canvasWidth: 1280,
      canvasHeight: 720,
      handle: 'se',
      currentPoint: { x: 840, y: 460 },
      keepAspectRatio: true,
      fromCenter: true
    });
    expect(resized.scaleX).toBe(2);
    expect(resized.scaleY).toBe(2);
    expect(resized.x).toBe(0);
    expect(resized.y).toBe(0);

    const rotated = rotateClipTransform({
      transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
      canvasWidth: 1280,
      canvasHeight: 720,
      currentPoint: { x: 640, y: 720 }
    });
    expect(rotated.rotation).toBe(180);
  });

  it('resizes edge handles from the opposite side when not scaling from center', () => {
    const resized = resizeClipTransform({
      transform: { x: 0, y: 0, scale: 1, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 },
      sourceWidth: 200,
      sourceHeight: 100,
      canvasWidth: 1280,
      canvasHeight: 720,
      handle: 'e',
      currentPoint: { x: 940, y: 360 },
      keepAspectRatio: false,
      fromCenter: false
    });

    expect(resized.scaleX).toBe(2);
    expect(resized.scaleY).toBe(1);
    expect(resized.x).toBe(100);
    expect(resized.y).toBe(0);
  });

  it('uses height as the primary axis for vertical aspect-locked resizing', () => {
    const resized = resizeClipTransform({
      transform: { x: 0, y: 0, scale: 1, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 },
      sourceWidth: 200,
      sourceHeight: 100,
      canvasWidth: 1280,
      canvasHeight: 720,
      handle: 's',
      currentPoint: { x: 640, y: 510 },
      keepAspectRatio: true,
      fromCenter: true
    });

    expect(resized.scaleX).toBe(3);
    expect(resized.scaleY).toBe(3);
  });
});
