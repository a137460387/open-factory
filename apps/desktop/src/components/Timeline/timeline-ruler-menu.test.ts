import { describe, expect, it } from 'vitest';
import { buildRulerContextMenuItems } from './timeline-ruler-menu';

describe('timeline ruler context menu', () => {
  it('exposes the expected ruler right-click actions', () => {
    expect(buildRulerContextMenuItems().map((item) => item.action)).toEqual([
      'add-marker',
      'add-protected-range',
      'set-in',
      'set-out',
      'jump-timecode',
    ]);
    expect(buildRulerContextMenuItems().map((item) => item.testId)).toEqual([
      'ruler-context-add-marker',
      'ruler-context-add-protected-range',
      'ruler-context-set-in',
      'ruler-context-set-out',
      'ruler-context-jump-timecode',
    ]);
  });
});
