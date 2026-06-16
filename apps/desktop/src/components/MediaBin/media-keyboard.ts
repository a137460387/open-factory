export function getMediaKeyboardNavigationIndex(input: {
  currentIndex: number;
  itemCount: number;
  columnCount: number;
  key: string;
}): number | undefined {
  if (input.itemCount <= 0 || input.currentIndex < 0 || input.currentIndex >= input.itemCount) {
    return undefined;
  }
  const columns = Math.max(1, input.columnCount);
  const delta =
    input.key === 'ArrowLeft'
      ? -1
      : input.key === 'ArrowRight'
        ? 1
        : input.key === 'ArrowUp'
          ? -columns
          : input.key === 'ArrowDown'
            ? columns
            : 0;
  if (delta === 0) {
    return undefined;
  }
  return Math.min(input.itemCount - 1, Math.max(0, input.currentIndex + delta));
}

export function inferMediaKeyboardColumnCount(tops: readonly number[]): number {
  if (tops.length <= 1) {
    return 1;
  }
  const firstTop = tops[0];
  const firstDifferentRow = tops.findIndex((top) => Math.abs(top - firstTop) > 2);
  return firstDifferentRow > 0 ? firstDifferentRow : tops.length;
}
