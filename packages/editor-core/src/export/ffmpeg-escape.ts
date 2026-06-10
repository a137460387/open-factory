export function normalizeFfmpegPath(path: string): string {
  return path.replace(/\\/g, '/');
}

export function escapeDrawtextValue(value: string): string {
  return normalizeFfmpegPath(value)
    .replace(/\\/g, '\\\\')
    .replace(/:/g, '\\\\:')
    .replace(/'/g, "\\'")
    .replace(/%/g, '\\%');
}

export function cssColorToFfmpeg(color: string): string {
  const trimmed = color.trim();
  const shortHex = trimmed.match(/^#([0-9a-fA-F]{3})$/);
  if (shortHex) {
    const expanded = shortHex[1]
      .split('')
      .map((part) => part + part)
      .join('');
    return `0x${expanded.toLowerCase()}`;
  }
  const longHex = trimmed.match(/^#([0-9a-fA-F]{6})$/);
  if (longHex) {
    return `0x${longHex[1].toLowerCase()}`;
  }
  return trimmed || 'white';
}

export function formatFfmpegSeconds(value: number): string {
  const rounded = Math.round(Math.max(0, value) * 1000) / 1000;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(/0+$/g, '').replace(/\.$/g, '');
}

export function quoteForDisplay(value: string): string {
  return /\s/.test(value) ? `"${value.replace(/"/g, '\\"')}"` : value;
}
