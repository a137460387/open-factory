import { describe, expect, it } from 'vitest';
import { closePathPoints, createMask, isPathMaskClosed, normalizePathPoints, pathPointsToSvgPath, samplePathPoints, triangulatePathMask } from '../src';

describe('path masks', () => {
  it('detects closed paths only when the final anchor returns to the first anchor', () => {
    const open = [
      { x: 0.1, y: 0.1 },
      { x: 0.8, y: 0.1 },
      { x: 0.8, y: 0.8 }
    ];
    const closed = closePathPoints(open);

    expect(isPathMaskClosed(open)).toBe(false);
    expect(isPathMaskClosed(closed)).toBe(true);
    expect(closed.at(-1)).toMatchObject(closed[0]);
  });

  it('normalizes path points and bezier handles on path masks', () => {
    const mask = createMask({
      id: 'mask-path',
      type: 'path',
      path: [
        { x: -1, y: 0.25, handleOut: { x: 0.25, y: 2 } },
        { x: 1.2, y: 0.75, handleIn: { x: Number.NaN, y: 0.5 } }
      ]
    });

    expect(mask).toMatchObject({
      id: 'mask-path',
      type: 'path',
      path: [
        { x: 0, y: 0.25, handleOut: { x: 0.25, y: 1 } },
        { x: 1, y: 0.75 }
      ]
    });
  });

  it('handles empty, invalid, and already closed path inputs without adding unsafe points', () => {
    const alreadyClosed = [
      { x: 0.2, y: 0.2, handleIn: { x: 0.1, y: 0.2 } },
      { x: 0.8, y: 0.2 },
      { x: 0.5, y: 0.8 },
      { x: 0.2, y: 0.2, handleOut: { x: 0.3, y: 0.2 } }
    ];

    expect(normalizePathPoints(undefined)).toEqual([]);
    expect(normalizePathPoints([{ x: Number.NaN, y: 0.5 }, undefined as never, { x: 0.4, y: 0.5, handleIn: { x: 0.3, y: 0.4 } }])).toEqual([
      { x: 0.4, y: 0.5, handleIn: { x: 0.3, y: 0.4 } }
    ]);
    expect(closePathPoints([{ x: 0.1, y: 0.1 }, { x: 0.5, y: 0.1 }])).toHaveLength(2);
    expect(closePathPoints(alreadyClosed)).toHaveLength(4);
    expect(samplePathPoints(undefined)).toEqual([]);
    expect(pathPointsToSvgPath(undefined)).toBe('');
    expect(triangulatePathMask(undefined)).toEqual({ vertices: [], indices: [] });
  });

  it('triangulates a simple closed polygon with earcut-compatible vertices', () => {
    const mesh = triangulatePathMask(
      closePathPoints([
        { x: 0.2, y: 0.2 },
        { x: 0.8, y: 0.2 },
        { x: 0.8, y: 0.8 },
        { x: 0.2, y: 0.8 }
      ])
    );

    expect(mesh.vertices).toEqual([0.2, 0.2, 0.8, 0.2, 0.8, 0.8, 0.2, 0.8]);
    expect(mesh.indices).toHaveLength(6);
    expect(new Set(mesh.indices)).toEqual(new Set([0, 1, 2, 3]));
  });

  it('samples bezier handles and serializes path masks to SVG paths', () => {
    const points = closePathPoints([
      { x: 0.1, y: 0.5, handleOut: { x: 0.3, y: 0.1 } },
      { x: 0.9, y: 0.5, handleIn: { x: 0.7, y: 0.1 } },
      { x: 0.5, y: 0.9 }
    ]);

    expect(samplePathPoints(points).length).toBeGreaterThan(3);
    expect(pathPointsToSvgPath(points, 100, 100)).toContain('C 30 10 70 10 90 50');
    expect(pathPointsToSvgPath(points, 100, 100).endsWith('Z')).toBe(true);
  });
});
