import { describe, expect, it } from 'vitest';
import { getMediaKeyboardNavigationIndex, inferMediaKeyboardColumnCount } from './media-keyboard';

describe('media keyboard navigation', () => {
  it('moves focus by row and column inside the media grid', () => {
    expect(getMediaKeyboardNavigationIndex({ currentIndex: 1, itemCount: 6, columnCount: 3, key: 'ArrowRight' })).toBe(
      2,
    );
    expect(getMediaKeyboardNavigationIndex({ currentIndex: 3, itemCount: 6, columnCount: 3, key: 'ArrowUp' })).toBe(0);
    expect(getMediaKeyboardNavigationIndex({ currentIndex: 2, itemCount: 6, columnCount: 3, key: 'ArrowDown' })).toBe(
      5,
    );
    expect(getMediaKeyboardNavigationIndex({ currentIndex: 0, itemCount: 6, columnCount: 3, key: 'ArrowLeft' })).toBe(
      0,
    );
  });

  it('infers the number of visible media columns from card row positions', () => {
    expect(inferMediaKeyboardColumnCount([10, 10, 10, 140, 140])).toBe(3);
    expect(inferMediaKeyboardColumnCount([10])).toBe(1);
  });
});
