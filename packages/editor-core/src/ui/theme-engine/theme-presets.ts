/**
 * Theme presets
 */

import type { ThemePreset } from './types.js';
import { DEFAULT_DARK_THEME, DEFAULT_LIGHT_THEME } from './default-themes.js';

/** Theme preset list */
export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'dark-blue',
    name: '深蓝',
    description: '专业深蓝色主题',
    preview: '',
    config: {
      colors: {
        ...DEFAULT_DARK_THEME.colors,
        primary: '#1e40af',
        secondary: '#5b21b6',
        accent: '#0e7490',
        timeline: {
          ...DEFAULT_DARK_THEME.colors.timeline,
          background: '#0c1425',
          track: '#1e293b',
          clip: '#1e40af',
          clipSelected: '#1e3a8a',
          clipHover: '#3b82f6',
        },
      },
    },
  },
  {
    id: 'dark-purple',
    name: '暗紫',
    description: '创意暗紫色主题',
    preview: '',
    config: {
      colors: {
        ...DEFAULT_DARK_THEME.colors,
        primary: '#7c3aed',
        secondary: '#a855f7',
        accent: '#c084fc',
        timeline: {
          ...DEFAULT_DARK_THEME.colors.timeline,
          background: '#0f0520',
          track: '#1e1033',
          clip: '#7c3aed',
          clipSelected: '#6d28d9',
          clipHover: '#8b5cf6',
        },
      },
    },
  },
  {
    id: 'light-minimal',
    name: '极简浅色',
    description: '简洁明亮的浅色主题',
    preview: '',
    config: {
      ...DEFAULT_LIGHT_THEME,
      id: 'light-minimal',
      name: '极简浅色',
    },
  },
  {
    id: 'amoled-dark',
    name: 'AMOLED 黑',
    description: '纯黑 AMOLED 主题',
    preview: '',
    config: {
      colors: {
        ...DEFAULT_DARK_THEME.colors,
        background: '#000000',
        backgroundSecondary: '#0a0a0a',
        backgroundTertiary: '#141414',
        surface: '#0a0a0a',
        surfaceVariant: '#141414',
        timeline: {
          ...DEFAULT_DARK_THEME.colors.timeline,
          background: '#000000',
          track: '#0a0a0a',
        },
      },
    },
  },
];
