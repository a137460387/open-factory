import { describe, expect, it } from 'vitest';
import {
  buildInputArgs,
  buildCustomShaderSequenceInputArgs,
  buildCustomShaderSequenceClip,
  pngSequenceOutputPath,
  escapeConcatPath,
  formatSequenceFrameDuration,
  getExportClipSourceDuration,
  shouldUseAdvancedTextFilters,
  exportTextStyleToTextStyle,
  buildSubtitleLanguageGroups,
  selectSubtitleBurnInGroup,
  subtitleLanguageToFfmpegMetadata,
  buildSubtitleInputArgs,
  buildSoftSubtitleCodec,
  normalizeSubtitleFormat,
  buildTextFontSizeExpression,
  buildDrawtextPositionExpression,
  round,
  formatOpacity,
  formatSigned,
  cssColorToAssColor,
} from '../src/export/ffmpeg-builder/text-subtitle-filters';
import type { ExportClip, ExportSettings } from '../src/export/export-types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeClip(overrides: Partial<ExportClip> = {}): ExportClip {
  return {
    id: 'clip-1',
    type: 'video',
    mediaPath: '/media.mp4',
    sourceColorProfile: null,
    nestedSequenceId: null,
    start: 0,
    duration: 5,
    trimStart: 0,
    trimEnd: 0,
    speed: 1,
    slowMotionMode: 'none',
    sourceDuration: 5,
    trackIndex: 0,
    transform: { x: 0, y: 0, scale: 1, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 },
    border: { enabled: false, width: 0, color: '#000000', radius: 0 },
    colorCorrection: { brightness: 0, contrast: 1, saturation: 1, hue: 0 },
    chromaKey: { enabled: false },
    stabilization: { enabled: false },
    frameInterpolation: { enabled: false },
    audioDenoise: { enabled: false },
    aiLocalDenoise: { enabled: false },
    audioRestoration: { enabled: false },
    spatialAudio: { x: 0, y: 0, z: 0, distance: 'medium' },
    videoRestoration: { enabled: false },
    qualityEnhancement: { enabled: false },
    projection: 'flat',
    panorama: { yaw: 0, pitch: 0, roll: 0, fov: 90, outputProjection: 'flat' },
    masks: [],
    imageSequence: null,
    effects: [],
    blendMode: 'normal',
    keyframes: null,
    volume: 1,
    audioChannelRouting: { enabled: false },
    pan: 0,
    eq: { enabled: false, bands: [] },
    compressor: { enabled: false, threshold: -20, ratio: 4, attack: 5, release: 50 },
    muted: false,
    pitchSemitones: 0,
    reverseAudio: false,
    fadeInDuration: 0,
    fadeOutDuration: 0,
    fadeInCurve: 'linear',
    fadeOutCurve: 'linear',
    hasEmbeddedAudio: false,
    audioChannels: 2,
    audioSampleRate: 44100,
    textStyle: null,
    textPath: null,
    subtitleStyle: null,
    subtitleType: null,
    speaker: null,
    soundDesc: null,
    subtitleMode: null,
    dataSubtitle: null,
    creditsStyle: null,
    motionGraphic: null,
    privacyRedactions: [],
    ...overrides,
  } as ExportClip;
}

const defaultSettings: ExportSettings = {
  width: 1920,
  height: 1080,
  fps: 30,
  sampleRate: 44100,
  videoCodec: 'libx264',
  audioCodec: 'aac',
  format: 'mp4',
  outputPath: '/out.mp4',
  videoBitrate: null,
  audioBitrate: null,
  outputMode: 'video',
  scaleMode: 'none',
  targetAspectRatio: 'source',
  reframeOffsetX: 0,
  reframeOffsetY: 0,
  subtitleMode: undefined,
  subtitleFormat: 'srt',
  exportSidecarSubtitle: false,
  subtitleLanguages: undefined,
  subtitleBurnInLanguage: undefined,
  hardwareEncoding: false,
  hardwareEncoderSettings: null,
  loudnessNormalization: 'off',
  platformPreset: undefined,
  videoProfile: undefined,
  watermark: null,
  timecodeBurnIn: null,
  slate: null,
  colorManagement: { inputColorSpace: 'srgb', outputColorSpace: 'srgb', embedIccProfile: false },
  colorPipeline: 'sdr-srgb',
  masterProcessing: null,
  spatialAudioAssets: null,
  audioVisualization: { style: 'waveform-line', color: '#22d3ee', background: { type: 'solid', color: '#050816' } },
  workingColorSpace: 'srgb',
};

// ---------------------------------------------------------------------------
// buildInputArgs
// ---------------------------------------------------------------------------
describe('buildInputArgs', () => {
  it('returns concat args for image sequence', () => {
    const clip = makeClip({ imageSequence: { frameRate: 30, frameCount: 100, paths: [] } });
    expect(buildInputArgs(clip)).toEqual(['-f', 'concat', '-safe', '0']);
  });

  it('returns loop args for image type', () => {
    const clip = makeClip({ type: 'image', duration: 3 });
    const args = buildInputArgs(clip);
    expect(args[0]).toBe('-loop');
    expect(args[1]).toBe('1');
    expect(args[2]).toBe('-t');
  });

  it('returns seek/trim args for video type', () => {
    const clip = makeClip({ type: 'video', trimStart: 1, sourceDuration: 10 });
    const args = buildInputArgs(clip);
    expect(args[0]).toBe('-ss');
    expect(args[2]).toBe('-t');
  });

  it('returns empty array for text type', () => {
    expect(buildInputArgs(makeClip({ type: 'text' }))).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// buildCustomShaderSequenceInputArgs
// ---------------------------------------------------------------------------
describe('buildCustomShaderSequenceInputArgs', () => {
  it('builds image2 input args with framerate', () => {
    const args = buildCustomShaderSequenceInputArgs(defaultSettings);
    expect(args).toEqual(['-f', 'image2', '-framerate', '30', '-start_number', '1']);
  });
});

// ---------------------------------------------------------------------------
// buildCustomShaderSequenceClip
// ---------------------------------------------------------------------------
describe('buildCustomShaderSequenceClip', () => {
  it('resets trim and speed for shader rendering', () => {
    const clip = makeClip({ trimStart: 2, trimEnd: 1, speed: 2, sourceDuration: 10, duration: 5 });
    const result = buildCustomShaderSequenceClip(clip);
    expect(result.trimStart).toBe(0);
    expect(result.trimEnd).toBe(0);
    expect(result.speed).toBe(1);
    expect(result.sourceDuration).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// pngSequenceOutputPath
// ---------------------------------------------------------------------------
describe('pngSequenceOutputPath', () => {
  it('appends frame pattern when no extension', () => {
    expect(pngSequenceOutputPath('/output/frames')).toBe('/output/frames/frame%04d.png');
  });

  it('preserves existing % pattern', () => {
    expect(pngSequenceOutputPath('/output/frame%06d.png')).toBe('/output/frame%06d.png');
  });

  it('preserves .png extension', () => {
    expect(pngSequenceOutputPath('/output/frames.png')).toBe('/output/frames.png');
  });
});

// ---------------------------------------------------------------------------
// escapeConcatPath
// ---------------------------------------------------------------------------
describe('escapeConcatPath', () => {
  it('escapes single quotes', () => {
    expect(escapeConcatPath("/path/it's")).toContain("'\\''");
  });
});

// ---------------------------------------------------------------------------
// formatSequenceFrameDuration
// ---------------------------------------------------------------------------
describe('formatSequenceFrameDuration', () => {
  it('formats with 6 decimal places then trims', () => {
    const result = formatSequenceFrameDuration(0.033333);
    expect(result).toMatch(/^0\.033/);
  });

  it('trims trailing zeros', () => {
    expect(formatSequenceFrameDuration(0.5)).toBe('0.5');
  });
});

// ---------------------------------------------------------------------------
// getExportClipSourceDuration
// ---------------------------------------------------------------------------
describe('getExportClipSourceDuration', () => {
  it('returns sourceDuration for video clips', () => {
    expect(getExportClipSourceDuration(makeClip({ type: 'video', sourceDuration: 10, duration: 5 }))).toBe(10);
  });

  it('returns duration for non-video clips', () => {
    expect(getExportClipSourceDuration(makeClip({ type: 'image', sourceDuration: 10, duration: 5 }))).toBe(5);
  });

  it('returns at least 0.001', () => {
    expect(getExportClipSourceDuration(makeClip({ type: 'video', sourceDuration: 0, duration: 0 }))).toBeGreaterThanOrEqual(0.001);
  });
});

// ---------------------------------------------------------------------------
// shouldUseAdvancedTextFilters
// ---------------------------------------------------------------------------
describe('shouldUseAdvancedTextFilters', () => {
  it('returns false for plain single-run text', () => {
    expect(
      shouldUseAdvancedTextFilters({
        text: 'Hello',
        fontSize: 48,
        fontColor: '#fff',
        backgroundColor: '#000',
        backgroundOpacity: 0,
        fontFamily: 'Arial',
        fontPath: null,
        x: 0,
        y: 0,
        opacity: 1,
        bold: false,
        italic: false,
        richText: null,
        textLayout: null,
        openTypeFeatures: null,
        arcText: null,
      }),
    ).toBe(false);
  });

  it('returns true for multi-paragraph rich text', () => {
    expect(
      shouldUseAdvancedTextFilters({
        text: 'A\nB',
        fontSize: 48,
        fontColor: '#fff',
        backgroundColor: '#000',
        backgroundOpacity: 0,
        fontFamily: 'Arial',
        fontPath: null,
        x: 0,
        y: 0,
        opacity: 1,
        bold: false,
        italic: false,
        richText: { paragraphs: [{ runs: [{ text: 'A' }] }, { runs: [{ text: 'B' }] }] },
        textLayout: null,
        openTypeFeatures: null,
        arcText: null,
      }),
    ).toBe(true);
  });

  it('returns true for runs with formatting', () => {
    expect(
      shouldUseAdvancedTextFilters({
        text: 'Hello',
        fontSize: 48,
        fontColor: '#fff',
        backgroundColor: '#000',
        backgroundOpacity: 0,
        fontFamily: 'Arial',
        fontPath: null,
        x: 0,
        y: 0,
        opacity: 1,
        bold: false,
        italic: false,
        richText: {
          paragraphs: [
            {
              runs: [
                { text: 'Hello', bold: true },
                { text: ' World' },
              ],
            },
          ],
        },
        textLayout: null,
        openTypeFeatures: null,
        arcText: null,
      }),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// exportTextStyleToTextStyle
// ---------------------------------------------------------------------------
describe('exportTextStyleToTextStyle', () => {
  it('converts export style to text style', () => {
    const result = exportTextStyleToTextStyle({
      text: 'Hi',
      fontSize: 36,
      fontColor: '#ff0000',
      backgroundColor: '#000',
      backgroundOpacity: 0.5,
      fontFamily: 'Arial',
      fontPath: null,
      x: 0,
      y: 0,
      opacity: 1,
      bold: true,
      italic: false,
      richText: null,
      textLayout: null,
      openTypeFeatures: null,
      arcText: null,
    });
    expect(result).toMatchObject({
      fontSize: 36,
      color: '#ff0000',
      bold: true,
      italic: false,
    });
  });
});

// ---------------------------------------------------------------------------
// buildSubtitleLanguageGroups
// ---------------------------------------------------------------------------
describe('buildSubtitleLanguageGroups', () => {
  const timeline = {
    duration: 10,
    transitions: [],
    tracks: [
      { index: 0, type: 'subtitle', language: 'en', muted: false, solo: false, locked: false, volume: 1, pan: 0, clips: [] },
      { index: 1, type: 'subtitle', language: 'zh', muted: false, solo: false, locked: false, volume: 1, pan: 0, clips: [] },
    ],
  } as any;

  it('returns empty for no clips', () => {
    expect(buildSubtitleLanguageGroups(timeline, [], undefined)).toEqual([]);
  });

  it('groups clips by language', () => {
    const clips = [
      makeClip({ id: 'c1', type: 'subtitle', trackIndex: 0, start: 0, duration: 2 }),
      makeClip({ id: 'c2', type: 'subtitle', trackIndex: 0, start: 3, duration: 2 }),
      makeClip({ id: 'c3', type: 'subtitle', trackIndex: 1, start: 0, duration: 2 }),
    ];
    const groups = buildSubtitleLanguageGroups(timeline, clips, undefined);
    expect(groups).toHaveLength(2);
  });

  it('filters by selected languages', () => {
    const clips = [
      makeClip({ id: 'c1', type: 'subtitle', trackIndex: 0, start: 0, duration: 2 }),
      makeClip({ id: 'c2', type: 'subtitle', trackIndex: 1, start: 0, duration: 2 }),
    ];
    const groups = buildSubtitleLanguageGroups(timeline, clips, ['en']);
    expect(groups).toHaveLength(1);
    expect(groups[0].language).toBe('en');
  });
});

// ---------------------------------------------------------------------------
// selectSubtitleBurnInGroup
// ---------------------------------------------------------------------------
describe('selectSubtitleBurnInGroup', () => {
  const groups = [
    { language: 'en', clips: [] },
    { language: 'zh', clips: [] },
  ] as any;

  it('returns undefined for empty groups', () => {
    expect(selectSubtitleBurnInGroup([], undefined)).toBeUndefined();
  });

  it('returns first group when no language specified', () => {
    expect(selectSubtitleBurnInGroup(groups, undefined)!.language).toBe('en');
  });

  it('returns matching group', () => {
    expect(selectSubtitleBurnInGroup(groups, 'zh')!.language).toBe('zh');
  });

  it('falls back to first group for unmatched language', () => {
    expect(selectSubtitleBurnInGroup(groups, 'fr')!.language).toBe('en');
  });
});

// ---------------------------------------------------------------------------
// subtitleLanguageToFfmpegMetadata
// ---------------------------------------------------------------------------
describe('subtitleLanguageToFfmpegMetadata', () => {
  it('maps known languages to ISO 639-2', () => {
    expect(subtitleLanguageToFfmpegMetadata('en')).toBe('eng');
    expect(subtitleLanguageToFfmpegMetadata('zh')).toBe('zho');
    expect(subtitleLanguageToFfmpegMetadata('ja')).toBe('jpn');
    expect(subtitleLanguageToFfmpegMetadata('de')).toBe('deu');
    expect(subtitleLanguageToFfmpegMetadata('fr')).toBe('fra');
  });

  it('returns normalized input for unknown languages', () => {
    expect(subtitleLanguageToFfmpegMetadata('xx')).toBe('xx');
  });
});

// ---------------------------------------------------------------------------
// buildSubtitleInputArgs
// ---------------------------------------------------------------------------
describe('buildSubtitleInputArgs', () => {
  it('returns srt args by default', () => {
    expect(buildSubtitleInputArgs('srt')).toEqual(['-f', 'srt']);
  });

  it('returns vtt args', () => {
    expect(buildSubtitleInputArgs('vtt')).toEqual(['-f', 'webvtt']);
  });

  it('returns ass args', () => {
    expect(buildSubtitleInputArgs('ass')).toEqual(['-f', 'ass']);
  });

  it('returns ssa args', () => {
    expect(buildSubtitleInputArgs('ssa')).toEqual(['-f', 'ssa']);
  });
});

// ---------------------------------------------------------------------------
// buildSoftSubtitleCodec
// ---------------------------------------------------------------------------
describe('buildSoftSubtitleCodec', () => {
  it('returns ass for ass format', () => {
    expect(buildSoftSubtitleCodec('ass', defaultSettings)).toBe('ass');
  });

  it('returns webvtt for vtt in webm container', () => {
    expect(buildSoftSubtitleCodec('vtt', { ...defaultSettings, format: 'webm' })).toBe('webvtt');
  });

  it('returns mov_text for srt in mp4', () => {
    expect(buildSoftSubtitleCodec('srt', defaultSettings)).toBe('mov_text');
  });
});

// ---------------------------------------------------------------------------
// normalizeSubtitleFormat
// ---------------------------------------------------------------------------
describe('normalizeSubtitleFormat', () => {
  it('accepts valid formats', () => {
    expect(normalizeSubtitleFormat('srt')).toBe('srt');
    expect(normalizeSubtitleFormat('vtt')).toBe('vtt');
    expect(normalizeSubtitleFormat('ass')).toBe('ass');
    expect(normalizeSubtitleFormat('ssa')).toBe('ssa');
  });

  it('defaults to srt for invalid', () => {
    expect(normalizeSubtitleFormat(undefined)).toBe('srt');
    expect(normalizeSubtitleFormat('txt' as any)).toBe('srt');
  });
});

// ---------------------------------------------------------------------------
// buildTextFontSizeExpression
// ---------------------------------------------------------------------------
describe('buildTextFontSizeExpression', () => {
  it('returns static font size when no keyframes', () => {
    const clip = makeClip({ transform: { x: 0, y: 0, scale: 1, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 } });
    const result = buildTextFontSizeExpression(clip, 48);
    expect(result).toBe('48');
  });

  it('scales font size by transform scale', () => {
    const clip = makeClip({ transform: { x: 0, y: 0, scale: 2, scaleX: 2, scaleY: 2, rotation: 0, opacity: 1 } });
    const result = buildTextFontSizeExpression(clip, 48);
    expect(result).toBe('96');
  });
});

// ---------------------------------------------------------------------------
// buildDrawtextPositionExpression
// ---------------------------------------------------------------------------
describe('buildDrawtextPositionExpression', () => {
  it('returns static position expression when no keyframes', () => {
    const clip = makeClip({ transform: { x: 100, y: 200, scale: 1, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 } });
    const xExpr = buildDrawtextPositionExpression(clip, 'x', 100);
    const yExpr = buildDrawtextPositionExpression(clip, 'y', 200);
    expect(xExpr).toContain('(w-text_w)/2');
    expect(yExpr).toContain('(h-text_h)/2');
  });
});

// ---------------------------------------------------------------------------
// round / formatOpacity / formatSigned
// ---------------------------------------------------------------------------
describe('round', () => {
  it('rounds to 3 decimal places', () => {
    expect(round(1.2345)).toBe(1.235);
    expect(round(1.2344)).toBe(1.234);
    expect(round(0)).toBe(0);
  });
});

describe('formatOpacity', () => {
  it('clamps to 0-1', () => {
    expect(formatOpacity(0.5)).toBeTruthy();
    expect(formatOpacity(-1)).toBeTruthy();
    expect(formatOpacity(2)).toBeTruthy();
  });
});

describe('formatSigned', () => {
  it('returns empty for zero', () => {
    expect(formatSigned(0)).toBe('');
  });

  it('returns empty for near-zero', () => {
    expect(formatSigned(1e-10)).toBe('');
  });

  it('adds + prefix for positive', () => {
    const result = formatSigned(5);
    expect(result.startsWith('+')).toBe(true);
  });

  it('returns negative with minus', () => {
    const result = formatSigned(-3);
    expect(result.startsWith('-')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// cssColorToAssColor
// ---------------------------------------------------------------------------
describe('cssColorToAssColor', () => {
  it('converts hex to ASS ABGR format', () => {
    expect(cssColorToAssColor('#ff0000')).toBe('&H000000FF');
    expect(cssColorToAssColor('#00ff00')).toBe('&H0000FF00');
    expect(cssColorToAssColor('#0000ff')).toBe('&H00FF0000');
  });

  it('includes alpha when opacity provided', () => {
    const result = cssColorToAssColor('#ffffff', 0.5);
    expect(result).toContain('80'); // 0.5 * 255 = 127.5 ≈ 128 = 0x80
  });

  it('clamps opacity to 0-1', () => {
    expect(cssColorToAssColor('#fff', -1)).toContain('00');
    expect(cssColorToAssColor('#fff', 2)).toContain('FF');
  });
});
