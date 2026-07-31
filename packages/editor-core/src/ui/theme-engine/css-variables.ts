/**
 * CSS variable generation from theme config
 */

import type { ThemeConfig } from './types.js';

/**
 * Generate CSS variables string from a theme config
 */
export function generateCSSVariables(theme: ThemeConfig): string {
  const t = theme;
  const vars: string[] = [];

  // Colors
  vars.push(`--color-primary: ${t.colors.primary};`);
  vars.push(`--color-secondary: ${t.colors.secondary};`);
  vars.push(`--color-accent: ${t.colors.accent};`);
  vars.push(`--color-success: ${t.colors.success};`);
  vars.push(`--color-warning: ${t.colors.warning};`);
  vars.push(`--color-error: ${t.colors.error};`);
  vars.push(`--color-info: ${t.colors.info};`);

  vars.push(`--color-background: ${t.colors.background};`);
  vars.push(`--color-background-secondary: ${t.colors.backgroundSecondary};`);
  vars.push(`--color-background-tertiary: ${t.colors.backgroundTertiary};`);
  vars.push(`--color-surface: ${t.colors.surface};`);
  vars.push(`--color-surface-variant: ${t.colors.surfaceVariant};`);

  vars.push(`--color-text-primary: ${t.colors.textPrimary};`);
  vars.push(`--color-text-secondary: ${t.colors.textSecondary};`);
  vars.push(`--color-text-tertiary: ${t.colors.textTertiary};`);
  vars.push(`--color-text-disabled: ${t.colors.textDisabled};`);
  vars.push(`--color-text-inverse: ${t.colors.textInverse};`);

  vars.push(`--color-border: ${t.colors.border};`);
  vars.push(`--color-border-light: ${t.colors.borderLight};`);
  vars.push(`--color-border-heavy: ${t.colors.borderHeavy};`);

  // Timeline
  vars.push(`--timeline-background: ${t.colors.timeline.background};`);
  vars.push(`--timeline-track: ${t.colors.timeline.track};`);
  vars.push(`--timeline-clip: ${t.colors.timeline.clip};`);
  vars.push(`--timeline-clip-selected: ${t.colors.timeline.clipSelected};`);
  vars.push(`--timeline-clip-hover: ${t.colors.timeline.clipHover};`);
  vars.push(`--timeline-playhead: ${t.colors.timeline.playhead};`);
  vars.push(`--timeline-marker: ${t.colors.timeline.marker};`);
  vars.push(`--timeline-waveform: ${t.colors.timeline.waveform};`);
  vars.push(`--timeline-grid: ${t.colors.timeline.grid};`);
  vars.push(`--timeline-ruler: ${t.colors.timeline.ruler};`);

  // Fonts
  vars.push(`--font-sans: ${t.fonts.families.sans};`);
  vars.push(`--font-serif: ${t.fonts.families.serif};`);
  vars.push(`--font-mono: ${t.fonts.families.mono};`);
  vars.push(`--font-display: ${t.fonts.families.display};`);

  // Animations
  vars.push(`--duration-instant: ${t.animations.durations.instant}ms;`);
  vars.push(`--duration-fast: ${t.animations.durations.fast}ms;`);
  vars.push(`--duration-normal: ${t.animations.durations.normal}ms;`);
  vars.push(`--duration-slow: ${t.animations.durations.slow}ms;`);
  vars.push(`--duration-slower: ${t.animations.durations.slower}ms;`);

  vars.push(`--ease-linear: ${t.animations.easings.linear};`);
  vars.push(`--ease-in: ${t.animations.easings.easeIn};`);
  vars.push(`--ease-out: ${t.animations.easings.easeOut};`);
  vars.push(`--ease-in-out: ${t.animations.easings.easeInOut};`);

  return `:root {\n  ${vars.join('\n  ')}\n}`;
}
