import { describe, expect, it } from 'vitest';
import { resolveSpectrumContextMenu, resolveSpectrumSelection, resolveSpectrumTime } from './audioSpectrum';

describe('audio spectrum editor geometry', () => {
  it('maps a canvas click to media time', () => {
    expect(resolveSpectrumTime(250, 50, 400, 20)).toBe(10);
    expect(resolveSpectrumTime(20, 50, 400, 20)).toBe(0);
    expect(resolveSpectrumTime(500, 50, 400, 20)).toBe(20);
  });

  it('converts dragged region to ordered in/out points', () => {
    expect(resolveSpectrumSelection(350, 150, 50, 400, 40)).toEqual({ inPoint: 10, outPoint: 30 });
  });

  it('builds a context menu state for splitting at the right-clicked time', () => {
    expect(resolveSpectrumContextMenu(275.2, 140.8, 75, 400, 80)).toEqual({ x: 275, y: 141, time: 40.04 });
  });
});
