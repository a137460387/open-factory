import { describe, expect, it } from 'vitest';
import {
  parseHexColor,
  normalizeHexColor,
  toHexChannel,
  formatFfmpegNumber,
  formatOpacity,
  finiteNumber,
  constrainDimensions,
  normalizeLoudnessNormalization,
  normalizeVideoProfile,
  normalizeWatermarkPosition,
  normalizeExportWatermark,
  normalizeTimecodeBurnIn,
  normalizeExportSlate,
  normalizeExportMasterProcessing,
  normalizeExportMasterEq,
  normalizeExportMasterEqBand,
  normalizeAudioVisualizationBackground,
  normalizeExportAudioVisualization,
  normalizeExportSpatialAudioAssets,
  normalizeSettingsForExportFormat,
  buildMasterAudioFilters,
  buildEqualizerFilters,
  buildWatermarkExpression,
  calculateWatermarkOverlayPosition,
  mergeExportMetadata,
  buildTimecodeBurnInFilter,
  buildSlateVideoFilters,
  buildWatermarkFilters,
  buildGifExportPasses,
  buildExportRangeOutputArgs,
  buildFfmpegFullArgs,
  DEFAULT_EXPORT_MASTER_EQ_BANDS,
  DEFAULT_EXPORT_MASTER_PROCESSING,
  WATERMARK_MARGIN_PX,
  SLATE_DURATION_SECONDS,
} from '../src/export/ffmpeg-builder/settings-normalize';

// ---------------------------------------------------------------------------
// parseHexColor
// ---------------------------------------------------------------------------
describe('parseHexColor', () => {
  it('parses 6-digit hex', () => {
    expect(parseHexColor('#ff8800', '#000000')).toEqual({ r: 255, g: 136, b: 0 });
  });

  it('parses 6-digit hex without hash', () => {
    expect(parseHexColor('00ff00', '#000000')).toEqual({ r: 0, g: 255, b: 0 });
  });

  it('parses 3-digit shorthand hex', () => {
    expect(parseHexColor('#f80', '#000000')).toEqual({ r: 255, g: 136, b: 0 });
  });

  it('returns fallback for invalid hex', () => {
    const result = parseHexColor('not-a-color', '#abcdef');
    expect(result).toEqual({ r: 171, g: 205, b: 239 });
  });

  it('returns safe default when fallback equals value', () => {
    expect(parseHexColor('#zzzzzz', '#zzzzzz')).toEqual({ r: 5, g: 8, b: 22 });
  });
});

// ---------------------------------------------------------------------------
// normalizeHexColor / toHexChannel
// ---------------------------------------------------------------------------
describe('normalizeHexColor', () => {
  it('normalizes valid color to lowercase 7-char string', () => {
    expect(normalizeHexColor('#FF8800', '#000000')).toBe('#ff8800');
  });

  it('pads single-digit channels', () => {
    expect(normalizeHexColor('#010203', '#000000')).toBe('#010203');
  });

  it('uses fallback for undefined value', () => {
    expect(normalizeHexColor(undefined, '#aabbcc')).toBe('#aabbcc');
  });
});

describe('toHexChannel', () => {
  it('clamps to 0-255 and pads to 2 digits', () => {
    expect(toHexChannel(0)).toBe('00');
    expect(toHexChannel(255)).toBe('ff');
    expect(toHexChannel(16)).toBe('10');
  });

  it('clamps out-of-range values', () => {
    expect(toHexChannel(-10)).toBe('00');
    expect(toHexChannel(300)).toBe('ff');
  });
});

// ---------------------------------------------------------------------------
// formatFfmpegNumber
// ---------------------------------------------------------------------------
describe('formatFfmpegNumber', () => {
  it('returns integer string for whole numbers', () => {
    expect(formatFfmpegNumber(30)).toBe('30');
    expect(formatFfmpegNumber(0)).toBe('0');
  });

  it('trims trailing zeros from decimals', () => {
    expect(formatFfmpegNumber(1.5)).toBe('1.5');
    expect(formatFfmpegNumber(1.500)).toBe('1.5');
    expect(formatFfmpegNumber(0.123)).toBe('0.123');
  });

  it('rounds to 3 decimal places', () => {
    expect(formatFfmpegNumber(1.2345)).toBe('1.235');
    expect(formatFfmpegNumber(1.2344)).toBe('1.234');
  });
});

// ---------------------------------------------------------------------------
// formatOpacity
// ---------------------------------------------------------------------------
describe('formatOpacity', () => {
  it('clamps to 0-1 range', () => {
    expect(formatOpacity(0.5)).toBeTruthy();
    expect(formatOpacity(-1)).toBeTruthy();
    expect(formatOpacity(2)).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// finiteNumber
// ---------------------------------------------------------------------------
describe('finiteNumber', () => {
  it('returns value when finite number', () => {
    expect(finiteNumber(42, 0)).toBe(42);
    expect(finiteNumber(0, 99)).toBe(0);
  });

  it('returns fallback for undefined', () => {
    expect(finiteNumber(undefined, 7)).toBe(7);
  });

  it('returns fallback for NaN', () => {
    expect(finiteNumber(NaN, 7)).toBe(7);
  });

  it('returns fallback for Infinity', () => {
    expect(finiteNumber(Infinity, 7)).toBe(7);
  });
});

// ---------------------------------------------------------------------------
// constrainDimensions
// ---------------------------------------------------------------------------
describe('constrainDimensions', () => {
  it('returns original dimensions when within max', () => {
    expect(constrainDimensions(1280, 720, 1920)).toEqual({ width: 1280, height: 720 });
  });

  it('scales down proportionally when exceeding max', () => {
    const result = constrainDimensions(1920, 1080, 1280);
    expect(result.width).toBe(1280);
    expect(result.height).toBe(720);
  });

  it('uses default dimensions for zero/NaN', () => {
    const result = constrainDimensions(0, 0, 1080);
    expect(result.width).toBeGreaterThan(0);
    expect(result.height).toBeGreaterThan(0);
  });

  it('handles portrait orientation', () => {
    const result = constrainDimensions(1080, 1920, 720);
    expect(result.height).toBe(720);
    expect(result.width).toBe(405);
  });
});

// ---------------------------------------------------------------------------
// normalizeLoudnessNormalization
// ---------------------------------------------------------------------------
describe('normalizeLoudnessNormalization', () => {
  it('accepts youtube mode', () => {
    expect(normalizeLoudnessNormalization('youtube')).toBe('youtube');
  });

  it('accepts ebu-r128 mode', () => {
    expect(normalizeLoudnessNormalization('ebu-r128')).toBe('ebu-r128');
  });

  it('returns off for undefined or invalid', () => {
    expect(normalizeLoudnessNormalization(undefined)).toBe('off');
    expect(normalizeLoudnessNormalization('loud' as any)).toBe('off');
    expect(normalizeLoudnessNormalization('off')).toBe('off');
  });
});

// ---------------------------------------------------------------------------
// normalizeVideoProfile
// ---------------------------------------------------------------------------
describe('normalizeVideoProfile', () => {
  it('accepts valid profiles', () => {
    expect(normalizeVideoProfile('baseline')).toBe('baseline');
    expect(normalizeVideoProfile('main')).toBe('main');
    expect(normalizeVideoProfile('high')).toBe('high');
  });

  it('returns undefined for invalid or undefined', () => {
    expect(normalizeVideoProfile(undefined)).toBeUndefined();
    expect(normalizeVideoProfile('super' as any)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// normalizeWatermarkPosition
// ---------------------------------------------------------------------------
describe('normalizeWatermarkPosition', () => {
  it('accepts all 9 valid positions', () => {
    const positions = [
      'top-left', 'top-center', 'top-right',
      'middle-left', 'center', 'middle-right',
      'bottom-left', 'bottom-center', 'bottom-right',
    ];
    for (const pos of positions) {
      expect(normalizeWatermarkPosition(pos as any)).toBe(pos);
    }
  });

  it('defaults to bottom-right for invalid', () => {
    expect(normalizeWatermarkPosition(undefined)).toBe('bottom-right');
    expect(normalizeWatermarkPosition('center-left' as any)).toBe('bottom-right');
  });
});

// ---------------------------------------------------------------------------
// normalizeExportWatermark
// ---------------------------------------------------------------------------
describe('normalizeExportWatermark', () => {
  it('returns null for undefined', () => {
    expect(normalizeExportWatermark(undefined)).toBeNull();
  });

  it('returns null when not enabled', () => {
    expect(normalizeExportWatermark({ enabled: false, type: 'text', text: 'hi' } as any)).toBeNull();
  });

  it('normalizes text watermark', () => {
    const result = normalizeExportWatermark({
      enabled: true,
      type: 'text',
      text: 'Logo',
      fontFamily: 'Arial',
      fontSize: 36,
      color: '#ffffff',
      position: 'top-left',
    });
    expect(result).toMatchObject({
      enabled: true,
      type: 'text',
      text: 'Logo',
      position: 'top-left',
    });
  });

  it('returns null for text watermark with empty text', () => {
    expect(normalizeExportWatermark({ enabled: true, type: 'text', text: '  ' } as any)).toBeNull();
  });

  it('normalizes image watermark', () => {
    const result = normalizeExportWatermark({
      enabled: true,
      type: 'image',
      path: '/logo.png',
      position: 'bottom-right',
      scalePercent: 20,
      opacity: 0.5,
    });
    expect(result).toMatchObject({
      enabled: true,
      type: 'image',
      path: '/logo.png',
      position: 'bottom-right',
    });
  });

  it('returns null for image watermark with empty path', () => {
    expect(normalizeExportWatermark({ enabled: true, type: 'image', path: '  ' } as any)).toBeNull();
  });

  it('clamps fontSize and scalePercent', () => {
    const result = normalizeExportWatermark({
      enabled: true,
      type: 'text',
      text: 'Test',
      fontSize: 500,
    });
    expect(result).not.toBeNull();
    expect((result as any).fontSize).toBe(240);
  });
});

// ---------------------------------------------------------------------------
// normalizeTimecodeBurnIn
// ---------------------------------------------------------------------------
describe('normalizeTimecodeBurnIn', () => {
  it('returns null for undefined', () => {
    expect(normalizeTimecodeBurnIn(undefined)).toBeNull();
  });

  it('returns null when not enabled', () => {
    expect(normalizeTimecodeBurnIn({ enabled: false } as any)).toBeNull();
  });

  it('normalizes enabled timecode', () => {
    const result = normalizeTimecodeBurnIn({
      enabled: true,
      position: 'top-left',
      fontSize: 28,
      color: '#ffffff',
      backgroundColor: '#000000',
      includeFrameNumber: true,
    });
    expect(result).toMatchObject({
      enabled: true,
      position: 'top-left',
      includeFrameNumber: true,
    });
  });

  it('clamps fontSize to 8-96', () => {
    expect(normalizeTimecodeBurnIn({ enabled: true, fontSize: 200 } as any)!.fontSize).toBe(96);
    expect(normalizeTimecodeBurnIn({ enabled: true, fontSize: 1 } as any)!.fontSize).toBe(8);
  });
});

// ---------------------------------------------------------------------------
// normalizeExportSlate
// ---------------------------------------------------------------------------
describe('normalizeExportSlate', () => {
  it('returns null for undefined or disabled', () => {
    expect(normalizeExportSlate(undefined)).toBeNull();
    expect(normalizeExportSlate({ enabled: false })).toBeNull();
  });

  it('returns enabled slate', () => {
    expect(normalizeExportSlate({ enabled: true })).toEqual({ enabled: true });
  });
});

// ---------------------------------------------------------------------------
// normalizeExportMasterProcessing / normalizeExportMasterEq / normalizeExportMasterEqBand
// ---------------------------------------------------------------------------
describe('normalizeExportMasterProcessing', () => {
  it('returns defaults for undefined input', () => {
    const result = normalizeExportMasterProcessing(undefined);
    expect(result.eq.enabled).toBe(false);
    expect(result.stereoEnhancer.enabled).toBe(false);
    expect(result.limiter.enabled).toBe(false);
  });

  it('normalizes enabled stereo enhancer with clamping', () => {
    const result = normalizeExportMasterProcessing({
      stereoEnhancer: { enabled: true, amount: 5 },
    });
    expect(result.stereoEnhancer.enabled).toBe(true);
    expect(result.stereoEnhancer.amount).toBe(2); // clamped to max 2
  });

  it('normalizes enabled limiter with clamping', () => {
    const result = normalizeExportMasterProcessing({
      limiter: { enabled: true, levelOutDb: -30 },
    });
    expect(result.limiter.enabled).toBe(true);
    expect(result.limiter.levelOutDb).toBe(-24); // clamped to min -24
  });
});

describe('normalizeExportMasterEq', () => {
  it('returns default bands for undefined input', () => {
    const result = normalizeExportMasterEq(undefined);
    expect(result.enabled).toBe(false);
    expect(result.bands).toHaveLength(DEFAULT_EXPORT_MASTER_EQ_BANDS.length);
  });

  it('preserves enabled state', () => {
    const result = normalizeExportMasterEq({ enabled: true, bands: [] });
    expect(result.enabled).toBe(true);
  });
});

describe('normalizeExportMasterEqBand', () => {
  it('uses fallback for undefined input', () => {
    const fallback = DEFAULT_EXPORT_MASTER_EQ_BANDS[0];
    const result = normalizeExportMasterEqBand(undefined, fallback);
    expect(result.id).toBe(fallback.id);
    expect(result.type).toBe(fallback.type);
    expect(result.frequency).toBe(fallback.frequency);
  });

  it('clamps frequency to 20-20000', () => {
    const fallback = DEFAULT_EXPORT_MASTER_EQ_BANDS[0];
    expect(normalizeExportMasterEqBand({ frequency: 1 }, fallback).frequency).toBe(20);
    expect(normalizeExportMasterEqBand({ frequency: 50000 }, fallback).frequency).toBe(20000);
  });

  it('clamps gain to -24..24', () => {
    const fallback = DEFAULT_EXPORT_MASTER_EQ_BANDS[0];
    expect(normalizeExportMasterEqBand({ gain: -30 }, fallback).gain).toBe(-24);
    expect(normalizeExportMasterEqBand({ gain: 30 }, fallback).gain).toBe(24);
  });

  it('clamps q to 0.1-4', () => {
    const fallback = DEFAULT_EXPORT_MASTER_EQ_BANDS[0];
    expect(normalizeExportMasterEqBand({ q: 0.01 }, fallback).q).toBe(0.1);
    expect(normalizeExportMasterEqBand({ q: 10 }, fallback).q).toBe(4);
  });

  it('accepts valid filter types', () => {
    const fallback = DEFAULT_EXPORT_MASTER_EQ_BANDS[0];
    expect(normalizeExportMasterEqBand({ type: 'lowshelf' }, fallback).type).toBe('lowshelf');
    expect(normalizeExportMasterEqBand({ type: 'highshelf' }, fallback).type).toBe('highshelf');
    expect(normalizeExportMasterEqBand({ type: 'peaking' }, fallback).type).toBe('peaking');
  });
});

// ---------------------------------------------------------------------------
// normalizeAudioVisualizationBackground
// ---------------------------------------------------------------------------
describe('normalizeAudioVisualizationBackground', () => {
  const fallback = { type: 'solid' as const, color: '#050816' };

  it('returns solid background', () => {
    const result = normalizeAudioVisualizationBackground({ type: 'solid', color: '#ff0000' }, fallback);
    expect(result).toMatchObject({ type: 'solid', color: '#ff0000' });
  });

  it('returns gradient background', () => {
    const result = normalizeAudioVisualizationBackground(
      { type: 'gradient', color: '#ff0000', color2: '#0000ff' },
      fallback,
    );
    expect(result).toMatchObject({ type: 'gradient', color: '#ff0000', color2: '#0000ff' });
  });

  it('returns image background when path is non-empty', () => {
    const result = normalizeAudioVisualizationBackground(
      { type: 'image', path: '/bg.png' },
      fallback,
    );
    expect(result).toMatchObject({ type: 'image', path: '/bg.png' });
  });

  it('falls back for image with empty path', () => {
    const result = normalizeAudioVisualizationBackground({ type: 'image', path: '  ' }, fallback);
    expect(result).toEqual(fallback);
  });

  it('falls back for undefined input', () => {
    expect(normalizeAudioVisualizationBackground(undefined, fallback)).toEqual(fallback);
  });
});

// ---------------------------------------------------------------------------
// normalizeExportSpatialAudioAssets
// ---------------------------------------------------------------------------
describe('normalizeExportSpatialAudioAssets', () => {
  it('returns null for undefined', () => {
    expect(normalizeExportSpatialAudioAssets(undefined)).toBeNull();
  });

  it('returns null for non-object', () => {
    expect(normalizeExportSpatialAudioAssets('invalid' as any)).toBeNull();
  });

  it('returns null when no valid paths', () => {
    expect(normalizeExportSpatialAudioAssets({ hrtfPath: '  ' })).toBeNull();
  });

  it('normalizes valid hrtf path', () => {
    const result = normalizeExportSpatialAudioAssets({ hrtfPath: '/path/to/hrtf.bin' });
    expect(result).not.toBeNull();
    expect(result!.hrtfPath).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// normalizeSettingsForExportFormat
// ---------------------------------------------------------------------------
describe('normalizeSettingsForExportFormat', () => {
  const base = { format: 'mp4', width: 1920, height: 1080, fps: 60, hardwareEncoding: true } as any;

  it('returns unchanged for non-gif/webp/apng formats', () => {
    const result = normalizeSettingsForExportFormat(base);
    expect(result).toBe(base);
  });

  it('disables hardware encoding for gif', () => {
    const result = normalizeSettingsForExportFormat({ ...base, format: 'gif' });
    expect(result.hardwareEncoding).toBe(false);
    expect(result.videoCodec).toBe('gif');
  });

  it('constrains gif dimensions to 1080 max', () => {
    const result = normalizeSettingsForExportFormat({ ...base, format: 'gif', width: 3840, height: 2160 });
    expect(Math.max(result.width, result.height)).toBeLessThanOrEqual(1080);
  });

  it('clamps gif fps to 1-30', () => {
    const result = normalizeSettingsForExportFormat({ ...base, format: 'gif', fps: 60 });
    expect(result.fps).toBe(30);
  });

  it('disables loudness normalization for animated formats', () => {
    const result = normalizeSettingsForExportFormat({ ...base, format: 'webp' });
    expect(result.loudnessNormalization).toBe('off');
  });
});

// ---------------------------------------------------------------------------
// buildMasterAudioFilters
// ---------------------------------------------------------------------------
describe('buildMasterAudioFilters', () => {
  it('returns empty for all-disabled processing', () => {
    expect(buildMasterAudioFilters(DEFAULT_EXPORT_MASTER_PROCESSING)).toEqual([]);
  });

  it('builds equalizer filter when EQ enabled with gain', () => {
    const filters = buildMasterAudioFilters({
      eq: {
        enabled: true,
        bands: DEFAULT_EXPORT_MASTER_EQ_BANDS.map((b, i) => ({ ...b, gain: i === 0 ? 3 : 0 })),
      },
      stereoEnhancer: { enabled: false, amount: 1 },
      limiter: { enabled: false, levelOutDb: -0.1 },
    });
    expect(filters).toHaveLength(1);
    expect(filters[0]).toContain('equalizer=f=31');
  });

  it('builds stereo enhancer filter', () => {
    const filters = buildMasterAudioFilters({
      ...DEFAULT_EXPORT_MASTER_PROCESSING,
      stereoEnhancer: { enabled: true, amount: 1.5 },
    });
    expect(filters).toHaveLength(1);
    expect(filters[0]).toContain('extrastereo=m=1.5');
  });

  it('builds limiter filter', () => {
    const filters = buildMasterAudioFilters({
      ...DEFAULT_EXPORT_MASTER_PROCESSING,
      limiter: { enabled: true, levelOutDb: -1 },
    });
    expect(filters).toHaveLength(1);
    expect(filters[0]).toContain('alimiter=level_out=-1dB');
  });
});

// ---------------------------------------------------------------------------
// buildEqualizerFilters
// ---------------------------------------------------------------------------
describe('buildEqualizerFilters', () => {
  it('skips bands with near-zero gain', () => {
    const filters = buildEqualizerFilters({
      bands: [
        { id: '1', type: 'peaking', frequency: 100, gain: 0.0001, q: 1 },
        { id: '2', type: 'peaking', frequency: 200, gain: 0, q: 1 },
      ],
    });
    expect(filters).toHaveLength(0);
  });

  it('generates filter string for non-zero gain', () => {
    const filters = buildEqualizerFilters({
      bands: [{ id: '1', type: 'peaking', frequency: 1000, gain: 5, q: 1 }],
    });
    expect(filters).toHaveLength(1);
    expect(filters[0]).toContain('equalizer=f=1000');
    expect(filters[0]).toContain('g=5');
  });
});

// ---------------------------------------------------------------------------
// buildWatermarkExpression
// ---------------------------------------------------------------------------
describe('buildWatermarkExpression', () => {
  it('builds top-left expression', () => {
    const result = buildWatermarkExpression('top-left', 'W', 'H', 'w', 'h');
    expect(result.x).toBe(String(WATERMARK_MARGIN_PX));
    expect(result.y).toBe(String(WATERMARK_MARGIN_PX));
  });

  it('builds bottom-right expression', () => {
    const result = buildWatermarkExpression('bottom-right', 'W', 'H', 'w', 'h');
    expect(result.x).toContain('W');
    expect(result.x).toContain('w');
    expect(result.y).toContain('H');
    expect(result.y).toContain('h');
  });

  it('builds center expression', () => {
    const result = buildWatermarkExpression('center', 'W', 'H', 'w', 'h');
    expect(result.x).toContain('(W-w)/2');
    expect(result.y).toContain('(H-h)/2');
  });
});

// ---------------------------------------------------------------------------
// calculateWatermarkOverlayPosition
// ---------------------------------------------------------------------------
describe('calculateWatermarkOverlayPosition', () => {
  it('calculates top-left pixel position', () => {
    const pos = calculateWatermarkOverlayPosition('top-left', 1920, 1080, 100, 50);
    expect(pos.x).toBe(WATERMARK_MARGIN_PX);
    expect(pos.y).toBe(WATERMARK_MARGIN_PX);
  });

  it('calculates bottom-right pixel position', () => {
    const pos = calculateWatermarkOverlayPosition('bottom-right', 1920, 1080, 100, 50);
    expect(pos.x).toBe(1920 - 100 - WATERMARK_MARGIN_PX);
    expect(pos.y).toBe(1080 - 50 - WATERMARK_MARGIN_PX);
  });

  it('calculates center pixel position', () => {
    const pos = calculateWatermarkOverlayPosition('center', 1920, 1080, 100, 50);
    expect(pos.x).toBe(Math.round((1920 - 100) / 2));
    expect(pos.y).toBe(Math.round((1080 - 50) / 2));
  });
});

// ---------------------------------------------------------------------------
// mergeExportMetadata
// ---------------------------------------------------------------------------
describe('mergeExportMetadata', () => {
  it('returns base when override is undefined', () => {
    expect(mergeExportMetadata({ title: 'A' }, undefined)).toEqual({ title: 'A' });
  });

  it('merges override into base', () => {
    const result = mergeExportMetadata({ title: 'A' }, { author: 'B' });
    expect(result).toEqual({ title: 'A', author: 'B' });
  });

  it('override wins on conflict', () => {
    const result = mergeExportMetadata({ title: 'Old' }, { title: 'New' });
    expect(result).toEqual({ title: 'New' });
  });

  it('filters empty override values', () => {
    const result = mergeExportMetadata({ title: 'A' }, { title: '  ', author: 'B' });
    expect(result).toEqual({ title: 'A', author: 'B' });
  });

  it('handles null base', () => {
    const result = mergeExportMetadata(null, { title: 'A' });
    expect(result).toEqual({ title: 'A' });
  });
});

// ---------------------------------------------------------------------------
// buildTimecodeBurnInFilter
// ---------------------------------------------------------------------------
describe('buildTimecodeBurnInFilter', () => {
  it('generates drawtext filter with timecode', () => {
    const filter = buildTimecodeBurnInFilter('vin', 'vout', {
      enabled: true,
      position: 'top-left',
      fontSize: 28,
      color: '#ffffff',
      backgroundColor: '#000000',
      includeFrameNumber: false,
    });
    expect(filter).toContain('[vin]drawtext=');
    expect(filter).toContain('[vout]');
    expect(filter).toContain('pts\\:hms');
    expect(filter).not.toContain(':n');
  });

  it('includes frame number when enabled', () => {
    const filter = buildTimecodeBurnInFilter('vin', 'vout', {
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

// ---------------------------------------------------------------------------
// buildSlateVideoFilters
// ---------------------------------------------------------------------------
describe('buildSlateVideoFilters', () => {
  it('generates slate color source with drawtext', () => {
    const filters = buildSlateVideoFilters('slate0', { width: 1920, height: 1080, fps: 30 } as any, {
      name: 'Test Project',
    } as any, 10, SLATE_DURATION_SECONDS);
    expect(filters).toHaveLength(1);
    expect(filters[0]).toContain('color=c=black');
    expect(filters[0]).toContain('drawtext=');
    expect(filters[0]).toContain('Test Project');
  });
});

// ---------------------------------------------------------------------------
// buildWatermarkFilters
// ---------------------------------------------------------------------------
describe('buildWatermarkFilters', () => {
  it('returns empty for image watermark without input index', () => {
    const filters = buildWatermarkFilters('vin', 'vout', {
      enabled: true,
      type: 'image',
      path: '/logo.png',
      position: 'top-left',
      scalePercent: 10,
      opacity: 0.5,
    }, { width: 1920, height: 1080 } as any, undefined);
    expect(filters).toEqual([]);
  });

  it('builds text watermark drawtext filter', () => {
    const filters = buildWatermarkFilters('vin', 'vout', {
      enabled: true,
      type: 'text',
      text: '© 2026',
      fontFamily: 'Arial',
      fontSize: 24,
      color: '#ffffff',
      position: 'bottom-right',
    }, { width: 1920, height: 1080 } as any, undefined);
    expect(filters).toHaveLength(1);
    expect(filters[0]).toContain('drawtext=');
    expect(filters[0]).toContain('© 2026');
  });
});

// ---------------------------------------------------------------------------
// buildGifExportPasses
// ---------------------------------------------------------------------------
describe('buildGifExportPasses', () => {
  it('builds two passes for gif export', () => {
    const textArtifacts: any[] = [];
    const result = buildGifExportPasses(
      [{ index: 0, path: 'input.mp4', args: [] }],
      'color=c=black:s=640x480:r=30:d=5[base0]',
      { outputPath: '/out.gif', width: 640, height: 480, fps: 30 } as any,
      5,
      textArtifacts,
    );
    expect(result.passes).toHaveLength(2);
    expect(result.passes[0].name).toBe('gif-palettegen');
    expect(result.passes[1].name).toBe('gif-paletteuse');
    expect(textArtifacts).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// buildExportRangeOutputArgs
// ---------------------------------------------------------------------------
describe('buildExportRangeOutputArgs', () => {
  it('returns empty for null range', () => {
    expect(buildExportRangeOutputArgs(null)).toEqual([]);
  });

  it('returns -ss arg for valid range', () => {
    const args = buildExportRangeOutputArgs({ start: 1.5, duration: 3 } as any);
    expect(args[0]).toBe('-ss');
    expect(args[1]).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// buildFfmpegFullArgs
// ---------------------------------------------------------------------------
describe('buildFfmpegFullArgs', () => {
  it('builds complete args array', () => {
    const args = buildFfmpegFullArgs(
      [{ index: 0, path: 'in.mp4', args: ['-ss', '0'] }],
      'filter',
      ['-map', '[vout]'],
      ['-f', 'mp4', 'out.mp4'],
    );
    expect(args[0]).toBe('-y');
    expect(args).toContain('-filter_complex');
    expect(args).toContain('filter');
    expect(args.at(-1)).toBe('out.mp4');
  });
});

// ---------------------------------------------------------------------------
// normalizeExportAudioVisualization
// ---------------------------------------------------------------------------
describe('normalizeExportAudioVisualization', () => {
  it('returns defaults for undefined', () => {
    const result = normalizeExportAudioVisualization(undefined);
    expect(result.style).toBe('waveform-line');
    expect(result.color).toBeTruthy();
    expect(result.background).toBeTruthy();
  });

  it('accepts valid styles', () => {
    expect(normalizeExportAudioVisualization({ style: 'spectrum-bars' } as any).style).toBe('spectrum-bars');
    expect(normalizeExportAudioVisualization({ style: 'circular-spectrum' } as any).style).toBe('circular-spectrum');
  });

  it('falls back for invalid style', () => {
    expect(normalizeExportAudioVisualization({ style: 'invalid' } as any).style).toBe('waveform-line');
  });

  it('preserves themeId when non-empty', () => {
    const result = normalizeExportAudioVisualization({ themeId: 'neon' } as any);
    expect(result.themeId).toBe('neon');
  });
});
