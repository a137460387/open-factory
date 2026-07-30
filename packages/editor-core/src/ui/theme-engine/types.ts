/**
 * Theme engine type definitions
 */

export type ThemeMode = 'light' | 'dark' | 'auto' | 'custom';

/** Color format */
export type ColorFormat = 'hex' | 'rgb' | 'hsl' | 'oklch';

/** Theme colors */
export interface ThemeColors {
  // Base colors
  primary: string;
  secondary: string;
  accent: string;
  success: string;
  warning: string;
  error: string;
  info: string;

  // Background colors
  background: string;
  backgroundSecondary: string;
  backgroundTertiary: string;
  surface: string;
  surfaceVariant: string;

  // Text colors
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textDisabled: string;
  textInverse: string;

  // Border colors
  border: string;
  borderLight: string;
  borderHeavy: string;

  // Interaction colors
  hover: string;
  active: string;
  focus: string;
  selected: string;
  disabled: string;

  // Component-specific colors
  timeline: {
    background: string;
    track: string;
    clip: string;
    clipSelected: string;
    clipHover: string;
    playhead: string;
    marker: string;
    waveform: string;
    grid: string;
    ruler: string;
  };

  preview: {
    background: string;
    border: string;
    controls: string;
    progressBar: string;
    timecode: string;
  };

  media: {
    background: string;
    thumbnail: string;
    selected: string;
    hover: string;
    info: string;
  };

  effects: {
    background: string;
    category: string;
    effect: string;
    applied: string;
    disabled: string;
  };
}

/** Timeline style */
export interface TimelineStyle {
  // Track style
  trackHeight: number;
  trackSpacing: number;
  trackBorderWidth: number;
  trackBorderColor: string;

  // Clip style
  clipBorderRadius: number;
  clipBorderWidth: number;
  clipShadowBlur: number;
  clipShadowColor: string;

  // Waveform style
  waveformHeight: number;
  waveformColor: string;
  waveformGradientStart: string;
  waveformGradientEnd: string;

  // Playhead style
  playheadWidth: number;
  playheadColor: string;
  playheadHandleSize: number;
  playheadHandleColor: string;

  // Marker style
  markerSize: number;
  markerColor: string;
  markerBorderColor: string;

  // Grid style
  gridLineWidth: number;
  gridLineColor: string;
  gridLineDash: number[];

  // Ruler style
  rulerHeight: number;
  rulerFontSize: number;
  rulerFontColor: string;
  rulerTickColor: string;

  // Zoom level
  zoomLevel: number;
  pixelsPerSecond: number;
}

/** Layout config */
export interface LayoutConfig {
  // Panel layout
  panels: {
    menuBar: { visible: boolean; height: number };
    toolbar: { visible: boolean; height: number };
    timeline: { visible: boolean; height: number; position: 'bottom' | 'top' };
    preview: { visible: boolean; width: number; position: 'left' | 'right' };
    mediaPanel: { visible: boolean; width: number; position: 'left' | 'right' };
    effectsPanel: { visible: boolean; width: number; position: 'left' | 'right' };
    propertiesPanel: { visible: boolean; width: number; position: 'left' | 'right' };
    statusBar: { visible: boolean; height: number };
  };

  // Splitter style
  splitter: {
    width: number;
    color: string;
    hoverColor: string;
    activeColor: string;
  };

  // Responsive breakpoints
  breakpoints: {
    mobile: number;
    tablet: number;
    desktop: number;
    wide: number;
  };

  // Grid system
  grid: {
    columns: number;
    gutter: number;
    margin: number;
  };
}

/** Font config */
export interface FontConfig {
  families: {
    sans: string;
    serif: string;
    mono: string;
    display: string;
  };

  sizes: {
    xs: string;
    sm: string;
    base: string;
    lg: string;
    xl: string;
    '2xl': string;
    '3xl': string;
    '4xl': string;
  };

  weights: {
    light: number;
    normal: number;
    medium: number;
    semibold: number;
    bold: number;
  };

  lineHeights: {
    tight: number;
    normal: number;
    relaxed: number;
    loose: number;
  };
}

/** Animation config */
export interface AnimationConfig {
  durations: {
    instant: number;
    fast: number;
    normal: number;
    slow: number;
    slower: number;
  };

  easings: {
    linear: string;
    easeIn: string;
    easeOut: string;
    easeInOut: string;
    bounce: string;
    elastic: string;
  };

  enabled: boolean;
  reducedMotion: boolean;
}

/** Full theme config */
export interface ThemeConfig {
  id: string;
  name: string;
  description: string;
  mode: ThemeMode;
  colors: ThemeColors;
  timeline: TimelineStyle;
  layout: LayoutConfig;
  fonts: FontConfig;
  animations: AnimationConfig;
  isDefault: boolean;
  createdAt: number;
  updatedAt: number;
}

/** Theme preset */
export interface ThemePreset {
  id: string;
  name: string;
  description: string;
  preview: string; // Preview image URL or base64
  config: Partial<ThemeConfig>;
}

/** Theme stats */
export interface ThemeStats {
  totalThemes: number;
  customThemes: number;
  activeTheme: string;
  lastModified: number;
}
