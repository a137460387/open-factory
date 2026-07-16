import {
  DEFAULT_SUBTITLE_MODE,
  normalizeColorCorrection,
  normalizeMasterVolume,
  normalizeSubtitleLanguage,
  normalizeSubtitleLanguageList,
  normalizeTrackCompressor,
  normalizeTrackEQ,
  normalizeTransitionDuration,
  normalizeTransitionType,
  getProjectPrimaryTimeline,
  getProjectSequences,
  normalizeChromaKey,
  normalizeAudioFadeCurve,
  normalizeAudioFadeDuration,
  normalizeAudioChannelRouting,
  normalizeAudioDenoise,
  normalizeAILocalDenoise,
  normalizeClipBorder,
  normalizeClipPanoramaView,
  normalizeClipProjection,
  normalizeAudioPitchSemitones,
  normalizeFrameInterpolation,
  normalizeQualityEnhancement,
  normalizeSequenceFrameRate,
  normalizeSlowMotionMode,
  normalizeStabilization,
  normalizeTextPath,
  normalizeTransform,
  normalizeMasks,
  normalizeVideoRestoration,
  normalizeMediaColorProfile,
  type ClipKeyframes,
  type Project,
  type Timeline,
  type ClipPrivacyRedaction,
} from '../../model';
import { normalizeAudioRestoration } from '../../audio-restoration';
import type { MixerState } from '../../audio/mixer-types';
import { normalizeColorGradingGraph } from '../../color-grading';
import { normalizeColorNodeGraph } from '../../color-node-graph';
import { cloneEffects } from '../../effects';
import { normalizeClipBlendMode } from '../../blend-modes';
import { cloneClipKeyframes, normalizeClipKeyframes } from '../../keyframes';
import { flattenMulticamProjectForExport } from '../../multicam';
import { collectExportMediaMetadata } from '../../media-batch';
import { clampReframeOffset, normalizeTargetAspectRatio, resolveReframeDimensions } from '../../reframe';
import { normalizeSpatialAudio } from '../../spatial-audio';
import {
  getClipSourceVisibleDuration,
  getClipSpeed,
  getTimelinePlaybackDuration,
  getTrackPan,
  getTrackVolume,
} from '../../timeline';
import { round } from '../../time';
import { normalizeMotionGraphic } from '../../motion-graphics';
import { normalizeDataSubtitleSource } from '../../data-subtitle';
import {
  DEFAULT_EXPORT_COLOR_MANAGEMENT,
  isDefaultExportColorManagement,
  normalizeExportColorManagement,
  normalizeProjectWorkingColorSpace,
} from '../../color-management';
import {
  buildProjectColorPipelineExportDefaults,
  normalizeProjectColorPipeline,
} from '../../color-pipeline';
import { normalizeAudioVisualizationTheme } from '../../audio-visualization-themes';
import { normalizeFfmpegPath } from '../ffmpeg-escape';
import type { ExportRenderRange } from '../export-ranges';
import type {
  ExportClip,
  ExportClipKeyframes,
  ExportAudioVisualizationBackground,
  ExportAudioVisualizationSettings,
  ExportLoudnessNormalization,
  ExportProject,
  ExportSettings,
  ExportVideoProfile,
  ExportWatermarkPosition,
  ExportTimeline,
  ExportTransition,
  ExportMasterEq,
  ExportMasterEqBand,
  ExportMasterProcessingSettings,
  ExportPreviewSampleKind,
} from '../export-types';

export interface BuildExportProjectOptions {
  outputPath: string;
  defaultFontPath?: string | null;
  settings?: Partial<Omit<ExportSettings, 'outputPath'>>;
  metadata?: ExportProject['metadata'];
}

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

export function buildExportProjectFromProject(project: Project, options: BuildExportProjectOptions): ExportProject {
  const exportSourceProject = flattenMulticamProjectForExport(project);
  const mediaById = new Map(exportSourceProject.media.map((asset) => [asset.id, asset]));
  const primaryTimeline = getProjectPrimaryTimeline(exportSourceProject);
  const colorPipeline = normalizeProjectColorPipeline(
    options.settings?.colorPipeline ?? exportSourceProject.settings.colorPipeline,
  );
  const workingColorSpace = normalizeProjectWorkingColorSpace(
    options.settings?.workingColorSpace ?? exportSourceProject.settings.workingColorSpace,
  );
  const colorManagementDefaults = buildProjectColorPipelineExportDefaults(colorPipeline);
  const requestedColorManagement = normalizeExportColorManagement(options.settings?.colorManagement);
  const defaultColorManagement =
    colorPipeline === 'sdr-srgb'
      ? normalizeExportColorManagement({
          inputColorSpace: workingColorSpace,
          outputColorSpace: workingColorSpace,
          embedIccProfile: true,
        })
      : normalizeExportColorManagement(colorManagementDefaults);
  const colorManagement =
    options.settings?.colorManagement && !isDefaultExportColorManagement(options.settings.colorManagement)
      ? requestedColorManagement
      : defaultColorManagement;
  const settings = normalizeExportReframeSettings({
    ...DEFAULT_EXPORT_SETTINGS,
    width: exportSourceProject.settings.width || DEFAULT_EXPORT_SETTINGS.width,
    height: exportSourceProject.settings.height || DEFAULT_EXPORT_SETTINGS.height,
    fps: exportSourceProject.settings.fps || DEFAULT_EXPORT_SETTINGS.fps,
    ...options.settings,
    outputPath: normalizeFfmpegPath(options.outputPath),
    colorPipeline,
    workingColorSpace,
    colorManagement,
  });
  return {
    name: exportSourceProject.name,
    settings,
    masterVolume: normalizeMasterVolume(exportSourceProject.masterVolume),
    metadata: mergeExportMetadata(collectExportMediaMetadata(exportSourceProject), options.metadata),
    timeline: buildExportTimeline(primaryTimeline, mediaById, options, exportSourceProject.mixerState),
    sequences: getProjectSequences(exportSourceProject)
      .filter((sequence) => sequence.id !== 'sequence-main')
      .map((sequence) => ({
        id: sequence.id,
        name: sequence.name,
        timeline: buildExportTimeline(sequence.timeline, mediaById, options, exportSourceProject.mixerState),
      })),
  };
}

export function buildExportTimeline(
  timeline: Timeline,
  mediaById: Map<string, Project['media'][number]>,
  options: BuildExportProjectOptions,
  mixerState?: MixerState,
): ExportTimeline {
  return {
    duration: getTimelinePlaybackDuration(timeline),
    transitions: (timeline.transitions ?? []).map(
      (transition) =>
        ({
          id: transition.id,
          type: normalizeTransitionType(transition.type),
          duration: normalizeTransitionDuration(transition.duration),
          fromClipId: transition.fromClipId,
          toClipId: transition.toClipId,
        }) satisfies ExportTransition,
    ),
    tracks: timeline.tracks.map((track, trackIndex) => {
      const trackVolume = getTrackVolume(track);
      const trackPan = getTrackPan(track);
      const trackEQ = normalizeTrackEQ(track.eq);
      const trackCompressor = normalizeTrackCompressor(track.compressor);
      return {
        index: trackIndex,
        type: track.type,
        language: track.type === 'subtitle' ? normalizeSubtitleLanguage(track.language) : undefined,
        muted: Boolean(track.muted),
        solo: Boolean(track.solo),
        locked: Boolean(track.locked),
        volume: trackVolume,
        pan: trackPan,
        clips: track.clips.map((clip) => {
          const media = 'mediaId' in clip ? mediaById.get(clip.mediaId) : undefined;
          const nestedSequenceId = clip.type === 'nested-sequence' ? clip.sequenceId : null;
          return {
            id: clip.id,
            type: clip.type,
            mediaPath: nestedSequenceId
              ? nestedInputPlaceholder(nestedSequenceId)
              : media
                ? normalizeFfmpegPath(media.path)
                : null,
            sourceColorProfile: normalizeMediaColorProfile(media?.colorProfile) ?? null,
            nestedSequenceId,
            start: clip.start,
            duration: clip.duration,
            trimStart: clip.trimStart,
            trimEnd: clip.trimEnd,
            speed: getClipSpeed(clip),
            slowMotionMode: normalizeSlowMotionMode(clip.slowMotionMode),
            sourceDuration: clip.type === 'nested-sequence' ? clip.duration : getClipSourceVisibleDuration(clip),
            trackIndex,
            transform: normalizeTransform(clip.transform),
            border: normalizeClipBorder(clip.border),
            colorCorrection: normalizeColorCorrection(clip.colorCorrection),
            ...(clip.colorNodeGraph
              ? { colorNodeGraph: normalizeColorNodeGraph(clip.colorNodeGraph, clip.colorCorrection) }
              : {}),
            ...(clip.colorGradingGraph
              ? { colorGradingGraph: normalizeColorGradingGraph(clip.colorGradingGraph) }
              : {}),
            chromaKey: normalizeChromaKey(clip.chromaKey),
            stabilization: normalizeStabilization(clip.stabilization),
            frameInterpolation: normalizeFrameInterpolation(clip.frameInterpolation),
            contentAnalysis: clip.contentAnalysis,
            motionTrack: clip.motionTrack,
            scenecuts: clip.scenecuts,
            audioDenoise: normalizeAudioDenoise(clip.audioDenoise),
            aiLocalDenoise: normalizeAILocalDenoise(clip.aiLocalDenoise),
            audioRestoration: normalizeAudioRestoration(clip.audioRestoration),
            spatialAudio: normalizeSpatialAudio(clip.spatialAudio),
            videoRestoration: normalizeVideoRestoration(clip.videoRestoration),
            qualityEnhancement: normalizeQualityEnhancement(clip.qualityEnhancement),
            projection: normalizeClipProjection(clip.projection),
            panorama: normalizeClipPanoramaView(clip.panorama),
            masks: normalizeMasks(clip.masks),
            imageSequence:
              clip.type === 'image' && media?.imageSequence
                ? {
                    frameRate:
                      normalizeSequenceFrameRate(clip.sequenceFrameRate ?? media.imageSequence.frameRate) ??
                      media.imageSequence.frameRate,
                    frameCount: media.imageSequence.frameCount,
                    paths: media.imageSequence.paths.map(normalizeFfmpegPath),
                  }
                : null,
            sequenceFrameRate: normalizeSequenceFrameRate(clip.sequenceFrameRate),
            effects: cloneEffects(clip.effects) ?? [],
            effectsChain: mixerState?.channels?.find((c) => c.trackId === track.id)?.effectsChain,
            automation: mixerState?.channels?.find((c) => c.trackId === track.id)?.automation,
            blendMode: normalizeClipBlendMode(clip.blendMode),
            keyframes: buildExportClipKeyframes(clip.keyframes, clip.duration, trackVolume),
            kenBurns: clip.type === 'image' ? Boolean(clip.kenBurns) : false,
            volume: ('volume' in clip ? clip.volume : 1) * trackVolume,
            audioChannelRouting: normalizeAudioChannelRouting(clip.audioChannelRouting),
            pan: trackPan,
            eq: trackEQ,
            compressor: trackCompressor,
            muted: 'muted' in clip ? Boolean(clip.muted) : false,
            pitchSemitones: 'pitchSemitones' in clip ? normalizeAudioPitchSemitones(clip.pitchSemitones) : 0,
            reverseAudio: 'reverseAudio' in clip ? clip.reverseAudio === true : false,
            fadeInDuration:
              'fadeInDuration' in clip ? normalizeAudioFadeDuration(clip.fadeInDuration, clip.duration) : 0,
            fadeOutDuration:
              'fadeOutDuration' in clip ? normalizeAudioFadeDuration(clip.fadeOutDuration, clip.duration) : 0,
            fadeInCurve: 'fadeInCurve' in clip ? normalizeAudioFadeCurve(clip.fadeInCurve) : 'linear',
            fadeOutCurve: 'fadeOutCurve' in clip ? normalizeAudioFadeCurve(clip.fadeOutCurve) : 'linear',
            hasEmbeddedAudio: clip.type === 'nested-sequence' || (clip.type === 'video' && Boolean(media?.hasAudio)),
            audioChannels: media?.audioChannels ?? 2,
            audioSampleRate: media?.audioSampleRate ?? DEFAULT_EXPORT_SETTINGS.sampleRate,
            textStyle:
              clip.type === 'text'
                ? {
                    text: clip.text,
                    fontSize: clip.style.fontSize,
                    fontColor: clip.style.color,
                    backgroundColor: clip.style.backgroundColor,
                    backgroundOpacity: clip.style.backgroundOpacity,
                    fontFamily: clip.style.fontFamily,
                    fontPath: options.defaultFontPath ?? null,
                    x: clip.transform.x,
                    y: clip.transform.y,
                    opacity: clip.transform.opacity,
                    bold: clip.style.bold,
                    italic: clip.style.italic,
                    richText: clip.richText ?? null,
                    textLayout: clip.textLayout ?? null,
                    openTypeFeatures: clip.openTypeFeatures ?? null,
                    arcText: clip.arcText ?? null,
                  }
                : null,
            textPath: clip.type === 'text' ? normalizeTextPath(clip.pathText) : null,
            subtitleStyle:
              clip.type === 'subtitle'
                ? {
                    text: clip.text,
                    fontSize: clip.style.fontSize,
                    fontColor: clip.style.color,
                    backgroundColor: clip.style.backgroundColor,
                    backgroundOpacity: clip.style.backgroundOpacity,
                    fontFamily: clip.style.fontFamily,
                    fontPath: options.defaultFontPath ?? null,
                    x: clip.transform.x,
                    y: clip.transform.y,
                    opacity: clip.transform.opacity,
                    bold: clip.style.bold,
                    italic: clip.style.italic,
                    richText: null,
                    textLayout: null,
                    openTypeFeatures: null,
                    arcText: null,
                    yOffset: clip.style.yOffset,
                    outlineColor: clip.style.outlineColor,
                    outlineWidth: clip.style.outlineWidth,
                    shadowColor: clip.style.shadowColor,
                    shadowOffset: clip.style.shadowOffset,
                  }
                : null,
            subtitleType: clip.type === 'subtitle' ? (clip.subtitleType ?? 'subtitle') : null,
            speaker: clip.type === 'subtitle' ? (clip.speaker ?? null) : null,
            soundDesc: clip.type === 'subtitle' ? (clip.soundDesc ?? null) : null,
            subtitleMode: clip.type === 'subtitle' ? (clip.subtitleMode ?? DEFAULT_SUBTITLE_MODE) : null,
            dataSubtitle: clip.type === 'subtitle' ? (normalizeDataSubtitleSource(clip.dataSubtitle) ?? null) : null,
            creditsStyle:
              clip.type === 'credits'
                ? {
                    text: clip.text,
                    rows: clip.rows,
                    rollSpeed: clip.rollSpeed,
                    lineSpacing: clip.style.lineSpacing,
                    horizontalMargin: clip.style.horizontalMargin,
                    fontSize: clip.style.fontSize,
                    fontColor: clip.style.color,
                    backgroundColor: clip.style.backgroundColor,
                    backgroundOpacity: clip.style.backgroundOpacity,
                    fontFamily: clip.style.fontFamily,
                    fontPath: options.defaultFontPath ?? null,
                    x: clip.transform.x,
                    y: clip.transform.y,
                    opacity: clip.transform.opacity,
                    bold: clip.style.bold,
                    italic: clip.style.italic,
                    richText: null,
                    textLayout: null,
                    openTypeFeatures: null,
                    arcText: null,
                  }
                : null,
            motionGraphic:
              clip.type === 'motion-graphic' ? normalizeMotionGraphic(clip.motionGraphic, clip.duration) : null,
            privacyRedactions:
              'privacyRedactions' in clip && Array.isArray(clip.privacyRedactions)
                ? clip.privacyRedactions.filter(
                    (r: ClipPrivacyRedaction) =>
                      r && r.enabled !== false && Array.isArray(r.keyframes) && r.keyframes.length > 0,
                  )
                : [],
          } satisfies ExportClip;
        }),
      };
    }),
  };
}

export function buildExportClipKeyframes(
  keyframes: ClipKeyframes | undefined,
  duration: number,
  trackVolume: number,
): ExportClipKeyframes | null {
  const normalized = normalizeClipKeyframes(cloneClipKeyframes(keyframes), duration);
  if (!normalized) {
    return null;
  }
  return {
    ...normalized,
    volume: normalized.volume?.map((frame) => ({
      ...frame,
      value: Math.min(2, Math.max(0, frame.value * trackVolume)),
    })),
  };
}

// ---------------------------------------------------------------------------
// Private helpers used by the extracted functions above
// ---------------------------------------------------------------------------

export function safeLabel(value: string): string {
  return value.replace(/[^a-zA-Z0-9_]/g, '_');
}

export function nestedInputPlaceholder(sequenceId: string): string {
  return `__NESTED_SEQUENCE_${safeLabel(sequenceId)}__.mp4`;
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

export function finiteNumber(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function normalizeLoudnessNormalization(mode: ExportLoudnessNormalization | undefined): ExportLoudnessNormalization {
  return mode === 'youtube' || mode === 'ebu-r128' ? mode : 'off';
}

export function normalizeVideoProfile(profile: ExportVideoProfile | undefined): ExportVideoProfile | undefined {
  return profile === 'baseline' || profile === 'main' || profile === 'high' ? profile : undefined;
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
