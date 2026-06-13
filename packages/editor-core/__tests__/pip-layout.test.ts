import { describe, expect, it } from 'vitest';
import { calculatePiPTransform } from '../src';

describe('PiP layout helpers', () => {
  it.each([
    ['bottom-right', { x: 448, y: 238 }],
    ['bottom-left', { x: -448, y: 238 }],
    ['top-right', { x: 448, y: -238 }],
    ['top-left', { x: -448, y: -238 }]
  ] as const)('calculates %s preset coordinates', (position, expected) => {
    expect(
      calculatePiPTransform({
        position,
        canvasWidth: 1280,
        canvasHeight: 720,
        sourceWidth: 1280,
        sourceHeight: 720,
        scale: 0.25,
        margin: 32
      })
    ).toMatchObject({
      ...expected,
      scale: 0.25,
      scaleX: 0.25,
      scaleY: 0.25,
      rotation: 0,
      opacity: 1
    });
  });
});
