import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BUILTIN_THEMES, DEFAULT_THEME_SETTINGS } from './theme';
import { applyThemeSettings, getCurrentTheme, getCurrentThemeSettings, subscribeTheme, useTheme } from './useTheme';

describe('useTheme store', () => {
  afterEach(() => {
    applyThemeSettings(DEFAULT_THEME_SETTINGS);
    vi.restoreAllMocks();
  });

  it('notifies subscribers and exposes canvas colors for non-CSS consumers', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeTheme(listener);

    applyThemeSettings({ activeThemeId: 'light', customThemes: [] });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(getCurrentThemeSettings().activeThemeId).toBe('light');
    expect(getCurrentTheme().colors.canvasBackground).toBe(BUILTIN_THEMES.light.colors.canvasBackground);

    unsubscribe();
  });

  it('lets Canvas-style components read the current theme through the hook', () => {
    applyThemeSettings({ activeThemeId: 'oled', customThemes: [] });

    function ThemeProbe() {
      const theme = useTheme();
      return createElement('span', { 'data-canvas-bg': theme.colors.canvasBackground });
    }

    expect(renderToString(createElement(ThemeProbe))).toContain(
      `data-canvas-bg="${BUILTIN_THEMES.oled.colors.canvasBackground}"`,
    );
  });
});
