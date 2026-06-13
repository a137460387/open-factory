import { describe, expect, it } from 'vitest';
import { DEFAULT_TEXT_PATH, buildPathTextFrameLayouts, getTextPathLength, layoutTextAlongPath, resolvePathTextStartOffset, sampleTextPath } from '../src';

describe('text path layout', () => {
  it('samples bezier paths with cumulative distance and tangent angle', () => {
    const samples = sampleTextPath(DEFAULT_TEXT_PATH.path, 1000, 500);

    expect(samples.length).toBeGreaterThan(12);
    expect(samples[0]).toMatchObject({ x: 140, y: 290, distance: 0 });
    expect(samples.at(-1)?.x).toBe(860);
    expect(samples.at(-1)?.distance).toBeGreaterThan(760);
    expect(samples.some((sample) => sample.angle < 0)).toBe(true);
    expect(samples.some((sample) => sample.angle > 0)).toBe(true);
  });

  it('lays characters along a bezier path using start offset and measured advances', () => {
    const first = layoutTextAlongPath({
      text: 'AB',
      path: DEFAULT_TEXT_PATH.path,
      width: 1000,
      height: 500,
      fontSize: 50,
      startOffset: 0,
      letterSpacing: 10,
      rotateCharacters: true,
      measureCharacter: () => 40
    });
    const shifted = layoutTextAlongPath({
      text: 'AB',
      path: DEFAULT_TEXT_PATH.path,
      width: 1000,
      height: 500,
      fontSize: 50,
      startOffset: 0.25,
      letterSpacing: 10,
      rotateCharacters: true,
      measureCharacter: () => 40
    });

    expect(first).toHaveLength(2);
    expect(shifted).toHaveLength(2);
    expect(shifted[0].x).toBeGreaterThan(first[0].x);
    expect(first[0].angle).not.toBe(0);
  });

  it('builds frame layouts from pathStartOffset keyframes and can disable per-character rotation', () => {
    const frames = buildPathTextFrameLayouts({
      text: 'A',
      path: DEFAULT_TEXT_PATH.path,
      pathText: { ...DEFAULT_TEXT_PATH, enabled: true, rotateCharacters: false },
      keyframes: {
        pathStartOffset: [
          { id: 'kf-a', time: 0, value: 0, easing: 'linear' },
          { id: 'kf-b', time: 1, value: 0.5, easing: 'linear' }
        ]
      },
      duration: 1,
      fps: 2,
      width: 1000,
      height: 500,
      fontSize: 50,
      letterSpacing: 0,
      rotateCharacters: false
    });

    expect(frames).toHaveLength(2);
    expect(resolvePathTextStartOffset({ ...DEFAULT_TEXT_PATH, enabled: true }, frames.length ? { pathStartOffset: [{ id: 'kf', time: 1, value: 0.5, easing: 'linear' }] } : undefined, 1)).toBe(0.5);
    expect(frames[1].chars[0].x).toBeGreaterThan(frames[0].chars[0].x);
    expect(frames[0].chars[0].angle).toBe(0);
  });

  it('handles empty and collapsed paths without producing character layouts', () => {
    expect(sampleTextPath(undefined, 100, 100)).toEqual([]);
    expect(
      sampleTextPath(
        [
          { x: 0.5, y: 0.5 },
          { x: 0.5, y: 0.5 }
        ],
        100,
        100
      )
    ).toEqual([]);

    const emptyLayout = layoutTextAlongPath({
      text: 'A',
      path: undefined,
      width: 100,
      height: 100,
      fontSize: 20,
      startOffset: 0,
      letterSpacing: 0,
      rotateCharacters: true
    });
    expect(emptyLayout).toEqual([]);
  });

  it('estimates whitespace advances and clamps invalid offsets', () => {
    const path = [
      { x: 0, y: 0.5 },
      { x: 1, y: 0.5 }
    ];
    const layout = layoutTextAlongPath({
      text: ' A',
      path,
      width: 200,
      height: 100,
      fontSize: 20,
      startOffset: Number.NaN,
      letterSpacing: -5,
      rotateCharacters: false,
      offsetX: Number.NaN,
      offsetY: 10
    });

    expect(getTextPathLength(path, 200, 100)).toBe(200);
    expect(layout).toHaveLength(2);
    expect(layout[0]).toMatchObject({ char: ' ', x: 3.5, y: 60, angle: 0 });
    expect(layout[1].x).toBeGreaterThan(layout[0].x);
  });
});
