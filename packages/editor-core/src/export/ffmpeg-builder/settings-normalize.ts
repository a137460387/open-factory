import { normalizeSubtitleLanguage, normalizeSubtitleLanguageList } from '../../model';
import { normalizeAudioVisualizationTheme } from '../../audio-visualization-themes';
import { clampReframeOffset, normalizeTargetAspectRatio, resolveReframeDimensions } from '../../reframe';
import { DEFAULT_EXPORT_COLOR_MANAGEMENT } from '../../color-management';
import { round } from '../../time';
import { cssColorToFfmpeg, escapeDrawtextValue, formatFfmpegSeconds, normalizeFfmpegPath } from '../ffmpeg-escape';
import type { ExportRenderRange, NormalizedExportRenderRange } from '../export-ranges';
import type {
  ExportAudioVisualizationBackground,
  ExportAudioVisualizationSettings,
  ExportClip,
  ExportLoudnessNormalization,
  ExportMasterEq,
  ExportMasterEqBand,
  ExportMasterProcessingSettings,
  ExportPreviewSampleKind,
  ExportProject,
  ExportSettings,
  ExportVideoProfile,
  ExportWatermarkPosition,
  FfmpegExportPass,
  FfmpegInput,
  TextArtifact,
} from '../export-types';

export const DEFAULT_EXPORT_SETTINGS: Omit<ExportSettings, 'outputPath'> = {
  width: 1280,
  height: 720,
  fps: 30,
  sampleRate: 44_100,
  videoCodec: 'libx264',
  audioCodec: 'aac',
  format: 'mp4',
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
  colorManagement: DEFAULT_EXPORT_COLOR_MANAGEMENT,
  colorPipeline: 'sdr-srgb',
  masterProcessing: null,
  spatialAudioAssets: null,
  audioVisualization: {
    style: 'waveform-line',
    color: '#22d3ee',
    background: { type: 'solid', color: '#050816' },
  },
  workingColorSpace: 'srgb',
};

export const SETPTS_EXPRESSION_LIMIT = 4096;
export const GIF_PALETTE_PLACEHOLDER = '__GIF_PALETTE_open_factory__';
export const LOUDNORM_MEASURED_I_PLACEHOLDER = '__LOUDNORM_MEASURED_I__';
export const LOUDNORM_MEASURED_TP_PLACEHOLDER = '__LOUDNORM_MEASURED_TP__';
export const LOUDNORM_MEASURED_LRA_PLACEHOLDER = '__LOUDNORM_MEASURED_LRA__';
export const LOUDNORM_MEASURED_THRESH_PLACEHOLDER = '__LOUDNORM_MEASURED_THRESH__';
export const LOUDNORM_OFFSET_PLACEHOLDER = '__LOUDNORM_OFFSET__';
export const WATERMARK_MARGIN_PX = 24;
export const SLATE_DURATION_SECONDS = 0.5;
export const CUSTOM_SHADER_SEQUENCE_KIND = 'custom-shader-sequence';
export const PATH_TEXT_SEQUENCE_KIND = 'path-text-sequence';
export const MOTION_GRAPHIC_SEQUENCE_PATH_MODE = 'motion-graphic-sequence';
export const EXPORT_PREVIEW_SAMPLE_KINDS: ExportPreviewSampleKind[] = ['start', 'middle', 'end'];

export interface LoudnessNormalizationPreset {
  mode: Exclude<ExportLoudnessNormalization, 'off'>;
  args: string[];
}

export interface BuildFfmpegExportPlanOptions {
  frameExport?: {
    time: number;
  };
  exportRange?: ExportRenderRange | null;
  stemTrackIndex?: number;
}

export interface SubtitleLanguageGroup {
  language: string;
  clips: ExportClip[];
}

export const DEFAULT_EXPORT_MASTER_EQ_BANDS: ExportMasterEqBand[] = [
  { id: 'master-eq-31', type: 'lowshelf', frequency: 31, gain: 0, q: 0.7 },
  { id: 'master-eq-63', type: 'peaking', frequency: 63, gain: 0, q: 1 },
  { id: 'master-eq-125', type: 'peaking', frequency: 125, gain: 0, q: 1 },
  { id: 'master-eq-250', type: 'peaking', frequency: 250, gain: 0, q: 1 },
  { id: 'master-eq-500', type: 'peaking', frequency: 500, gain: 0, q: 1 },
  { id: 'master-eq-1000', type: 'peaking', frequency: 1000, gain: 0, q: 1 },
  { id: 'master-eq-4000', type: 'peaking', frequency: 4000, gain: 0, q: 1 },
  { id: 'master-eq-12000', type: 'highshelf', frequency: 12000, gain: 0, q: 0.7 },
];

export const DEFAULT_EXPORT_MASTER_PROCESSING: ExportMasterProcessingSettings = {
  eq: {
    enabled: false,
    bands: DEFAULT_EXPORT_MASTER_EQ_BANDS.map((band) => ({ ...band })),
  },
  stereoEnhancer: {
    enabled: false,
    amount: 1,
  },
  limiter: {
    enabled: false,
    levelOutDb: -0.1,
  },
};

// ---------------------------------------------------------------------------
// Helper utilities (needed by the normalizer / builder functions below)
// ---------------------------------------------------------------------------

export function normalizeLoudnessNormalization(mode: ExportLoudnessNormalization | undefined): ExportLoudnessNormalization {
  return mode === 'youtube' || mode === 'ebu-r128' ? mode : 'off';
}

export function normalizeVideoProfile(profile: ExportVideoProfile | undefined): ExportVideoProfile | undefined {
  return profile === 'baseline' || profile === 'main' || profile === 'high' ? profile : undefined;
}

export function normalizeExportAudioVisualization(
  input: ExportAudioVisualizationSettings | undefined,
): ExportAudioVisualizationSettings {
  const defaultVisualization = DEFAULT_EXPORT_SETTINGS.audioVisualization!;
  const style =
    input?.style === 'spectrum-bars' || input?.style === 'circular-spectrum' || input?.style === 'waveform-line'
      ? input.style
      : defaultVisualization.style;
  const normalized: ExportAudioVisualizationSettings = {
    style,
    color: normalizeHexColor(input?.color, defaultVisualization.color),
    background: normalizeAudioVisualizationBackground(input?.background, defaultVisualization.background),
  };
  if (typeof input?.themeId === 'string' && input.themeId.trim()) {
    normalized.themeId = input.themeId.trim();
  }
  if (input?.theme && typeof input.theme === 'object') {
    normalized.theme = normalizeAudioVisualizationTheme(input.theme);
  }
  return normalized;
}

export function normalizeAudioVisualizationBackground(
  input: ExportAudioVisualizationBackground | undefined,
  fallback: ExportAudioVisualizationBackground,
): ExportAudioVisualizationBackground {
  if (input?.type === 'image' && input.path.trim()) {
    return { type: 'image', path: input.path.trim() };
  }
  if (input?.type === 'gradient') {
    return {
      type: 'gradient',
      color: normalizeHexColor(
        input.color,
        fallback.type === 'gradient' || fallback.type === 'solid' ? fallback.color : '#050816',
      ),
      color2: normalizeHexColor(input.color2, fallback.type === 'gradient' ? fallback.color2 : '#1d4ed8'),
    };
  }
  if (input?.type === 'solid') {
    return {
      type: 'solid',
      color: normalizeHexColor(
        input.color,
        fallback.type === 'solid' || fallback.type === 'gradient' ? fallback.color : '#050816',
      ),
    };
  }
  return fallback;
}

export function normalizeHexColor(value: string | undefined, fallback: string): string {
  const parsed = parseHexColor(value ?? '', fallback);
  return `#${toHexChannel(parsed.r)}${toHexChannel(parsed.g)}${toHexChannel(parsed.b)}`;
}

export function parseHexColor(value: string, fallback: string): { r: number; g: number; b: number } {
  const normalized = value.trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return {
      r: Number.parseInt(normalized.slice(0, 2), 16),
      g: Number.parseInt(normalized.slice(2, 4), 16),
      b: Number.parseInt(normalized.slice(4, 6), 16),
    };
  }
  if (/^[0-9a-fA-F]{3}$/.test(normalized)) {
    return {
      r: Number.parseInt(normalized[0] + normalized[0], 16),
      g: Number.parseInt(normalized[1] + normalized[1], 16),
      b: Number.parseInt(normalized[2] + normalized[2], 16),
    };
  }
  if (value === fallback) {
    return { r: 5, g: 8, b: 22 };
  }
  return parseHexColor(fallback, '#050816');
}

export function toHexChannel(value: number): string {
  return Math.round(Math.min(255, Math.max(0, value)))
    .toString(16)
    .padStart(2, '0');
}

export function buildMasterAudioFilters(masterProcessing: ExportSettings['masterProcessing'] | undefined): string[] {
  const master = normalizeExportMasterProcessing(masterProcessing);
  const filters: string[] = [];
  if (master.eq.enabled) {
    filters.push(...buildEqualizerFilters(master.eq));
  }
  if (master.stereoEnhancer.enabled) {
    filters.push(`extrastereo=m=${formatFfmpegNumber(master.stereoEnhancer.amount)}`);
  }
  if (master.limiter.enabled) {
    filters.push(`alimiter=level_out=${formatFfmpegNumber(master.limiter.levelOutDb)}dB`);
  }
  return filters;
}

export function buildEqualizerFilters(eq: Pick<ExportMasterEq, 'bands'>): string[] {
  const filters: string[] = [];
  for (const band of eq.bands) {
    if (Math.abs(band.gain) < 0.001) {
      continue;
    }
    filters.push(
      `equalizer=f=${formatFfmpegNumber(band.frequency)}:width_type=o:width=${formatFfmpegNumber(band.q)}:g=${formatFfmpegNumber(band.gain)}`,
    );
  }
  return filters;
}

export function formatFfmpegNumber(value: number): string {
  const rounded = Math.round(value * 1000) / 1000;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(/0+$/g, '').replace(/\.$/g, '');
}

export function formatOpacity(value: number): string {
  return formatFfmpegSeconds(Math.min(1, Math.max(0, value)));
}

// ---------------------------------------------------------------------------
// Normalizer functions
// ---------------------------------------------------------------------------

export function normalizeExportReframeSettings(settings: ExportSettings): ExportSettings {
  const targetAspectRatio = normalizeTargetAspectRatio(settings.targetAspectRatio);
  const dimensions = resolveReframeDimensions(settings.width, settings.height, targetAspectRatio);
  return {
    ...settings,
    ...dimensions,
    targetAspectRatio,
    reframeOffsetX: clampReframeOffset(settings.reframeOffsetX),
    reframeOffsetY: clampReframeOffset(settings.reframeOffsetY),
    loudnessNormalization: normalizeLoudnessNormalization(settings.loudnessNormalization),
    videoProfile: normalizeVideoProfile(settings.videoProfile),
    subtitleLanguages: normalizeSubtitleLanguageList(settings.subtitleLanguages),
    subtitleBurnInLanguage: settings.subtitleBurnInLanguage
      ? normalizeSubtitleLanguage(settings.subtitleBurnInLanguage)
      : undefined,
    watermark: normalizeExportWatermark(settings.watermark),
    timecodeBurnIn: normalizeTimecodeBurnIn(settings.timecodeBurnIn),
    slate: normalizeExportSlate(settings.slate),
    audioVisualization: normalizeExportAudioVisualization(settings.audioVisualization),
    masterProcessing: normalizeExportMasterProcessing(settings.masterProcessing),
    spatialAudioAssets: normalizeExportSpatialAudioAssets(settings.spatialAudioAssets),
  };
}

export function normalizeExportSpatialAudioAssets(
  input: ExportSettings['spatialAudioAssets'] | undefined,
): ExportSettings['spatialAudioAssets'] {
  if (!input || typeof input !== 'object') {
    return null;
  }
  const hrtfPath =
    typeof input.hrtfPath === 'string' && input.hrtfPath.trim() ? normalizeFfmpegPath(input.hrtfPath.trim()) : null;
  const roomImpulseResponses =
    input.roomImpulseResponses && typeof input.roomImpulseResponses === 'object'
      ? Object.fromEntries(
          Object.entries(input.roomImpulseResponses)
            .filter(
              (entry): entry is ['small-room' | 'hall' | 'outdoor', string] =>
                ['small-room', 'hall', 'outdoor'].includes(entry[0]) &&
                typeof entry[1] === 'string' &&
                entry[1].trim().length > 0,
            )
            .map(([key, value]) => [key, normalizeFfmpegPath(value.trim())]),
        )
      : {};
  return hrtfPath || Object.keys(roomImpulseResponses).length > 0 ? { hrtfPath, roomImpulseResponses } : null;
}

export function mergeExportMetadata(
  base: ExportProject['metadata'],
  override: ExportProject['metadata'],
): ExportProject['metadata'] {
  if (!override) {
    return base;
  }
  return {
    ...(base ?? {}),
    ...Object.fromEntries(
      Object.entries(override).filter(
        (entry): entry is [keyof NonNullable<ExportProject['metadata']>, string] =>
          typeof entry[1] === 'string' && entry[1].trim().length > 0,
      ),
    ),
  };
}

export function normalizeExportMasterProcessing(
  input: ExportSettings['masterProcessing'] | undefined,
): ExportMasterProcessingSettings {
  const source = input ?? DEFAULT_EXPORT_MASTER_PROCESSING;
  return {
    eq: normalizeExportMasterEq(source.eq),
    stereoEnhancer: {
      enabled: source.stereoEnhancer?.enabled === true,
      amount: round(
        Math.min(
          2,
          Math.max(
            0,
            finiteNumber(source.stereoEnhancer?.amount, DEFAULT_EXPORT_MASTER_PROCESSING.stereoEnhancer.amount),
          ),
        ),
      ),
    },
    limiter: {
      enabled: source.limiter?.enabled === true,
      levelOutDb: round(
        Math.min(
          0,
          Math.max(-24, finiteNumber(source.limiter?.levelOutDb, DEFAULT_EXPORT_MASTER_PROCESSING.limiter.levelOutDb)),
        ),
      ),
    },
  };
}

export function hasExportMasterProcessing(input: ExportSettings['masterProcessing'] | undefined): boolean {
  return buildMasterAudioFilters(normalizeExportMasterProcessing(input)).length > 0;
}

export function normalizeExportMasterEq(input: Partial<ExportMasterEq> | undefined): ExportMasterEq {
  const bands = Array.isArray(input?.bands) ? input.bands : [];
  return {
    enabled: input?.enabled === true,
    bands: DEFAULT_EXPORT_MASTER_EQ_BANDS.map((fallback, index) => normalizeExportMasterEqBand(bands[index], fallback)),
  };
}

export function normalizeExportMasterEqBand(
  input: Partial<ExportMasterEqBand> | undefined,
  fallback: ExportMasterEqBand,
): ExportMasterEqBand {
  const type =
    input?.type === 'lowshelf' || input?.type === 'highshelf' || input?.type === 'peaking' ? input.type : fallback.type;
  return {
    id: typeof input?.id === 'string' && input.id.trim() ? input.id : fallback.id,
    type,
    frequency: round(Math.min(20_000, Math.max(20, finiteNumber(input?.frequency, fallback.frequency)))),
    gain: round(Math.min(24, Math.max(-24, finiteNumber(input?.gain, fallback.gain)))),
    q: round(Math.min(4, Math.max(0.1, finiteNumber(input?.q, fallback.q)))),
  };
}

export function normalizeSettingsForExportFormat(settings: ExportSettings): ExportSettings {
  if (settings.format !== 'gif' && settings.format !== 'webp' && settings.format !== 'apng') {
    return settings;
  }
  const base: ExportSettings = {
    ...settings,
    outputMode: 'video',
    audioCodec: settings.audioCodec || 'aac',
    hardwareEncoding: false,
    loudnessNormalization: 'off',
  };
  if (settings.format !== 'gif') {
    return base;
  }
  const { width, height } = constrainDimensions(settings.width, settings.height, 1080);
  return {
    ...base,
    width,
    height,
    fps: Math.min(30, Math.max(1, Math.round(settings.fps || 30))),
    outputMode: 'video',
    videoCodec: 'gif',
  };
}

export function constrainDimensions(width: number, height: number, maxDimension: number): { width: number; height: number } {
  const safeWidth = Math.max(1, Math.round(width || DEFAULT_EXPORT_SETTINGS.width));
  const safeHeight = Math.max(1, Math.round(height || DEFAULT_EXPORT_SETTINGS.height));
  const longest = Math.max(safeWidth, safeHeight);
  if (longest <= maxDimension) {
    return { width: safeWidth, height: safeHeight };
  }
  const ratio = maxDimension / longest;
  return {
    width: Math.max(1, Math.round(safeWidth * ratio)),
    height: Math.max(1, Math.round(safeHeight * ratio)),
  };
}

export function normalizeExportWatermark(watermark: ExportSettings['watermark'] | undefined): ExportSettings['watermark'] {
  if (!watermark || watermark.enabled !== true) {
    return null;
  }
  const position = normalizeWatermarkPosition(watermark.position);
  if (watermark.type === 'image') {
    const path = typeof watermark.path === 'string' ? watermark.path.trim() : '';
    if (!path) {
      return null;
    }
    return {
      enabled: true,
      type: 'image',
      path,
      position,
      scalePercent: Math.min(50, Math.max(1, finiteNumber(watermark.scalePercent, 12))),
      opacity: Math.min(1, Math.max(0, finiteNumber(watermark.opacity, 0.75))),
    };
  }
  if (watermark.type === 'text') {
    const text = typeof watermark.text === 'string' ? watermark.text.trim() : '';
    if (!text) {
      return null;
    }
    return {
      enabled: true,
      type: 'text',
      text,
      fontFamily:
        typeof watermark.fontFamily === 'string' && watermark.fontFamily.trim() ? watermark.fontFamily.trim() : 'Arial',
      color: typeof watermark.color === 'string' && watermark.color.trim() ? watermark.color.trim() : '#ffffff',
      fontSize: Math.round(Math.min(240, Math.max(8, finiteNumber(watermark.fontSize, 36)))),
      position,
    };
  }
  return null;
}

export function normalizeWatermarkPosition(position: ExportWatermarkPosition | undefined): ExportWatermarkPosition {
  return position === 'top-left' ||
    position === 'top-center' ||
    position === 'top-right' ||
    position === 'middle-left' ||
    position === 'center' ||
    position === 'middle-right' ||
    position === 'bottom-left' ||
    position === 'bottom-center' ||
    position === 'bottom-right'
    ? position
    : 'bottom-right';
}

export function normalizeTimecodeBurnIn(
  timecode: ExportSettings['timecodeBurnIn'] | undefined,
): ExportSettings['timecodeBurnIn'] {
  if (!timecode || timecode.enabled !== true) {
    return null;
  }
  return {
    enabled: true,
    position: normalizeWatermarkPosition(timecode.position),
    fontSize: Math.round(Math.min(96, Math.max(8, finiteNumber(timecode.fontSize, 28)))),
    color: typeof timecode.color === 'string' && timecode.color.trim() ? timecode.color.trim() : '#ffffff',
    backgroundColor:
      typeof timecode.backgroundColor === 'string' && timecode.backgroundColor.trim()
        ? timecode.backgroundColor.trim()
        : '#000000',
    includeFrameNumber: timecode.includeFrameNumber === true,
  };
}

export function normalizeExportSlate(slate: ExportSettings['slate'] | undefined): ExportSettings['slate'] {
  return slate?.enabled === true ? { enabled: true } : null;
}

// ---------------------------------------------------------------------------
// Filter builder functions
// ---------------------------------------------------------------------------

export function buildTimecodeBurnInFilter(
  inputLabel: string,
  outputLabel: string,
  timecode: NonNullable<ExportSettings['timecodeBurnIn']>,
): string {
  const position = buildWatermarkExpression(timecode.position, 'w', 'h', 'text_w', 'text_h');
  const textExpression = timecode.includeFrameNumber ? '%{pts\\:hms}:%{n}' : '%{pts\\:hms}';
  return `[${inputLabel}]drawtext=text='${textExpression}':fontsize=${timecode.fontSize}:fontcolor=${cssColorToFfmpeg(timecode.color)}:box=1:boxcolor=${cssColorToFfmpeg(
    timecode.backgroundColor,
  )}@0.72:boxborderw=8:x='${position.x}':y='${position.y}'[${outputLabel}]`;
}

export function buildSlateVideoFilters(
  outputLabel: string,
  settings: ExportSettings,
  project: ExportProject,
  timelineDuration: number,
  slateDuration: number,
): string[] {
  const fontSize = Math.max(20, Math.round(Math.min(settings.width, settings.height) * 0.045));
  const lineHeight = Math.round(fontSize * 1.55);
  const startX = Math.max(32, Math.round(settings.width * 0.08));
  const startY = Math.max(48, Math.round(settings.height * 0.26));
  const date = new Date().toISOString().slice(0, 10);
  const lines = [
    `Project: ${project.name || 'Untitled Project'}`,
    `Date: ${date}`,
    `Duration: ${formatFfmpegSeconds(timelineDuration)}s`,
    `Frame Rate: ${formatFfmpegSeconds(settings.fps)} fps`,
  ];
  const drawTextFilters = lines.map((line, index) => {
    const y = startY + lineHeight * index;
    return `drawtext=text='${escapeDrawtextValue(line)}':fontsize=${fontSize}:fontcolor=white:x=${startX}:y=${y}`;
  });
  return [
    `color=c=black:s=${settings.width}x${settings.height}:r=${settings.fps}:d=${formatFfmpegSeconds(
      slateDuration,
    )},format=rgba,drawbox=x=0:y=0:w=iw:h=ih:color=black@1:t=fill,${drawTextFilters.join(',')}[${outputLabel}]`,
  ];
}

export function buildWatermarkFilters(
  inputLabel: string,
  outputLabel: string,
  watermark: NonNullable<ExportSettings['watermark']>,
  settings: ExportSettings,
  imageInputIndex: number | undefined,
): string[] {
  if (watermark.type === 'image') {
    if (imageInputIndex === undefined) {
      return [];
    }
    const preparedLabel = `watermark_${imageInputIndex}`;
    const targetWidth = Math.max(1, Math.round(settings.width * (watermark.scalePercent / 100)));
    const position = buildWatermarkExpression(watermark.position, 'main_w', 'main_h', 'overlay_w', 'overlay_h');
    return [
      `[${imageInputIndex}:v]scale=${targetWidth}:-1,format=rgba,colorchannelmixer=aa=${formatOpacity(watermark.opacity)}[${preparedLabel}]`,
      `[${inputLabel}][${preparedLabel}]overlay=x='${position.x}':y='${position.y}':eval=frame[${outputLabel}]`,
    ];
  }

  const position = buildWatermarkExpression(watermark.position, 'w', 'h', 'text_w', 'text_h');
  const font = watermark.fontFamily ? `:font='${escapeDrawtextValue(watermark.fontFamily)}'` : '';
  return [
    `[${inputLabel}]drawtext=text='${escapeDrawtextValue(watermark.text)}'${font}:fontsize=${watermark.fontSize}:fontcolor=${cssColorToFfmpeg(
      watermark.color,
    )}:x='${position.x}':y='${position.y}'[${outputLabel}]`,
  ];
}

export function buildWatermarkExpression(
  position: ExportWatermarkPosition,
  widthVar: string,
  heightVar: string,
  itemWidthVar: string,
  itemHeightVar: string,
): { x: string; y: string } {
  const horizontal = position.endsWith('left') ? 'left' : position.endsWith('right') ? 'right' : 'center';
  const vertical = position.startsWith('top') ? 'top' : position.startsWith('bottom') ? 'bottom' : 'middle';
  const x =
    horizontal === 'left'
      ? String(WATERMARK_MARGIN_PX)
      : horizontal === 'right'
        ? `${widthVar}-${itemWidthVar}-${WATERMARK_MARGIN_PX}`
        : `(${widthVar}-${itemWidthVar})/2`;
  const y =
    vertical === 'top'
      ? String(WATERMARK_MARGIN_PX)
      : vertical === 'bottom'
        ? `${heightVar}-${itemHeightVar}-${WATERMARK_MARGIN_PX}`
        : `(${heightVar}-${itemHeightVar})/2`;
  return { x, y };
}

export function calculateWatermarkOverlayPosition(
  position: ExportWatermarkPosition,
  canvasWidth: number,
  canvasHeight: number,
  watermarkWidth: number,
  watermarkHeight: number,
): { x: number; y: number } {
  const safePosition = normalizeWatermarkPosition(position);
  const horizontal = safePosition.endsWith('left') ? 'left' : safePosition.endsWith('right') ? 'right' : 'center';
  const vertical = safePosition.startsWith('top') ? 'top' : safePosition.startsWith('bottom') ? 'bottom' : 'middle';
  const x =
    horizontal === 'left'
      ? WATERMARK_MARGIN_PX
      : horizontal === 'right'
        ? canvasWidth - watermarkWidth - WATERMARK_MARGIN_PX
        : (canvasWidth - watermarkWidth) / 2;
  const y =
    vertical === 'top'
      ? WATERMARK_MARGIN_PX
      : vertical === 'bottom'
        ? canvasHeight - watermarkHeight - WATERMARK_MARGIN_PX
        : (canvasHeight - watermarkHeight) / 2;
  return { x: Math.round(x), y: Math.round(y) };
}

export function finiteNumber(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

// ---------------------------------------------------------------------------
// Pass / arg builder functions
// ---------------------------------------------------------------------------

export function buildGifExportPasses(
  inputs: FfmpegInput[],
  baseFilterComplex: string,
  settings: ExportSettings,
  duration: number,
  textArtifacts: TextArtifact[],
  outputRange?: NormalizedExportRenderRange | null,
): { filterComplex: string; maps: string[]; outputArgs: string[]; fullArgs: string[]; passes: FfmpegExportPass[] } {
  textArtifacts.push({
    clipId: 'gif-palette',
    text: '',
    fileName: 'gif-palette.png',
    placeholder: GIF_PALETTE_PLACEHOLDER,
    pathMode: 'argument',
  });

  const paletteFilterComplex = `${baseFilterComplex};[vout]palettegen=stats_mode=diff[gifpalette]`;
  const paletteMaps = ['-map', '[gifpalette]'];
  const paletteOutputArgs = ['-frames:v', '1', '-update', '1', '-f', 'image2', GIF_PALETTE_PLACEHOLDER];
  const paletteFullArgs = buildFfmpegFullArgs(inputs, paletteFilterComplex, paletteMaps, paletteOutputArgs);
  const paletteInput: FfmpegInput = { index: inputs.length, path: GIF_PALETTE_PLACEHOLDER, args: [] };
  const gifFilterComplex = `${baseFilterComplex};[vout][${paletteInput.index}:v]paletteuse=dither=sierra2_4a:diff_mode=rectangle[gifout]`;
  const gifMaps = ['-map', '[gifout]'];
  const gifOutputArgs = [
    '-loop',
    '0',
    ...buildExportRangeOutputArgs(outputRange),
    '-t',
    formatFfmpegSeconds(duration),
    '-f',
    'gif',
    normalizeFfmpegPath(settings.outputPath),
  ];
  const gifFullArgs = buildFfmpegFullArgs([...inputs, paletteInput], gifFilterComplex, gifMaps, gifOutputArgs);
  return {
    filterComplex: gifFilterComplex,
    maps: gifMaps,
    outputArgs: gifOutputArgs,
    fullArgs: gifFullArgs,
    passes: [
      { name: 'gif-palettegen', fullArgs: paletteFullArgs, duration },
      { name: 'gif-paletteuse', fullArgs: gifFullArgs, duration },
    ],
  };
}

export function buildExportRangeOutputArgs(range: NormalizedExportRenderRange | null | undefined): string[] {
  return range ? ['-ss', formatFfmpegSeconds(range.start)] : [];
}

export function buildLoudnessNormalizationPasses(
  inputs: FfmpegInput[],
  analysisFilterComplex: string,
  renderFullArgs: string[],
  duration: number,
): { passes: FfmpegExportPass[] } {
  const analysisFullArgs = buildFfmpegFullArgs(inputs, analysisFilterComplex, ['-map', '[aout]'], ['-f', 'null', '-']);
  return {
    passes: [
      { name: 'loudness-analysis', kind: 'loudness-analysis', fullArgs: analysisFullArgs, duration },
      { name: 'loudness-render', kind: 'render', fullArgs: renderFullArgs, duration },
    ],
  };
}

export function buildFfmpegFullArgs(
  inputs: FfmpegInput[],
  filterComplex: string,
  maps: string[],
  outputArgs: string[],
): string[] {
  return [
    '-y',
    '-progress',
    'pipe:2',
    '-nostats',
    ...inputs.flatMap((input) => [...input.args, '-i', input.path]),
    '-filter_complex',
    filterComplex,
    ...maps,
    ...outputArgs,
  ];
}
