import { describe, it, expect, vi } from 'vitest';

// Mock heavy dependencies to isolate visual-filters.ts
vi.mock('../src/model', () => ({
  DEFAULT_COLOR_CORRECTION: { brightness: 0, contrast: 1, saturation: 1, hue: 0, threeWayColor: undefined, colorCurves: undefined, luts: [] },
  isDefaultColorCorrection: () => true,
  normalizeColorCorrection: (c: unknown) => c,
  normalizeTransitionDuration: (d: unknown) => (typeof d === 'number' ? d : 1),
  isStabilizationExportable: (s: unknown) => (s as { enabled?: boolean })?.enabled === true,
  normalizeChromaKey: (k: unknown) => ({ enabled: false, mode: 'chroma-key', colors: [], similarity: 0.3, blend: 0.1, erosion: 0, spillSuppression: false, ...(k as object) }),
  normalizeClipBorder: (b: unknown) => ({ enabled: false, color: '#000000', width: 0, ...(b as object) }),
  normalizeClipPanoramaView: (p: unknown) => ({ yaw: 0, pitch: 0, roll: 0, fov: 90, outputProjection: 'flat', ...(p as object) }),
  normalizeQualityEnhancement: (q: unknown) => ({ superResolution: false, deblock: false, colorBoost: false, frameCompensation: false, ...(q as object) }),
  normalizeSlowMotionMode: (m: unknown) => m ?? 'none',
  normalizeVideoRestoration: (v: unknown) => ({
    deinterlace: { enabled: false, mode: 'send_frame' },
    temporalDenoise: { preset: 'off', lumaSpatial: 0, chromaSpatial: 0, lumaTmp: 0 },
    spatialDenoise: { enabled: false, strength: 0, patchSize: 0, researchSize: 0 },
    ...(v as object),
  }),
  normalizeLutLayers: () => [],
}));

vi.mock('../src/color-grading', () => ({
  isDefaultColorCurves: () => true,
  isNeutralThreeWayColor: () => true,
  normalizeThreeWayColor: (v: unknown) => v,
  serializeColorCurvesToCube: () => '',
  PrimaryWheels: { toFfmpegFilter: () => null },
  PrimarySliders: { toFfmpegFilter: () => null },
  toFfmpegSelectiveColor: () => null,
}));

vi.mock('../src/color-node-graph', () => ({
  buildColorNodeGraphFilterPlan: () => ({ filters: [] }),
  detectColorNodeGraphCycle: () => null,
  normalizeColorNodeGraph: (g: unknown) => g,
}));

vi.mock('../src/color-log-luts', () => ({
  getLogToRec709Lut: () => null,
  isLogInputColorSpace: () => false,
  serializeLogToRec709Cube: () => '',
}));

vi.mock('../src/motion-blur', () => ({
  buildMotionBlurExportFilter: () => null,
  normalizeMotionBlurParams: (p: unknown) => p,
}));

vi.mock('../src/reframe', () => ({
  buildReframeCropFilter: () => null,
  isReframeEnabled: () => false,
}));

vi.mock('../src/masks/path-mask', () => ({
  triangulatePathMask: () => ({ vertices: [], indices: [] }),
}));

vi.mock('../src/blend-modes', () => ({
  getFfmpegBlendMode: () => 'normal',
  normalizeClipBlendMode: (m: unknown) => m ?? 'normal',
}));

vi.mock('../src/timeline', () => ({
  getClipSpeed: (clip: { speed: number }) => clip.speed,
  calculateSpeedCurveSourceDuration: (duration: number) => duration,
}));

vi.mock('../src/time', () => ({
  round: (v: number) => Math.round(v * 1e6) / 1e6,
}));

vi.mock('../src/export/frame-interpolation', () => ({
  averageClipMotionScore: () => 0,
  buildSceneBoundaryProtectionRanges: () => [],
  resolveFrameInterpolationMode: (mode: string) => mode,
}));

vi.mock('../src/color-management', () => ({
  DEFAULT_EXPORT_COLOR_MANAGEMENT: {},
  buildZscaleColorConversionFilter: () => null,
  normalizeProjectWorkingColorSpace: (s: string) => s,
}));

vi.mock('../src/privacy-redaction', () => ({
  buildPrivacyRedactionFFmpegExpressions: () => [],
}));

vi.mock('../src/export/ffmpeg-escape', () => ({
  cssColorToFfmpeg: (color: string) => color.replace('#', '0x'),
  escapeDrawtextValue: (v: string) => v,
  formatFfmpegSeconds: (v: number) => String(Math.round(v * 1000) / 1000),
}));

vi.mock('../src/export/ffmpeg-builder/utils', () => ({
  formatFfmpegNumber: (v: number) => String(Math.round(v * 1000) / 1000),
  formatScale: (v: number) => String(v),
  formatOpacity: (v: number) => String(Math.min(1, Math.max(0, v))),
  safeLabel: (s: string) => s.replace(/[^a-zA-Z0-9_]/g, '_'),
  formatOffsetExpression: (v: number) => (v === 0 ? '' : `+${v}`),
  getAnimatedFrames: () => [],
  buildTimelineExpression: () => '0',
}));

vi.mock('../src/effects', () => ({
  getEffectNumberParam: (_effect: unknown, _key: string, fallback: number) => fallback,
}));

import {
  mapTransitionType,
  buildShapeWipeGeqExpression,
  visualKindOrder,
  areExportClipsAdjacent,
  formatChromaKeyColor,
  triangleArea,
  getPathVertex,
  buildPathEdgeExpression,
  isTransitionVisualClip,
  isSimpleRectMask,
  getPrivacyBlurMasks,
  hasPrivacyBlurMasks,
  buildPrivacyBlurEffectFilter,
  getExportClipSourceDuration,
  hasSphericalVideoClips,
  getMinimumClipSpeed,
  colorBalanceValue,
  buildFrameInterpolationFilterArg,
  buildOverlayXExpression,
  buildOverlayYExpression,
  buildStaticSetptsFilter,
  buildTransitionPreviewArgs,
  buildPathTriangleExpression,
} from '../src/export/ffmpeg-builder/visual-filters';

// Helper to create a minimal ExportClip
function makeClip(overrides: Record<string, unknown> = {}) {
  return {
    id: 'clip-1',
    type: 'video',
    mediaPath: '/video.mp4',
    sourceColorProfile: null,
    nestedSequenceId: null,
    start: 0,
    duration: 10,
    trimStart: 0,
    trimEnd: 0,
    speed: 1,
    slowMotionMode: 'none',
    sourceDuration: 10,
    trackIndex: 0,
    transform: { x: 0, y: 0, scale: 1, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 },
    border: { enabled: false, color: '#000000', width: 0 },
    colorCorrection: { brightness: 0, contrast: 1, saturation: 1, hue: 0, luts: [] },
    chromaKey: { enabled: false, mode: 'chroma-key', colors: [], similarity: 0.3, blend: 0.1, erosion: 0, spillSuppression: false },
    stabilization: { enabled: false, smoothing: 10, zoom: 0 },
    frameInterpolation: { enabled: false, mode: 'blend', targetFps: 30, protectionFrames: 0 },
    audioDenoise: { enabled: false },
    aiLocalDenoise: { enabled: false },
    audioRestoration: { enabled: false },
    spatialAudio: { enabled: false },
    videoRestoration: { deinterlace: { enabled: false, mode: 'send_frame' } },
    qualityEnhancement: { superResolution: false },
    masks: [],
    effects: [],
    projection: 'flat',
    ...overrides,
  } as never;
}

describe('mapTransitionType', () => {
  it('maps fade-black to fadeblack', () => {
    expect(mapTransitionType('fade-black')).toBe('fadeblack');
  });

  it('maps wipe-left to wipeleft', () => {
    expect(mapTransitionType('wipe-left')).toBe('wipeleft');
  });

  it('maps wipe-right to wiperight', () => {
    expect(mapTransitionType('wipe-right')).toBe('wiperight');
  });

  it('maps wipe-up to wipeup', () => {
    expect(mapTransitionType('wipe-up')).toBe('wipeup');
  });

  it('maps wipe-down to wipedown', () => {
    expect(mapTransitionType('wipe-down')).toBe('wipedown');
  });

  it('maps zoom-dissolve to zoominzoomout', () => {
    expect(mapTransitionType('zoom-dissolve')).toBe('zoominzoomout');
  });

  it('maps flash-white to fadewhite', () => {
    expect(mapTransitionType('flash-white')).toBe('fadewhite');
  });

  it('maps block to pixelize', () => {
    expect(mapTransitionType('block')).toBe('pixelize');
  });

  it('maps film-roll-open to horzopen', () => {
    expect(mapTransitionType('film-roll-open')).toBe('horzopen');
  });

  it('maps film-roll-close to horzclose', () => {
    expect(mapTransitionType('film-roll-close')).toBe('horzclose');
  });

  it('maps push types to slide types', () => {
    expect(mapTransitionType('push-left')).toBe('slideleft');
    expect(mapTransitionType('push-right')).toBe('slideright');
    expect(mapTransitionType('push-up')).toBe('slideup');
    expect(mapTransitionType('push-down')).toBe('slidedown');
  });

  it('maps custom transitions to custom', () => {
    expect(mapTransitionType('shape-heart')).toBe('custom');
    expect(mapTransitionType('shape-star')).toBe('custom');
    expect(mapTransitionType('light-leak')).toBe('custom');
    expect(mapTransitionType('glitch')).toBe('custom');
    expect(mapTransitionType('flip-horizontal')).toBe('custom');
    expect(mapTransitionType('flip-vertical')).toBe('custom');
    expect(mapTransitionType('cube-rotate')).toBe('custom');
    expect(mapTransitionType('portal')).toBe('custom');
  });

  it('defaults to dissolve', () => {
    expect(mapTransitionType('dissolve')).toBe('dissolve');
    expect(mapTransitionType('unknown' as never)).toBe('dissolve');
  });
});

describe('buildShapeWipeGeqExpression', () => {
  it('builds star expression', () => {
    const expr = buildShapeWipeGeqExpression('shape-star');
    expect(expr).toContain('abs(X-W/2)');
    expect(expr).toContain('abs(Y-H/2)');
  });

  it('builds heart expression', () => {
    const expr = buildShapeWipeGeqExpression('shape-heart');
    expect(expr).toContain('pow');
    expect(expr).toContain('sqrt');
  });
});

describe('visualKindOrder', () => {
  it('media has order 0', () => {
    expect(visualKindOrder({ kind: 'media' } as never)).toBe(0);
  });

  it('adjustment has order 1', () => {
    expect(visualKindOrder({ kind: 'adjustment' } as never)).toBe(1);
  });

  it('text/credits have order 2', () => {
    expect(visualKindOrder({ kind: 'text' } as never)).toBe(2);
    expect(visualKindOrder({ kind: 'credits' } as never)).toBe(2);
  });
});

describe('areExportClipsAdjacent', () => {
  it('returns true for adjacent clips', () => {
    expect(areExportClipsAdjacent(
      { start: 0, duration: 5 } as never,
      { start: 5, duration: 3 } as never,
    )).toBe(true);
  });

  it('returns false for non-adjacent clips', () => {
    expect(areExportClipsAdjacent(
      { start: 0, duration: 5 } as never,
      { start: 6, duration: 3 } as never,
    )).toBe(false);
  });

  it('handles tiny floating point gaps', () => {
    expect(areExportClipsAdjacent(
      { start: 0, duration: 5 } as never,
      { start: 5.0005, duration: 3 } as never,
    )).toBe(true);
  });
});

describe('formatChromaKeyColor', () => {
  it('formats RGB tuple to hex', () => {
    expect(formatChromaKeyColor([0, 128, 255])).toBe('0080FF');
  });

  it('pads single-digit values', () => {
    expect(formatChromaKeyColor([1, 2, 3])).toBe('010203');
  });
});

describe('triangleArea', () => {
  it('returns positive for counter-clockwise', () => {
    expect(triangleArea({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 })).toBeGreaterThan(0);
  });

  it('returns negative for clockwise', () => {
    expect(triangleArea({ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 0 })).toBeLessThan(0);
  });

  it('returns 0 for collinear points', () => {
    expect(triangleArea({ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 })).toBe(0);
  });
});

describe('getPathVertex', () => {
  it('returns vertex at index', () => {
    expect(getPathVertex([10, 20, 30, 40], 0)).toEqual({ x: 10, y: 20 });
    expect(getPathVertex([10, 20, 30, 40], 1)).toEqual({ x: 30, y: 40 });
  });

  it('returns 0 for out-of-bounds', () => {
    expect(getPathVertex([], 0)).toEqual({ x: 0, y: 0 });
  });
});

describe('buildPathEdgeExpression', () => {
  it('builds gte expression', () => {
    const expr = buildPathEdgeExpression({ x: 0, y: 0 }, { x: 1, y: 0 }, 'gte');
    expect(expr).toContain('gte(');
    expect(expr).toContain('Y/ih');
    expect(expr).toContain('X/iw');
  });

  it('builds lte expression', () => {
    const expr = buildPathEdgeExpression({ x: 0, y: 0 }, { x: 1, y: 0 }, 'lte');
    expect(expr).toContain('lte(');
  });
});

describe('isTransitionVisualClip', () => {
  it('returns true for video', () => {
    expect(isTransitionVisualClip(makeClip({ type: 'video' }))).toBe(true);
  });

  it('returns true for image', () => {
    expect(isTransitionVisualClip(makeClip({ type: 'image' }))).toBe(true);
  });

  it('returns true for nested-sequence', () => {
    expect(isTransitionVisualClip(makeClip({ type: 'nested-sequence' }))).toBe(true);
  });

  it('returns false for audio', () => {
    expect(isTransitionVisualClip(makeClip({ type: 'audio' }))).toBe(false);
  });

  it('returns false for text', () => {
    expect(isTransitionVisualClip(makeClip({ type: 'text' }))).toBe(false);
  });
});

describe('isSimpleRectMask', () => {
  it('returns true for simple rect mask', () => {
    expect(isSimpleRectMask({ type: 'rect', inverted: false, feather: 0 } as never)).toBe(true);
  });

  it('returns false for inverted mask', () => {
    expect(isSimpleRectMask({ type: 'rect', inverted: true, feather: 0 } as never)).toBe(false);
  });

  it('returns false for feathered mask', () => {
    expect(isSimpleRectMask({ type: 'rect', inverted: false, feather: 0.5 } as never)).toBe(false);
  });

  it('returns false for non-rect mask', () => {
    expect(isSimpleRectMask({ type: 'ellipse', inverted: false, feather: 0 } as never)).toBe(false);
  });
});

describe('getPrivacyBlurMasks / hasPrivacyBlurMasks', () => {
  it('returns empty for no masks', () => {
    const clip = makeClip({ masks: [] });
    expect(getPrivacyBlurMasks(clip)).toEqual([]);
    expect(hasPrivacyBlurMasks(clip)).toBe(false);
  });

  it('filters non-privacy masks', () => {
    const clip = makeClip({
      masks: [
        { id: 'm1', enabled: true, privacyBlur: { enabled: false } },
        { id: 'm2', enabled: true, privacyBlur: { enabled: true } },
        { id: 'm3', enabled: false, privacyBlur: { enabled: true } },
      ],
    });
    expect(getPrivacyBlurMasks(clip)).toHaveLength(1);
    expect(hasPrivacyBlurMasks(clip)).toBe(true);
  });
});

describe('buildPrivacyBlurEffectFilter', () => {
  it('builds solid effect', () => {
    const filter = buildPrivacyBlurEffectFilter({ privacyBlur: { effect: 'solid', color: '#ff0000' } } as never);
    expect(filter).toContain('drawbox');
  });

  it('builds gblur effect', () => {
    const filter = buildPrivacyBlurEffectFilter({ privacyBlur: { effect: 'gblur' } } as never);
    expect(filter).toContain('gblur');
  });

  it('defaults to pixelize', () => {
    const filter = buildPrivacyBlurEffectFilter({ privacyBlur: {} } as never);
    expect(filter).toContain('pixelize');
  });
});

describe('getExportClipSourceDuration', () => {
  it('returns sourceDuration for video', () => {
    expect(getExportClipSourceDuration(makeClip({ type: 'video', sourceDuration: 20, duration: 10 }))).toBe(20);
  });

  it('returns sourceDuration for audio', () => {
    expect(getExportClipSourceDuration(makeClip({ type: 'audio', sourceDuration: 15, duration: 10 }))).toBe(15);
  });

  it('returns duration for image', () => {
    expect(getExportClipSourceDuration(makeClip({ type: 'image', sourceDuration: 0, duration: 5 }))).toBe(5);
  });

  it('minimum is 0.001', () => {
    expect(getExportClipSourceDuration(makeClip({ type: 'video', sourceDuration: 0, duration: 0 }))).toBe(0.001);
  });
});

describe('hasSphericalVideoClips', () => {
  it('returns false for empty', () => {
    expect(hasSphericalVideoClips([])).toBe(false);
  });

  it('returns false for flat clips', () => {
    expect(hasSphericalVideoClips([makeClip({ projection: 'flat' })])).toBe(false);
  });

  it('returns true for equirectangular', () => {
    expect(hasSphericalVideoClips([makeClip({ projection: 'equirectangular' })])).toBe(true);
  });
});

describe('getMinimumClipSpeed', () => {
  it('returns static speed when no animated frames', () => {
    expect(getMinimumClipSpeed(makeClip({ speed: 2 }))).toBe(2);
  });
});

describe('colorBalanceValue', () => {
  it('computes balance from RGB + intensity', () => {
    const result = colorBalanceValue({ r: 0.5, g: 0, b: 0, intensity: 1 }, 'r');
    // min(1, max(-1, 0.5 + 1 - 1)) = 0.5
    expect(result).toBeCloseTo(0.5);
  });

  it('clamps to [-1, 1]', () => {
    expect(colorBalanceValue({ r: 1, g: 0, b: 0, intensity: 1 }, 'r')).toBe(1);
    expect(colorBalanceValue({ r: -1, g: 0, b: 0, intensity: 0 }, 'r')).toBe(-1);
  });
});

describe('buildFrameInterpolationFilterArg', () => {
  it('builds blend mode', () => {
    expect(buildFrameInterpolationFilterArg(60, 'blend', false)).toBe('minterpolate=fps=60:mi_mode=blend');
  });

  it('builds mci mode', () => {
    expect(buildFrameInterpolationFilterArg(60, 'mci', false)).toBe('minterpolate=fps=60:mi_mode=mci:mc_mode=aobmc');
  });

  it('adds scene detection when sceneProtected', () => {
    expect(buildFrameInterpolationFilterArg(60, 'blend', true)).toContain('scd=fdiff');
  });
});

describe('buildOverlayXExpression', () => {
  it('returns centered expression for no animation', () => {
    const expr = buildOverlayXExpression(makeClip({ transform: { x: 0, y: 0, scale: 1, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 } }));
    expect(expr).toContain('main_w-overlay_w');
  });
});

describe('buildOverlayYExpression', () => {
  it('returns centered expression for no animation', () => {
    const expr = buildOverlayYExpression(makeClip({ transform: { x: 0, y: 0, scale: 1, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 } }));
    expect(expr).toContain('main_h-overlay_h');
  });
});

describe('buildStaticSetptsFilter', () => {
  it('returns PTS-STARTPTS for speed 1 with offset', () => {
    const filter = buildStaticSetptsFilter(makeClip({ start: 5, speed: 1, type: 'video' }) as never, true, 1);
    expect(filter).toContain('PTS-STARTPTS');
    expect(filter).toContain('5');
  });

  it('returns PTS-STARTPTS for speed 1 without offset', () => {
    const filter = buildStaticSetptsFilter(makeClip({ start: 5, speed: 1, type: 'video' }) as never, false, 1);
    expect(filter).toBe('setpts=PTS-STARTPTS');
  });

  it('divides by speed when not 1', () => {
    const filter = buildStaticSetptsFilter(makeClip({ start: 0, speed: 2, type: 'video' }) as never, false, 2);
    expect(filter).toContain('PTS-STARTPTS');
    expect(filter).toContain('2');
  });

  it('returns PTS-STARTPTS for images regardless of speed', () => {
    const filter = buildStaticSetptsFilter(makeClip({ start: 0, speed: 2, type: 'image' }) as never, false, 2);
    expect(filter).toBe('setpts=PTS-STARTPTS');
  });
});

describe('buildTransitionPreviewArgs', () => {
  it('builds args for dissolve transition', () => {
    const args = buildTransitionPreviewArgs('dissolve', { width: 320, height: 240, fps: 30, duration: 1 });
    expect(args[0]).toBe('-f');
    expect(args[1]).toBe('lavfi');
    expect(args).toContain('pipe:1');
  });

  it('builds args for shape-heart transition', () => {
    const args = buildTransitionPreviewArgs('shape-heart');
    expect(args).toContain('-filter_complex');
    const filterIdx = args.indexOf('-filter_complex');
    expect(args[filterIdx + 1]).toContain('geq');
  });

  it('builds args for shape-star transition', () => {
    const args = buildTransitionPreviewArgs('shape-star');
    const filterIdx = args.indexOf('-filter_complex');
    expect(args[filterIdx + 1]).toContain('geq');
  });
});

describe('buildPathTriangleExpression', () => {
  it('builds expression for triangle', () => {
    const expr = buildPathTriangleExpression(
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
    );
    expect(expr).toContain('gte');
    expect(expr).toContain('*');
  });
});
