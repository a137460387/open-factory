import { describe, it, expect, vi } from 'vitest';

// Mock dependencies that settings-normalize.ts imports
vi.mock('../../model', () => ({
  normalizeSubtitleLanguage: (lang: string) => lang,
  normalizeSubtitleLanguageList: (langs?: string[]) => langs,
}));

vi.mock('../../audio-visualization-themes', () => ({
  normalizeAudioVisualizationTheme: (theme: unknown) => theme,
}));

vi.mock('../../reframe', () => ({
  clampReframeOffset: (v: number) => Math.min(1, Math.max(-1, v)),
  normalizeTargetAspectRatio: (v: string) => v,
  resolveReframeDimensions: (w: number, h: number) => ({ width: w, height: h }),
}));

vi.mock('../../color-management', () => ({
  DEFAULT_EXPORT_COLOR_MANAGEMENT: {},
}));

vi.mock('../../time', () => ({
  round: (v: number, _precision?: number) => Math.round(v * 1e6) / 1e6,
}));

vi.mock('../ffmpeg-escape', () => ({
  cssColorToFfmpeg: (color: string) => color.replace('#', '0x'),
  escapeDrawtextValue: (v: string) => v.replace(/'/g, "\\'").replace(/:/g, '\\:'),
  formatFfmpegSeconds: (v: number) => String(Math.round(v * 1000) / 1000),
  normalizeFfmpegPath: (p: string) => p,
}));

import {
  DEFAULT_EXPORT_SETTINGS,
  SETPTS_EXPRESSION_LIMIT,
  GIF_PALETTE_PLACEHOLDER,
  LOUDNORM_MEASURED_I_PLACEHOLDER,
  LOUDNORM_MEASURED_TP_PLACEHOLDER,
  LOUDNORM_MEASURED_LRA_PLACEHOLDER,
  LOUDNORM_MEASURED_THRESH_PLACEHOLDER,
  LOUDNORM_OFFSET_PLACEHOLDER,
  WATERMARK_MARGIN_PX,
  SLATE_DURATION_SECONDS,
  EXPORT_PREVIEW_SAMPLE_KINDS,
  DEFAULT_EXPORT_MASTER_EQ_BANDS,
  DEFAULT_EXPORT_MASTER_PROCESSING,
  normalizeLoudnessNormalization,
  normalizeVideoProfile,
  normalizeExportAudioVisualization,
  normalizeAudioVisualizationBackground,
  normalizeHexColor,
  parseHexColor,
  toHexChannel,
  buildMasterAudioFilters,
  buildEqualizerFilters,
  formatFfmpegNumber,
  formatOpacity,
  normalizeExportReframeSettings,
  normalizeExportSpatialAudioAssets,
  mergeExportMetadata,
  normalizeExportMasterProcessing,
  hasExportMasterProcessing,
  normalizeExportMasterEq,
  normalizeExportMasterEqBand,
  normalizeSettingsForExportFormat,
  constrainDimensions,
  normalizeExportWatermark,
  normalizeWatermarkPosition,
  normalizeTimecodeBurnIn,
  normalizeExportSlate,
  buildTimecodeBurnInFilter,
  buildSlateVideoFilters,
  buildWatermarkFilters,
  buildWatermarkExpression,
  calculateWatermarkOverlayPosition,
  finiteNumber,
  buildGifExportPasses,
  buildExportRangeOutputArgs,
  buildLoudnessNormalizationPasses,
  buildFfmpegFullArgs,
} from '../src/export/ffmpeg-builder/settings-normalize';

// Helper to create minimal ExportSettings
function makeSettings(overrides: Record<string, unknown> = {}) {
  return {
    ...DEFAULT_EXPORT_SETTINGS,
    outputPath: '/tmp/output.mp4',
    ...overrides,
  } as ReturnType<typeof normalizeExportReframeSettings>;
}

describe('settings-normalize constants', () => {
  it('exports correct placeholder constants', () => {
    expect(SETPTS_EXPRESSION_LIMIT).toBe(4096);
    expect(GIF_PALETTE_PLACEHOLDER).toBe('__GIF_PALETTE_open_factory__');
    expect(LOUDNORM_MEASURED_I_PLACEHOLDER).toBe('__LOUDNORM_MEASURED_I__');
    expect(LOUDNORM_MEASURED_TP_PLACEHOLDER).toBe('__LOUDNORM_MEASURED_TP__');
    expect(LOUDNORM_MEASURED_LRA_PLACEHOLDER).toBe('__LOUDNORM_MEASURED_LRA__');
    expect(LOUDNORM_MEASURED_THRESH_PLACEHOLDER).toBe('__LOUDNORM_MEASURED_THRESH__');
    expect(LOUDNORM_OFFSET_PLACEHOLDER).toBe('__LOUDNORM_OFFSET__');
    expect(WATERMARK_MARGIN_PX).toBe(24);
    expect(SLATE_DURATION_SECONDS).toBe(0.5);
  });

  it('has valid default export settings', () => {
    expect(DEFAULT_EXPORT_SETTINGS.width).toBe(1280);
    expect(DEFAULT_EXPORT_SETTINGS.height).toBe(720);
    expect(DEFAULT_EXPORT_SETTINGS.fps).toBe(30);
    expect(DEFAULT_EXPORT_SETTINGS.videoCodec).toBe('libx264');
    expect(DEFAULT_EXPORT_SETTINGS.audioCodec).toBe('aac');
    expect(DEFAULT_EXPORT_SETTINGS.format).toBe('mp4');
  });

  it('has 8 default EQ bands', () => {
    expect(DEFAULT_EXPORT_MASTER_EQ_BANDS).toHaveLength(8);
    expect(DEFAULT_EXPORT_MASTER_EQ_BANDS[0].frequency).toBe(31);
    expect(DEFAULT_EXPORT_MASTER_EQ_BANDS[7].frequency).toBe(12000);
  });

  it('has default master processing disabled', () => {
    expect(DEFAULT_EXPORT_MASTER_PROCESSING.eq.enabled).toBe(false);
    expect(DEFAULT_EXPORT_MASTER_PROCESSING.stereoEnhancer.enabled).toBe(false);
    expect(DEFAULT_EXPORT_MASTER_PROCESSING.limiter.enabled).toBe(false);
  });

  it('exports preview sample kinds', () => {
    expect(EXPORT_PREVIEW_SAMPLE_KINDS).toEqual(['start', 'middle', 'end']);
  });
});

describe('normalizeLoudnessNormalization', () => {
  it('accepts youtube', () => {
    expect(normalizeLoudnessNormalization('youtube')).toBe('youtube');
  });

  it('accepts ebu-r128', () => {
    expect(normalizeLoudnessNormalization('ebu-r128')).toBe('ebu-r128');
  });

  it('returns off for undefined', () => {
    expect(normalizeLoudnessNormalization(undefined)).toBe('off');
  });

  it('returns off for invalid value', () => {
    expect(normalizeLoudnessNormalization('loud' as never)).toBe('off');
  });
});

describe('normalizeVideoProfile', () => {
  it('accepts baseline', () => {
    expect(normalizeVideoProfile('baseline')).toBe('baseline');
  });

  it('accepts main', () => {
    expect(normalizeVideoProfile('main')).toBe('main');
  });

  it('accepts high', () => {
    expect(normalizeVideoProfile('high')).toBe('high');
  });

  it('returns undefined for invalid', () => {
    expect(normalizeVideoProfile('super')).toBeUndefined();
  });

  it('returns undefined for undefined input', () => {
    expect(normalizeVideoProfile(undefined)).toBeUndefined();
  });
});

describe('normalizeWatermarkPosition', () => {
  it('accepts all 9 valid positions', () => {
    const positions = [
      'top-left', 'top-center', 'top-right',
      'middle-left', 'center', 'middle-right',
      'bottom-left', 'bottom-center', 'bottom-right',
    ];
    for (const pos of positions) {
      expect(normalizeWatermarkPosition(pos as never)).toBe(pos);
    }
  });

  it('falls back to bottom-right for invalid', () => {
    expect(normalizeWatermarkPosition(undefined)).toBe('bottom-right');
    expect(normalizeWatermarkPosition('middle' as never)).toBe('bottom-right');
  });
});

describe('normalizeExportSlate', () => {
  it('returns enabled when true', () => {
    expect(normalizeExportSlate({ enabled: true })).toEqual({ enabled: true });
  });

  it('returns null when disabled', () => {
    expect(normalizeExportSlate({ enabled: false })).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(normalizeExportSlate(undefined)).toBeNull();
  });
});

describe('finiteNumber', () => {
  it('returns value when finite', () => {
    expect(finiteNumber(42, 0)).toBe(42);
    expect(finiteNumber(0, 99)).toBe(0);
    expect(finiteNumber(-3.14, 0)).toBeCloseTo(-3.14);
  });

  it('returns fallback for undefined', () => {
    expect(finiteNumber(undefined, 10)).toBe(10);
  });

  it('returns fallback for NaN', () => {
    expect(finiteNumber(NaN, 10)).toBe(10);
  });

  it('returns fallback for Infinity', () => {
    expect(finiteNumber(Infinity, 10)).toBe(10);
  });
});

describe('toHexChannel', () => {
  it('converts 0 to 00', () => {
    expect(toHexChannel(0)).toBe('00');
  });

  it('converts 255 to ff', () => {
    expect(toHexChannel(255)).toBe('ff');
  });

  it('clamps below 0', () => {
    expect(toHexChannel(-10)).toBe('00');
  });

  it('clamps above 255', () => {
    expect(toHexChannel(300)).toBe('ff');
  });

  it('pads single digit', () => {
    expect(toHexChannel(15)).toBe('0f');
  });
});

describe('parseHexColor', () => {
  it('parses 6-digit hex', () => {
    expect(parseHexColor('#ff8800', '#000000')).toEqual({ r: 255, g: 136, b: 0 });
  });

  it('parses 3-digit hex', () => {
    expect(parseHexColor('#f80', '#000000')).toEqual({ r: 255, g: 136, b: 0 });
  });

  it('parses without hash', () => {
    expect(parseHexColor('00ff00', '#000000')).toEqual({ r: 0, g: 255, b: 0 });
  });

  it('falls back for invalid input', () => {
    const result = parseHexColor('not-a-color', '#112233');
    expect(result).toEqual({ r: 0x11, g: 0x22, b: 0x33 });
  });

  it('falls back to hardcoded default when fallback equals input', () => {
    const result = parseHexColor('zzz', 'zzz');
    expect(result).toEqual({ r: 5, g: 8, b: 22 });
  });
});

describe('normalizeHexColor', () => {
  it('normalizes valid hex', () => {
    expect(normalizeHexColor('#ABCDEF', '#000000')).toBe('#abcdef');
  });

  it('uses fallback for invalid', () => {
    expect(normalizeHexColor('invalid', '#112233')).toBe('#112233');
  });
});

describe('formatFfmpegNumber', () => {
  it('formats integers without decimals', () => {
    expect(formatFfmpegNumber(42)).toBe('42');
    expect(formatFfmpegNumber(0)).toBe('0');
  });

  it('trims trailing zeros', () => {
    expect(formatFfmpegNumber(1.5)).toBe('1.5');
    expect(formatFfmpegNumber(1.500)).toBe('1.5');
    expect(formatFfmpegNumber(1.123)).toBe('1.123');
  });

  it('rounds to 3 decimal places', () => {
    expect(formatFfmpegNumber(1.123456)).toBe('1.123');
    expect(formatFfmpegNumber(1.9999)).toBe('2');
  });
});

describe('formatOpacity', () => {
  it('clamps between 0 and 1', () => {
    expect(formatOpacity(0.5)).toBe('0.5');
    expect(formatOpacity(-0.5)).toBe('0');
    expect(formatOpacity(1.5)).toBe('1');
  });
});

describe('constrainDimensions', () => {
  it('returns original when within limit', () => {
    expect(constrainDimensions(1920, 1080, 3840)).toEqual({ width: 1920, height: 1080 });
  });

  it('scales down proportionally', () => {
    const result = constrainDimensions(1920, 1080, 960);
    expect(result.width).toBe(960);
    expect(result.height).toBe(540);
  });

  it('handles portrait orientation', () => {
    const result = constrainDimensions(1080, 1920, 960);
    expect(result.width).toBe(540);
    expect(result.height).toBe(960);
  });

  it('handles zero dimensions with defaults', () => {
    const result = constrainDimensions(0, 0, 100);
    expect(result.width).toBeGreaterThan(0);
    expect(result.height).toBeGreaterThan(0);
  });

  it('minimum dimension is 1', () => {
    const result = constrainDimensions(1, 1, 1);
    expect(result.width).toBe(1);
    expect(result.height).toBe(1);
  });
});

describe('buildWatermarkExpression', () => {
  it('top-left uses margin for both x and y', () => {
    const result = buildWatermarkExpression('top-left', 'w', 'h', 'tw', 'th');
    expect(result.x).toBe(String(WATERMARK_MARGIN_PX));
    expect(result.y).toBe(String(WATERMARK_MARGIN_PX));
  });

  it('bottom-right subtracts size and margin', () => {
    const result = buildWatermarkExpression('bottom-right', 'w', 'h', 'tw', 'th');
    expect(result.x).toBe('w-tw-24');
    expect(result.y).toBe('h-th-24');
  });

  it('center calculates midpoint', () => {
    const result = buildWatermarkExpression('center', 'w', 'h', 'tw', 'th');
    expect(result.x).toBe('(w-tw)/2');
    expect(result.y).toBe('(h-th)/2');
  });
});

describe('calculateWatermarkOverlayPosition', () => {
  it('top-left returns margin', () => {
    const result = calculateWatermarkOverlayPosition('top-left', 1920, 1080, 200, 50);
    expect(result.x).toBe(WATERMARK_MARGIN_PX);
    expect(result.y).toBe(WATERMARK_MARGIN_PX);
  });

  it('bottom-right calculates from edges', () => {
    const result = calculateWatermarkOverlayPosition('bottom-right', 1920, 1080, 200, 50);
    expect(result.x).toBe(Math.round(1920 - 200 - WATERMARK_MARGIN_PX));
    expect(result.y).toBe(Math.round(1080 - 50 - WATERMARK_MARGIN_PX));
  });

  it('center calculates midpoint', () => {
    const result = calculateWatermarkOverlayPosition('center', 1920, 1080, 200, 50);
    expect(result.x).toBe(Math.round((1920 - 200) / 2));
    expect(result.y).toBe(Math.round((1080 - 50) / 2));
  });
});

describe('buildEqualizerFilters', () => {
  it('skips bands with near-zero gain', () => {
    const filters = buildEqualizerFilters({
      bands: [
        { id: 'eq1', type: 'peaking', frequency: 1000, gain: 0, q: 1 },
        { id: 'eq2', type: 'peaking', frequency: 2000, gain: 0.0001, q: 1 },
      ],
    });
    expect(filters).toHaveLength(0);
  });

  it('builds filter for non-zero gain', () => {
    const filters = buildEqualizerFilters({
      bands: [
        { id: 'eq1', type: 'peaking', frequency: 1000, gain: 3, q: 1 },
      ],
    });
    expect(filters).toHaveLength(1);
    expect(filters[0]).toContain('equalizer');
    expect(filters[0]).toContain('f=1000');
    expect(filters[0]).toContain('g=3');
  });
});

describe('buildMasterAudioFilters', () => {
  it('returns empty when all disabled', () => {
    expect(buildMasterAudioFilters(undefined)).toHaveLength(0);
    expect(buildMasterAudioFilters(DEFAULT_EXPORT_MASTER_PROCESSING)).toHaveLength(0);
  });

  it('includes EQ when enabled with gain', () => {
    const filters = buildMasterAudioFilters({
      eq: {
        enabled: true,
        bands: [{ id: 'eq1', type: 'peaking', frequency: 1000, gain: 5, q: 1 }],
      },
      stereoEnhancer: { enabled: false, amount: 1 },
      limiter: { enabled: false, levelOutDb: -0.1 },
    });
    expect(filters.length).toBeGreaterThan(0);
    expect(filters[0]).toContain('equalizer');
  });

  it('includes extrastereo when enabled', () => {
    const filters = buildMasterAudioFilters({
      eq: { enabled: false, bands: DEFAULT_EXPORT_MASTER_EQ_BANDS },
      stereoEnhancer: { enabled: true, amount: 1.5 },
      limiter: { enabled: false, levelOutDb: -0.1 },
    });
    expect(filters).toHaveLength(1);
    expect(filters[0]).toContain('extrastereo');
  });

  it('includes limiter when enabled', () => {
    const filters = buildMasterAudioFilters({
      eq: { enabled: false, bands: DEFAULT_EXPORT_MASTER_EQ_BANDS },
      stereoEnhancer: { enabled: false, amount: 1 },
      limiter: { enabled: true, levelOutDb: -3 },
    });
    expect(filters).toHaveLength(1);
    expect(filters[0]).toContain('alimiter');
  });
});

describe('normalizeExportMasterProcessing', () => {
  it('returns defaults for undefined input', () => {
    const result = normalizeExportMasterProcessing(undefined);
    expect(result.eq.enabled).toBe(false);
    expect(result.stereoEnhancer.enabled).toBe(false);
    expect(result.limiter.enabled).toBe(false);
  });

  it('clamps stereoEnhancer amount to 0-2', () => {
    const result = normalizeExportMasterProcessing({
      eq: { enabled: false, bands: [] },
      stereoEnhancer: { enabled: true, amount: 5 },
      limiter: { enabled: false, levelOutDb: -0.1 },
    });
    expect(result.stereoEnhancer.amount).toBe(2);
  });

  it('clamps limiter levelOutDb to -24..0', () => {
    const result = normalizeExportMasterProcessing({
      eq: { enabled: false, bands: [] },
      stereoEnhancer: { enabled: false, amount: 1 },
      limiter: { enabled: true, levelOutDb: -50 },
    });
    expect(result.limiter.levelOutDb).toBe(-24);
  });
});

describe('hasExportMasterProcessing', () => {
  it('returns false for default processing', () => {
    expect(hasExportMasterProcessing(undefined)).toBe(false);
  });

  it('returns true when EQ has gain', () => {
    expect(hasExportMasterProcessing({
      eq: {
        enabled: true,
        bands: [{ id: 'eq1', type: 'peaking', frequency: 1000, gain: 5, q: 1 }],
      },
      stereoEnhancer: { enabled: false, amount: 1 },
      limiter: { enabled: false, levelOutDb: -0.1 },
    })).toBe(true);
  });
});

describe('normalizeExportMasterEqBand', () => {
  it('uses fallback for undefined input', () => {
    const fallback = DEFAULT_EXPORT_MASTER_EQ_BANDS[0];
    const result = normalizeExportMasterEqBand(undefined, fallback);
    expect(result).toEqual(fallback);
  });

  it('clamps frequency to 20-20000', () => {
    const fallback = DEFAULT_EXPORT_MASTER_EQ_BANDS[0];
    const result = normalizeExportMasterEqBand(
      { frequency: 50000, gain: 0, q: 1, type: 'peaking', id: 'test' },
      fallback,
    );
    expect(result.frequency).toBe(20000);
  });

  it('clamps gain to -24..24', () => {
    const fallback = DEFAULT_EXPORT_MASTER_EQ_BANDS[0];
    const result = normalizeExportMasterEqBand(
      { frequency: 1000, gain: 100, q: 1, type: 'peaking', id: 'test' },
      fallback,
    );
    expect(result.gain).toBe(24);
  });

  it('clamps q to 0.1..4', () => {
    const fallback = DEFAULT_EXPORT_MASTER_EQ_BANDS[0];
    const result = normalizeExportMasterEqBand(
      { frequency: 1000, gain: 0, q: 10, type: 'peaking', id: 'test' },
      fallback,
    );
    expect(result.q).toBe(4);
  });

  it('accepts valid band types', () => {
    const fallback = DEFAULT_EXPORT_MASTER_EQ_BANDS[0];
    for (const type of ['lowshelf', 'highshelf', 'peaking'] as const) {
      const result = normalizeExportMasterEqBand(
        { frequency: 1000, gain: 0, q: 1, type, id: 'test' },
        fallback,
      );
      expect(result.type).toBe(type);
    }
  });

  it('falls back to default type for invalid', () => {
    const fallback = DEFAULT_EXPORT_MASTER_EQ_BANDS[0];
    const result = normalizeExportMasterEqBand(
      { frequency: 1000, gain: 0, q: 1, type: 'invalid' as never, id: 'test' },
      fallback,
    );
    expect(result.type).toBe(fallback.type);
  });
});

describe('normalizeExportWatermark', () => {
  it('returns null for undefined', () => {
    expect(normalizeExportWatermark(undefined)).toBeNull();
  });

  it('returns null when disabled', () => {
    expect(normalizeExportWatermark({ enabled: false } as never)).toBeNull();
  });

  it('normalizes image watermark', () => {
    const result = normalizeExportWatermark({
      enabled: true,
      type: 'image',
      path: '/path/to/logo.png',
      position: 'bottom-right',
      scalePercent: 12,
      opacity: 0.75,
    });
    expect(result).toEqual({
      enabled: true,
      type: 'image',
      path: '/path/to/logo.png',
      position: 'bottom-right',
      scalePercent: 12,
      opacity: 0.75,
    });
  });

  it('returns null for image watermark with empty path', () => {
    expect(normalizeExportWatermark({
      enabled: true,
      type: 'image',
      path: '  ',
      position: 'bottom-right',
      scalePercent: 12,
      opacity: 0.75,
    })).toBeNull();
  });

  it('normalizes text watermark', () => {
    const result = normalizeExportWatermark({
      enabled: true,
      type: 'text',
      text: 'Sample',
      fontFamily: 'Arial',
      color: '#ffffff',
      fontSize: 36,
      position: 'center',
    });
    expect(result).toEqual({
      enabled: true,
      type: 'text',
      text: 'Sample',
      fontFamily: 'Arial',
      color: '#ffffff',
      fontSize: 36,
      position: 'center',
    });
  });

  it('returns null for text watermark with empty text', () => {
    expect(normalizeExportWatermark({
      enabled: true,
      type: 'text',
      text: '  ',
      fontFamily: 'Arial',
      color: '#ffffff',
      fontSize: 36,
      position: 'center',
    })).toBeNull();
  });

  it('clamps scalePercent to 1-50', () => {
    const result = normalizeExportWatermark({
      enabled: true,
      type: 'image',
      path: '/logo.png',
      position: 'center',
      scalePercent: 100,
      opacity: 0.5,
    });
    expect(result!.type === 'image' ? result.scalePercent : null).toBe(50);
  });

  it('clamps fontSize to 8-240', () => {
    const result = normalizeExportWatermark({
      enabled: true,
      type: 'text',
      text: 'Test',
      position: 'center',
      fontSize: 500,
    });
    expect(result!.type === 'text' ? result.fontSize : null).toBe(240);
  });
});

describe('normalizeTimecodeBurnIn', () => {
  it('returns null for undefined', () => {
    expect(normalizeTimecodeBurnIn(undefined)).toBeNull();
  });

  it('returns null when disabled', () => {
    expect(normalizeTimecodeBurnIn({ enabled: false } as never)).toBeNull();
  });

  it('normalizes enabled timecode', () => {
    const result = normalizeTimecodeBurnIn({
      enabled: true,
      position: 'top-left',
      fontSize: 28,
      color: '#ffffff',
      backgroundColor: '#000000',
      includeFrameNumber: false,
    });
    expect(result).toEqual({
      enabled: true,
      position: 'top-left',
      fontSize: 28,
      color: '#ffffff',
      backgroundColor: '#000000',
      includeFrameNumber: false,
    });
  });

  it('clamps fontSize to 8-96', () => {
    const result = normalizeTimecodeBurnIn({
      enabled: true,
      position: 'center',
      fontSize: 200,
      color: '#fff',
      backgroundColor: '#000',
      includeFrameNumber: true,
    });
    expect(result!.fontSize).toBe(96);
  });
});

describe('normalizeExportAudioVisualization', () => {
  it('returns defaults for undefined', () => {
    const result = normalizeExportAudioVisualization(undefined);
    expect(result.style).toBe('waveform-line');
    expect(result.color).toBeDefined();
    expect(result.background).toBeDefined();
  });

  it('accepts valid styles', () => {
    for (const style of ['spectrum-bars', 'circular-spectrum', 'waveform-line'] as const) {
      const result = normalizeExportAudioVisualization({ style } as never);
      expect(result.style).toBe(style);
    }
  });

  it('falls back for invalid style', () => {
    const result = normalizeExportAudioVisualization({ style: 'invalid' } as never);
    expect(result.style).toBe('waveform-line');
  });
});

describe('normalizeAudioVisualizationBackground', () => {
  const fallback = { type: 'solid' as const, color: '#050816' };

  it('returns fallback for undefined', () => {
    expect(normalizeAudioVisualizationBackground(undefined, fallback)).toEqual(fallback);
  });

  it('normalizes solid background', () => {
    const result = normalizeAudioVisualizationBackground(
      { type: 'solid', color: '#ff0000' },
      fallback,
    );
    expect(result.type).toBe('solid');
  });

  it('normalizes gradient background', () => {
    const result = normalizeAudioVisualizationBackground(
      { type: 'gradient', color: '#ff0000', color2: '#0000ff' },
      fallback,
    );
    expect(result.type).toBe('gradient');
  });

  it('normalizes image background with path', () => {
    const result = normalizeAudioVisualizationBackground(
      { type: 'image', path: '/bg.png' },
      fallback,
    );
    expect(result).toEqual({ type: 'image', path: '/bg.png' });
  });

  it('returns fallback for image with empty path', () => {
    expect(normalizeAudioVisualizationBackground(
      { type: 'image', path: '  ' },
      fallback,
    )).toEqual(fallback);
  });
});

describe('mergeExportMetadata', () => {
  it('returns base when override is undefined', () => {
    const base = { name: 'Test' };
    expect(mergeExportMetadata(base, undefined)).toBe(base);
  });

  it('merges override into base', () => {
    const result = mergeExportMetadata({ name: 'Base' }, { author: 'Alice' });
    expect(result).toEqual({ name: 'Base', author: 'Alice' });
  });

  it('filters out empty string values', () => {
    const result = mergeExportMetadata({ name: 'Base' }, { author: '  ' });
    expect(result).toEqual({ name: 'Base' });
  });
});

describe('normalizeExportSpatialAudioAssets', () => {
  it('returns null for undefined', () => {
    expect(normalizeExportSpatialAudioAssets(undefined)).toBeNull();
  });

  it('returns null for non-object', () => {
    expect(normalizeExportSpatialAudioAssets('invalid' as never)).toBeNull();
  });

  it('returns null when both fields empty', () => {
    expect(normalizeExportSpatialAudioAssets({ hrtfPath: '', roomImpulseResponses: {} })).toBeNull();
  });

  it('normalizes valid hrtfPath', () => {
    const result = normalizeExportSpatialAudioAssets({ hrtfPath: '/path/hrtf.wav', roomImpulseResponses: {} });
    expect(result).not.toBeNull();
    expect(result!.hrtfPath).toBe('/path/hrtf.wav');
  });

  it('filters invalid room impulse response keys', () => {
    const result = normalizeExportSpatialAudioAssets({
      hrtfPath: '',
      roomImpulseResponses: {
        'small-room': '/path/small.wav',
        'invalid-room': '/path/invalid.wav',
      },
    });
    expect(result).not.toBeNull();
    expect(result!.roomImpulseResponses).toHaveProperty('small-room');
    expect(result!.roomImpulseResponses).not.toHaveProperty('invalid-room');
  });
});

describe('normalizeSettingsForExportFormat', () => {
  it('returns settings unchanged for mp4', () => {
    const settings = makeSettings({ format: 'mp4' });
    expect(normalizeSettingsForExportFormat(settings)).toBe(settings);
  });

  it('forces video outputMode for gif', () => {
    const settings = makeSettings({ format: 'gif', outputMode: 'audio' as never });
    const result = normalizeSettingsForExportFormat(settings);
    expect(result.outputMode).toBe('video');
    expect(result.videoCodec).toBe('gif');
  });

  it('constrains gif dimensions to 1080', () => {
    const settings = makeSettings({ format: 'gif', width: 3840, height: 2160 });
    const result = normalizeSettingsForExportFormat(settings);
    expect(Math.max(result.width, result.height)).toBeLessThanOrEqual(1080);
  });

  it('clamps gif fps to 1-30', () => {
    const settings = makeSettings({ format: 'gif', fps: 60 });
    const result = normalizeSettingsForExportFormat(settings);
    expect(result.fps).toBeLessThanOrEqual(30);
  });

  it('disables hardware encoding for gif', () => {
    const settings = makeSettings({ format: 'gif', hardwareEncoding: true });
    const result = normalizeSettingsForExportFormat(settings);
    expect(result.hardwareEncoding).toBe(false);
  });

  it('handles webp format', () => {
    const settings = makeSettings({ format: 'webp' });
    const result = normalizeSettingsForExportFormat(settings);
    expect(result.outputMode).toBe('video');
  });
});

describe('buildFfmpegFullArgs', () => {
  it('builds correct arg structure', () => {
    const args = buildFfmpegFullArgs(
      [{ index: 0, path: '/input.mp4', args: ['-ss', '0'] }],
      'filter',
      ['-map', '[out]'],
      ['-f', 'mp4', '/output.mp4'],
    );
    expect(args[0]).toBe('-y');
    expect(args).toContain('-filter_complex');
    expect(args).toContain('filter');
    expect(args).toContain('/input.mp4');
    expect(args).toContain('/output.mp4');
  });
});

describe('buildExportRangeOutputArgs', () => {
  it('returns empty for null range', () => {
    expect(buildExportRangeOutputArgs(null)).toEqual([]);
    expect(buildExportRangeOutputArgs(undefined)).toEqual([]);
  });

  it('returns -ss for valid range', () => {
    const args = buildExportRangeOutputArgs({ start: 10, end: 20, duration: 10 });
    expect(args[0]).toBe('-ss');
    expect(args.length).toBe(2);
  });
});

describe('buildLoudnessNormalizationPasses', () => {
  it('creates two passes', () => {
    const result = buildLoudnessNormalizationPasses(
      [{ index: 0, path: '/input.mp4', args: [] }],
      'analysis_filter',
      ['render', 'args'],
      60,
    );
    expect(result.passes).toHaveLength(2);
    expect(result.passes[0].name).toBe('loudness-analysis');
    expect(result.passes[0].kind).toBe('loudness-analysis');
    expect(result.passes[1].name).toBe('loudness-render');
    expect(result.passes[1].kind).toBe('render');
  });
});

describe('buildGifExportPasses', () => {
  it('creates palettegen and paletteuse passes', () => {
    const textArtifacts: Array<{ clipId: string; text: string; fileName: string; placeholder: string; pathMode: string }> = [];
    const result = buildGifExportPasses(
      [{ index: 0, path: '/input.mp4', args: [] }],
      '[0:v]scale=320:240[vout]',
      makeSettings({ outputPath: '/tmp/out.gif' }) as never,
      5,
      textArtifacts,
    );
    expect(result.passes).toHaveLength(2);
    expect(result.passes[0].name).toBe('gif-palettegen');
    expect(result.passes[1].name).toBe('gif-paletteuse');
    expect(textArtifacts).toHaveLength(1);
    expect(textArtifacts[0].placeholder).toBe(GIF_PALETTE_PLACEHOLDER);
  });
});

describe('normalizeExportReframeSettings', () => {
  it('returns normalized settings with all required fields', () => {
    const settings = makeSettings();
    const result = normalizeExportReframeSettings(settings);
    expect(result.width).toBeDefined();
    expect(result.height).toBeDefined();
    expect(result.targetAspectRatio).toBeDefined();
    expect(result.loudnessNormalization).toBeDefined();
  });
});

describe('buildSlateVideoFilters', () => {
  it('generates filter with project info', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-15'));

    const filters = buildSlateVideoFilters(
      'slate',
      makeSettings() as never,
      { name: 'Test Project', metadata: {} } as never,
      120,
      0.5,
    );

    expect(filters).toHaveLength(1);
    expect(filters[0]).toContain('color=c=black');
    expect(filters[0]).toContain('Test Project');
    expect(filters[0]).toContain('2026-01-15');

    vi.useRealTimers();
  });
});

describe('buildTimecodeBurnInFilter', () => {
  it('generates drawtext filter', () => {
    const filter = buildTimecodeBurnInFilter('in', 'out', {
      enabled: true,
      position: 'top-left',
      fontSize: 28,
      color: '#ffffff',
      backgroundColor: '#000000',
      includeFrameNumber: false,
    });
    expect(filter).toContain('drawtext');
    expect(filter).toContain('[in]');
    expect(filter).toContain('[out]');
    expect(filter).toContain('fontsize=28');
  });

  it('includes frame number when enabled', () => {
    const filter = buildTimecodeBurnInFilter('in', 'out', {
      enabled: true,
      position: 'bottom-right',
      fontSize: 28,
      color: '#ffffff',
      backgroundColor: '#000000',
      includeFrameNumber: true,
    });
    expect(filter).toContain('%{n}');
  });
});

describe('buildWatermarkFilters', () => {
  it('returns empty when image input index undefined', () => {
    const filters = buildWatermarkFilters('in', 'out', {
      enabled: true,
      type: 'image',
      path: '/logo.png',
      position: 'center',
      scalePercent: 12,
      opacity: 0.5,
    }, makeSettings() as never, undefined);
    expect(filters).toEqual([]);
  });

  it('builds image watermark with input index', () => {
    const filters = buildWatermarkFilters('in', 'out', {
      enabled: true,
      type: 'image',
      path: '/logo.png',
      position: 'center',
      scalePercent: 12,
      opacity: 0.5,
    }, makeSettings() as never, 1);
    expect(filters.length).toBeGreaterThan(0);
  });

  it('builds text watermark', () => {
    const filters = buildWatermarkFilters('in', 'out', {
      enabled: true,
      type: 'text',
      text: 'Sample',
      fontFamily: 'Arial',
      color: '#ffffff',
      fontSize: 36,
      position: 'bottom-right',
    }, makeSettings() as never, undefined);
    expect(filters).toHaveLength(1);
    expect(filters[0]).toContain('drawtext');
  });
});
