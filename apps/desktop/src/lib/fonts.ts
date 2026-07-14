const GENERIC_FONT_FAMILIES = new Set([
  'serif',
  'sans-serif',
  'monospace',
  'cursive',
  'fantasy',
  'system-ui',
  'ui-serif',
  'ui-sans-serif',
  'ui-monospace',
]);

export function isFontFamilyAvailable(fontFamily: string): boolean {
  const family = fontFamily.trim();
  if (!family || isGenericFontFamily(family) || typeof document === 'undefined') {
    return true;
  }
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) {
    return true;
  }
  const sample = 'mmmmmmmmmmlli';
  const size = '72px';
  const baselines = ['monospace', 'serif', 'sans-serif'].map((baseline) => {
    context.font = `${size} ${baseline}`;
    return context.measureText(sample).width;
  });
  return ['monospace', 'serif', 'sans-serif'].some((baseline, index) => {
    context.font = `${size} "${family}", ${baseline}`;
    return Math.abs(context.measureText(sample).width - baselines[index]) > 0.1;
  });
}

function isGenericFontFamily(fontFamily: string): boolean {
  return GENERIC_FONT_FAMILIES.has(fontFamily.trim().toLowerCase());
}
