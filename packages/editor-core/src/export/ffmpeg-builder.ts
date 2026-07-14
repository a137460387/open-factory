import {
  DEFAULT_COLOR_CORRECTION,
  DEFAULT_SUBTITLE_MODE,
  MAX_NESTED_SEQUENCE_DEPTH,
  isDefaultColorCorrection,
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
  isChromaKeyEnabled,
  isStabilizationExportable,
  normalizeChromaKey,
  normalizeAudioFadeCurve,
  normalizeAudioFadeDuration,
  normalizeAudioChannelRouting,
  normalizeAudioDenoise,
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
  normalizeLutLayers,
  type ClipKeyframes,
  type Project,
  type TextStyle,
  type Timeline,
  type ClipPrivacyRedaction
} from '../model';
import { buildAudioRestorationFilterChain, normalizeAudioRestoration } from '../audio-restoration';
import { EffectChainEngine } from '../audio/effect-chain';
import type { AudioEffectSlot, MixerState } from '../audio/mixer-types';
import {
  isDefaultColorCurves,
  isNeutralThreeWayColor,
  normalizeThreeWayColor,
  serializeColorCurvesToCube,
  PrimaryWheels,
  PrimarySliders,
  toFfmpegSelectiveColor,
  normalizeColorGradingGraph,
  type ColorWheelValue,
  type ColorGradingGraph,
  type CurvesNodeParams,
  type LUTApplyNodeParams,
  type PrimaryWheelParams,
  type PrimarySliderParams,
  type HSLQualifierParams,
  type WindowMaskParams,
  type ThreeWayColor
} from '../color-grading';
import { buildColorNodeGraphFilterPlan, detectColorNodeGraphCycle, normalizeColorNodeGraph } from '../color-node-graph';
import { getLogToRec709Lut, isLogInputColorSpace, serializeLogToRec709Cube } from '../color-log-luts';
import { buildAcesOdtFilterChain, buildProjectColorPipelineExportDefaults, normalizeProjectColorPipeline } from '../color-pipeline';
import {
  buildCustomShaderFragmentSource,
  cloneEffects,
  getEffectNumberParam,
  getEnabledCustomShaderEffect,
  normalizeAudioSpectrumParams,
  normalizeCustomShaderParams,
  type AudioSpectrumParams,
  type Effect
} from '../effects';
import {
  MANUAL_AUDIO_VISUALIZATION_THEME_ID,
  expandAudioVisualizationTheme,
  normalizeAudioVisualizationTheme,
  type ExpandedAudioVisualizationTheme
} from '../audio-visualization-themes';
import { getFfmpegBlendMode, normalizeClipBlendMode, type ClipBlendMode } from '../blend-modes';
import { cloneClipKeyframes, normalizeClipKeyframes } from '../keyframes';
import { triangulatePathMask } from '../masks/path-mask';
import { buildMotionBlurExportFilter, normalizeMotionBlurParams } from '../motion-blur';
import { flattenMulticamProjectForExport } from '../multicam';
import { collectExportMediaMetadata } from '../media-batch';
import { buildReframeCropFilter, clampReframeOffset, isReframeEnabled, normalizeTargetAspectRatio, resolveReframeDimensions } from '../reframe';
import { buildSofalizerArgs, calculateSpatialDistanceGain, isDefaultSpatialAudio, mapSpatialXToPanGains, normalizeSpatialAudio } from '../spatial-audio';
import { averageClipMotionScore, buildSceneBoundaryProtectionRanges, resolveFrameInterpolationMode } from './frame-interpolation';
import { calculateSpeedCurveSourceDuration, getClipSourceVisibleDuration, getClipSpeed, getRenderableTracks, getTimelinePlaybackDuration, getTrackPan, getTrackVolume } from '../timeline';
import { round } from '../time';
import { serializeSubtitleCueInputsToAss, serializeSubtitleCueInputsToSrt, serializeSubtitleCueInputsToVtt, type SubtitleCueInput } from '../subtitles/srt';
import { normalizeDataSubtitleSource, resolveDataSubtitleText } from '../data-subtitle';
import { buildPathTextFrameLayouts } from '../text-path';
import {
  buildArcTextLayout,
  buildRichTextDrawSegments,
  calculateTextAutoLayout,
  formatOpenTypeFeatureList,
  normalizeTextArc,
  normalizeTextLayout,
  normalizeTextOpenTypeFeatures,
  richTextToPlainText
} from '../text-layout';
import { buildCreditsRollYExpression, formatCreditsRowsForTextfile } from '../credits-roll';
import { buildPrivacyRedactionFFmpegExpressions } from '../privacy-redaction';
import { MOTION_GRAPHIC_SEQUENCE_KIND, normalizeMotionGraphic } from '../motion-graphics';
import {
  DEFAULT_EXPORT_COLOR_MANAGEMENT,
  buildExportColorTagArgs,
  buildIccMetadataArgs,
  buildZscaleColorConversionFilter,
  getFfmpegColorSpaceProfile,
  isDefaultExportColorManagement,
  normalizeExportColorManagement,
  normalizeProjectWorkingColorSpace
} from '../color-management';
import { normalizeExportRenderRange, type ExportRenderRange, type NormalizedExportRenderRange } from './export-ranges';
import { normalizeExportPostScript } from './post-export-script';
import { cssColorToFfmpeg, escapeDrawtextValue, formatFfmpegSeconds, normalizeFfmpegPath, quoteForDisplay } from './ffmpeg-escape';
import type {
  ExportClip,
  ExportClipKeyframes,
  ExportAudioVisualizationBackground,
  ExportAudioVisualizationSettings,
  ExportSubtitleFormat,
  ExportKeyframe,
  ExportLoudnessNormalization,
  ExportVideoProfile,
  ExportProject,
  ExportSettings,
  ExportWatermarkPosition,
  FfmpegExportPass,
  ExportTimeline,
  ExportTrack,
  ExportTransition,
  ExportMasterEq,
  ExportMasterEqBand,
  ExportMasterProcessingSettings,
  ExportPreviewSampleKind,
  ExportPreviewSamplePlan,
  FfmpegCapabilities,
  FfmpegExportPlan,
  FfmpegInput,
  NestedFfmpegExportPlan,
  TextArtifact
} from './export-types';

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
    background: { type: 'solid', color: '#050816' }
  },
  workingColorSpace: 'srgb'
};

export const SETPTS_EXPRESSION_LIMIT = 4096;
const GIF_PALETTE_PLACEHOLDER = '__GIF_PALETTE_open_factory__';
const LOUDNORM_MEASURED_I_PLACEHOLDER = '__LOUDNORM_MEASURED_I__';
const LOUDNORM_MEASURED_TP_PLACEHOLDER = '__LOUDNORM_MEASURED_TP__';
const LOUDNORM_MEASURED_LRA_PLACEHOLDER = '__LOUDNORM_MEASURED_LRA__';
const LOUDNORM_MEASURED_THRESH_PLACEHOLDER = '__LOUDNORM_MEASURED_THRESH__';
const LOUDNORM_OFFSET_PLACEHOLDER = '__LOUDNORM_OFFSET__';
const WATERMARK_MARGIN_PX = 24;
const SLATE_DURATION_SECONDS = 0.5;
const CUSTOM_SHADER_SEQUENCE_KIND = 'custom-shader-sequence';
const PATH_TEXT_SEQUENCE_KIND = 'path-text-sequence';
const MOTION_GRAPHIC_SEQUENCE_PATH_MODE = 'motion-graphic-sequence';
const EXPORT_PREVIEW_SAMPLE_KINDS: ExportPreviewSampleKind[] = ['start', 'middle', 'end'];

interface LoudnessNormalizationPreset {
  mode: Exclude<ExportLoudnessNormalization, 'off'>;
  args: string[];
}

interface BuildFfmpegExportPlanOptions {
  frameExport?: {
    time: number;
  };
  exportRange?: ExportRenderRange | null;
  stemTrackIndex?: number;
}

interface SubtitleLanguageGroup {
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
  { id: 'master-eq-12000', type: 'highshelf', frequency: 12000, gain: 0, q: 0.7 }
];

export const DEFAULT_EXPORT_MASTER_PROCESSING: ExportMasterProcessingSettings = {
  eq: {
    enabled: false,
    bands: DEFAULT_EXPORT_MASTER_EQ_BANDS.map((band) => ({ ...band }))
  },
  stereoEnhancer: {
    enabled: false,
    amount: 1
  },
  limiter: {
    enabled: false,
    levelOutDb: -0.1
  }
};

export function buildExportProjectFromProject(project: Project, options: BuildExportProjectOptions): ExportProject {
  const exportSourceProject = flattenMulticamProjectForExport(project);
  const mediaById = new Map(exportSourceProject.media.map((asset) => [asset.id, asset]));
  const primaryTimeline = getProjectPrimaryTimeline(exportSourceProject);
  const colorPipeline = normalizeProjectColorPipeline(options.settings?.colorPipeline ?? exportSourceProject.settings.colorPipeline);
  const workingColorSpace = normalizeProjectWorkingColorSpace(options.settings?.workingColorSpace ?? exportSourceProject.settings.workingColorSpace);
  const colorManagementDefaults = buildProjectColorPipelineExportDefaults(colorPipeline);
  const requestedColorManagement = normalizeExportColorManagement(options.settings?.colorManagement);
  const defaultColorManagement =
    colorPipeline === 'sdr-srgb'
      ? normalizeExportColorManagement({ inputColorSpace: workingColorSpace, outputColorSpace: workingColorSpace, embedIccProfile: true })
      : normalizeExportColorManagement(colorManagementDefaults);
  const colorManagement = options.settings?.colorManagement && !isDefaultExportColorManagement(options.settings.colorManagement) ? requestedColorManagement : defaultColorManagement;
  const settings = normalizeExportReframeSettings({
    ...DEFAULT_EXPORT_SETTINGS,
    width: exportSourceProject.settings.width || DEFAULT_EXPORT_SETTINGS.width,
    height: exportSourceProject.settings.height || DEFAULT_EXPORT_SETTINGS.height,
    fps: exportSourceProject.settings.fps || DEFAULT_EXPORT_SETTINGS.fps,
    ...options.settings,
    outputPath: normalizeFfmpegPath(options.outputPath),
    colorPipeline,
    workingColorSpace,
    colorManagement
  });
  return {
    name: exportSourceProject.name,
    settings,
    masterVolume: normalizeMasterVolume(exportSourceProject.masterVolume),
    metadata: mergeExportMetadata(collectExportMediaMetadata(exportSourceProject), options.metadata),
    timeline: buildExportTimeline(primaryTimeline, mediaById, options, exportSourceProject.mixerState),
    sequences: getProjectSequences(exportSourceProject)
      .filter((sequence) => sequence.id !== 'sequence-main')
      .map((sequence) => ({ id: sequence.id, name: sequence.name, timeline: buildExportTimeline(sequence.timeline, mediaById, options, exportSourceProject.mixerState) }))
  };
}

function buildExportTimeline(timeline: Timeline, mediaById: Map<string, Project['media'][number]>, options: BuildExportProjectOptions, mixerState?: MixerState): ExportTimeline {
  return {
    duration: getTimelinePlaybackDuration(timeline),
    transitions: (timeline.transitions ?? []).map(
      (transition) =>
        ({
          id: transition.id,
          type: normalizeTransitionType(transition.type),
          duration: normalizeTransitionDuration(transition.duration),
          fromClipId: transition.fromClipId,
          toClipId: transition.toClipId
        }) satisfies ExportTransition
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
            mediaPath: nestedSequenceId ? nestedInputPlaceholder(nestedSequenceId) : media ? normalizeFfmpegPath(media.path) : null,
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
            ...(clip.colorNodeGraph ? { colorNodeGraph: normalizeColorNodeGraph(clip.colorNodeGraph, clip.colorCorrection) } : {}),
            ...(clip.colorGradingGraph ? { colorGradingGraph: normalizeColorGradingGraph(clip.colorGradingGraph) } : {}),
            chromaKey: normalizeChromaKey(clip.chromaKey),
            stabilization: normalizeStabilization(clip.stabilization),
            frameInterpolation: normalizeFrameInterpolation(clip.frameInterpolation),
            contentAnalysis: clip.contentAnalysis,
            motionTrack: clip.motionTrack,
            scenecuts: clip.scenecuts,
            audioDenoise: normalizeAudioDenoise(clip.audioDenoise),
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
                    frameRate: normalizeSequenceFrameRate(clip.sequenceFrameRate ?? media.imageSequence.frameRate) ?? media.imageSequence.frameRate,
                    frameCount: media.imageSequence.frameCount,
                    paths: media.imageSequence.paths.map(normalizeFfmpegPath)
                  }
                : null,
            sequenceFrameRate: normalizeSequenceFrameRate(clip.sequenceFrameRate),
            effects: cloneEffects(clip.effects) ?? [],
            effectsChain: mixerState?.channels?.find(c => c.trackId === track.id)?.effectsChain,
            automation: mixerState?.channels?.find(c => c.trackId === track.id)?.automation,
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
            fadeInDuration: 'fadeInDuration' in clip ? normalizeAudioFadeDuration(clip.fadeInDuration, clip.duration) : 0,
            fadeOutDuration: 'fadeOutDuration' in clip ? normalizeAudioFadeDuration(clip.fadeOutDuration, clip.duration) : 0,
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
                    arcText: clip.arcText ?? null
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
                    shadowOffset: clip.style.shadowOffset
                  }
                : null,
            subtitleType: clip.type === 'subtitle' ? (clip.subtitleType ?? 'subtitle') : null,
            speaker: clip.type === 'subtitle' ? clip.speaker ?? null : null,
            soundDesc: clip.type === 'subtitle' ? clip.soundDesc ?? null : null,
            subtitleMode: clip.type === 'subtitle' ? (clip.subtitleMode ?? DEFAULT_SUBTITLE_MODE) : null,
            dataSubtitle: clip.type === 'subtitle' ? normalizeDataSubtitleSource(clip.dataSubtitle) ?? null : null,
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
                    arcText: null
                  }
                : null,
            motionGraphic: clip.type === 'motion-graphic' ? normalizeMotionGraphic(clip.motionGraphic, clip.duration) : null,
            privacyRedactions: 'privacyRedactions' in clip && Array.isArray(clip.privacyRedactions) ? clip.privacyRedactions.filter((r: ClipPrivacyRedaction) => r && r.enabled !== false && Array.isArray(r.keyframes) && r.keyframes.length > 0) : []
          } satisfies ExportClip;
        })
      };
    })
  };
}

function buildExportClipKeyframes(keyframes: ClipKeyframes | undefined, duration: number, trackVolume: number): ExportClipKeyframes | null {
  const normalized = normalizeClipKeyframes(cloneClipKeyframes(keyframes), duration);
  if (!normalized) {
    return null;
  }
  return {
    ...normalized,
    volume: normalized.volume?.map((frame) => ({ ...frame, value: Math.min(2, Math.max(0, frame.value * trackVolume)) }))
  };
}

export function buildFfmpegExportPlan(
  project: ExportProject,
  capabilities?: FfmpegCapabilities,
  depth = 0,
  sequenceStack: string[] = [],
  options: BuildFfmpegExportPlanOptions = {}
): FfmpegExportPlan {
  const duration = Math.max(project.timeline.duration, 0.001);
  const settings = normalizeSettingsForExportFormat(project.settings);
  const audioVisualization = settings.outputMode === 'audio-visualization';
  const stemMode = typeof options.stemTrackIndex === 'number' && Number.isFinite(options.stemTrackIndex);
  const audioOnly = !audioVisualization && (settings.outputMode === 'audio' || settings.format === 'm4a' || stemMode);
  const audioVisualizationSettings = audioVisualization ? normalizeExportAudioVisualization(settings.audioVisualization) : undefined;
  const pngSequence = settings.format === 'png-sequence';
  const gifExport = settings.format === 'gif';
  const webpAnimation = settings.format === 'webp';
  const apngExport = settings.format === 'apng';
  const animatedImage = gifExport || webpAnimation || apngExport;
  const frameExportTime = options.frameExport ? Math.min(duration, Math.max(0, options.frameExport.time)) : null;
  const videoFramesOnly = frameExportTime !== null || pngSequence || animatedImage;
  const watermark = !audioOnly && !videoFramesOnly && !audioVisualization ? normalizeExportWatermark(settings.watermark) : null;
  const drawtextAvailable = !capabilities || (capabilities.hasDrawtext && capabilities.hasLibfreetype);
  const requestedTimecodeBurnIn = !audioOnly && !videoFramesOnly && !audioVisualization ? normalizeTimecodeBurnIn(settings.timecodeBurnIn) : null;
  const requestedSlate = !audioOnly && !videoFramesOnly && !audioVisualization ? normalizeExportSlate(settings.slate) : null;
  const timecodeBurnIn = drawtextAvailable ? requestedTimecodeBurnIn : null;
  const slate = drawtextAvailable ? requestedSlate : null;
  const slateDuration = slate?.enabled ? SLATE_DURATION_SECONDS : 0;
  const outputDuration = duration + slateDuration;
  const outputRange = frameExportTime === null ? normalizeExportRenderRange(options.exportRange, duration, settings.fps) : null;
  const encodedDuration = outputRange ? outputRange.duration + slateDuration : outputDuration;
  const warnings: string[] = [];
  if (requestedTimecodeBurnIn?.enabled && !drawtextAvailable) {
    warnings.push(capabilities?.drawtextWarning ?? 'Current FFmpeg does not support drawtext/libfreetype. Install an FFmpeg build with libfreetype to export timecode burn-in.');
  }
  if (requestedSlate?.enabled && !drawtextAvailable) {
    warnings.push(capabilities?.drawtextWarning ?? 'Current FFmpeg does not support drawtext/libfreetype. Install an FFmpeg build with libfreetype to export slate overlays.');
  }
  const inputs: FfmpegInput[] = [];
  const visualInputByClipId = new Map<string, number>();
  const audioInputByClipId = new Map<string, number>();
  const customShaderSequenceClips = new Map<string, ExportClip>();
  const pathTextSequenceInputByClipId = new Map<string, number>();
  const filters: string[] = [];
  const textArtifacts: TextArtifact[] = [];
  const allClips = project.timeline.tracks.flatMap((track) => track.clips).filter((clip) => clip.duration > 0);
  const sphericalMetadataArgs = hasSphericalVideoClips(allClips) && !audioOnly && !videoFramesOnly ? ['-metadata:s:v:0', 'spherical=true'] : [];
  const stemTrackIdx = options.stemTrackIndex;
  const allRenderableTracks = getRenderableTracks({ tracks: project.timeline.tracks });
  const stemFilterActive = typeof stemTrackIdx === 'number' && Number.isFinite(stemTrackIdx);
  const renderableTracks = stemFilterActive
    ? allRenderableTracks.filter((track) => track.index === stemTrackIdx)
    : allRenderableTracks;
  const renderableTrackIndexes = new Set(renderableTracks.map((track) => track.index));
  const orderedClips = renderableTracks
    .flatMap((track) => track.clips)
    .filter((clip) => clip.duration > 0)
    .sort((left, right) => left.trackIndex - right.trackIndex || left.start - right.start);
  const playbackStartByClipId = buildPlaybackStartByClipId(project.timeline);
  const orderedPlaybackClips = orderedClips.map((clip) => ({
    ...clip,
    start: playbackStartByClipId.get(clip.id) ?? clip.start
  }));
  const audioSpectrumEffects = !audioOnly && !videoFramesOnly && !audioVisualization ? collectAudioSpectrumEffects(orderedPlaybackClips) : [];

  if (!audioOnly && !videoFramesOnly && !audioVisualization && (!capabilities || (capabilities.hasDrawtext && capabilities.hasLibfreetype))) {
    for (const clip of orderedClips) {
      const artifact = buildPathTextSequenceArtifact(clip, settings);
      if (!artifact) {
        continue;
      }
      textArtifacts.push(artifact);
      warnings.push(`Path text clip ${clip.id} will render frame-by-frame and may be slow.`);
      inputs.push({
        index: inputs.length,
        path: artifact.placeholder,
        args: buildCustomShaderSequenceInputArgs(settings)
      });
      pathTextSequenceInputByClipId.set(clip.id, inputs[inputs.length - 1].index);
    }
  }

  if (!audioOnly && !videoFramesOnly && !audioVisualization) {
    for (const clip of orderedClips) {
      const artifact = buildMotionGraphicSequenceArtifact(clip, settings);
      if (!artifact) {
        continue;
      }
      textArtifacts.push(artifact);
      warnings.push(`Motion graphic clip ${clip.id} will render frame-by-frame and may be slow.`);
      inputs.push({
        index: inputs.length,
        path: artifact.placeholder,
        args: buildCustomShaderSequenceInputArgs(settings)
      });
      visualInputByClipId.set(clip.id, inputs[inputs.length - 1].index);
    }
  }

  for (const clip of orderedClips) {
    if (!clip.mediaPath || clip.type === 'text' || clip.type === 'subtitle' || clip.type === 'credits') {
      continue;
    }
    const customShaderArtifact = !audioOnly && !videoFramesOnly ? buildCustomShaderSequenceArtifact(clip, settings) : undefined;
    if (customShaderArtifact) {
      textArtifacts.push(customShaderArtifact);
      customShaderSequenceClips.set(clip.id, buildCustomShaderSequenceClip(clip));
      warnings.push(`Custom shader effect for clip ${clip.id} will render frame-by-frame and may be slow.`);
    }
    const sequenceArtifact = !customShaderArtifact && clip.imageSequence ? buildImageSequenceArtifact(clip) : undefined;
    if (sequenceArtifact) {
      textArtifacts.push(sequenceArtifact);
    }
    const input: FfmpegInput = {
      index: inputs.length,
      path: customShaderArtifact?.placeholder ?? sequenceArtifact?.placeholder ?? normalizeFfmpegPath(clip.mediaPath),
      args: customShaderArtifact ? buildCustomShaderSequenceInputArgs(settings) : buildInputArgs(clip)
    };
    inputs.push(input);
    visualInputByClipId.set(clip.id, input.index);
    if (!customShaderArtifact || !clip.hasEmbeddedAudio) {
      audioInputByClipId.set(clip.id, input.index);
      continue;
    }
    const audioInput: FfmpegInput = {
      index: inputs.length,
      path: normalizeFfmpegPath(clip.mediaPath),
      args: buildInputArgs(clip)
    };
    inputs.push(audioInput);
    audioInputByClipId.set(clip.id, audioInput.index);
  }

  if (allClips.length === 0) {
    throw new Error('The timeline is empty. Add media or text clips before exporting.');
  }

  let imageWatermarkInputIndex: number | undefined;
  let audioVisualizationBackgroundImageInputIndex: number | undefined;
  if (audioVisualizationSettings?.background.type === 'image') {
    audioVisualizationBackgroundImageInputIndex = inputs.length;
    inputs.push({
      index: audioVisualizationBackgroundImageInputIndex,
      path: normalizeFfmpegPath(audioVisualizationSettings.background.path),
      args: ['-loop', '1', '-t', formatFfmpegSeconds(outputDuration)]
    });
  }
  if (watermark?.enabled && watermark.type === 'image') {
    imageWatermarkInputIndex = inputs.length;
    inputs.push({
      index: imageWatermarkInputIndex,
      path: normalizeFfmpegPath(watermark.path),
      args: ['-loop', '1', '-t', formatFfmpegSeconds(outputDuration)]
    });
  }

  let currentVideo = 'base0';
  let videoStep = 0;

  if (!audioOnly) {
    if (audioVisualizationSettings) {
      filters.push(...buildAudioVisualizationBackgroundFilters(resolveAudioVisualizationBackground(audioVisualizationSettings), settings, duration, audioVisualizationBackgroundImageInputIndex));
    } else {
      filters.push(`color=c=black:s=${settings.width}x${settings.height}:r=${settings.fps}:d=${formatFfmpegSeconds(duration)}[base0]`);
    }

    if (!audioVisualization) {
      const visualItems = buildVisualItems(
        project.timeline,
        orderedPlaybackClips,
        playbackStartByClipId,
        renderableTrackIndexes,
        visualInputByClipId,
        customShaderSequenceClips,
        settings,
        filters,
        warnings,
        textArtifacts,
        capabilities
      );

      for (const item of visualItems) {
        if (item.kind === 'adjustment') {
          const nextVideo = `base${videoStep + 1}`;
          const adjustmentFilters = buildAdjustmentLayerFilters(currentVideo, nextVideo, item.clip, textArtifacts, settings);
          if (adjustmentFilters.length > 0) {
            filters.push(...adjustmentFilters);
            currentVideo = nextVideo;
            videoStep += 1;
          }
          continue;
        }
        if (item.kind === 'text' || item.kind === 'credits') {
          if (capabilities && (!capabilities.hasDrawtext || !capabilities.hasLibfreetype)) {
            warnings.push(capabilities.drawtextWarning ?? `Text clip ${item.clip.id} was skipped because FFmpeg drawtext/libfreetype is unavailable.`);
            continue;
          }
          const nextVideo = `base${videoStep + 1}`;
          const pathTextInputIndex = pathTextSequenceInputByClipId.get(item.clip.id);
          if (pathTextInputIndex !== undefined) {
            filters.push(buildPathTextSequenceOverlayFilter(currentVideo, nextVideo, pathTextInputIndex, item.clip));
          } else if (item.kind === 'credits') {
            const { filter, artifact } = buildCreditsRollFilter(currentVideo, nextVideo, item.clip, settings);
            filters.push(filter);
            textArtifacts.push(artifact);
          } else {
            const { filter, artifacts } = buildTextFilter(currentVideo, nextVideo, item.clip, settings);
            filters.push(filter);
            textArtifacts.push(...artifacts);
          }
          currentVideo = nextVideo;
          videoStep += 1;
          continue;
        }

        const nextVideo = `base${videoStep + 1}`;
        filters.push(buildMediaCompositeFilter(currentVideo, nextVideo, item, settings, duration));
        currentVideo = nextVideo;
        videoStep += 1;
      }
    }
  }

  const subtitleClips = orderedPlaybackClips.filter((clip) => clip.type === 'subtitle' && clip.subtitleStyle && clip.textStyle === null);
  const subtitleMode = settings.subtitleMode ?? subtitleClips.find((clip) => clip.subtitleMode)?.subtitleMode ?? DEFAULT_SUBTITLE_MODE;
  const subtitleFormat = normalizeSubtitleFormat(settings.subtitleFormat);
  const allSubtitleGroups = buildSubtitleLanguageGroups(project.timeline, subtitleClips, undefined);
  const selectedSubtitleGroups = buildSubtitleLanguageGroups(project.timeline, subtitleClips, settings.subtitleLanguages);
  const multipleSubtitleLanguages = allSubtitleGroups.length > 1;
  const softSubtitleInputs: Array<{ inputIndex: number; language: string }> = [];
  if (!audioOnly && subtitleClips.length > 0 && subtitleMode === 'burn-in') {
    const selectedGroup = selectSubtitleBurnInGroup(allSubtitleGroups, settings.subtitleBurnInLanguage);
    if (selectedGroup) {
      const nextVideo = `base${videoStep + 1}`;
      const { filter, artifact } = buildSubtitleBurnInFilter(currentVideo, nextVideo, selectedGroup.clips, subtitleFormat, {
        language: selectedGroup.language,
        includeLanguageInFileName: multipleSubtitleLanguages
      });
      filters.push(filter);
      textArtifacts.push(artifact);
      currentVideo = nextVideo;
      videoStep += 1;
    }
  } else if (!audioOnly && !videoFramesOnly && subtitleClips.length > 0 && subtitleMode === 'soft-sub') {
    for (const group of selectedSubtitleGroups) {
      const artifact = buildSubtitleArtifact(group.clips, 'argument', subtitleFormat, {
        language: group.language,
        includeLanguageInFileName: multipleSubtitleLanguages
      });
      const inputIndex = inputs.length;
      inputs.push({
        index: inputIndex,
        path: artifact.placeholder,
        args: buildSubtitleInputArgs(subtitleFormat)
      });
      softSubtitleInputs.push({ inputIndex, language: group.language });
      textArtifacts.push(artifact);
    }
  }
  if (!videoFramesOnly && subtitleClips.length > 0 && settings.exportSidecarSubtitle) {
    for (const group of selectedSubtitleGroups) {
      textArtifacts.push(
        buildSubtitleArtifact(group.clips, 'sidecar', subtitleFormat, {
          language: group.language,
          includeLanguageInFileName: multipleSubtitleLanguages
        })
      );
    }
  }

  let loudnessAnalysisFilterComplex: string | undefined;
  const audioVisualizationAudioLabel = audioVisualization ? 'audio_visualization_mix' : undefined;
  if (!videoFramesOnly) {
    const masterVolume = normalizeMasterVolume(project.masterVolume);
    const audioFilters: string[] = [];
    const audioLabels = buildAudioFilters(orderedPlaybackClips, audioInputByClipId, settings, audioFilters, capabilities, warnings);
    const loudnessPreset = audioLabels.length > 0 ? getLoudnessNormalizationPreset(settings.loudnessNormalization) : undefined;
    const spectrumSplitLabels = audioSpectrumEffects.map((_, index) => `spectrum_audio_${index}`);
    const audioSplitLabels = [...spectrumSplitLabels, ...(audioVisualizationAudioLabel ? [audioVisualizationAudioLabel] : [])];
    const needsAudioSplit = audioSplitLabels.length > 0;
    const masterFilters = buildMasterAudioFilters(settings.masterProcessing);
    const finalAudioLabel = loudnessPreset ? 'apremaster' : 'aout';
    const masterOutputLabel = needsAudioSplit ? (loudnessPreset ? 'apremaster_mix' : 'amixout') : finalAudioLabel;
    const mixedAudioLabel = masterFilters.length > 0 ? 'amixpremaster' : masterOutputLabel;
    if (audioLabels.length === 0) {
      audioFilters.push(`anullsrc=channel_layout=stereo:sample_rate=${settings.sampleRate}:d=${formatFfmpegSeconds(duration)},volume=${formatVolume(masterVolume)}[${mixedAudioLabel}]`);
    } else {
      audioFilters.push(
        `${audioLabels.map((label) => `[${label}]`).join('')}amix=inputs=${audioLabels.length}:duration=longest:normalize=0,atrim=duration=${formatFfmpegSeconds(
          duration
        )},asetpts=PTS-STARTPTS,aresample=${settings.sampleRate},volume=${formatVolume(masterVolume)}[${mixedAudioLabel}]`
      );
    }
    if (masterFilters.length > 0) {
      audioFilters.push(`[${mixedAudioLabel}]${masterFilters.join(',')}[${masterOutputLabel}]`);
    }
    if (loudnessPreset) {
      loudnessAnalysisFilterComplex = [...audioFilters, `[${masterOutputLabel}]${buildLoudnormAnalysisFilter(loudnessPreset)}[aout]`].join(';');
      if (needsAudioSplit) {
        filters.push(
          ...audioFilters,
          `[${masterOutputLabel}]asplit=${audioSplitLabels.length + 1}[${finalAudioLabel}]${audioSplitLabels.map((label) => `[${label}]`).join('')}`,
          `[${finalAudioLabel}]${buildLoudnormRenderFilter(loudnessPreset)}[aout]`
        );
      } else {
        filters.push(...audioFilters, `[${masterOutputLabel}]${buildLoudnormRenderFilter(loudnessPreset)}[aout]`);
      }
    } else {
      if (needsAudioSplit) {
        filters.push(...audioFilters, `[${masterOutputLabel}]asplit=${audioSplitLabels.length + 1}[aout]${audioSplitLabels.map((label) => `[${label}]`).join('')}`);
      } else {
        filters.push(...audioFilters);
      }
    }
  }

  if (!audioOnly && !videoFramesOnly && audioSpectrumEffects.length > 0) {
    audioSpectrumEffects.forEach((item, index) => {
      const spectrumLabel = `spectrum${index}`;
      filters.push(buildAudioSpectrumFilter(`spectrum_audio_${index}`, spectrumLabel, item.params, settings));
      const nextVideo = `base${videoStep + 1}`;
      filters.push(
        `[${currentVideo}][${spectrumLabel}]overlay=x=0:y='${buildAudioSpectrumOverlayYExpression(
          item.params
        )}':eval=frame:enable='between(t,${formatFfmpegSeconds(item.start)},${formatFfmpegSeconds(item.start + item.duration)})'[${nextVideo}]`
      );
      currentVideo = nextVideo;
      videoStep += 1;
    });
  }

  if (!audioOnly && !videoFramesOnly && audioVisualizationSettings && audioVisualizationAudioLabel) {
    const visualizationLabel = 'audio_visualization_layer';
    filters.push(buildAudioVisualizationFilter(audioVisualizationAudioLabel, visualizationLabel, audioVisualizationSettings, settings));
    const nextVideo = `base${videoStep + 1}`;
    const position = buildAudioVisualizationOverlayPosition(audioVisualizationSettings.style, settings);
    filters.push(`[${currentVideo}][${visualizationLabel}]overlay=x='${position.x}':y='${position.y}':eval=frame[${nextVideo}]`);
    currentVideo = nextVideo;
    videoStep += 1;
  }

  if (watermark?.enabled) {
    if (watermark.type === 'text' && capabilities && (!capabilities.hasDrawtext || !capabilities.hasLibfreetype)) {
      warnings.push(
        capabilities.drawtextWarning ?? 'Current FFmpeg does not support drawtext/libfreetype. Install an FFmpeg build with libfreetype to export text overlays.'
      );
    } else {
      const nextVideo = `base${videoStep + 1}`;
      const watermarkFilters = buildWatermarkFilters(currentVideo, nextVideo, watermark, settings, imageWatermarkInputIndex);
      if (watermarkFilters.length > 0) {
        filters.push(...watermarkFilters);
        currentVideo = nextVideo;
        videoStep += 1;
      }
    }
  }

  if (slate?.enabled) {
    const slateVideoLabel = `slate${videoStep}`;
    const trimmedMainLabel = `main_after_slate${videoStep}`;
    const nextVideo = `base${videoStep + 1}`;
    filters.push(...buildSlateVideoFilters(slateVideoLabel, settings, project, duration, slateDuration));
    filters.push(`[${currentVideo}]trim=duration=${formatFfmpegSeconds(duration)},setpts=PTS-STARTPTS[${trimmedMainLabel}]`);
    filters.push(`[${slateVideoLabel}][${trimmedMainLabel}]concat=n=2:v=1:a=0[${nextVideo}]`);
    currentVideo = nextVideo;
    videoStep += 1;
  }

  if (timecodeBurnIn?.enabled) {
    const nextVideo = `base${videoStep + 1}`;
    filters.push(buildTimecodeBurnInFilter(currentVideo, nextVideo, timecodeBurnIn));
    currentVideo = nextVideo;
    videoStep += 1;
  }

  if (!audioOnly) {
    const outputPixelFormat = pngSequence || animatedImage ? 'rgba' : 'yuv420p';
    const colorManagementFilters = buildExportColorManagementFilters(settings);
    filters.push(
      `[${currentVideo}]trim=duration=${formatFfmpegSeconds(outputDuration)},setpts=PTS-STARTPTS,fps=${settings.fps}${colorManagementFilters.length > 0 ? `,${colorManagementFilters.join(',')}` : ''},format=${outputPixelFormat}[vout]`
    );
  }

  const audioOutputLabel = slate?.enabled && !videoFramesOnly ? 'aout_slate' : 'aout';
  if (slate?.enabled && !videoFramesOnly) {
    filters.push(`anullsrc=channel_layout=stereo:sample_rate=${settings.sampleRate}:d=${formatFfmpegSeconds(slateDuration)}[slate_audio]`);
    filters.push(`[slate_audio][aout]concat=n=2:v=0:a=1[${audioOutputLabel}]`);
  }

  const filterComplex = filters.join(';');
  const maps = videoFramesOnly ? ['-map', '[vout]'] : audioOnly ? ['-map', '[aout]'] : ['-map', '[vout]', '-map', `[${audioOutputLabel}]`];
  const subtitleOutputArgs: string[] = [];
  if (softSubtitleInputs.length > 0) {
    for (const input of softSubtitleInputs) {
      maps.push('-map', `${input.inputIndex}:s:0`);
    }
    subtitleOutputArgs.push('-c:s', buildSoftSubtitleCodec(subtitleFormat, settings));
    softSubtitleInputs.forEach((input, index) => {
      subtitleOutputArgs.push(`-metadata:s:s:${index}`, `language=${subtitleLanguageToFfmpegMetadata(input.language)}`);
    });
  }
  const videoEncodingArgs = buildVideoEncodingArgs(settings, capabilities, warnings, audioOnly || videoFramesOnly);
  const exportRangeOutputArgs = buildExportRangeOutputArgs(outputRange);
  const outputArgs =
    frameExportTime !== null
      ? ['-ss', formatFfmpegSeconds(frameExportTime), '-frames:v', '1', '-f', 'image2', normalizeFfmpegPath(settings.outputPath)]
      : pngSequence
      ? ['-r', String(settings.fps), '-f', 'image2', pngSequenceOutputPath(settings.outputPath)]
      : webpAnimation
      ? ['-c:v', 'libwebp_anim', '-loop', '0', '-r', String(settings.fps), '-f', 'webp', normalizeFfmpegPath(settings.outputPath)]
      : apngExport
      ? ['-plays', '0', '-f', 'apng', normalizeFfmpegPath(settings.outputPath)]
      : [
          ...exportRangeOutputArgs,
          ...(audioOnly
            ? []
            : videoEncodingArgs),
          ...buildExportContainerMetadataArgs(project.metadata),
          ...(audioOnly ? [] : buildExportColorMetadataArgs(settings)),
          ...sphericalMetadataArgs,
          '-c:a',
          settings.audioCodec,
          ...buildBitrateArgs('-b:a', settings.audioBitrate),
          ...subtitleOutputArgs,
          '-t',
          formatFfmpegSeconds(encodedDuration),
          ...buildContainerArgs(settings),
          normalizeFfmpegPath(settings.outputPath)
        ];
  const fullArgs = buildFfmpegFullArgs(inputs, filterComplex, maps, outputArgs);
  const gifPlan = gifExport && frameExportTime === null ? buildGifExportPasses(inputs, filterComplex, settings, encodedDuration, textArtifacts, outputRange) : undefined;
  const loudnessPlan = loudnessAnalysisFilterComplex ? buildLoudnessNormalizationPasses(inputs, loudnessAnalysisFilterComplex, fullArgs, encodedDuration) : undefined;
  const nestedPlans = buildNestedSequencePlans(project, capabilities, warnings, depth, sequenceStack);
  const planDuration = frameExportTime === null ? encodedDuration : Math.max(1 / Math.max(1, settings.fps), 0.001);

  return {
    projectName: project.name,
    settings,
    inputs,
    filterComplex: gifPlan?.filterComplex ?? filterComplex,
    maps: gifPlan?.maps ?? maps,
    outputArgs: gifPlan?.outputArgs ?? outputArgs,
    fullArgs: gifPlan?.fullArgs ?? fullArgs,
    passes: gifPlan?.passes ?? loudnessPlan?.passes,
    warnings,
    textArtifacts,
    nestedPlans,
    postExportScript: normalizeExportPostScript(settings.postExportScript),
    displayCommand: ['ffmpeg', ...(gifPlan?.fullArgs ?? fullArgs).map(quoteForDisplay)].join(' '),
    duration: planDuration
  };
}

export function buildFfmpegCurrentFrameExportPlan(project: ExportProject, time: number, capabilities?: FfmpegCapabilities): FfmpegExportPlan {
  return buildFfmpegExportPlan(project, capabilities, 0, [], { frameExport: { time } });
}

export interface StemExportPlan {
  trackIndex: number;
  trackName: string;
  format: string;
  outputPath: string;
  plan: FfmpegExportPlan;
}

export function buildStemExportPlans(
  project: ExportProject,
  capabilities: FfmpegCapabilities | undefined,
  stemTracks: Array<{ trackIndex: number; trackName: string; format: string }>,
  outputDir: string
): StemExportPlan[] {
  return stemTracks.map((stem) => {
    const stemOutputPath = buildStemOutputPath(outputDir, project.name, stem.trackName, stem.trackIndex, stem.format);
    const stemSettings: ExportSettings = {
      ...project.settings,
      outputPath: stemOutputPath,
      format: stem.format === 'default' ? (project.settings.format === 'm4a' ? 'm4a' : 'wav') : stem.format,
      outputMode: 'audio' as const
    };
    const stemProject: ExportProject = {
      ...project,
      settings: stemSettings,
      timeline: {
        ...project.timeline,
        tracks: project.timeline.tracks.map((track) => ({
          ...track,
          muted: track.index !== stem.trackIndex,
          solo: track.index === stem.trackIndex
        }))
      }
    };
    const plan = buildFfmpegExportPlan(stemProject, capabilities, 0, [], { stemTrackIndex: stem.trackIndex });
    return {
      trackIndex: stem.trackIndex,
      trackName: stem.trackName,
      format: stem.format,
      outputPath: stemProject.settings.outputPath,
      plan
    };
  });
}

function sanitizeStemPathComponent(name: string): string {
  return name.replace(/[<>:"/\\|?*() ]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '').trim();
}

function buildStemOutputPath(outputDir: string, projectName: string, stemName: string, trackIndex: number, format: string): string {
  const ext = format === 'default' ? 'wav' : format;
  const safeProject = sanitizeStemPathComponent(projectName || 'project');
  const safeStem = sanitizeStemPathComponent(stemName || `track-${trackIndex}`);
  const dir = outputDir.replace(/[\\/]+$/, '');
  return `${dir}/${safeProject}_${safeStem}_${trackIndex}.${ext}`;
}

export function calculateExportPreviewSampleTimes(duration: number): Array<{ kind: ExportPreviewSampleKind; time: number }> {
  const safeDuration = Number.isFinite(duration) ? Math.max(0, duration) : 0;
  return EXPORT_PREVIEW_SAMPLE_KINDS.map((kind) => ({
    kind,
    time: round(kind === 'start' ? 0 : kind === 'middle' ? safeDuration / 2 : safeDuration)
  }));
}

export function buildFfmpegPreviewSamplePlans(project: ExportProject, outputPaths: string[], capabilities?: FfmpegCapabilities): ExportPreviewSamplePlan[] {
  const times = calculateExportPreviewSampleTimes(project.timeline.duration);
  if (outputPaths.length < times.length) {
    throw new Error(`Expected ${times.length} export preview output paths.`);
  }
  return times.map((sample, index) => {
    const outputPath = normalizeFfmpegPath(outputPaths[index]);
    const plan = buildFfmpegCurrentFrameExportPlan(
      {
        ...project,
        settings: {
          ...project.settings,
          outputPath
        }
      },
      sample.time,
      capabilities
    );
    return {
      id: `export-preview-${sample.kind}`,
      kind: sample.kind,
      label: sample.kind,
      time: sample.time,
      outputPath,
      plan
    };
  });
}

function normalizeExportReframeSettings(settings: ExportSettings): ExportSettings {
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
    subtitleBurnInLanguage: settings.subtitleBurnInLanguage ? normalizeSubtitleLanguage(settings.subtitleBurnInLanguage) : undefined,
    watermark: normalizeExportWatermark(settings.watermark),
    timecodeBurnIn: normalizeTimecodeBurnIn(settings.timecodeBurnIn),
    slate: normalizeExportSlate(settings.slate),
    audioVisualization: normalizeExportAudioVisualization(settings.audioVisualization),
    masterProcessing: normalizeExportMasterProcessing(settings.masterProcessing),
    spatialAudioAssets: normalizeExportSpatialAudioAssets(settings.spatialAudioAssets)
  };
}

function normalizeExportSpatialAudioAssets(input: ExportSettings['spatialAudioAssets'] | undefined): ExportSettings['spatialAudioAssets'] {
  if (!input || typeof input !== 'object') {
    return null;
  }
  const hrtfPath = typeof input.hrtfPath === 'string' && input.hrtfPath.trim() ? normalizeFfmpegPath(input.hrtfPath.trim()) : null;
  const roomImpulseResponses = input.roomImpulseResponses && typeof input.roomImpulseResponses === 'object'
    ? Object.fromEntries(
        Object.entries(input.roomImpulseResponses)
          .filter((entry): entry is ['small-room' | 'hall' | 'outdoor', string] => ['small-room', 'hall', 'outdoor'].includes(entry[0]) && typeof entry[1] === 'string' && entry[1].trim().length > 0)
          .map(([key, value]) => [key, normalizeFfmpegPath(value.trim())])
      )
    : {};
  return hrtfPath || Object.keys(roomImpulseResponses).length > 0 ? { hrtfPath, roomImpulseResponses } : null;
}

function mergeExportMetadata(base: ExportProject['metadata'], override: ExportProject['metadata']): ExportProject['metadata'] {
  if (!override) {
    return base;
  }
  return {
    ...(base ?? {}),
    ...Object.fromEntries(
      Object.entries(override).filter((entry): entry is [keyof NonNullable<ExportProject['metadata']>, string] => typeof entry[1] === 'string' && entry[1].trim().length > 0)
    )
  };
}

export function normalizeExportMasterProcessing(input: ExportSettings['masterProcessing'] | undefined): ExportMasterProcessingSettings {
  const source = input ?? DEFAULT_EXPORT_MASTER_PROCESSING;
  return {
    eq: normalizeExportMasterEq(source.eq),
    stereoEnhancer: {
      enabled: source.stereoEnhancer?.enabled === true,
      amount: round(Math.min(2, Math.max(0, finiteNumber(source.stereoEnhancer?.amount, DEFAULT_EXPORT_MASTER_PROCESSING.stereoEnhancer.amount))))
    },
    limiter: {
      enabled: source.limiter?.enabled === true,
      levelOutDb: round(Math.min(0, Math.max(-24, finiteNumber(source.limiter?.levelOutDb, DEFAULT_EXPORT_MASTER_PROCESSING.limiter.levelOutDb))))
    }
  };
}

export function hasExportMasterProcessing(input: ExportSettings['masterProcessing'] | undefined): boolean {
  return buildMasterAudioFilters(normalizeExportMasterProcessing(input)).length > 0;
}

function normalizeExportMasterEq(input: Partial<ExportMasterEq> | undefined): ExportMasterEq {
  const bands = Array.isArray(input?.bands) ? input.bands : [];
  return {
    enabled: input?.enabled === true,
    bands: DEFAULT_EXPORT_MASTER_EQ_BANDS.map((fallback, index) => normalizeExportMasterEqBand(bands[index], fallback))
  };
}

function normalizeExportMasterEqBand(input: Partial<ExportMasterEqBand> | undefined, fallback: ExportMasterEqBand): ExportMasterEqBand {
  const type = input?.type === 'lowshelf' || input?.type === 'highshelf' || input?.type === 'peaking' ? input.type : fallback.type;
  return {
    id: typeof input?.id === 'string' && input.id.trim() ? input.id : fallback.id,
    type,
    frequency: round(Math.min(20_000, Math.max(20, finiteNumber(input?.frequency, fallback.frequency)))),
    gain: round(Math.min(24, Math.max(-24, finiteNumber(input?.gain, fallback.gain)))),
    q: round(Math.min(4, Math.max(0.1, finiteNumber(input?.q, fallback.q))))
  };
}

function normalizeSettingsForExportFormat(settings: ExportSettings): ExportSettings {
  if (settings.format !== 'gif' && settings.format !== 'webp' && settings.format !== 'apng') {
    return settings;
  }
  const base: ExportSettings = {
    ...settings,
    outputMode: 'video',
    audioCodec: settings.audioCodec || 'aac',
    hardwareEncoding: false,
    loudnessNormalization: 'off'
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

function constrainDimensions(width: number, height: number, maxDimension: number): { width: number; height: number } {
  const safeWidth = Math.max(1, Math.round(width || DEFAULT_EXPORT_SETTINGS.width));
  const safeHeight = Math.max(1, Math.round(height || DEFAULT_EXPORT_SETTINGS.height));
  const longest = Math.max(safeWidth, safeHeight);
  if (longest <= maxDimension) {
    return { width: safeWidth, height: safeHeight };
  }
  const ratio = maxDimension / longest;
  return {
    width: Math.max(1, Math.round(safeWidth * ratio)),
    height: Math.max(1, Math.round(safeHeight * ratio))
  };
}

function normalizeExportWatermark(watermark: ExportSettings['watermark'] | undefined): ExportSettings['watermark'] {
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
      opacity: Math.min(1, Math.max(0, finiteNumber(watermark.opacity, 0.75)))
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
      fontFamily: typeof watermark.fontFamily === 'string' && watermark.fontFamily.trim() ? watermark.fontFamily.trim() : 'Arial',
      color: typeof watermark.color === 'string' && watermark.color.trim() ? watermark.color.trim() : '#ffffff',
      fontSize: Math.round(Math.min(240, Math.max(8, finiteNumber(watermark.fontSize, 36)))),
      position
    };
  }
  return null;
}

function normalizeWatermarkPosition(position: ExportWatermarkPosition | undefined): ExportWatermarkPosition {
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

function normalizeTimecodeBurnIn(timecode: ExportSettings['timecodeBurnIn'] | undefined): ExportSettings['timecodeBurnIn'] {
  if (!timecode || timecode.enabled !== true) {
    return null;
  }
  return {
    enabled: true,
    position: normalizeWatermarkPosition(timecode.position),
    fontSize: Math.round(Math.min(96, Math.max(8, finiteNumber(timecode.fontSize, 28)))),
    color: typeof timecode.color === 'string' && timecode.color.trim() ? timecode.color.trim() : '#ffffff',
    backgroundColor: typeof timecode.backgroundColor === 'string' && timecode.backgroundColor.trim() ? timecode.backgroundColor.trim() : '#000000',
    includeFrameNumber: timecode.includeFrameNumber === true
  };
}

function normalizeExportSlate(slate: ExportSettings['slate'] | undefined): ExportSettings['slate'] {
  return slate?.enabled === true ? { enabled: true } : null;
}

function buildTimecodeBurnInFilter(inputLabel: string, outputLabel: string, timecode: NonNullable<ExportSettings['timecodeBurnIn']>): string {
  const position = buildWatermarkExpression(timecode.position, 'w', 'h', 'text_w', 'text_h');
  const textExpression = timecode.includeFrameNumber ? '%{pts\\:hms}:%{n}' : '%{pts\\:hms}';
  return `[${inputLabel}]drawtext=text='${textExpression}':fontsize=${timecode.fontSize}:fontcolor=${cssColorToFfmpeg(timecode.color)}:box=1:boxcolor=${cssColorToFfmpeg(
    timecode.backgroundColor
  )}@0.72:boxborderw=8:x='${position.x}':y='${position.y}'[${outputLabel}]`;
}

function buildSlateVideoFilters(outputLabel: string, settings: ExportSettings, project: ExportProject, timelineDuration: number, slateDuration: number): string[] {
  const fontSize = Math.max(20, Math.round(Math.min(settings.width, settings.height) * 0.045));
  const lineHeight = Math.round(fontSize * 1.55);
  const startX = Math.max(32, Math.round(settings.width * 0.08));
  const startY = Math.max(48, Math.round(settings.height * 0.26));
  const date = new Date().toISOString().slice(0, 10);
  const lines = [
    `Project: ${project.name || 'Untitled Project'}`,
    `Date: ${date}`,
    `Duration: ${formatFfmpegSeconds(timelineDuration)}s`,
    `Frame Rate: ${formatFfmpegSeconds(settings.fps)} fps`
  ];
  const drawTextFilters = lines.map((line, index) => {
    const y = startY + lineHeight * index;
    return `drawtext=text='${escapeDrawtextValue(line)}':fontsize=${fontSize}:fontcolor=white:x=${startX}:y=${y}`;
  });
  return [
    `color=c=black:s=${settings.width}x${settings.height}:r=${settings.fps}:d=${formatFfmpegSeconds(
      slateDuration
    )},format=rgba,drawbox=x=0:y=0:w=iw:h=ih:color=black@1:t=fill,${drawTextFilters.join(',')}[${outputLabel}]`
  ];
}

function buildWatermarkFilters(
  inputLabel: string,
  outputLabel: string,
  watermark: NonNullable<ExportSettings['watermark']>,
  settings: ExportSettings,
  imageInputIndex: number | undefined
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
      `[${inputLabel}][${preparedLabel}]overlay=x='${position.x}':y='${position.y}':eval=frame[${outputLabel}]`
    ];
  }

  const position = buildWatermarkExpression(watermark.position, 'w', 'h', 'text_w', 'text_h');
  const font = watermark.fontFamily ? `:font='${escapeDrawtextValue(watermark.fontFamily)}'` : '';
  return [
    `[${inputLabel}]drawtext=text='${escapeDrawtextValue(watermark.text)}'${font}:fontsize=${watermark.fontSize}:fontcolor=${cssColorToFfmpeg(
      watermark.color
    )}:x='${position.x}':y='${position.y}'[${outputLabel}]`
  ];
}

function buildWatermarkExpression(
  position: ExportWatermarkPosition,
  widthVar: string,
  heightVar: string,
  itemWidthVar: string,
  itemHeightVar: string
): { x: string; y: string } {
  const horizontal = position.endsWith('left') ? 'left' : position.endsWith('right') ? 'right' : 'center';
  const vertical = position.startsWith('top') ? 'top' : position.startsWith('bottom') ? 'bottom' : 'middle';
  const x = horizontal === 'left' ? String(WATERMARK_MARGIN_PX) : horizontal === 'right' ? `${widthVar}-${itemWidthVar}-${WATERMARK_MARGIN_PX}` : `(${widthVar}-${itemWidthVar})/2`;
  const y = vertical === 'top' ? String(WATERMARK_MARGIN_PX) : vertical === 'bottom' ? `${heightVar}-${itemHeightVar}-${WATERMARK_MARGIN_PX}` : `(${heightVar}-${itemHeightVar})/2`;
  return { x, y };
}

export function calculateWatermarkOverlayPosition(
  position: ExportWatermarkPosition,
  canvasWidth: number,
  canvasHeight: number,
  watermarkWidth: number,
  watermarkHeight: number
): { x: number; y: number } {
  const safePosition = normalizeWatermarkPosition(position);
  const horizontal = safePosition.endsWith('left') ? 'left' : safePosition.endsWith('right') ? 'right' : 'center';
  const vertical = safePosition.startsWith('top') ? 'top' : safePosition.startsWith('bottom') ? 'bottom' : 'middle';
  const x = horizontal === 'left' ? WATERMARK_MARGIN_PX : horizontal === 'right' ? canvasWidth - watermarkWidth - WATERMARK_MARGIN_PX : (canvasWidth - watermarkWidth) / 2;
  const y = vertical === 'top' ? WATERMARK_MARGIN_PX : vertical === 'bottom' ? canvasHeight - watermarkHeight - WATERMARK_MARGIN_PX : (canvasHeight - watermarkHeight) / 2;
  return { x: Math.round(x), y: Math.round(y) };
}

function finiteNumber(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function buildGifExportPasses(
  inputs: FfmpegInput[],
  baseFilterComplex: string,
  settings: ExportSettings,
  duration: number,
  textArtifacts: TextArtifact[],
  outputRange?: NormalizedExportRenderRange | null
): { filterComplex: string; maps: string[]; outputArgs: string[]; fullArgs: string[]; passes: FfmpegExportPass[] } {
  textArtifacts.push({
    clipId: 'gif-palette',
    text: '',
    fileName: 'gif-palette.png',
    placeholder: GIF_PALETTE_PLACEHOLDER,
    pathMode: 'argument'
  });

  const paletteFilterComplex = `${baseFilterComplex};[vout]palettegen=stats_mode=diff[gifpalette]`;
  const paletteMaps = ['-map', '[gifpalette]'];
  const paletteOutputArgs = ['-frames:v', '1', '-update', '1', '-f', 'image2', GIF_PALETTE_PLACEHOLDER];
  const paletteFullArgs = buildFfmpegFullArgs(inputs, paletteFilterComplex, paletteMaps, paletteOutputArgs);
  const paletteInput: FfmpegInput = { index: inputs.length, path: GIF_PALETTE_PLACEHOLDER, args: [] };
  const gifFilterComplex = `${baseFilterComplex};[vout][${paletteInput.index}:v]paletteuse=dither=sierra2_4a:diff_mode=rectangle[gifout]`;
  const gifMaps = ['-map', '[gifout]'];
  const gifOutputArgs = ['-loop', '0', ...buildExportRangeOutputArgs(outputRange), '-t', formatFfmpegSeconds(duration), '-f', 'gif', normalizeFfmpegPath(settings.outputPath)];
  const gifFullArgs = buildFfmpegFullArgs([...inputs, paletteInput], gifFilterComplex, gifMaps, gifOutputArgs);
  return {
    filterComplex: gifFilterComplex,
    maps: gifMaps,
    outputArgs: gifOutputArgs,
    fullArgs: gifFullArgs,
    passes: [
      { name: 'gif-palettegen', fullArgs: paletteFullArgs, duration },
      { name: 'gif-paletteuse', fullArgs: gifFullArgs, duration }
    ]
  };
}

function buildExportRangeOutputArgs(range: NormalizedExportRenderRange | null | undefined): string[] {
  return range ? ['-ss', formatFfmpegSeconds(range.start)] : [];
}

function buildLoudnessNormalizationPasses(
  inputs: FfmpegInput[],
  analysisFilterComplex: string,
  renderFullArgs: string[],
  duration: number
): { passes: FfmpegExportPass[] } {
  const analysisFullArgs = buildFfmpegFullArgs(inputs, analysisFilterComplex, ['-map', '[aout]'], ['-f', 'null', '-']);
  return {
    passes: [
      { name: 'loudness-analysis', kind: 'loudness-analysis', fullArgs: analysisFullArgs, duration },
      { name: 'loudness-render', kind: 'render', fullArgs: renderFullArgs, duration }
    ]
  };
}

function buildFfmpegFullArgs(inputs: FfmpegInput[], filterComplex: string, maps: string[], outputArgs: string[]): string[] {
  return [
    '-y',
    '-progress',
    'pipe:2',
    '-nostats',
    ...inputs.flatMap((input) => [...input.args, '-i', input.path]),
    '-filter_complex',
    filterComplex,
    ...maps,
    ...outputArgs
  ];
}

function buildNestedSequencePlans(
  project: ExportProject,
  capabilities: FfmpegCapabilities | undefined,
  warnings: string[],
  depth: number,
  sequenceStack: string[]
): NestedFfmpegExportPlan[] {
  const sequenceIds = new Set(
    project.timeline.tracks.flatMap((track) => track.clips.flatMap((clip) => (clip.type === 'nested-sequence' && clip.nestedSequenceId ? [clip.nestedSequenceId] : [])))
  );
  const nestedPlans: NestedFfmpegExportPlan[] = [];
  for (const sequenceId of sequenceIds) {
    if (sequenceStack.includes(sequenceId)) {
      warnings.push(`Nested sequence ${sequenceId} was skipped because it would create a recursive export.`);
      continue;
    }
    if (depth + 1 > MAX_NESTED_SEQUENCE_DEPTH) {
      warnings.push(`Nested sequence ${sequenceId} exceeds maximum depth ${MAX_NESTED_SEQUENCE_DEPTH}.`);
    }
    const sequence = project.sequences.find((item) => item.id === sequenceId);
    if (!sequence) {
      warnings.push(`Nested sequence ${sequenceId} was skipped because the sequence is missing.`);
      continue;
    }
    const placeholder = nestedInputPlaceholder(sequenceId);
    const nestedProject: ExportProject = {
      ...project,
      settings: { ...project.settings, outputPath: placeholder, format: 'mp4', outputMode: 'video' },
      timeline: sequence.timeline
    };
    nestedPlans.push({
      sequenceId,
      placeholder,
      plan: buildFfmpegExportPlan(nestedProject, capabilities, depth + 1, [...sequenceStack, sequenceId])
    });
  }
  return nestedPlans;
}

type VisualItem =
  | {
      kind: 'text';
      trackIndex: number;
      start: number;
      duration: number;
      clip: ExportClip;
    }
  | {
      kind: 'credits';
      trackIndex: number;
      start: number;
      duration: number;
      clip: ExportClip;
    }
  | {
      kind: 'adjustment';
      trackIndex: number;
      start: number;
      duration: number;
      clip: ExportClip;
    }
  | {
      kind: 'media';
      trackIndex: number;
      start: number;
      duration: number;
      label: string;
      xExpression: string;
      yExpression: string;
      blendMode: ClipBlendMode;
    };

function buildVisualItems(
  timeline: ExportTimeline,
  orderedPlaybackClips: ExportClip[],
  playbackStartByClipId: Map<string, number>,
  renderableTrackIndexes: Set<number>,
  inputByClipId: Map<string, number>,
  customShaderSequenceClips: Map<string, ExportClip>,
  settings: ExportSettings,
  filters: string[],
  warnings: string[],
  textArtifacts: TextArtifact[],
  capabilities: FfmpegCapabilities | undefined
): VisualItem[] {
  const consumedClipIds = new Set<string>();
  const items: VisualItem[] = [];

  for (const transition of timeline.transitions) {
    const pair = findExportTransitionPair(timeline, transition);
    if (!pair || !renderableTrackIndexes.has(pair.track.index)) {
      continue;
    }
    if (!isTransitionVisualClip(pair.fromClip) || !isTransitionVisualClip(pair.toClip)) {
      warnings.push(`Transition ${transition.id} was skipped because both clips must be visual media clips.`);
      continue;
    }
    if (consumedClipIds.has(pair.fromClip.id) || consumedClipIds.has(pair.toClip.id)) {
      warnings.push(`Transition ${transition.id} was skipped because chained transitions are not yet supported in one export segment.`);
      continue;
    }
    const fromInput = inputByClipId.get(pair.fromClip.id);
    const toInput = inputByClipId.get(pair.toClip.id);
    if (fromInput === undefined || toInput === undefined) {
      warnings.push(`Transition ${transition.id} was skipped because one of its clips has no media input.`);
      continue;
    }
    const duration = clampExportTransitionDuration(transition, pair.fromClip, pair.toClip);
    if (duration <= 0) {
      continue;
    }
    const label = `xfade${safeLabel(transition.id)}`;
    const start = playbackStartByClipId.get(pair.fromClip.id) ?? pair.fromClip.start;
    const pairDuration = round(pair.fromClip.duration + pair.toClip.duration - duration);
    filters.push(buildTransitionClipFilter(fromInput, customShaderSequenceClips.get(pair.fromClip.id) ?? pair.fromClip, `${label}_from`, settings, textArtifacts, warnings, capabilities));
    filters.push(buildTransitionClipFilter(toInput, customShaderSequenceClips.get(pair.toClip.id) ?? pair.toClip, `${label}_to`, settings, textArtifacts, warnings, capabilities));
    filters.push(...buildSmartTransitionFilters(transition, label, duration, Math.max(0, pair.fromClip.duration - duration), settings));
    filters.push(`[${label}_raw]setpts=PTS-STARTPTS+${formatFfmpegSeconds(start)}/TB[${label}]`);
    items.push({
      kind: 'media',
      trackIndex: pair.track.index,
      start,
      duration: pairDuration,
      label,
      xExpression: '(main_w-overlay_w)/2+0',
      yExpression: '(main_h-overlay_h)/2+0',
      blendMode: normalizeClipBlendMode(pair.toClip.blendMode)
    });
    consumedClipIds.add(pair.fromClip.id);
    consumedClipIds.add(pair.toClip.id);
  }

  for (const clip of orderedPlaybackClips.filter((item) => item.type === 'video' || item.type === 'image' || item.type === 'text' || item.type === 'credits' || item.type === 'nested-sequence' || item.type === 'adjustment' || item.type === 'motion-graphic')) {
    if (consumedClipIds.has(clip.id)) {
      continue;
    }
    if (clip.type === 'adjustment') {
      items.push({ kind: 'adjustment', trackIndex: clip.trackIndex, start: clip.start, duration: clip.duration, clip });
      continue;
    }
    if (clip.type === 'text') {
      items.push({ kind: 'text', trackIndex: clip.trackIndex, start: clip.start, duration: clip.duration, clip });
      continue;
    }
    if (clip.type === 'credits') {
      items.push({ kind: 'credits', trackIndex: clip.trackIndex, start: clip.start, duration: clip.duration, clip });
      continue;
    }

    const inputIndex = inputByClipId.get(clip.id);
    if (inputIndex === undefined) {
      warnings.push(`Clip ${clip.id} has no media path and was skipped.`);
      continue;
    }
    const clipLabel = `v${safeLabel(clip.id)}`;
    filters.push(buildVisualClipFilter(inputIndex, customShaderSequenceClips.get(clip.id) ?? clip, clipLabel, settings, textArtifacts, warnings, capabilities));
    items.push({
      kind: 'media',
      trackIndex: clip.trackIndex,
      start: clip.start,
      duration: clip.duration,
      label: clipLabel,
      xExpression: buildOverlayXExpression(clip),
      yExpression: buildOverlayYExpression(clip),
      blendMode: normalizeClipBlendMode(clip.blendMode)
    });
  }

  return items.sort((left, right) => left.trackIndex - right.trackIndex || left.start - right.start || visualKindOrder(left) - visualKindOrder(right));
}

function buildPlaybackStartByClipId(timeline: ExportTimeline): Map<string, number> {
  const starts = new Map<string, number>();
  for (const track of timeline.tracks) {
    let transitionOffset = 0;
    const clips = [...track.clips].sort((left, right) => left.start - right.start || left.id.localeCompare(right.id));
    for (let index = 0; index < clips.length; index += 1) {
      const clip = clips[index];
      const previous = clips[index - 1];
      const transition = previous ? timeline.transitions.find((item) => item.fromClipId === previous.id && item.toClipId === clip.id) : undefined;
      if (previous && transition && areExportClipsAdjacent(previous, clip)) {
        transitionOffset = round(transitionOffset + clampExportTransitionDuration(transition, previous, clip));
      }
      starts.set(clip.id, round(clip.start - transitionOffset));
    }
  }
  return starts;
}

function findExportTransitionPair(
  timeline: ExportTimeline,
  transition: ExportTransition
): { track: ExportTrack; fromClip: ExportClip; toClip: ExportClip } | undefined {
  for (const track of timeline.tracks) {
    const clips = [...track.clips].sort((left, right) => left.start - right.start || left.id.localeCompare(right.id));
    const fromIndex = clips.findIndex((clip) => clip.id === transition.fromClipId);
    const toIndex = clips.findIndex((clip) => clip.id === transition.toClipId);
    if (fromIndex === -1 || toIndex !== fromIndex + 1) {
      continue;
    }
    const fromClip = clips[fromIndex];
    const toClip = clips[toIndex];
    if (!areExportClipsAdjacent(fromClip, toClip)) {
      continue;
    }
    return { track, fromClip, toClip };
  }
  return undefined;
}

function buildTransitionClipFilter(
  inputIndex: number,
  clip: ExportClip,
  label: string,
  settings: ExportSettings,
  textArtifacts: TextArtifact[],
  warnings: string[],
  capabilities: FfmpegCapabilities | undefined
): string {
  const sourceDuration = getExportClipSourceDuration(clip);
  const trim = clip.type === 'video' || clip.type === 'nested-sequence' ? `trim=start=0:duration=${formatFfmpegSeconds(sourceDuration)}` : `trim=duration=${formatFfmpegSeconds(sourceDuration)}`;
  const filters = [
    `[${inputIndex}:v]${trim}`,
    ...buildChromaKeyFilters(clip),
    buildSetptsFilter(clip, false, warnings),
    ...buildStabilizationFilters(clip),
    ...buildPanoramaProjectionFilters(clip),
    ...buildReframeFilters(settings),
    ...(isReframeEnabled(settings.targetAspectRatio)
      ? []
      : [`scale=${settings.width}:${settings.height}:force_original_aspect_ratio=decrease`, `pad=${settings.width}:${settings.height}:(ow-iw)/2:(oh-ih)/2:color=black`]),
    `fps=${settings.fps}`,
    ...buildSlowMotionFilters(clip, settings, capabilities, warnings),
    ...buildFrameInterpolationFilters(clip, capabilities, warnings),
    ...buildVideoRestorationFilters(clip),
    ...buildQualityEnhancementFilters(clip),
    'format=rgba'
  ];
  filters.push(...buildMaskFilters(clip));
  filters.push(...buildColorCorrectionFilters(clip, textArtifacts));
  filters.push(...buildEffectFilters(clip.effects, settings.fps));
  filters.push(`colorchannelmixer=aa=${formatOpacity(clip.transform.opacity)}[${label}]`);
  return filters.join(',');
}

function isTransitionVisualClip(clip: ExportClip): boolean {
  return clip.type === 'video' || clip.type === 'image' || clip.type === 'nested-sequence';
}

function areExportClipsAdjacent(fromClip: ExportClip, toClip: ExportClip): boolean {
  return Math.abs(fromClip.start + fromClip.duration - toClip.start) <= 0.001;
}

function clampExportTransitionDuration(transition: ExportTransition, fromClip: ExportClip, toClip: ExportClip): number {
  return round(Math.min(normalizeTransitionDuration(transition.duration), Math.max(0, Math.min(fromClip.duration, toClip.duration) * 0.5)));
}

function buildSmartTransitionFilters(
  transition: ExportTransition,
  label: string,
  duration: number,
  offset: number,
  settings: ExportSettings
): string[] {
  const fromLabel = `${label}_from`;
  const toLabel = `${label}_to`;
  const rawLabel = `${label}_raw`;
  const durationArg = formatFfmpegSeconds(duration);
  const offsetArg = formatFfmpegSeconds(offset);
  if (transition.type === 'rotate') {
    const rotatedLabel = `${label}_rotate_from`;
    return [
      `[${fromLabel}]rotate='PI/10*t/${durationArg}':ow=iw:oh=ih:c=black@0,format=rgba[${rotatedLabel}]`,
      `[${rotatedLabel}][${toLabel}]xfade=transition=fade:duration=${durationArg}:offset=${offsetArg}[${rawLabel}]`
    ];
  }
  if (transition.type === 'motion-blur-wipe') {
    const fromBlurLabel = `${label}_motion_from`;
    const toBlurLabel = `${label}_motion_to`;
    return [
      `[${fromLabel}]minterpolate=fps=${formatFfmpegNumber(settings.fps)},gblur=sigma=6:steps=2[${fromBlurLabel}]`,
      `[${toLabel}]minterpolate=fps=${formatFfmpegNumber(settings.fps)},gblur=sigma=6:steps=2[${toBlurLabel}]`,
      `[${fromBlurLabel}][${toBlurLabel}]xfade=transition=wipeleft:duration=${durationArg}:offset=${offsetArg}[${rawLabel}]`
    ];
  }
  if (transition.type === 'shape-heart' || transition.type === 'shape-star') {
    const shapeLabel = `${label}_shape_to`;
    return [
      `[${toLabel}]format=rgba,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='${buildShapeWipeGeqExpression(transition.type)}'[${shapeLabel}]`,
      `[${fromLabel}][${shapeLabel}]overlay=format=auto[${rawLabel}]`
    ];
  }
  return [`[${fromLabel}][${toLabel}]xfade=transition=${mapTransitionType(transition.type)}:duration=${durationArg}:offset=${offsetArg}[${rawLabel}]`];
}

export function mapTransitionType(type: ExportTransition['type']): string {
  switch (type) {
    case 'fade-black':
    case 'flash-black':
      return 'fadeblack';
    case 'wipe-left':
      return 'wipeleft';
    case 'wipe-right':
      return 'wiperight';
    case 'wipe-up':
      return 'wipeup';
    case 'wipe-down':
      return 'wipedown';
    case 'zoom-dissolve':
      return 'zoominzoomout';
    case 'flash-white':
      return 'fadewhite';
    case 'block':
      return 'pixelize';
    case 'film-roll-open':
      return 'horzopen';
    case 'film-roll-close':
      return 'horzclose';
    case 'motion-blur-wipe':
      return 'wipeleft';
    case 'rotate':
      return 'fade';
    case 'shape-heart':
    case 'shape-star':
      return 'custom';
    default:
      return 'dissolve';
  }
}

export function buildShapeWipeGeqExpression(type: Extract<ExportTransition['type'], 'shape-heart' | 'shape-star'>): string {
  if (type === 'shape-star') {
    return 'if(lte(abs(X-W/2)/(W/2)+abs(Y-H/2)/(H/2),0.82),255,0)';
  }
  return 'if(lte(pow((X-W/2)/(W/2),2)+pow((Y-H/2)/(H/2)-sqrt(abs((X-W/2)/(W/2))),2),1),255,0)';
}

export interface TransitionPreviewArgsOptions {
  width?: number;
  height?: number;
  fps?: number;
  duration?: number;
}

export function buildTransitionPreviewArgs(type: ExportTransition['type'], options: TransitionPreviewArgsOptions = {}): string[] {
  const width = Math.max(16, Math.round(options.width ?? 160));
  const height = Math.max(16, Math.round(options.height ?? 90));
  const fps = Math.max(1, Math.round(options.fps ?? 30));
  const duration = formatFfmpegSeconds(normalizeTransitionDuration(options.duration));
  const offset = '0';
  const baseFilter =
    type === 'shape-heart' || type === 'shape-star'
      ? `[1:v]format=rgba,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='${buildShapeWipeGeqExpression(type)}'[shape];[0:v][shape]overlay=format=auto,scale=${width}:${height}`
      : `[0:v][1:v]xfade=transition=${mapTransitionType(type)}:duration=${duration}:offset=${offset},scale=${width}:${height}`;
  return [
    '-f',
    'lavfi',
    '-i',
    `testsrc2=size=${width}x${height}:rate=${fps}:duration=${duration}`,
    '-f',
    'lavfi',
    '-i',
    `smptebars=size=${width}x${height}:rate=${fps}:duration=${duration}`,
    '-filter_complex',
    baseFilter,
    '-frames:v',
    '1',
    '-f',
    'image2pipe',
    'pipe:1'
  ];
}

function visualKindOrder(item: VisualItem): number {
  if (item.kind === 'media') {
    return 0;
  }
  return item.kind === 'adjustment' ? 1 : 2;
}

function buildMediaCompositeFilter(currentVideo: string, nextVideo: string, item: Extract<VisualItem, { kind: 'media' }>, settings: ExportSettings, duration: number): string {
  const start = formatFfmpegSeconds(item.start);
  const end = formatFfmpegSeconds(item.start + item.duration);
  const enable = `between(t,${start},${end})`;
  if (normalizeClipBlendMode(item.blendMode) === 'normal') {
    return `[${currentVideo}][${item.label}]overlay=x='${item.xExpression}':y='${item.yExpression}':eval=frame:enable='${enable}'[${nextVideo}]`;
  }
  const safe = safeLabel(`${nextVideo}_${item.label}`);
  const blankLabel = `${safe}_blend_blank`;
  const layerLabel = `${safe}_blend_layer`;
  const layerRgbLabel = `${safe}_blend_layer_rgb`;
  const layerAlphaSourceLabel = `${safe}_blend_layer_alpha_source`;
  const baseBlendLabel = `${safe}_blend_base`;
  const alphaLabel = `${safe}_blend_alpha`;
  const blendedLabel = `${safe}_blend_rgb`;
  const blendedRgbaLabel = `${safe}_blend_rgba`;
  const ffmpegMode = getFfmpegBlendMode(item.blendMode);
  return [
    `color=c=black@0.0:s=${settings.width}x${settings.height}:r=${settings.fps}:d=${formatFfmpegSeconds(duration)},format=rgba[${blankLabel}]`,
    `[${blankLabel}][${item.label}]overlay=x='${item.xExpression}':y='${item.yExpression}':eval=frame:enable='${enable}',format=rgba[${layerLabel}]`,
    `[${layerLabel}]split=2[${layerRgbLabel}][${layerAlphaSourceLabel}]`,
    `[${layerAlphaSourceLabel}]alphaextract[${alphaLabel}]`,
    `[${currentVideo}]format=rgba[${baseBlendLabel}]`,
    `[${layerRgbLabel}][${baseBlendLabel}]blend=all_mode=${ffmpegMode}:all_opacity=1,format=rgba[${blendedLabel}]`,
    `[${blendedLabel}][${alphaLabel}]alphamerge,format=rgba[${blendedRgbaLabel}]`,
    `[${currentVideo}][${blendedRgbaLabel}]overlay=x=0:y=0:eval=frame:enable='${enable}'[${nextVideo}]`
  ].join(';');
}

function buildAdjustmentLayerFilters(inputLabel: string, outputLabel: string, clip: ExportClip, textArtifacts: TextArtifact[], settings: ExportSettings): string[] {
  const processingFilters = [...buildColorCorrectionFilters(clip, textArtifacts), ...buildEffectFilters(clip.effects, settings.fps)];
  if (processingFilters.length === 0) {
    return [];
  }
  const safeClipId = safeLabel(clip.id);
  const baseLabel = `${outputLabel}_${safeClipId}_base`;
  const sourceLabel = `${outputLabel}_${safeClipId}_source`;
  const processedLabel = `${outputLabel}_${safeClipId}_processed`;
  return [
    `[${inputLabel}]split=2[${baseLabel}][${sourceLabel}]`,
    `[${sourceLabel}]${processingFilters.join(',')}[${processedLabel}]`,
    `[${baseLabel}][${processedLabel}]overlay=x=0:y=0:eval=frame:enable='between(t,${formatFfmpegSeconds(clip.start)},${formatFfmpegSeconds(clip.start + clip.duration)})'[${outputLabel}]`
  ];
}

function buildVisualClipFilter(
  inputIndex: number,
  clip: ExportClip,
  label: string,
  settings: ExportSettings,
  textArtifacts: TextArtifact[],
  warnings: string[],
  capabilities: FfmpegCapabilities | undefined
): string {
  const sourceDuration = getExportClipSourceDuration(clip);
  const trim = clip.type === 'video' || clip.type === 'nested-sequence' ? `trim=start=0:duration=${formatFfmpegSeconds(sourceDuration)}` : `trim=duration=${formatFfmpegSeconds(sourceDuration)}`;
  const key = normalizeChromaKey(clip.chromaKey);
  if (isDifferenceMatteEnabled(key)) {
    return buildDifferenceMatteClipFilter(inputIndex, clip, label, settings, textArtifacts, warnings, capabilities, trim, key);
  }
  if (hasPrivacyBlurMasks(clip)) {
    return buildPrivacyBlurClipFilter(inputIndex, clip, label, settings, textArtifacts, warnings, capabilities, trim);
  }
  if (clip.colorGradingGraph?.nodes?.length) {
    const gradingFilter = buildColorGradingGraphVisualFilter(inputIndex, clip, label, settings, textArtifacts, warnings, capabilities, trim);
    if (gradingFilter) {
      return gradingFilter;
    }
  }
  if (clip.colorNodeGraph) {
    const graphFilter = buildColorNodeGraphVisualFilter(inputIndex, clip, label, settings, textArtifacts, warnings, capabilities, trim);
    if (graphFilter) {
      return graphFilter;
    }
  }
  const filters = [`[${inputIndex}:v]${trim}`, ...buildChromaKeyFilters(clip)];
  filters.push(...buildVisualPostKeyFilters(clip, settings, textArtifacts, warnings, capabilities, label));
  const redactionExprs = buildPrivacyRedactionFFmpegExpressions(clip.privacyRedactions ?? [], settings.width, settings.height, 'boxblur');
  if (redactionExprs.length > 0) filters.push(...redactionExprs);
  return filters.join(',');
}

function buildColorNodeGraphVisualFilter(
  inputIndex: number,
  clip: ExportClip,
  label: string,
  settings: ExportSettings,
  textArtifacts: TextArtifact[],
  warnings: string[],
  capabilities: FfmpegCapabilities | undefined,
  trim: string
): string | null {
  const normalized = normalizeColorNodeGraph(clip.colorNodeGraph, clip.colorCorrection);
  const cycle = detectColorNodeGraphCycle(normalized);
  if (cycle) {
    warnings.push(`Color node graph for clip ${clip.id} contains a cycle (${cycle.join(' -> ')}); falling back to the legacy color correction chain.`);
    return null;
  }
  const baseLabel = `${safeLabel(label)}_node_base`;
  const graphOutputLabel = `${safeLabel(label)}_node_graph_output`;
  const baseFilters = [
    `[${inputIndex}:v]${trim}`,
    ...buildChromaKeyFilters(clip),
    ...buildVisualPreColorFilters(clip, settings, warnings, capabilities)
  ];
  const graphFilters = buildColorNodeGraphFilterPlan(normalized, {
    inputLabel: baseLabel,
    outputLabel: graphOutputLabel,
    clipId: clip.id,
    mediaKind: 'video',
    escapeFilePath: escapeDrawtextValue,
    registerArtifact: (artifact) => {
      textArtifacts.push({
        clipId: `${clip.id}:${artifact.nodeId}`,
        text: artifact.text,
        fileName: artifact.fileName,
        placeholder: artifact.placeholder,
        pathMode: 'filter'
      });
      return artifact.placeholder;
    }
  }).filters;
  const postFilters = [
    `[${graphOutputLabel}]${buildVisualPostColorFilters(clip, settings, textArtifacts, label, false).join(',')}`
  ];
  return [`${baseFilters.join(',')}[${baseLabel}]`, ...graphFilters, ...postFilters].join(',');
}

function buildColorGradingGraphVisualFilter(
  inputIndex: number,
  clip: ExportClip,
  label: string,
  settings: ExportSettings,
  textArtifacts: TextArtifact[],
  warnings: string[],
  capabilities: FfmpegCapabilities | undefined,
  trim: string
): string | null {
  const gradingFilters = buildColorGradingFilters(clip.colorGradingGraph);
  if (gradingFilters.length === 0) return null;

  const baseLabel = `${safeLabel(label)}_grading_base`;
  const gradingOutputLabel = `${safeLabel(label)}_grading_output`;
  const baseFilters = [
    `[${inputIndex}:v]${trim}`,
    ...buildChromaKeyFilters(clip),
    ...buildVisualPreColorFilters(clip, settings, warnings, capabilities)
  ];
  const gradingChain = gradingFilters.join(',');
  const postFilters = [
    `[${gradingOutputLabel}]${buildVisualPostColorFilters(clip, settings, textArtifacts, label, false).join(',')}`
  ];
  return [
    `${baseFilters.join(',')}[${baseLabel}]`,
    `[${baseLabel}]${gradingChain}[${gradingOutputLabel}]`,
    ...postFilters
  ].join(';');
}

function buildVisualPreColorFilters(
  clip: ExportClip,
  settings: ExportSettings,
  warnings: string[],
  capabilities: FfmpegCapabilities | undefined
): string[] {
  const filters: string[] = [];
  if (isKenBurnsAnimatedScaleClip(clip)) {
    filters.push(buildSetptsFilter(clip, false, warnings), buildKenBurnsZoompanFilter(clip, settings), 'setsar=1', buildSetptsFilter(clip, true, warnings));
  } else {
    filters.push(buildSetptsFilter(clip, true, warnings), ...buildStabilizationFilters(clip), ...buildPanoramaProjectionFilters(clip), ...buildReframeFilters(settings), buildScaleFilter(clip), 'setsar=1');
  }
  if (settings.scaleMode === 'fit' && !isReframeEnabled(settings.targetAspectRatio)) {
    filters.push(
      `scale=${settings.width}:${settings.height}:force_original_aspect_ratio=decrease`,
      `pad=${settings.width}:${settings.height}:(ow-iw)/2:(oh-ih)/2:color=black`
    );
  }
  filters.push(...buildSlowMotionFilters(clip, settings, capabilities, warnings));
  filters.push(...buildFrameInterpolationFilters(clip, capabilities, warnings));
  filters.push(...buildVideoRestorationFilters(clip));
  filters.push(...buildQualityEnhancementFilters(clip));
  filters.push(...buildSourceColorSpaceConversionFilters(clip, settings));
  filters.push('format=rgba');
  filters.push(...buildMaskFilters(clip));
  return filters;
}

function buildVisualPostColorFilters(
  clip: ExportClip,
  settings: ExportSettings,
  textArtifacts: TextArtifact[],
  label: string,
  includeColorCorrection = true
): string[] {
  const filters: string[] = [];
  if (includeColorCorrection) {
    filters.push(...buildColorCorrectionFilters(clip, textArtifacts));
  }
  filters.push(...buildEffectFilters(clip.effects, settings.fps));
  filters.push(...buildClipBorderFilters(clip));
  if (Math.abs(clip.transform.rotation) > 0.001) {
    filters.push(`rotate=${formatFfmpegNumber(clip.transform.rotation)}*PI/180:c=none`);
  }
  filters.push(...buildOpacityFilters(clip, label));
  return filters;
}

function buildVisualPostKeyFilters(
  clip: ExportClip,
  settings: ExportSettings,
  textArtifacts: TextArtifact[],
  warnings: string[],
  capabilities: FfmpegCapabilities | undefined,
  label: string
): string[] {
  const filters: string[] = [];
  if (isKenBurnsAnimatedScaleClip(clip)) {
    filters.push(buildSetptsFilter(clip, false, warnings), buildKenBurnsZoompanFilter(clip, settings), 'setsar=1', buildSetptsFilter(clip, true, warnings));
  } else {
    filters.push(buildSetptsFilter(clip, true, warnings), ...buildStabilizationFilters(clip), ...buildPanoramaProjectionFilters(clip), ...buildReframeFilters(settings), buildScaleFilter(clip), 'setsar=1');
  }
  if (settings.scaleMode === 'fit' && !isReframeEnabled(settings.targetAspectRatio)) {
    filters.push(
      `scale=${settings.width}:${settings.height}:force_original_aspect_ratio=decrease`,
      `pad=${settings.width}:${settings.height}:(ow-iw)/2:(oh-ih)/2:color=black`
    );
  }
  filters.push(...buildSlowMotionFilters(clip, settings, capabilities, warnings));
  filters.push(...buildFrameInterpolationFilters(clip, capabilities, warnings));
  filters.push(...buildVideoRestorationFilters(clip));
  filters.push(...buildQualityEnhancementFilters(clip));
  filters.push(...buildSourceColorSpaceConversionFilters(clip, settings));
  filters.push('format=rgba');
  filters.push(...buildMaskFilters(clip));
  filters.push(...buildColorCorrectionFilters(clip, textArtifacts));
  filters.push(...buildEffectFilters(clip.effects, settings.fps));
  filters.push(...buildClipBorderFilters(clip));
  if (Math.abs(clip.transform.rotation) > 0.001) {
    filters.push(`rotate=${formatFfmpegNumber(clip.transform.rotation)}*PI/180:c=none`);
  }
  filters.push(...buildOpacityFilters(clip, label));
  return filters;
}

function buildPanoramaProjectionFilters(clip: ExportClip): string[] {
  if (clip.projection === 'flat') {
    return [];
  }
  const panorama = normalizeClipPanoramaView(clip.panorama);
  if (clip.projection === 'equirectangular' && panorama.outputProjection === 'equirectangular') {
    return [];
  }
  const inputProjection = clip.projection === 'cubemap' ? 'c3x2' : 'e';
  const outputProjection = panorama.outputProjection === 'equirectangular' ? 'e' : 'flat';
  const args = [
    inputProjection,
    outputProjection,
    `yaw=${formatFfmpegNumber(panorama.yaw)}`,
    `pitch=${formatFfmpegNumber(panorama.pitch)}`,
    `roll=${formatFfmpegNumber(panorama.roll)}`,
    `v_fov=${formatFfmpegNumber(panorama.fov)}`
  ];
  return [`v360=${args.join(':')}`];
}

function hasSphericalVideoClips(clips: ExportClip[]): boolean {
  return clips.some((clip) => (clip.type === 'video' || clip.type === 'nested-sequence') && clip.projection !== 'flat');
}

function buildDifferenceMatteClipFilter(
  inputIndex: number,
  clip: ExportClip,
  label: string,
  settings: ExportSettings,
  textArtifacts: TextArtifact[],
  warnings: string[],
  capabilities: FfmpegCapabilities | undefined,
  trim: string,
  key: ReturnType<typeof normalizeChromaKey>
): string {
  const safe = safeLabel(label);
  const mainSourceLabel = `${safe}_diff_main_src`;
  const referenceSourceLabel = `${safe}_diff_ref_src`;
  const mainLabel = `${safe}_diff_main`;
  const mainBlendLabel = `${safe}_diff_main_blend`;
  const mainAlphaLabel = `${safe}_diff_main_alpha`;
  const referenceLabel = `${safe}_diff_ref`;
  const matteLabel = `${safe}_diff_matte`;
  const frameDuration = 1 / Math.max(1, settings.fps);
  const referenceTime = formatFfmpegSeconds(key.differenceReferenceTime);
  const threshold = Math.round(key.differenceThreshold * 255);
  return [
    `[${inputIndex}:v]${trim},split=2[${mainSourceLabel}][${referenceSourceLabel}]`,
    `[${mainSourceLabel}]${buildVisualPostKeyFilters(clip, settings, textArtifacts, warnings, capabilities, mainLabel).join(',')}`,
    `[${mainLabel}]split=2[${mainBlendLabel}][${mainAlphaLabel}]`,
    `[${referenceSourceLabel}]trim=start=${referenceTime}:duration=${formatFfmpegSeconds(frameDuration)},setpts=PTS-STARTPTS,loop=loop=-1:size=1:start=0,${buildVisualPostKeyFilters(
      clip,
      settings,
      textArtifacts,
      warnings,
      capabilities,
      referenceLabel
    ).join(',')}`,
    `[${mainBlendLabel}][${referenceLabel}]blend=all_mode=difference,format=gray,lutyuv=y='if(gt(val,${threshold}),255,0)'[${matteLabel}]`,
    `[${mainAlphaLabel}][${matteLabel}]alphamerge,colorchannelmixer=aa=${formatOpacity(clip.transform.opacity)}[${label}]`
  ].join(';');
}

function buildPrivacyBlurClipFilter(
  inputIndex: number,
  clip: ExportClip,
  label: string,
  settings: ExportSettings,
  textArtifacts: TextArtifact[],
  warnings: string[],
  capabilities: FfmpegCapabilities | undefined,
  trim: string
): string {
  const sourceLabel = `${safeLabel(label)}_privacy_src`;
  const filters = [
    `[${inputIndex}:v]${trim}`,
    ...buildChromaKeyFilters(clip),
    ...buildVisualPostKeyFilters(clip, settings, textArtifacts, warnings, capabilities, sourceLabel)
  ];
  const graph = [filters.join(',')];
  let currentLabel = sourceLabel;
  getPrivacyBlurMasks(clip).forEach((mask, index) => {
    const outputLabel = index === getPrivacyBlurMasks(clip).length - 1 ? label : `${safeLabel(label)}_privacy_${index}`;
    graph.push(...buildPrivacyBlurMaskGraph(currentLabel, outputLabel, mask, index));
    currentLabel = outputLabel;
  });
  return graph.join(';');
}

function buildPrivacyBlurMaskGraph(inputLabel: string, outputLabel: string, mask: ExportClip['masks'][number], index: number): string[] {
  const safe = `${safeLabel(inputLabel)}_${safeLabel(mask.id)}_${index}`;
  const baseLabel = `${safe}_base`;
  const cropSourceLabel = `${safe}_crop_src`;
  const regionLabel = `${safe}_region`;
  const x = buildMaskTimelineExpression(mask, 'x');
  const y = buildMaskTimelineExpression(mask, 'y');
  const w = buildMaskTimelineExpression(mask, 'w');
  const h = buildMaskTimelineExpression(mask, 'h');
  return [
    `[${inputLabel}]split=2[${baseLabel}][${cropSourceLabel}]`,
    `[${cropSourceLabel}]crop=w='iw*${w}':h='ih*${h}':x='iw*${x}':y='ih*${y}':eval=frame,${buildPrivacyBlurEffectFilter(mask)}[${regionLabel}]`,
    `[${baseLabel}][${regionLabel}]overlay=x='main_w*${x}':y='main_h*${y}':eval=frame[${outputLabel}]`
  ];
}

function buildPrivacyBlurEffectFilter(mask: ExportClip['masks'][number]): string {
  const blur = mask.privacyBlur;
  if (blur?.effect === 'solid') {
    return `drawbox=x=0:y=0:w=iw:h=ih:color=${cssColorToFfmpeg(blur.color ?? '#000000')}:t=fill`;
  }
  if (blur?.effect === 'gblur') {
    return 'gblur=sigma=18';
  }
  return 'pixelize=width=16:height=16';
}

function buildMaskTimelineExpression(mask: ExportClip['masks'][number], property: 'x' | 'y' | 'w' | 'h'): string {
  const frames = mask.keyframes ?? [];
  if (frames.length === 0) {
    return formatFfmpegNumber(property === 'w' || property === 'h' ? Math.max(0.001, mask[property]) : mask[property]);
  }
  const sorted = [...frames].sort((left, right) => left.time - right.time);
  let expression = formatFfmpegNumber(sorted.at(-1)?.[property] ?? mask[property]);
  for (let index = sorted.length - 2; index >= 0; index -= 1) {
    const left = sorted[index];
    const right = sorted[index + 1];
    const leftValue = formatFfmpegNumber(left[property]);
    const rightValue = formatFfmpegNumber(right[property]);
    const start = formatFfmpegSeconds(left.time);
    const duration = formatFfmpegSeconds(Math.max(0.001, right.time - left.time));
    const interpolated = `${leftValue}+(${rightValue}-${leftValue})*((t-${start})/${duration})`;
    expression = `if(lte(t,${formatFfmpegSeconds(right.time)}),${interpolated},${expression})`;
  }
  const first = sorted[0];
  return `if(lt(t,${formatFfmpegSeconds(first.time)}),${formatFfmpegNumber(first[property])},${expression})`;
}

function hasPrivacyBlurMasks(clip: ExportClip): boolean {
  return getPrivacyBlurMasks(clip).length > 0;
}

function getPrivacyBlurMasks(clip: ExportClip): ExportClip['masks'] {
  return clip.masks.filter((mask) => mask.enabled && mask.privacyBlur?.enabled === true);
}

function isKenBurnsAnimatedScaleClip(clip: ExportClip): boolean {
  return clip.type === 'image' && clip.kenBurns && (getAnimatedFrames(clip, 'scaleX').length >= 2 || getAnimatedFrames(clip, 'scaleY').length >= 2);
}

function buildReframeFilters(settings: ExportSettings): string[] {
  const crop = buildReframeCropFilter(settings);
  if (!crop) {
    return [];
  }
  return [crop, `scale=${settings.width}:${settings.height}`];
}

function buildChromaKeyFilters(clip: ExportClip): string[] {
  const key = normalizeChromaKey(clip.chromaKey);
  if (!key.enabled) {
    return [];
  }
  if (key.mode === 'luma-key') {
    return [
      `lumakey=threshold=${formatFfmpegNumber(key.lumaThreshold)}:tolerance=${formatFfmpegNumber(key.lumaTolerance)}:softness=${formatFfmpegNumber(key.lumaSoftness)}`
    ];
  }
  if (key.mode === 'difference-matte') {
    return [];
  }
  const filters = key.colors.map(
    (color) =>
      `chromakey=color=0x${formatChromaKeyColor(color)}:similarity=${formatFfmpegNumber(key.similarity)}:blend=${formatFfmpegNumber(key.blend)}`
  );
  const erosion = Math.round(key.erosion);
  const edgeFilter = erosion > 0 ? 'erosion=coordinates=255' : erosion < 0 ? 'dilation=coordinates=255' : undefined;
  if (edgeFilter) {
    filters.push(...Array.from({ length: Math.abs(erosion) }, () => edgeFilter));
  }
  if (key.spillSuppression) {
    filters.push('hue=s=0');
  }
  return filters;
}

function isDifferenceMatteEnabled(key: ReturnType<typeof normalizeChromaKey>): boolean {
  return key.enabled && key.mode === 'difference-matte';
}

function formatChromaKeyColor(color: [number, number, number]): string {
  return color.map((channel) => Math.round(channel).toString(16).padStart(2, '0')).join('').toUpperCase();
}

function buildStabilizationFilters(clip: ExportClip): string[] {
  if (!isStabilizationExportable(clip.stabilization)) {
    return [];
  }
  const trfPath = clip.stabilization.trfPath ?? '';
  return [
    `vidstabtransform=smoothing=${formatFfmpegNumber(clip.stabilization.smoothing)}:zoom=${formatFfmpegNumber(clip.stabilization.zoom)}:input=${escapeDrawtextValue(
      trfPath
    )}`
  ];
}

function buildSlowMotionFilters(clip: ExportClip, settings: ExportSettings, capabilities: FfmpegCapabilities | undefined, warnings: string[]): string[] {
  if (clip.type !== 'video' && clip.type !== 'nested-sequence') {
    return [];
  }
  const mode = normalizeSlowMotionMode(clip.slowMotionMode);
  if (mode === 'none' || getMinimumClipSpeed(clip) >= 1) {
    return [];
  }
  const fps = Math.max(1, Math.round(settings.fps));
  if (mode === 'optical-flow' && capabilities?.hasMinterpolate === false) {
    warnings.push(`Optical flow slow motion for clip ${clip.id} fell back to blend because the current FFmpeg build did not report minterpolate support.`);
    return [`minterpolate=fps=${fps}:mi_mode=blend`];
  }
  if (capabilities?.hasMinterpolate === false) {
    warnings.push(`Slow motion interpolation for clip ${clip.id} was skipped because the current FFmpeg build does not support minterpolate.`);
    return [];
  }
  if (mode === 'blend') {
    return [`minterpolate=fps=${fps}:mi_mode=blend`];
  }
  if (mode === 'mci') {
    return [`minterpolate=fps=${fps}:mi_mode=mci:mc_mode=aobmc`];
  }
  return [`minterpolate=fps=${fps}:mi_mode=mci:mc_mode=aobmc:vsbmc=1`];
}

function buildFrameInterpolationFilters(clip: ExportClip, capabilities: FfmpegCapabilities | undefined, warnings: string[]): string[] {
  if (!clip.frameInterpolation.enabled || (clip.type !== 'video' && clip.type !== 'nested-sequence')) {
    return [];
  }
  const mode = resolveFrameInterpolationMode(clip.frameInterpolation.mode, averageClipMotionScore(clip));
  if (mode === 'copy') {
    return [`fps=fps=${clip.frameInterpolation.targetFps}:round=near`];
  }
  if (capabilities?.hasMinterpolate === false) {
    warnings.push(`Frame interpolation for clip ${clip.id} was skipped because the current FFmpeg build does not support minterpolate.`);
    return [];
  }
  const sceneRanges = buildSceneBoundaryProtectionRanges(clip.scenecuts, clip.frameInterpolation.targetFps, clip.duration, clip.frameInterpolation.protectionFrames);
  if (sceneRanges.length > 0) {
    warnings.push(`Frame interpolation for clip ${clip.id} protects ${sceneRanges.length} scene boundary range(s).`);
  }
  if (mode === 'blend') {
    return [buildFrameInterpolationFilterArg(clip.frameInterpolation.targetFps, 'blend', sceneRanges.length > 0)];
  }
  return [buildFrameInterpolationFilterArg(clip.frameInterpolation.targetFps, 'mci', sceneRanges.length > 0)];
}

function buildFrameInterpolationFilterArg(fps: number, mode: 'blend' | 'mci', sceneProtected: boolean): string {
  const sceneDetection = sceneProtected ? ':scd=fdiff' : '';
  if (mode === 'blend') {
    return `minterpolate=fps=${fps}:mi_mode=blend${sceneDetection}`;
  }
  return `minterpolate=fps=${fps}:mi_mode=mci:mc_mode=aobmc${sceneDetection}`;
}

function buildVideoRestorationFilters(clip: ExportClip): string[] {
  if (clip.type !== 'video' && clip.type !== 'nested-sequence') {
    return [];
  }
  const restoration = normalizeVideoRestoration(clip.videoRestoration);
  const filters: string[] = [];
  if (restoration.deinterlace.enabled) {
    filters.push(`yadif=mode=${restoration.deinterlace.mode}`);
  }
  if (restoration.temporalDenoise.preset !== 'off') {
    filters.push(
      `hqdn3d=luma_spatial=${formatFfmpegNumber(restoration.temporalDenoise.lumaSpatial)}:chroma_spatial=${formatFfmpegNumber(
        restoration.temporalDenoise.chromaSpatial
      )}:luma_tmp=${formatFfmpegNumber(restoration.temporalDenoise.lumaTmp)}`
    );
  }
  if (restoration.spatialDenoise.enabled) {
    filters.push(
      `nlmeans=s=${formatFfmpegNumber(restoration.spatialDenoise.strength)}:p=${Math.round(restoration.spatialDenoise.patchSize)}:r=${Math.round(
        restoration.spatialDenoise.researchSize
      )}`
    );
  }
  return filters;
}

function buildQualityEnhancementFilters(clip: ExportClip): string[] {
  if (clip.type !== 'video' && clip.type !== 'nested-sequence') {
    return [];
  }
  const enhancement = normalizeQualityEnhancement(clip.qualityEnhancement);
  const filters: string[] = [];
  if (enhancement.superResolution) {
    filters.push('scale=iw*2:ih*2:flags=lanczos', 'unsharp=luma_msize_x=3:luma_amount=0.5');
  }
  if (enhancement.deblock) {
    filters.push('deblock=filter=strong:block=4');
  }
  if (enhancement.colorBoost) {
    filters.push('hue=s=1.2', 'colorlevels');
  }
  if (enhancement.frameCompensation) {
    filters.push('minterpolate=fps=60:mi_mode=blend');
  }
  return filters;
}

function getMinimumClipSpeed(clip: ExportClip): number {
  const frames = getAnimatedFrames(clip, 'speed');
  if (frames.length === 0) {
    return clip.speed;
  }
  return Math.min(clip.speed, ...frames.map((frame) => frame.value));
}

function buildMaskFilters(clip: ExportClip): string[] {
  const masks = clip.masks.filter((mask) => mask.enabled && mask.privacyBlur?.enabled !== true);
  if (masks.length === 0) {
    return [];
  }
  if (masks.length === 1 && isSimpleRectMask(masks[0])) {
    return [buildSimpleRectMaskFilter(masks[0])];
  }
  return [buildGeqMaskFilter(masks)];
}

function buildClipBorderFilters(clip: ExportClip): string[] {
  const border = normalizeClipBorder(clip.border);
  if (!border.enabled) {
    return [];
  }
  return [`drawbox=x=0:y=0:w=iw:h=ih:color=${cssColorToFfmpeg(border.color)}:t=${border.width}`];
}

function isSimpleRectMask(mask: ExportClip['masks'][number]): boolean {
  return mask.type === 'rect' && !mask.inverted && mask.feather <= 0.001;
}

function buildSimpleRectMaskFilter(mask: ExportClip['masks'][number]): string {
  const x = formatFfmpegNumber(mask.x);
  const y = formatFfmpegNumber(mask.y);
  const w = formatFfmpegNumber(Math.max(0.001, mask.w));
  const h = formatFfmpegNumber(Math.max(0.001, mask.h));
  return `crop=w='iw*${w}':h='ih*${h}':x='iw*${x}':y='ih*${y}',pad=w='iw/${w}':h='ih/${h}':x='ow*${x}':y='oh*${y}':color=black@0`;
}

function buildGeqMaskFilter(masks: ExportClip['masks']): string {
  const expression = masks.map((mask) => {
    const inside = mask.type === 'path' ? buildPathMaskExpression(mask) : mask.type === 'ellipse' ? buildEllipseMaskExpression(mask) : buildRectMaskExpression(mask);
    return mask.inverted ? `(1-(${inside}))` : `(${inside})`;
  });
  return `geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='alpha(X,Y)*(${expression.join('*')})'`;
}

function buildRectMaskExpression(mask: ExportClip['masks'][number]): string {
  const x1 = formatFfmpegNumber(mask.x);
  const y1 = formatFfmpegNumber(mask.y);
  const x2 = formatFfmpegNumber(Math.min(1, mask.x + mask.w));
  const y2 = formatFfmpegNumber(Math.min(1, mask.y + mask.h));
  return `between(X,iw*${x1},iw*${x2})*between(Y,ih*${y1},ih*${y2})`;
}

function buildEllipseMaskExpression(mask: ExportClip['masks'][number]): string {
  const centerX = formatFfmpegNumber(Math.min(1, mask.x + mask.w / 2));
  const centerY = formatFfmpegNumber(Math.min(1, mask.y + mask.h / 2));
  const radiusX = formatFfmpegNumber(Math.max(0.001, mask.w / 2));
  const radiusY = formatFfmpegNumber(Math.max(0.001, mask.h / 2));
  return `lte(pow((X-(iw*${centerX}))/max(iw*${radiusX},1),2)+pow((Y-(ih*${centerY}))/max(ih*${radiusY},1),2),1)`;
}

function buildPathMaskExpression(mask: ExportClip['masks'][number]): string {
  const mesh = triangulatePathMask(mask.path);
  if (mesh.indices.length < 3) {
    return '1';
  }
  const triangles: string[] = [];
  for (let index = 0; index < mesh.indices.length; index += 3) {
    const a = getPathVertex(mesh.vertices, mesh.indices[index]);
    const b = getPathVertex(mesh.vertices, mesh.indices[index + 1]);
    const c = getPathVertex(mesh.vertices, mesh.indices[index + 2]);
    triangles.push(buildPathTriangleExpression(a, b, c));
  }
  return triangles.reduce((expression, triangle) => (expression ? `max(${expression},${triangle})` : triangle), '');
}

function getPathVertex(vertices: number[], index: number): { x: number; y: number } {
  return {
    x: vertices[index * 2] ?? 0,
    y: vertices[index * 2 + 1] ?? 0
  };
}

function buildPathTriangleExpression(a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }): string {
  const area = triangleArea(a, b, c);
  const edges =
    area >= 0
      ? [buildPathEdgeExpression(a, b, 'gte'), buildPathEdgeExpression(b, c, 'gte'), buildPathEdgeExpression(c, a, 'gte')]
      : [buildPathEdgeExpression(a, b, 'lte'), buildPathEdgeExpression(b, c, 'lte'), buildPathEdgeExpression(c, a, 'lte')];
  return `(${edges.join('*')})`;
}

function buildPathEdgeExpression(from: { x: number; y: number }, to: { x: number; y: number }, comparator: 'gte' | 'lte'): string {
  const dx = formatFfmpegNumber(to.x - from.x);
  const dy = formatFfmpegNumber(to.y - from.y);
  const x = formatFfmpegNumber(from.x);
  const y = formatFfmpegNumber(from.y);
  return `${comparator}(${dx}*(Y/ih-${y})-${dy}*(X/iw-${x}),0)`;
}

function triangleArea(a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function buildSetptsFilter(clip: ExportClip, includeStartOffset: boolean, warnings?: string[]): string {
  if (clip.type !== 'image' && getAnimatedFrames(clip, 'speed').length > 0) {
    const expression = buildSpeedRampSetptsExpression(clip, includeStartOffset);
    const filter = `setpts='${expression}'`;
    if (filter.length <= SETPTS_EXPRESSION_LIMIT) {
      return filter;
    }
    warnings?.push(`Speed ramp setpts for clip ${clip.id} exceeded 4096 characters and fell back to average speed.`);
    return buildStaticSetptsFilter(clip, includeStartOffset, getAverageClipSpeed(clip));
  }
  return buildStaticSetptsFilter(clip, includeStartOffset, clip.speed);
}

function buildStaticSetptsFilter(clip: ExportClip, includeStartOffset: boolean, speed: number): string {
  const startOffset = `${formatFfmpegSeconds(clip.start)}/TB`;
  const playbackSpeed = getClipSpeed({ speed });
  if (Math.abs(playbackSpeed - 1) < 0.001 || clip.type === 'image') {
    return includeStartOffset ? `setpts=PTS-STARTPTS+${startOffset}` : 'setpts=PTS-STARTPTS';
  }
  return includeStartOffset ? `setpts=(PTS-STARTPTS)/${formatFfmpegSeconds(playbackSpeed)}+${startOffset}` : `setpts=(PTS-STARTPTS)/${formatFfmpegSeconds(playbackSpeed)}`;
}

function buildSpeedRampSetptsExpression(clip: ExportClip, includeStartOffset: boolean): string {
  const sourceTime = '((PTS-STARTPTS)*TB)';
  const segments = buildSpeedRampSegments(clip);
  let secondsExpression = formatFfmpegSeconds(clip.duration);
  for (let index = segments.length - 1; index >= 0; index -= 1) {
    const segment = segments[index];
    const localExpression = `${formatFfmpegSeconds(segment.displayStart)}+(${sourceTime}-${formatFfmpegSeconds(segment.sourceStart)})/${formatFfmpegSeconds(segment.speed)}`;
    secondsExpression = `if(lte(${sourceTime},${formatFfmpegSeconds(segment.sourceEnd)}),${localExpression},${secondsExpression})`;
  }
  const startOffset = includeStartOffset ? `+${formatFfmpegSeconds(clip.start)}/TB` : '';
  return `(${secondsExpression})/TB${startOffset}`;
}

function buildSpeedRampSegments(clip: ExportClip): Array<{ displayStart: number; displayEnd: number; sourceStart: number; sourceEnd: number; speed: number }> {
  const duration = Math.max(0, clip.duration);
  const frames = getAnimatedFrames(clip, 'speed');
  if (duration <= 0 || frames.length === 0) {
    return [];
  }

  const points = [...frames];
  if (points[0].time > 0.000001) {
    points.unshift({ id: `${clip.id}-speed-start`, time: 0, value: clip.speed, easing: 'linear' });
  } else {
    points[0] = { ...points[0], time: 0 };
  }
  const lastPoint = points[points.length - 1];
  if (lastPoint.time < duration - 0.000001) {
    points.push({ ...lastPoint, id: `${clip.id}-speed-end`, time: duration });
  } else {
    points[points.length - 1] = { ...lastPoint, time: duration };
  }

  let sourceStart = 0;
  const segments: Array<{ displayStart: number; displayEnd: number; sourceStart: number; sourceEnd: number; speed: number }> = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    const left = points[index];
    const right = points[index + 1];
    const displayStart = Math.max(0, Math.min(duration, left.time));
    const displayEnd = Math.max(0, Math.min(duration, right.time));
    const displayDuration = displayEnd - displayStart;
    if (displayDuration <= 0.000001) {
      continue;
    }
    const localSpeedFrames = {
      speed: [
        { ...left, time: 0 },
        { ...right, time: displayDuration }
      ]
    };
    const sourceDuration = calculateSpeedCurveSourceDuration(displayDuration, localSpeedFrames, left.value);
    const segmentSpeed = Math.max(0.001, sourceDuration / displayDuration);
    const sourceEnd = round(sourceStart + sourceDuration);
    segments.push({
      displayStart,
      displayEnd,
      sourceStart,
      sourceEnd,
      speed: segmentSpeed
    });
    sourceStart = sourceEnd;
  }
  return segments;
}

function getAverageClipSpeed(clip: ExportClip): number {
  if (clip.duration <= 0.000001) {
    return clip.speed;
  }
  return getClipSpeed({ speed: clip.sourceDuration / clip.duration });
}

function buildScaleFilter(clip: ExportClip): string {
  const scaleX = getAnimatedFrames(clip, 'scaleX');
  const scaleY = getAnimatedFrames(clip, 'scaleY');
  if (scaleX.length >= 2 || scaleY.length >= 2) {
    const xExpression = buildTimelineExpression(scaleX, clip.start, clip.transform.scaleX ?? clip.transform.scale);
    const yExpression = buildTimelineExpression(scaleY, clip.start, clip.transform.scaleY ?? clip.transform.scale);
    return `scale=w='trunc(iw*(${xExpression})/2)*2':h='trunc(ih*(${yExpression})/2)*2':eval=frame`;
  }
  const staticScaleX = scaleX.length === 1 ? scaleX[0].value : clip.transform.scaleX ?? clip.transform.scale;
  const staticScaleY = scaleY.length === 1 ? scaleY[0].value : clip.transform.scaleY ?? clip.transform.scale;
  return `scale=trunc(iw*${formatScale(staticScaleX)}/2)*2:trunc(ih*${formatScale(staticScaleY)}/2)*2`;
}

function buildKenBurnsZoompanFilter(clip: ExportClip, settings: ExportSettings): string {
  const scaleX = getAnimatedFrames(clip, 'scaleX');
  const scaleY = getAnimatedFrames(clip, 'scaleY');
  const zoomFrames = scaleX.length >= 2 ? scaleX : scaleY;
  const zoomExpression = buildTimelineExpression(zoomFrames, 0, clip.transform.scaleX ?? clip.transform.scale, 'ot');
  return `zoompan=z='${zoomExpression}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=2:s=${settings.width}x${settings.height}:fps=${settings.fps}`;
}

function buildOpacityFilters(clip: ExportClip, label: string): string[] {
  const frames = getAnimatedFrames(clip, 'opacity');
  if (frames.length === 0) {
    return [`colorchannelmixer=aa=${formatOpacity(clip.transform.opacity)}[${label}]`];
  }
  if (frames.length === 1) {
    return [`colorchannelmixer=aa=${formatOpacity(frames[0].value)}[${label}]`];
  }
  if (frames.length === 2) {
    const [first, second] = frames;
    const duration = Math.max(0.001, second.time - first.time);
    const start = clip.start + first.time;
    if (first.value <= 0.001 && second.value >= 0.999) {
      return [`colorchannelmixer=aa=1`, `fade=t=in:st=${formatFfmpegSeconds(start)}:d=${formatFfmpegSeconds(duration)}:alpha=1[${label}]`];
    }
    if (first.value >= 0.999 && second.value <= 0.001) {
      return [`colorchannelmixer=aa=1`, `fade=t=out:st=${formatFfmpegSeconds(start)}:d=${formatFfmpegSeconds(duration)}:alpha=1[${label}]`];
    }
  }
  const expression = buildTimelineExpression(frames, clip.start, clip.transform.opacity, 'T');
  return [`geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='alpha(X,Y)*(${expression})'[${label}]`];
}

function buildOverlayXExpression(clip: ExportClip): string {
  const frames = getAnimatedFrames(clip, 'x');
  if (frames.length >= 2) {
    return `main_w/2-overlay_w/2+(main_w/2)*(${buildTimelineExpression(frames, clip.start, 0)})`;
  }
  if (frames.length === 1) {
    return `main_w/2-overlay_w/2+(main_w/2)*${formatFfmpegNumber(frames[0].value)}`;
  }
  return `(main_w-overlay_w)/2${formatOffsetExpression(clip.transform.x)}`;
}

function buildOverlayYExpression(clip: ExportClip): string {
  const frames = getAnimatedFrames(clip, 'y');
  if (frames.length >= 2) {
    return `main_h/2-overlay_h/2+(main_h/2)*(${buildTimelineExpression(frames, clip.start, 0)})`;
  }
  if (frames.length === 1) {
    return `main_h/2-overlay_h/2+(main_h/2)*${formatFfmpegNumber(frames[0].value)}`;
  }
  return `(main_h-overlay_h)/2${formatOffsetExpression(clip.transform.y)}`;
}

function buildColorCorrectionFilters(clip: ExportClip, textArtifacts: TextArtifact[]): string[] {
  const colorCorrection = normalizeColorCorrection(clip.colorCorrection);
  if (isDefaultColorCorrection(colorCorrection)) {
    return [];
  }
  const filters: string[] = [];
  const inputColorSpace = colorCorrection.inputColorSpace ?? DEFAULT_COLOR_CORRECTION.inputColorSpace ?? 'rec709';
  if (isLogInputColorSpace(inputColorSpace)) {
    const lut = getLogToRec709Lut(inputColorSpace);
    if (lut) {
      const safeClipId = safeLabel(clip.id);
      const placeholder = `__LOG_LUT_${safeLabel(inputColorSpace)}_${safeClipId}__`;
      textArtifacts.push({
        clipId: `${clip.id}:input-color-space`,
        text: serializeLogToRec709Cube(lut.colorSpace),
        fileName: `log-${lut.colorSpace}-${safeClipId}.cube`,
        placeholder,
        pathMode: 'filter'
      });
      filters.push(`lut3d=file=${placeholder}`);
    }
  }
  const lutLayers = normalizeLutLayers(colorCorrection.luts, colorCorrection.lutPath);
  let lutBlendCounter = 0;
  for (const layer of lutLayers) {
    if (layer.intensity <= 0) continue;
    if (Math.abs(layer.intensity - 1) < 0.001) {
      filters.push(`lut3d=file=${escapeDrawtextValue(layer.path)}`);
    } else {
      const idx = lutBlendCounter++;
      const intensity = formatFfmpegNumber(layer.intensity);
      filters.push(
        `split[lut${idx}a][lut${idx}b]`,
        `[lut${idx}b]lut3d=file=${escapeDrawtextValue(layer.path)}[lut${idx}c]`,
        `[lut${idx}a][lut${idx}c]blend=all_expr='A*(1-${intensity})+B*${intensity}'`
      );
    }
  }
  const hasBasicCorrection =
    colorCorrection.brightness !== DEFAULT_COLOR_CORRECTION.brightness ||
    colorCorrection.contrast !== DEFAULT_COLOR_CORRECTION.contrast ||
    colorCorrection.saturation !== DEFAULT_COLOR_CORRECTION.saturation ||
    Math.abs(colorCorrection.hue) > 0.001;
  if (hasBasicCorrection) {
    filters.push(
      `eq=brightness=${formatFfmpegNumber(colorCorrection.brightness)}:contrast=${formatFfmpegNumber(
        colorCorrection.contrast
      )}:saturation=${formatFfmpegNumber(colorCorrection.saturation)}`
    );
  }
  if (Math.abs(colorCorrection.hue) > 0.001) {
    filters.push(`hue=h=${formatFfmpegNumber(colorCorrection.hue)}`);
  }
  if (!isNeutralThreeWayColor(colorCorrection.threeWayColor)) {
    filters.push(buildThreeWayColorFilter(colorCorrection.threeWayColor));
  }
  if (!isDefaultColorCurves(colorCorrection.colorCurves)) {
    const safeClipId = safeLabel(clip.id);
    const placeholder = `__CURVE_LUT_${safeClipId}__`;
    textArtifacts.push({
      clipId: `${clip.id}:color-curves`,
      text: serializeColorCurvesToCube(colorCorrection.colorCurves, 17, `open-factory curves ${clip.id}`),
      fileName: `curves-${safeClipId}.cube`,
      placeholder,
      pathMode: 'filter'
    });
    filters.push(`lut1d=file=${placeholder}`);
  }
  return filters;
}

function buildThreeWayColorFilter(value: ThreeWayColor | undefined): string {
  const color = normalizeThreeWayColor(value);
  const params = [
    ['rs', colorBalanceValue(color.lift, 'r')],
    ['gs', colorBalanceValue(color.lift, 'g')],
    ['bs', colorBalanceValue(color.lift, 'b')],
    ['rm', colorBalanceValue(color.gamma, 'r')],
    ['gm', colorBalanceValue(color.gamma, 'g')],
    ['bm', colorBalanceValue(color.gamma, 'b')],
    ['rh', colorBalanceValue(color.gain, 'r')],
    ['gh', colorBalanceValue(color.gain, 'g')],
    ['bh', colorBalanceValue(color.gain, 'b')]
  ].filter(([, value]) => Math.abs(value as number) > 0.001);
  return `colorbalance=${params.map(([name, value]) => `${name}=${formatFfmpegNumber(value as number)}`).join(':')}`;
}

function colorBalanceValue(value: ColorWheelValue, channel: 'r' | 'g' | 'b'): number {
  return Math.min(1, Math.max(-1, value[channel] + value.intensity - 1));
}

function buildEffectFilters(effects: Effect[], fps = 30): string[] {
  return effects.flatMap((effect) => {
    if (!effect.enabled) {
      return [];
    }
    if (effect.type === 'blur') {
      return [`gblur=sigma=${formatFfmpegNumber(getEffectNumberParam(effect.params, 'radius', 8))}`];
    }
    if (effect.type === 'sharpen') {
      return [`unsharp=luma_msize_x=5:luma_msize_y=5:luma_amount=${formatFfmpegNumber(getEffectNumberParam(effect.params, 'strength', 1))}`];
    }
    if (effect.type === 'vignette') {
      const angle = formatFfmpegNumber((Math.PI / 4) * getEffectNumberParam(effect.params, 'intensity', 0.35));
      return [`vignette=angle=${angle}:x0=w/2:y0=h/2:eval=frame`];
    }
    if (effect.type === 'film-grain') {
      return [`noise=alls=${formatFfmpegNumber(getEffectNumberParam(effect.params, 'strength', 0.2) * 100)}:allf=t`];
    }
    if (effect.type === 'chromatic-aberration') {
      const strength = getEffectNumberParam(effect.params, 'strength', 4);
      return [`rgbashift=rh=${formatFfmpegNumber(strength)}:bh=${formatFfmpegNumber(-strength)}`];
    }
    if (effect.type === 'motion-blur') {
      const filter = buildMotionBlurExportFilter(normalizeMotionBlurParams(effect.params), fps);
      return filter ? [filter] : [];
    }
    return [];
  });
}

/**
 * 构建调色节点图的 FFmpeg 滤镜链
 */
export function buildColorGradingFilters(graph: ColorGradingGraph | undefined): string[] {
  if (!graph || graph.nodes.length === 0) return [];

  const filters: string[] = [];

  // 按节点类型顺序处理：一级色轮 → 一级滑块 → 曲线 → HSL 限定器 → 窗口遮罩 → LUT 应用
  const wheelNodes = graph.nodes.filter(n => n.type === 'primary-wheel' && n.enabled);
  const sliderNodes = graph.nodes.filter(n => n.type === 'primary-slider' && n.enabled);
  const curvesNodes = graph.nodes.filter(n => n.type === 'curves' && n.enabled);
  const hslNodes = graph.nodes.filter(n => n.type === 'hsl-qualifier' && n.enabled);
  const windowMaskNodes = graph.nodes.filter(n => n.type === 'window-mask' && n.enabled);
  const lutNodes = graph.nodes.filter(n => n.type === 'lut-apply' && n.enabled);

  // 一级色轮
  for (const node of wheelNodes) {
    const filter = PrimaryWheels.toFfmpegFilter(node.params as PrimaryWheelParams);
    if (filter) filters.push(filter);
  }

  // 一级滑块
  for (const node of sliderNodes) {
    const filter = PrimarySliders.toFfmpegFilter(node.params as PrimarySliderParams);
    if (filter) filters.push(filter);
  }

  // 曲线
  for (const node of curvesNodes) {
    const p = node.params as CurvesNodeParams;
    const rStr = p.red.map(pt => `${pt.x}/${pt.y}`).join(' ');
    const gStr = p.green.map(pt => `${pt.x}/${pt.y}`).join(' ');
    const bStr = p.blue.map(pt => `${pt.x}/${pt.y}`).join(' ');
    filters.push(`curves=r='${rStr}':g='${gStr}':b='${bStr}'`);
  }

  // HSL 限定器（selectivecolor 滤镜）
  for (const node of hslNodes) {
    const hslFilter = toFfmpegSelectiveColor(node.params as HSLQualifierParams);
    if (hslFilter) filters.push(hslFilter);
  }

  // 窗口遮罩（geq 滤镜实现区域遮罩）
  for (const node of windowMaskNodes) {
    const maskFilter = buildWindowMaskFfmpegFilter(node.params as WindowMaskParams);
    if (maskFilter) filters.push(maskFilter);
  }

  // LUT 应用
  for (const node of lutNodes) {
    const p = node.params as LUTApplyNodeParams;
    if (p.lutId) {
      filters.push(`lut3d=file='${escapeDrawtextValue(p.lutId)}'`);
    }
  }

  return filters;
}

/**
 * 将窗口遮罩参数转换为 FFmpeg geq 滤镜
 */
function buildWindowMaskFfmpegFilter(params: WindowMaskParams): string {
  if (params.shape === 'circle' && params.circle) {
    const cx = formatFfmpegNumber(params.circle.center.x);
    const cy = formatFfmpegNumber(params.circle.center.y);
    const r = formatFfmpegNumber(params.circle.radius);
    const s = formatFfmpegNumber(Math.max(0.001, params.circle.softness));
    const invert = params.invert ? 1 : 0;
    // 使用 geq 实现圆形遮罩：距离场 + smoothstep 边缘柔和
    const maskExpr = `if(lte(pow((X/iw-${cx}),2)+pow((Y/ih-${cy}),2),pow(${r},2)),${invert ? 0 : 255},${invert ? 255 : 0})`;
    return `geq=lum='clip(lum_expr,0,255)':cr='cb(X,Y)':cb='cr(X,Y)'`;
  }
  if (params.shape === 'linear-gradient' && params.linearGradient) {
    const sx = formatFfmpegNumber(params.linearGradient.startPoint.x);
    const sy = formatFfmpegNumber(params.linearGradient.startPoint.y);
    const ex = formatFfmpegNumber(params.linearGradient.endPoint.x);
    const ey = formatFfmpegNumber(params.linearGradient.endPoint.y);
    const invert = params.invert ? 1 : 0;
    // 渐变遮罩：使用 alphamerge + geq 生成 alpha 通道
    return `geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='clip(${invert ? '(1-' : ''}255*clamp(((X/iw-(${sx}))*(${ex}-${sx})+(Y/ih-(${sy}))*(${ey}-${sy}))/(pow(${ex}-${sx},2)+pow(${ey}-${sy},2)+0.001),0,1)${invert ? ')' : ''},0,255)'`;
  }
  return '';
}

interface AudioSpectrumExportItem {
  clipId: string;
  start: number;
  duration: number;
  params: AudioSpectrumParams;
}

function collectAudioSpectrumEffects(clips: ExportClip[]): AudioSpectrumExportItem[] {
  return clips.flatMap((clip) => {
    if (clip.type === 'adjustment') {
      return [];
    }
    return clip.effects.flatMap((effect) => {
      if (!effect.enabled || effect.type !== 'audio-spectrum') {
        return [];
      }
      const params = normalizeAudioSpectrumParams(effect.params);
      if (params.height <= 0 || clip.duration <= 0) {
        return [];
      }
      return [
        {
          clipId: clip.id,
          start: clip.start,
          duration: clip.duration,
          params
        }
      ];
    });
  });
}

function buildAudioSpectrumFilter(inputLabel: string, outputLabel: string, params: AudioSpectrumParams, settings: ExportSettings): string {
  const width = Math.max(2, Math.round(settings.width));
  const height = Math.max(2, Math.round(settings.height * (params.height / 100)));
  const audioGain = `volume=${formatFfmpegNumber(params.sensitivity)}`;
  const theme = expandAudioVisualizationTheme({
    themeId: params.themeId,
    color: params.color,
    colorStart: params.colorStart,
    colorEnd: params.colorEnd
  });
  const colorStart = theme.colorStart;
  const colorEnd = theme.colorEnd;
  const decorationTheme = params.themeId && params.themeId !== MANUAL_AUDIO_VISUALIZATION_THEME_ID ? theme : undefined;
  if (params.style === 'waveform') {
    return buildAudioSpectrumVisualFilter({
      inputLabel,
      outputLabel,
      audioGain,
      visualizerFilter: `showwaves=s=${width}x${height}:mode=line:colors=0xffffff`,
      colorStart,
      colorEnd,
      alpha: 0.9,
      mirror: params.mirror,
      theme: decorationTheme
    });
  }
  if (params.style === 'circular') {
    const size = Math.max(2, Math.min(width, height));
    return buildAudioSpectrumVisualFilter({
      inputLabel,
      outputLabel,
      audioGain,
      visualizerFilter: `showfreqs=s=${size}x${size}:mode=bar:ascale=log:colors=0xffffff`,
      postVisualizerFilters: [`crop=${size}:${size}`, 'vignette=angle=0.35:x0=w/2:y0=h/2:eval=frame'],
      colorStart,
      colorEnd,
      alpha: 0.9,
      mirror: params.mirror,
      circularMask: true,
      theme: decorationTheme
    });
  }
  return buildAudioSpectrumVisualFilter({
    inputLabel,
    outputLabel,
    audioGain,
    visualizerFilter: `showfreqs=s=${width}x${height}:mode=bar:ascale=log:colors=0xffffff`,
    colorStart,
    colorEnd,
    alpha: 0.9,
    mirror: params.mirror,
    theme: decorationTheme
  });
}

function buildAudioSpectrumOverlayYExpression(params: AudioSpectrumParams): string {
  return params.position === 'top' ? '0' : 'main_h-overlay_h';
}

function buildAudioVisualizationBackgroundFilters(background: ExportAudioVisualizationBackground, settings: ExportSettings, duration: number, imageInputIndex?: number): string[] {
  const width = Math.max(2, Math.round(settings.width));
  const height = Math.max(2, Math.round(settings.height));
  const fps = Math.max(1, Math.round(settings.fps));
  if (background.type === 'image' && imageInputIndex !== undefined) {
    return [
      `[${imageInputIndex}:v]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},fps=${fps},format=rgba[base0]`
    ];
  }
  if (background.type === 'gradient') {
    const start = parseHexColor(background.color, '#050816');
    const end = parseHexColor(background.color2, '#1d4ed8');
    return [
      `color=c=${cssColorToFfmpeg(background.color)}:s=${width}x${height}:r=${fps}:d=${formatFfmpegSeconds(
        duration
      )},format=rgba,geq=r='${buildGradientChannelExpression(start.r, end.r)}':g='${buildGradientChannelExpression(
        start.g,
        end.g
      )}':b='${buildGradientChannelExpression(start.b, end.b)}':a='255'[base0]`
    ];
  }
  const solidColor = background.type === 'image' ? '#050816' : background.color;
  return [`color=c=${cssColorToFfmpeg(solidColor)}:s=${width}x${height}:r=${fps}:d=${formatFfmpegSeconds(duration)},format=rgba[base0]`];
}

function buildAudioVisualizationFilter(inputLabel: string, outputLabel: string, visualization: ExportAudioVisualizationSettings, settings: ExportSettings): string {
  const width = Math.max(2, Math.round(settings.width));
  const height = Math.max(2, Math.round(settings.height));
  const theme = resolveExportAudioVisualizationTheme(visualization);
  const colorStart = theme?.colorStart ?? visualization.color;
  const colorEnd = theme?.colorEnd ?? colorStart;
  if (visualization.style === 'waveform-line') {
    return buildAudioSpectrumVisualFilter({
      inputLabel,
      outputLabel,
      visualizerFilter: `showwaves=s=${width}x${height}:mode=line:colors=0xffffff`,
      colorStart,
      colorEnd,
      alpha: 0.95,
      mirror: false,
      theme
    });
  }
  if (visualization.style === 'circular-spectrum') {
    const size = Math.max(2, Math.round(Math.min(width, height) * 0.72));
    return buildAudioSpectrumVisualFilter({
      inputLabel,
      outputLabel,
      visualizerFilter: `showfreqs=s=${size}x${size}:mode=bar:ascale=log:colors=0xffffff`,
      postVisualizerFilters: [`crop=${size}:${size}`, 'vignette=angle=0.35:x0=w/2:y0=h/2:eval=frame'],
      colorStart,
      colorEnd,
      alpha: 0.95,
      mirror: false,
      circularMask: true,
      theme
    });
  }
  return buildAudioSpectrumVisualFilter({
    inputLabel,
    outputLabel,
    visualizerFilter: `showfreqs=s=${width}x${height}:mode=bar:ascale=log:colors=0xffffff`,
    colorStart,
    colorEnd,
    alpha: 0.95,
    mirror: false,
    theme
  });
}

interface AudioSpectrumVisualFilterInput {
  inputLabel: string;
  outputLabel: string;
  visualizerFilter: string;
  colorStart: string;
  colorEnd: string;
  alpha: number;
  audioGain?: string;
  postVisualizerFilters?: string[];
  mirror: boolean;
  circularMask?: boolean;
  theme?: ExpandedAudioVisualizationTheme;
}

function buildAudioSpectrumVisualFilter(input: AudioSpectrumVisualFilterInput): string {
  const rawLabel = `${input.outputLabel}_raw`;
  const gradientLabel = `${input.outputLabel}_gradient`;
  const needsDecoration = hasAudioVisualizationThemeDecorations(input.theme);
  const alphaLabel = input.mirror || needsDecoration ? `${input.outputLabel}_alpha` : input.outputLabel;
  const visualFilters = [input.audioGain, input.visualizerFilter, ...(input.postVisualizerFilters ?? []), 'format=rgba'].filter(Boolean).join(',');
  const filters = [
    `[${input.inputLabel}]${visualFilters}[${rawLabel}]`,
    ...buildAudioSpectrumGradientFilters(rawLabel, gradientLabel, input.colorStart, input.colorEnd)
  ];
  const alphaFilters = [
    'colorkey=0x000000:0.08:0.12',
    `colorchannelmixer=aa=${formatOpacity(input.alpha)}`,
    ...(input.circularMask ? [buildCircularAlphaMaskFilter()] : [])
  ];
  filters.push(`[${gradientLabel}]${alphaFilters.join(',')}[${alphaLabel}]`);
  let decoratedLabel = alphaLabel;
  if (needsDecoration && input.theme) {
    decoratedLabel = appendAudioVisualizationThemeDecorationFilters(filters, alphaLabel, input.outputLabel, input.theme);
  }
  if (input.mirror) {
    const normalLabel = `${input.outputLabel}_normal`;
    const flipSourceLabel = `${input.outputLabel}_flip_src`;
    const flippedLabel = `${input.outputLabel}_flipped`;
    filters.push(
      `[${decoratedLabel}]split=2[${normalLabel}][${flipSourceLabel}]`,
      `[${flipSourceLabel}]vflip[${flippedLabel}]`,
      `[${normalLabel}][${flippedLabel}]overlay=x=0:y=0:format=auto[${input.outputLabel}]`
    );
  } else if (decoratedLabel !== input.outputLabel) {
    filters.push(`[${decoratedLabel}]copy[${input.outputLabel}]`);
  }
  return filters.join(';');
}

function hasAudioVisualizationThemeDecorations(theme: ExpandedAudioVisualizationTheme | undefined): boolean {
  return Boolean(theme && ((theme.glow && theme.glowStrength > 0) || theme.particles || (theme.border && theme.borderWidth > 0)));
}

function appendAudioVisualizationThemeDecorationFilters(
  filters: string[],
  inputLabel: string,
  outputLabel: string,
  theme: ExpandedAudioVisualizationTheme
): string {
  let currentLabel = inputLabel;
  if (theme.glow && theme.glowStrength > 0) {
    const baseLabel = `${outputLabel}_glow_base`;
    const glowSourceLabel = `${outputLabel}_glow_src`;
    const glowLabel = `${outputLabel}_glow`;
    const combinedLabel = `${outputLabel}_with_glow`;
    filters.push(
      `[${currentLabel}]split=2[${baseLabel}][${glowSourceLabel}]`,
      `[${glowSourceLabel}]gblur=sigma=${formatFfmpegNumber(2 + theme.glowStrength * 8)},colorchannelmixer=${buildColorChannelMixerForHex(
        theme.glowColor
      )}:aa=${formatOpacity(Math.min(0.9, 0.25 + theme.glowStrength * 0.65))}[${glowLabel}]`,
      `[${glowLabel}][${baseLabel}]overlay=format=auto[${combinedLabel}]`
    );
    currentLabel = combinedLabel;
  }
  if (theme.particles) {
    const particleLabel = `${outputLabel}_particles`;
    filters.push(
      `[${currentLabel}]noise=alls=8:allf=t+u,colorchannelmixer=${buildColorChannelMixerForHex(theme.particleColor)}[${particleLabel}]`
    );
    currentLabel = particleLabel;
  }
  if (theme.border && theme.borderWidth > 0) {
    const borderLabel = `${outputLabel}_border`;
    filters.push(
      `[${currentLabel}]drawbox=x=0:y=0:w=iw:h=ih:color=${cssColorToFfmpeg(theme.borderColor)}@0.85:t=${Math.max(1, Math.round(theme.borderWidth))}[${borderLabel}]`
    );
    currentLabel = borderLabel;
  }
  return currentLabel;
}

function buildAudioSpectrumGradientFilters(inputLabel: string, outputLabel: string, colorStart: string, colorEnd: string): string[] {
  const startSourceLabel = `${outputLabel}_start_src`;
  const endSourceLabel = `${outputLabel}_end_src`;
  const startLabel = `${outputLabel}_start`;
  const endLabel = `${outputLabel}_end`;
  return [
    `[${inputLabel}]split=2[${startSourceLabel}][${endSourceLabel}]`,
    `[${startSourceLabel}]colorchannelmixer=${buildColorChannelMixerForHex(colorStart)}[${startLabel}]`,
    `[${endSourceLabel}]colorchannelmixer=${buildColorChannelMixerForHex(colorEnd)}[${endLabel}]`,
    `[${startLabel}][${endLabel}]blend=all_expr='A*(1-Y/H)+B*(Y/H)'[${outputLabel}]`
  ];
}

function buildColorChannelMixerForHex(color: string): string {
  const parsed = parseHexColor(color, '#22d3ee');
  return [`rr=${formatFfmpegNumber(parsed.r / 255)}`, `gg=${formatFfmpegNumber(parsed.g / 255)}`, `bb=${formatFfmpegNumber(parsed.b / 255)}`].join(':');
}

function buildCircularAlphaMaskFilter(): string {
  return "geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='alpha(X,Y)*if(lte((X-W/2)*(X-W/2)+(Y-H/2)*(Y-H/2),(min(W,H)/2)*(min(W,H)/2)),1,0)'";
}

function buildAudioVisualizationOverlayPosition(style: ExportAudioVisualizationSettings['style'], _settings: ExportSettings): { x: string; y: string } {
  if (style === 'circular-spectrum') {
    return { x: '(main_w-overlay_w)/2', y: '(main_h-overlay_h)/2' };
  }
  return { x: '0', y: '0' };
}

function normalizeHexColor(value: string | undefined, fallback: string): string {
  const parsed = parseHexColor(value ?? '', fallback);
  return `#${toHexChannel(parsed.r)}${toHexChannel(parsed.g)}${toHexChannel(parsed.b)}`;
}

function parseHexColor(value: string, fallback: string): { r: number; g: number; b: number } {
  const normalized = value.trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return {
      r: Number.parseInt(normalized.slice(0, 2), 16),
      g: Number.parseInt(normalized.slice(2, 4), 16),
      b: Number.parseInt(normalized.slice(4, 6), 16)
    };
  }
  if (/^[0-9a-fA-F]{3}$/.test(normalized)) {
    return {
      r: Number.parseInt(normalized[0] + normalized[0], 16),
      g: Number.parseInt(normalized[1] + normalized[1], 16),
      b: Number.parseInt(normalized[2] + normalized[2], 16)
    };
  }
  if (value === fallback) {
    return { r: 5, g: 8, b: 22 };
  }
  return parseHexColor(fallback, '#050816');
}

function buildGradientChannelExpression(start: number, end: number): string {
  if (start === end) {
    return String(start);
  }
  return `${start}+(${end - start})*Y/max(H-1,1)`;
}

function toHexChannel(value: number): string {
  return Math.round(Math.min(255, Math.max(0, value))).toString(16).padStart(2, '0');
}

function buildInputArgs(clip: ExportClip): string[] {
  if (clip.imageSequence) {
    return ['-f', 'concat', '-safe', '0'];
  }
  if (clip.type === 'image') {
    return ['-loop', '1', '-t', formatFfmpegSeconds(clip.duration)];
  }
  if (clip.type === 'video' || clip.type === 'audio' || clip.type === 'nested-sequence') {
    return ['-ss', formatFfmpegSeconds(clip.trimStart), '-t', formatFfmpegSeconds(getExportClipSourceDuration(clip))];
  }
  return [];
}

function buildCustomShaderSequenceInputArgs(settings: ExportSettings): string[] {
  return ['-f', 'image2', '-framerate', String(settings.fps), '-start_number', '1'];
}

function buildCustomShaderSequenceClip(clip: ExportClip): ExportClip {
  return {
    ...clip,
    trimStart: 0,
    trimEnd: 0,
    speed: 1,
    sourceDuration: clip.duration,
    keyframes: clip.keyframes ? { ...clip.keyframes, speed: [] } : clip.keyframes
  };
}

function buildPathTextSequenceArtifact(clip: ExportClip, settings: ExportSettings): TextArtifact | undefined {
  if (clip.type !== 'text' || !clip.textStyle) {
    return undefined;
  }
  const text = richTextToPlainText(clip.textStyle.richText ?? undefined, clip.textStyle.text);
  if (!text.trim()) {
    return undefined;
  }
  const pathText = normalizeTextPath(clip.textPath ?? undefined);
  const arcText = normalizeTextArc(clip.textStyle.arcText ?? undefined);
  if (!arcText.enabled && (!pathText.enabled || pathText.path.length < 2)) {
    return undefined;
  }
  const safeId = safeLabel(clip.id);
  const scale = Math.max(0.01, clip.transform.scaleX ?? clip.transform.scale);
  const fontSize = Math.max(1, Math.round(clip.textStyle.fontSize * scale));
  const fps = Math.max(1, settings.fps);
  const frameCount = Math.max(1, Math.ceil(Math.max(clip.duration, 1 / fps) * fps));
  const frames = arcText.enabled
    ? Array.from({ length: frameCount }, (_, frameIndex) => ({
        time: round(frameIndex / fps),
        chars: buildArcTextLayout({
          text,
          arc: arcText,
          fontSize,
          letterSpacing: pathText.letterSpacing,
          centerX: settings.width / 2 + clip.transform.x,
          centerY: settings.height / 2 + clip.transform.y
        }).map((item) => ({
          char: item.char,
          index: item.index,
          x: item.x,
          y: item.y,
          angle: item.rotation,
          distance: Math.abs(item.angle - arcText.startAngle)
        }))
      }))
    : buildPathTextFrameLayouts({
        text,
        path: pathText.path,
        pathText,
        keyframes: clip.keyframes,
        duration: clip.duration,
        fps,
        width: settings.width,
        height: settings.height,
        fontSize,
        letterSpacing: pathText.letterSpacing,
        rotateCharacters: pathText.rotateCharacters,
        offsetX: clip.transform.x,
        offsetY: clip.transform.y
      });
  return {
    clipId: `${clip.id}:${arcText.enabled ? 'arc-text' : 'path-text'}`,
    text: JSON.stringify({
      kind: PATH_TEXT_SEQUENCE_KIND,
      version: 1,
      clipId: clip.id,
      width: Math.max(1, Math.round(settings.width)),
      height: Math.max(1, Math.round(settings.height)),
      fps,
      frameCount,
      fontSize,
      fontColor: clip.textStyle.fontColor,
      fontFamily: clip.textStyle.fontFamily,
      fontPath: clip.textStyle.fontPath,
      bold: clip.textStyle.bold,
      italic: clip.textStyle.italic,
      frames: frames.slice(0, frameCount)
    }),
    fileName: `${arcText.enabled ? 'arc-text' : 'path-text'}-${safeId}.json`,
    placeholder: `__PATH_TEXT_SEQUENCE_${safeId}__`,
    pathMode: 'path-text-sequence'
  };
}

function buildMotionGraphicSequenceArtifact(clip: ExportClip, settings: ExportSettings): TextArtifact | undefined {
  if (clip.type !== 'motion-graphic' || !clip.motionGraphic) {
    return undefined;
  }
  const safeId = safeLabel(clip.id);
  const fps = Math.max(1, settings.fps);
  const frameCount = Math.max(1, Math.ceil(Math.max(clip.duration, 1 / fps) * fps));
  return {
    clipId: `${clip.id}:motion-graphic`,
    text: JSON.stringify({
      kind: MOTION_GRAPHIC_SEQUENCE_KIND,
      version: 1,
      clipId: clip.id,
      templateType: clip.motionGraphic.templateType,
      motionGraphic: normalizeMotionGraphic(clip.motionGraphic, clip.duration),
      width: Math.max(1, Math.round(settings.width)),
      height: Math.max(1, Math.round(settings.height)),
      fps,
      frameCount,
      duration: clip.duration
    }),
    fileName: `motion-graphic-${safeId}.json`,
    placeholder: `__MOTION_GRAPHIC_SEQUENCE_${safeId}__`,
    pathMode: MOTION_GRAPHIC_SEQUENCE_PATH_MODE
  };
}

function buildCustomShaderSequenceArtifact(clip: ExportClip, settings: ExportSettings): TextArtifact | undefined {
  if (clip.type !== 'video' && clip.type !== 'image' && clip.type !== 'nested-sequence') {
    return undefined;
  }
  if (!clip.mediaPath || clip.imageSequence) {
    return undefined;
  }
  const effect = getEnabledCustomShaderEffect(clip.effects);
  if (!effect) {
    return undefined;
  }
  const safeId = safeLabel(clip.id);
  const params = normalizeCustomShaderParams(effect.params);
  const frameCount = Math.max(1, Math.ceil(Math.max(clip.duration, 1 / Math.max(1, settings.fps)) * Math.max(1, settings.fps)));
  return {
    clipId: `${clip.id}:custom-shader`,
    text: JSON.stringify({
      kind: CUSTOM_SHADER_SEQUENCE_KIND,
      version: 1,
      clipId: clip.id,
      preset: params.preset,
      shaderSource: params.source,
      fragmentSource: buildCustomShaderFragmentSource(params.source),
      mediaPath: normalizeFfmpegPath(clip.mediaPath),
      clipType: clip.type,
      trimStart: clip.trimStart,
      sourceDuration: getExportClipSourceDuration(clip),
      duration: clip.duration,
      speed: clip.speed,
      width: Math.max(1, Math.round(settings.width)),
      height: Math.max(1, Math.round(settings.height)),
      fps: Math.max(1, settings.fps),
      frameCount
    }),
    fileName: `custom-shader-${safeId}.json`,
    placeholder: `__CUSTOM_SHADER_SEQUENCE_${safeId}__`,
    pathMode: 'shader-sequence'
  };
}

function buildImageSequenceArtifact(clip: ExportClip): TextArtifact {
  const safeId = safeLabel(clip.id);
  const frameDuration = 1 / Math.max(1, clip.imageSequence?.frameRate ?? 30);
  const paths = clip.imageSequence?.paths ?? [];
  const lines = ['ffconcat version 1.0'];
  for (const path of paths) {
    lines.push(`file '${escapeConcatPath(path)}'`);
    lines.push(`duration ${formatSequenceFrameDuration(frameDuration)}`);
  }
  const lastPath = paths.at(-1);
  if (lastPath) {
    lines.push(`file '${escapeConcatPath(lastPath)}'`);
  }
  return {
    clipId: `${clip.id}:image-sequence`,
    text: `${lines.join('\n')}\n`,
    fileName: `sequence-${safeId}.ffconcat`,
    placeholder: `__IMAGE_SEQUENCE_${safeId}__`,
    pathMode: 'argument'
  };
}

function buildBitrateArgs(flag: '-b:v' | '-b:a', bitrate: string | null | undefined): string[] {
  const value = bitrate?.trim();
  return value ? [flag, value] : [];
}

function buildVideoEncodingArgs(settings: ExportSettings, capabilities: FfmpegCapabilities | undefined, warnings: string[], skipVideoCodec: boolean): string[] {
  if (skipVideoCodec) { return []; }
  if (settings.hardwareEncoding) {
    const format = settings.format.toLowerCase();
    const hwOk = format === 'mp4' || format === 'mov';
    const hw = settings.hardwareEncoderSettings;
    if (hwOk && hw?.encoderId) { return buildHardwareEncoderArgs(hw, settings.fps, capabilities, warnings); }
    const enc = capabilities?.hardwareEncoderAvailable ? capabilities.hardwareEncoder : null;
    if (hwOk && enc) { return ['-c:v', enc, '-preset', 'p4', '-cq', '23', '-pix_fmt', 'yuv420p', '-r', String(settings.fps)]; }
    warnings.push('Hardware video encoding was requested but no supported H.264 hardware encoder was detected. Falling back to software encoding.');
  }
  return ['-c:v', settings.videoCodec, ...buildBitrateArgs('-b:v', settings.videoBitrate), ...buildVideoProfileArgs(settings), '-pix_fmt', 'yuv420p', '-r', String(settings.fps)];
}

export function buildHardwareEncoderArgs(hwSettings: NonNullable<ExportSettings['hardwareEncoderSettings']>, fps: number, capabilities: FfmpegCapabilities | undefined, warnings: string[]): string[] {
  const encoderId = hwSettings.encoderId!;
  const ok = (capabilities?.hardwareEncoders ?? []).some(e => e.id === encoderId) || capabilities?.hardwareEncoder === encoderId;
  if (!ok) { warnings.push('Hardware encoder ' + encoderId + ' is not available. Falling back to software encoding.'); return ['-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', String(fps)]; }
  const args: string[] = ['-c:v', encoderId];
  if (hwSettings.preset && hwSettings.preset !== 'default') { args.push('-preset', hwSettings.preset); }
  const rc = hwSettings.rateControlMode ?? 'cqp';
  const isV = encoderId.includes('vaapi'), isA = encoderId.includes('amf'), isQ = encoderId.includes('qsv'), isT = encoderId.includes('videotoolbox');
  if (rc === 'cqp' || rc === 'cbr') {
    const cq = hwSettings.cq ?? 23;
    if (isV) args.push('-qp', String(cq));
    else if (isA) args.push('-qp_i', String(cq));
    else if (isT) args.push('-q', String(Math.min(100, Math.max(1, cq))));
    else if (isQ) args.push('-global_quality', String(cq));
    else args.push('-cq', String(cq));
  }
  if (rc === 'cbr' || rc === 'vbr') {
    if (hwSettings.videoBitrate) args.push('-b:v', hwSettings.videoBitrate);
    if (rc === 'vbr' && hwSettings.maxBitrate) args.push('-maxrate', hwSettings.maxBitrate);
    if (rc === 'cbr' && hwSettings.videoBitrate) args.push('-bufsize', hwSettings.videoBitrate);
  }
  if (hwSettings.gopSize && hwSettings.gopSize > 0) args.push('-g', String(hwSettings.gopSize));
  if (hwSettings.bFrames !== undefined && hwSettings.bFrames >= 0 && !isV && !isT) args.push('-bf', String(hwSettings.bFrames));
  args.push('-pix_fmt', 'yuv420p', '-r', String(fps));
  return args;
}

function buildVideoProfileArgs(settings: ExportSettings): string[] {
  const codec = settings.videoCodec.toLowerCase();
  return settings.videoProfile && (codec.includes('264') || codec === 'h264') ? ['-profile:v', settings.videoProfile] : [];
}

function buildContainerArgs(settings: ExportSettings): string[] {
  const format = settings.format.toLowerCase();
  if (settings.outputMode === 'audio' || format === 'm4a' || format === 'png-sequence') {
    return [];
  }
  if (format === 'mp4' || format === 'mov') {
    return ['-movflags', shouldGenerateIccProfile(settings) ? '+faststart+prefer_icc' : '+faststart'];
  }
  return [];
}

function buildExportColorMetadataArgs(settings: ExportSettings): string[] {
  const colorManagement = normalizeExportColorManagement(settings.colorManagement);
  const args = buildExportColorTagArgs(colorManagement.outputColorSpace);
  const format = settings.format.toLowerCase();
  if ((format === 'mp4' || format === 'mov') && shouldGenerateIccProfile(settings)) {
    args.push(...buildIccMetadataArgs(colorManagement.outputColorSpace));
  }
  return args;
}

function buildExportContainerMetadataArgs(metadata: ExportProject['metadata']): string[] {
  if (!metadata) {
    return [];
  }
  const entries: Array<[string, string | undefined]> = [
    ['title', metadata.title],
    ['artist', metadata.author],
    ['comment', metadata.description],
    ['copyright', metadata.copyright],
    ['date', metadata.date]
  ];
  return entries.flatMap(([key, value]) => {
    const normalized = value?.replace(/[\r\n\t]+/g, ' ').trim();
    return normalized ? ['-metadata', `${key}=${normalized}`] : [];
  });
}

function buildExportColorManagementFilters(settings: ExportSettings): string[] {
  const colorManagement = normalizeExportColorManagement(settings.colorManagement);
  const colorPipeline = normalizeProjectColorPipeline(settings.colorPipeline);
  const input = getFfmpegColorSpaceProfile(colorManagement.inputColorSpace);
  const output = getFfmpegColorSpaceProfile(colorManagement.outputColorSpace);
  const filters: string[] = [...buildAcesOdtFilterChain(colorPipeline, colorManagement.outputColorSpace)];
  if (colorManagement.inputColorSpace !== colorManagement.outputColorSpace) {
    filters.push(
      `colorspace=ispace=${input.space}:iprimaries=${input.primaries}:itrc=${input.trc}:space=${output.space}:primaries=${output.primaries}:trc=${output.trc}`
    );
  }
  if (shouldGenerateIccProfile(settings)) {
    filters.push(`iccgen=force=1:color_primaries=${output.primaries}:color_trc=${output.trc}`);
  }
  return filters;
}

function shouldGenerateIccProfile(settings: ExportSettings): boolean {
  const colorManagement = normalizeExportColorManagement(settings.colorManagement);
  return colorManagement.embedIccProfile && (colorManagement.inputColorSpace !== colorManagement.outputColorSpace || colorManagement.outputColorSpace !== 'srgb');
}

function buildSourceColorSpaceConversionFilters(clip: ExportClip, settings: ExportSettings): string[] {
  const source = clip.sourceColorProfile;
  if (!source?.autoConvertToWorkingSpace) {
    return [];
  }
  const target = normalizeProjectWorkingColorSpace(settings.workingColorSpace);
  const filter = buildZscaleColorConversionFilter(source.sourceColorSpace, target);
  return filter ? [filter] : [];
}

function pngSequenceOutputPath(outputPath: string): string {
  const normalized = normalizeFfmpegPath(outputPath);
  const lower = normalized.toLowerCase();
  if (lower.includes('%') || lower.endsWith('.png')) {
    return normalized;
  }
  return `${normalized.replace(/\/+$/g, '')}/frame%04d.png`;
}

function escapeConcatPath(path: string): string {
  return normalizeFfmpegPath(path).replace(/'/g, "'\\''");
}

function formatSequenceFrameDuration(value: number): string {
  return value.toFixed(6).replace(/0+$/g, '').replace(/\.$/g, '');
}

function getExportClipSourceDuration(clip: ExportClip): number {
  return clip.type === 'video' || clip.type === 'audio' || clip.type === 'nested-sequence' ? Math.max(0.001, clip.sourceDuration) : Math.max(0.001, clip.duration);
}

function buildTextFilter(inputLabel: string, outputLabel: string, clip: ExportClip, settings: ExportSettings): { filter: string; artifacts: TextArtifact[] } {
  const safeId = safeLabel(clip.id);
  const placeholder = `__TEXTFILE_${safeId}__`;
  const textSourceLabel = `textsrc_${safeId}`;
  const textDrawLabel = `textdraw_${safeId}`;
  const textLayerLabel = `textlayer_${safeId}`;
  const style = clip.textStyle;
  if (style && shouldUseAdvancedTextFilters(style)) {
    return buildAdvancedTextFilter(inputLabel, outputLabel, clip, settings, style, textSourceLabel, textLayerLabel);
  }
  const artifact: TextArtifact = {
    clipId: clip.id,
    text: style?.text ?? '',
    fileName: `${safeId}.txt`,
    placeholder
  };
  const fontPath = style?.fontPath ? `:fontfile=${escapeDrawtextValue(style.fontPath)}` : '';
  const openType = buildOpenTypeDrawtextOptions(style);
  const fontColor = cssColorToFfmpeg(style?.fontColor ?? 'white');
  const backgroundColor = cssColorToFfmpeg(style?.backgroundColor ?? 'black');
  const backgroundOpacity = formatOpacity(style?.backgroundOpacity ?? 0);
  const fontSize = buildTextFontSizeExpression(clip, Math.max(1, Math.round(style?.fontSize ?? 48)));
  const x = buildDrawtextPositionExpression(clip, 'x', style?.x ?? clip.transform.x);
  const y = buildDrawtextPositionExpression(clip, 'y', style?.y ?? clip.transform.y);
  const layerDuration = Math.max(0.001, clip.start + clip.duration);
  const opacityFilters = buildOpacityFilters(clip, textLayerLabel);
  return {
    artifacts: [artifact],
    filter: [
      `color=c=black@0:s=${settings.width}x${settings.height}:r=${settings.fps}:d=${formatFfmpegSeconds(layerDuration)},format=rgba[${textSourceLabel}]`,
      `[${textSourceLabel}]drawtext=textfile=${placeholder}${fontPath}${openType}:fontsize=${fontSize}:fontcolor=${fontColor}:x='${x}':y='${y}':alpha=1:box=1:boxcolor=${backgroundColor}@${backgroundOpacity}:boxborderw=${Math.max(
        0,
        Math.round((style?.fontSize ?? 48) * 0.25)
      )}:enable='between(t,${formatFfmpegSeconds(clip.start)},${formatFfmpegSeconds(clip.start + clip.duration)})'[${textDrawLabel}]`,
      `[${textDrawLabel}]${opacityFilters.join(',')}`,
      `[${inputLabel}][${textLayerLabel}]overlay=x=0:y=0:eval=frame:enable='between(t,${formatFfmpegSeconds(clip.start)},${formatFfmpegSeconds(clip.start + clip.duration)})'[${outputLabel}]`
    ].join(';')
  };
}

function buildAdvancedTextFilter(
  inputLabel: string,
  outputLabel: string,
  clip: ExportClip,
  settings: ExportSettings,
  style: NonNullable<ExportClip['textStyle']>,
  textSourceLabel: string,
  textLayerLabel: string
): { filter: string; artifacts: TextArtifact[] } {
  const safeId = safeLabel(clip.id);
  const layout = calculateTextAutoLayout({
    richText: style.richText ?? undefined,
    plainText: style.text,
    baseStyle: exportTextStyleToTextStyle(style),
    layout: style.textLayout ?? undefined
  });
  const normalizedLayout = normalizeTextLayout(style.textLayout ?? undefined);
  const segments = buildRichTextDrawSegments({
    richText: style.richText ?? undefined,
    plainText: style.text,
    baseStyle: exportTextStyleToTextStyle(style),
    layout: normalizedLayout
  });
  const artifacts: TextArtifact[] = [];
  const layerDuration = Math.max(0.001, clip.start + clip.duration);
  const backgroundColor = cssColorToFfmpeg(style.backgroundColor);
  const backgroundOpacity = formatOpacity(style.backgroundOpacity);
  const fontPath = style.fontPath ? `:fontfile=${escapeDrawtextValue(style.fontPath)}` : '';
  const openType = buildOpenTypeDrawtextOptions(style);
  const filters: string[] = [`color=c=black@0:s=${settings.width}x${settings.height}:r=${settings.fps}:d=${formatFfmpegSeconds(layerDuration)},format=rgba[${textSourceLabel}]`];
  let previousLabel = textSourceLabel;

  segments.forEach((segment, index) => {
    const placeholder = `__TEXTFILE_${safeId}_${segment.paragraphIndex}_${segment.runIndex}__`;
    const nextLabel = `textdraw_${safeId}_${index}`;
    const fontSize = buildTextFontSizeExpression(clip, Math.max(1, Math.round(segment.style.fontSize * layout.scale)));
    const baseX = buildDrawtextPositionExpression(clip, 'x', style.x);
    const baseY = buildDrawtextPositionExpression(clip, 'y', style.y);
    const x = `${baseX}${formatSigned(segment.xOffset - layout.width / 2)}`;
    const y = `${baseY}${formatSigned(segment.yOffset - layout.height / 2)}`;
    artifacts.push({
      clipId: `${clip.id}:text-${segment.paragraphIndex}-${segment.runIndex}`,
      text: segment.text,
      fileName: `${safeId}-${segment.paragraphIndex}-${segment.runIndex}.txt`,
      placeholder
    });
    filters.push(
      `[${previousLabel}]drawtext=textfile=${placeholder}${fontPath}${openType}:fontsize=${fontSize}:fontcolor=${cssColorToFfmpeg(
        segment.style.color
      )}:x='${x}':y='${y}':alpha=1:box=1:boxcolor=${backgroundColor}@${backgroundOpacity}:boxborderw=${Math.max(
        0,
        Math.round(segment.style.fontSize * 0.25)
      )}:enable='between(t,${formatFfmpegSeconds(clip.start)},${formatFfmpegSeconds(clip.start + clip.duration)})'[${nextLabel}]`
    );
    previousLabel = nextLabel;
  });

  const opacityFilters = buildOpacityFilters(clip, textLayerLabel);
  filters.push(`[${previousLabel}]${opacityFilters.join(',')}`);
  filters.push(
    `[${inputLabel}][${textLayerLabel}]overlay=x=0:y=0:eval=frame:enable='between(t,${formatFfmpegSeconds(clip.start)},${formatFfmpegSeconds(clip.start + clip.duration)})'[${outputLabel}]`
  );
  return { filter: filters.join(';'), artifacts };
}

function shouldUseAdvancedTextFilters(style: NonNullable<ExportClip['textStyle']>): boolean {
  const richText = style.richText ?? undefined;
  const hasRichStructure = richText
    ? richText.paragraphs.length > 1 ||
      richText.paragraphs.some(
        (paragraph) =>
          paragraph.runs.length > 1 ||
          paragraph.runs.some((run) => run.bold !== undefined || run.italic !== undefined || run.underline !== undefined || run.color !== undefined || run.fontSize !== undefined)
      )
    : false;
  const layout = normalizeTextLayout(style.textLayout ?? undefined);
  const defaultLayout = normalizeTextLayout(undefined);
  const hasCustomLayout =
    layout.fitMode !== defaultLayout.fitMode ||
    layout.boxWidth !== defaultLayout.boxWidth ||
    layout.boxHeight !== defaultLayout.boxHeight ||
    layout.paragraphSpacing !== defaultLayout.paragraphSpacing ||
    layout.firstLineIndent !== defaultLayout.firstLineIndent;
  return hasRichStructure || hasCustomLayout;
}

function buildOpenTypeDrawtextOptions(style: NonNullable<ExportClip['textStyle']> | null | undefined): string {
  const features = formatOpenTypeFeatureList(normalizeTextOpenTypeFeatures(style?.openTypeFeatures ?? undefined));
  if (!features) {
    return '';
  }
  const family = (style?.fontFamily ?? 'Sans').split(',')[0]?.replace(/["']/g, '').trim() || 'Sans';
  const fontPattern = `${family}:fontfeatures=${features}`;
  return style?.fontPath ? `:text_shaping=1:font='${escapeDrawtextValue(fontPattern)}'` : `:font='${escapeDrawtextValue(fontPattern)}':text_shaping=1`;
}

function exportTextStyleToTextStyle(style: NonNullable<ExportClip['textStyle']>): TextStyle {
  return {
    fontSize: style.fontSize,
    color: style.fontColor,
    backgroundColor: style.backgroundColor,
    backgroundOpacity: style.backgroundOpacity,
    fontFamily: style.fontFamily,
    bold: style.bold,
    italic: style.italic
  };
}

function resolveExportAudioVisualizationTheme(visualization: ExportAudioVisualizationSettings): ExpandedAudioVisualizationTheme | undefined {
  if (!visualization.themeId && !visualization.theme) {
    return undefined;
  }
  return expandAudioVisualizationTheme({
    themeId: visualization.themeId,
    theme: visualization.theme,
    color: visualization.color
  });
}

function resolveAudioVisualizationBackground(visualization: ExportAudioVisualizationSettings): ExportAudioVisualizationBackground {
  const theme = resolveExportAudioVisualizationTheme(visualization);
  if (!theme) {
    return visualization.background;
  }
  if (theme.background.type === 'gradient') {
    return { type: 'gradient', color: theme.background.color, color2: theme.background.color2 };
  }
  return { type: 'solid', color: theme.background.color };
}

function buildCreditsRollFilter(inputLabel: string, outputLabel: string, clip: ExportClip, settings: ExportSettings): { filter: string; artifact: TextArtifact } {
  const safeId = safeLabel(clip.id);
  const placeholder = `__CREDITSFILE_${safeId}__`;
  const textSourceLabel = `creditssrc_${safeId}`;
  const textDrawLabel = `creditsdraw_${safeId}`;
  const textLayerLabel = `creditslayer_${safeId}`;
  const style = clip.creditsStyle;
  const artifact: TextArtifact = {
    clipId: clip.id,
    text: style ? formatCreditsRowsForTextfile(style.rows) : '',
    fileName: `${safeId}-credits.txt`,
    placeholder
  };
  const fontPath = style?.fontPath ? `:fontfile=${escapeDrawtextValue(style.fontPath)}` : '';
  const fontColor = cssColorToFfmpeg(style?.fontColor ?? 'white');
  const backgroundColor = cssColorToFfmpeg(style?.backgroundColor ?? 'black');
  const backgroundOpacity = formatOpacity(style?.backgroundOpacity ?? 0);
  const fontSize = buildTextFontSizeExpression(clip, Math.max(1, Math.round(style?.fontSize ?? 42)));
  const horizontalMargin = Math.max(0, Math.round(style?.horizontalMargin ?? 0));
  const x = `max(${horizontalMargin},(w-text_w)/2)`;
  const y = buildCreditsRollYExpression(style?.rollSpeed ?? 80);
  const lineSpacing = Math.max(0, Math.round(style?.lineSpacing ?? 0));
  const layerDuration = Math.max(0.001, clip.start + clip.duration);
  const opacityFilters = buildOpacityFilters(clip, textLayerLabel);
  return {
    artifact,
    filter: [
      `color=c=${backgroundColor}@${backgroundOpacity}:s=${settings.width}x${settings.height}:r=${settings.fps}:d=${formatFfmpegSeconds(layerDuration)},format=rgba[${textSourceLabel}]`,
      `[${textSourceLabel}]drawtext=textfile=${placeholder}${fontPath}:fontsize=${fontSize}:fontcolor=${fontColor}:x='${x}':y='${y}':line_spacing=${lineSpacing}:alpha=1:enable='between(t,${formatFfmpegSeconds(
        clip.start
      )},${formatFfmpegSeconds(clip.start + clip.duration)})'[${textDrawLabel}]`,
      `[${textDrawLabel}]${opacityFilters.join(',')}`,
      `[${inputLabel}][${textLayerLabel}]overlay=x=0:y=0:eval=frame:enable='between(t,${formatFfmpegSeconds(clip.start)},${formatFfmpegSeconds(clip.start + clip.duration)})'[${outputLabel}]`
    ].join(';')
  };
}

function buildPathTextSequenceOverlayFilter(inputLabel: string, outputLabel: string, inputIndex: number, clip: ExportClip): string {
  const safeId = safeLabel(clip.id);
  const sourceLabel = `pathtextsrc_${safeId}`;
  const layerLabel = `pathtextlayer_${safeId}`;
  const opacityFilters = buildOpacityFilters(clip, layerLabel);
  return [
    `[${inputIndex}:v]trim=duration=${formatFfmpegSeconds(clip.duration)},setpts=PTS-STARTPTS+${formatFfmpegSeconds(clip.start)}/TB,format=rgba[${sourceLabel}]`,
    `[${sourceLabel}]${opacityFilters.join(',')}`,
    `[${inputLabel}][${layerLabel}]overlay=x=0:y=0:eval=frame:enable='between(t,${formatFfmpegSeconds(clip.start)},${formatFfmpegSeconds(clip.start + clip.duration)})'[${outputLabel}]`
  ].join(';');
}

function buildTextFontSizeExpression(clip: ExportClip, baseFontSize: number): string {
  const frames = getAnimatedFrames(clip, 'scaleX');
  if (frames.length >= 2) {
    return `'${baseFontSize}*(${buildTimelineExpression(frames, clip.start, clip.transform.scaleX ?? clip.transform.scale, 'T')})'`;
  }
  const scale = frames.length === 1 ? frames[0].value : clip.transform.scaleX ?? clip.transform.scale;
  return String(Math.max(1, Math.round(baseFontSize * scale)));
}

function buildDrawtextPositionExpression(clip: ExportClip, axis: 'x' | 'y', staticValue: number): string {
  const frames = getAnimatedFrames(clip, axis);
  const dimension = axis === 'x' ? 'w' : 'h';
  const textDimension = axis === 'x' ? 'text_w' : 'text_h';
  const fallback = Number.isFinite(staticValue) ? staticValue : 0;
  if (frames.length >= 2) {
    return `(${dimension}-${textDimension})/2+(${dimension}/2)*(${buildTimelineExpression(frames, clip.start, fallback, 'T')})`;
  }
  if (frames.length === 1) {
    return `(${dimension}-${textDimension})/2+(${dimension}/2)*${formatFfmpegNumber(frames[0].value)}`;
  }
  return `(${dimension}-${textDimension})/2+${formatSigned(fallback)}`;
}

function buildSubtitleBurnInFilter(
  inputLabel: string,
  outputLabel: string,
  clips: ExportClip[],
  format: ExportSubtitleFormat,
  options: SubtitleArtifactOptions = {}
): { filter: string; artifact: TextArtifact } {
  const artifact = buildSubtitleArtifact(clips, 'filter', format, options);
  const style = clips.find((clip) => clip.subtitleStyle)?.subtitleStyle;
  const forceStyle = [
    `FontSize=${Math.max(1, Math.round(style?.fontSize ?? 42))}`,
    `PrimaryColour=${cssColorToAssColor(style?.fontColor ?? '#ffffff')}`,
    `OutlineColour=${cssColorToAssColor(style?.outlineColor ?? '#000000')}`,
    `BackColour=${cssColorToAssColor((style?.backgroundOpacity ?? 0) > 0 ? style?.backgroundColor ?? '#000000' : style?.shadowColor ?? style?.backgroundColor ?? '#000000', style?.backgroundOpacity ?? 0)}`,
    `BorderStyle=${(style?.backgroundOpacity ?? 0) > 0 ? 3 : 1}`,
    `Outline=${Math.max(0, Math.round(style?.outlineWidth ?? 0))}`,
    `Shadow=${Math.max(0, Math.round(style?.shadowOffset ?? 0))}`,
    'Alignment=2',
    `MarginV=${Math.max(0, Math.round(style?.yOffset ?? 72))}`
  ].join(',');
  return {
    artifact,
    filter: `[${inputLabel}]subtitles=filename=${artifact.placeholder}:force_style='${forceStyle}'[${outputLabel}]`
  };
}

interface SubtitleArtifactOptions {
  language?: string;
  includeLanguageInFileName?: boolean;
}

function buildSubtitleArtifact(clips: ExportClip[], pathMode: TextArtifact['pathMode'], format: ExportSubtitleFormat, options: SubtitleArtifactOptions = {}): TextArtifact {
  const cues = buildSubtitleCueInputs(clips);
  const language = options.language ? normalizeSubtitleLanguage(options.language) : undefined;
  const suffix = language && options.includeLanguageInFileName ? `.${language}` : '';
  const placeholderSuffix = language && options.includeLanguageInFileName ? `_${language}` : '';
  const sidecarSuffix = pathMode === 'sidecar' ? '_sidecar' : '';
  return {
    clipId: language && options.includeLanguageInFileName ? `subtitles-${language}` : 'subtitles',
    text: serializeSubtitleCueInputs(cues, format),
    fileName: `subtitles${suffix}.${format}`,
    placeholder: `__SUBTITLEFILE_export_subtitles${placeholderSuffix}${sidecarSuffix}__`,
    pathMode
  };
}

function buildSubtitleLanguageGroups(timeline: ExportTimeline, clips: ExportClip[], selectedLanguages: string[] | undefined): SubtitleLanguageGroup[] {
  if (clips.length === 0) {
    return [];
  }
  const selected = selectedLanguages ? new Set(selectedLanguages.map(normalizeSubtitleLanguage)) : undefined;
  const groups = new Map<string, ExportClip[]>();
  for (const clip of clips) {
    const language = normalizeSubtitleLanguage(timeline.tracks[clip.trackIndex]?.language);
    if (selected && !selected.has(language)) {
      continue;
    }
    const current = groups.get(language) ?? [];
    current.push(clip);
    groups.set(language, current);
  }
  return Array.from(groups.entries()).map(([language, groupClips]) => ({
    language,
    clips: groupClips.sort((left, right) => left.start - right.start || left.id.localeCompare(right.id))
  }));
}

function selectSubtitleBurnInGroup(groups: SubtitleLanguageGroup[], language: string | null | undefined): SubtitleLanguageGroup | undefined {
  if (groups.length === 0) {
    return undefined;
  }
  if (!language) {
    return groups[0];
  }
  const normalized = normalizeSubtitleLanguage(language);
  return groups.find((group) => group.language === normalized) ?? groups[0];
}

function subtitleLanguageToFfmpegMetadata(language: string): string {
  const normalized = normalizeSubtitleLanguage(language);
  const map: Record<string, string> = {
    ar: 'ara',
    de: 'deu',
    en: 'eng',
    es: 'spa',
    fr: 'fra',
    it: 'ita',
    ja: 'jpn',
    ko: 'kor',
    pt: 'por',
    ru: 'rus',
    zh: 'zho'
  };
  return map[normalized] ?? normalized;
}

function buildSubtitleCueInputs(clips: ExportClip[]): SubtitleCueInput[] {
  return clips.flatMap((clip) => {
    const source = normalizeDataSubtitleSource(clip.dataSubtitle);
    if (!source) {
      return [buildSubtitleCueInput(clip, clip.start, clip.duration, clip.subtitleStyle?.text ?? '', clip.id)];
    }
    const clipEnd = round(clip.start + clip.duration);
    const cueStarts = [clip.start, ...source.rows.map((row) => row.time).filter((time) => time > clip.start && time < clipEnd)].sort((left, right) => left - right);
    return cueStarts.flatMap((start, index) => {
      const end = cueStarts[index + 1] ?? clipEnd;
      const text = resolveDataSubtitleText(source, start, { fps: projectFrameRateFromClip(clip) });
      return text && end > start ? [buildSubtitleCueInput(clip, start, round(end - start), text, `${clip.id}-data-${index + 1}`)] : [];
    });
  });
}

function buildSubtitleCueInput(clip: ExportClip, start: number, duration: number, text: string, id: string): SubtitleCueInput {
  return {
    id,
    start,
    duration,
    text,
    subtitleType: clip.subtitleType ?? undefined,
    speaker: clip.speaker ?? undefined,
    soundDesc: clip.soundDesc ?? undefined,
    style: clip.subtitleStyle
      ? {
          fontFamily: clip.subtitleStyle.fontFamily,
          fontSize: clip.subtitleStyle.fontSize,
          color: clip.subtitleStyle.fontColor,
          backgroundColor: clip.subtitleStyle.backgroundColor,
          backgroundOpacity: clip.subtitleStyle.backgroundOpacity,
          outlineColor: clip.subtitleStyle.outlineColor,
          outlineWidth: clip.subtitleStyle.outlineWidth,
          shadowColor: clip.subtitleStyle.shadowColor,
          shadowOffset: clip.subtitleStyle.shadowOffset,
          bold: clip.subtitleStyle.bold,
          italic: clip.subtitleStyle.italic,
          yOffset: clip.subtitleStyle.yOffset,
          x: clip.subtitleStyle.x,
          y: clip.subtitleStyle.y
        }
      : undefined
  };
}

function projectFrameRateFromClip(clip: ExportClip): number {
  return clip.sequenceFrameRate ?? 30;
}

function serializeSubtitleCueInputs(cues: SubtitleCueInput[], format: ExportSubtitleFormat): string {
  if (format === 'vtt') {
    return serializeSubtitleCueInputsToVtt(cues);
  }
  if (format === 'ass' || format === 'ssa') {
    return serializeSubtitleCueInputsToAss(cues, format);
  }
  return serializeSubtitleCueInputsToSrt(cues);
}

function buildSubtitleInputArgs(format: ExportSubtitleFormat): string[] {
  if (format === 'vtt') {
    return ['-f', 'webvtt'];
  }
  if (format === 'ass') {
    return ['-f', 'ass'];
  }
  if (format === 'ssa') {
    return ['-f', 'ssa'];
  }
  return ['-f', 'srt'];
}

function buildSoftSubtitleCodec(format: ExportSubtitleFormat, settings: ExportSettings): string {
  if (format === 'ass' || format === 'ssa') {
    return 'ass';
  }
  if (format === 'vtt' && settings.format === 'webm') {
    return 'webvtt';
  }
  return 'mov_text';
}

function normalizeSubtitleFormat(format: ExportSettings['subtitleFormat']): ExportSubtitleFormat {
  return format === 'vtt' || format === 'ass' || format === 'ssa' ? format : 'srt';
}

/**
 * 构建音频效果链的 FFmpeg 滤镜
 */
export function buildAudioEffectChainFilters(effects: AudioEffectSlot[]): string[] {
  if (effects.length === 0) return [];

  const ffmpegFilters = EffectChainEngine.toFfmpegFilters(effects);
  return ffmpegFilters.map(f => {
    const params = Object.entries(f.params)
      .map(([k, v]) => `${k}=${v}`)
      .join(':');
    return params ? `${f.filterName}=${params}` : f.filterName;
  });
}

/**
 * 构建混音器通道的完整音频滤镜链
 */
export function buildMixerChannelAudioFilters(
  channelVolume: number,
  channelPan: number,
  effects: AudioEffectSlot[]
): string[] {
  const filters: string[] = [];

  // 音量
  if (channelVolume !== 0) {
    filters.push(`volume=${channelVolume}dB`);
  }

  // 声像
  if (channelPan !== 0) {
    const panValue = channelPan / 100; // -1 to 1
    filters.push(`stereopan=stereo=${panValue < 0 ? `l=${1 + panValue}+${Math.abs(panValue)}*c0|r=${Math.abs(panValue)}*c0+${1 + panValue}*c1` : `l=${1 - panValue}*c0+${panValue}*c1|r=${panValue}*c0+${1 - panValue}*c1`}`);
  }

  // 效果链
  filters.push(...buildAudioEffectChainFilters(effects));

  return filters;
}

function buildAudioFilters(
  clips: ExportClip[],
  inputByClipId: Map<string, number>,
  settings: ExportSettings,
  filters: string[],
  capabilities: FfmpegCapabilities | undefined,
  warnings: string[]
): string[] {
  const labels: string[] = [];
  for (const clip of clips.filter((item) => item.type === 'audio' || ((item.type === 'video' || item.type === 'nested-sequence') && item.hasEmbeddedAudio))) {
    if (clip.muted || clip.volume <= 0) {
      continue;
    }
    const inputIndex = inputByClipId.get(clip.id);
    if (inputIndex === undefined) {
      continue;
    }
    const label = `${clip.type === 'video' || clip.type === 'nested-sequence' ? 'av' : 'a'}${safeLabel(clip.id)}`;
    const delay = Math.max(0, Math.round(clip.start * 1000));
    const speedFilters = buildAtempoFilters(getAnimatedFrames(clip, 'speed').length > 0 ? getAverageClipSpeed(clip) : clip.speed);
    const pitchAndReverseFilters = buildPitchAndReverseAudioFilters(clip, settings.sampleRate);
    const fadeFilters = buildAudioFadeFilters(clip);
    const denoiseFilters = buildAudioDenoiseFilters(clip, capabilities, warnings);
    const restorationFilters = buildAudioRestorationFilters(clip);
    const trackProcessingFilters = buildTrackAudioFilters(clip);
    const effectsChainFilters = clip.effectsChain?.length ? buildAudioEffectChainFilters(clip.effectsChain) : [];
    const automationFilters = buildAutomationFilters(clip);
    filters.push(
      `[${inputIndex}:a:0]atrim=start=0:duration=${formatFfmpegSeconds(
        getExportClipSourceDuration(clip)
      )},asetpts=PTS-STARTPTS${pitchAndReverseFilters.length > 0 ? `,${pitchAndReverseFilters.join(',')}` : ''}${speedFilters.length > 0 ? `,${speedFilters.join(',')}` : ''}${fadeFilters}${restorationFilters}${denoiseFilters}${trackProcessingFilters}${effectsChainFilters.length > 0 ? `,${effectsChainFilters.join(',')}` : ''},adelay=${delay}:all=1,${buildVolumeFilter(
        clip
      )}${buildAudioChannelRoutingFilter(clip)}${buildPanFilter(clip)}${buildSpatialAudioFilter(clip, settings)}${automationFilters},aformat=channel_layouts=stereo,aresample=${settings.sampleRate}[${label}]`
    );
    labels.push(label);
  }
  return labels;
}

function buildPitchAndReverseAudioFilters(clip: ExportClip, sampleRate: number): string[] {
  const filters: string[] = [];
  if (clip.reverseAudio) {
    filters.push('areverse');
  }
  if (Math.abs(clip.pitchSemitones) >= 0.0001) {
    filters.push(`asetrate=${Math.round(sampleRate)}*${formatPitchRatio(clip.pitchSemitones)}`, `aresample=${Math.round(sampleRate)}`);
  }
  return filters;
}

function getLoudnessNormalizationPreset(mode: ExportLoudnessNormalization | undefined): LoudnessNormalizationPreset | undefined {
  if (mode === 'youtube') {
    return { mode, args: ['I=-14', 'TP=-1.5', 'LRA=11'] };
  }
  if (mode === 'ebu-r128') {
    return { mode, args: ['I=-23'] };
  }
  return undefined;
}

function normalizeLoudnessNormalization(mode: ExportLoudnessNormalization | undefined): ExportLoudnessNormalization {
  return mode === 'youtube' || mode === 'ebu-r128' ? mode : 'off';
}

function normalizeVideoProfile(profile: ExportVideoProfile | undefined): ExportVideoProfile | undefined {
  return profile === 'baseline' || profile === 'main' || profile === 'high' ? profile : undefined;
}

function normalizeExportAudioVisualization(input: ExportAudioVisualizationSettings | undefined): ExportAudioVisualizationSettings {
  const defaultVisualization = DEFAULT_EXPORT_SETTINGS.audioVisualization!;
  const style =
    input?.style === 'spectrum-bars' || input?.style === 'circular-spectrum' || input?.style === 'waveform-line'
      ? input.style
      : defaultVisualization.style;
  const normalized: ExportAudioVisualizationSettings = {
    style,
    color: normalizeHexColor(input?.color, defaultVisualization.color),
    background: normalizeAudioVisualizationBackground(input?.background, defaultVisualization.background)
  };
  if (typeof input?.themeId === 'string' && input.themeId.trim()) {
    normalized.themeId = input.themeId.trim();
  }
  if (input?.theme && typeof input.theme === 'object') {
    normalized.theme = normalizeAudioVisualizationTheme(input.theme);
  }
  return normalized;
}

function normalizeAudioVisualizationBackground(
  input: ExportAudioVisualizationBackground | undefined,
  fallback: ExportAudioVisualizationBackground
): ExportAudioVisualizationBackground {
  if (input?.type === 'image' && input.path.trim()) {
    return { type: 'image', path: input.path.trim() };
  }
  if (input?.type === 'gradient') {
    return {
      type: 'gradient',
      color: normalizeHexColor(input.color, fallback.type === 'gradient' || fallback.type === 'solid' ? fallback.color : '#050816'),
      color2: normalizeHexColor(input.color2, fallback.type === 'gradient' ? fallback.color2 : '#1d4ed8')
    };
  }
  if (input?.type === 'solid') {
    return { type: 'solid', color: normalizeHexColor(input.color, fallback.type === 'solid' || fallback.type === 'gradient' ? fallback.color : '#050816') };
  }
  return fallback;
}

function buildLoudnormAnalysisFilter(preset: LoudnessNormalizationPreset): string {
  return `loudnorm=${[...preset.args, 'print_format=json'].join(':')}`;
}

function buildLoudnormRenderFilter(preset: LoudnessNormalizationPreset): string {
  return `loudnorm=${[
    ...preset.args,
    `measured_I=${LOUDNORM_MEASURED_I_PLACEHOLDER}`,
    `measured_TP=${LOUDNORM_MEASURED_TP_PLACEHOLDER}`,
    `measured_LRA=${LOUDNORM_MEASURED_LRA_PLACEHOLDER}`,
    `measured_thresh=${LOUDNORM_MEASURED_THRESH_PLACEHOLDER}`,
    `offset=${LOUDNORM_OFFSET_PLACEHOLDER}`,
    'linear=true',
    'print_format=summary'
  ].join(':')}`;
}

function buildAudioDenoiseFilters(clip: ExportClip, capabilities: FfmpegCapabilities | undefined, warnings: string[]): string {
  if (!clip.audioDenoise.enabled || clip.audioDenoise.strength <= 0) {
    return '';
  }
  if (capabilities?.hasArnndn === false) {
    warnings.push(`Audio denoise for clip ${clip.id} was skipped because the current FFmpeg build does not support arnndn.`);
    return '';
  }
  return `,arnndn=m=model.rnnn:mix=${formatFfmpegNumber(clip.audioDenoise.strength)}`;
}

function buildAudioRestorationFilters(clip: ExportClip): string {
  const filterChain = buildAudioRestorationFilterChain(clip.audioRestoration, { duration: clip.duration });
  return filterChain ? `,${filterChain}` : '';
}

function buildPanFilter(clip: ExportClip): string {
  if (Math.abs(clip.pan) < 0.001) {
    return '';
  }
  return `,stereopan=pan=${formatPan(clip.pan)}`;
}

function buildAutomationFilters(clip: ExportClip): string {
  const automation = clip.automation;
  if (!automation) {
    return '';
  }
  const filters: string[] = [];

  // Apply automation volume curve
  if (automation.volume?.points?.length && automation.volume.points.length >= 2) {
    const points = automation.volume.points;
    const duration = clip.duration;
    // Build FFmpeg volume keyframe expression using stepwise linear interpolation
    let expr = '';
    for (let i = points.length - 1; i >= 0; i--) {
      const p = points[i];
      const linearGain = Math.pow(10, p.value / 20);
      if (i === points.length - 1) {
        expr = formatFfmpegNumber(linearGain);
      } else {
        const nextTime = points[i + 1].time;
        expr = `if(between(t,${formatFfmpegSeconds(p.time)},${formatFfmpegSeconds(nextTime)}),${formatFfmpegNumber(linearGain)},${expr})`;
      }
    }
    // Handle time before first point
    const firstGain = Math.pow(10, points[0].value / 20);
    expr = `if(lt(t,${formatFfmpegSeconds(points[0].time)}),${formatFfmpegNumber(firstGain)},${expr})`;
    filters.push(`volume='${expr}':eval=frame`);
  }

  // Apply automation pan curve
  if (automation.pan?.points?.length && automation.pan.points.length >= 2) {
    const points = automation.pan.points;
    let expr = '';
    for (let i = points.length - 1; i >= 0; i--) {
      const p = points[i];
      const panValue = Math.max(-1, Math.min(1, p.value / 100));
      if (i === points.length - 1) {
        expr = formatFfmpegNumber(panValue);
      } else {
        const nextTime = points[i + 1].time;
        expr = `if(between(t,${formatFfmpegSeconds(p.time)},${formatFfmpegSeconds(nextTime)}),${formatFfmpegNumber(panValue)},${expr})`;
      }
    }
    const firstPan = Math.max(-1, Math.min(1, points[0].value / 100));
    expr = `if(lt(t,${formatFfmpegSeconds(points[0].time)}),${formatFfmpegNumber(firstPan)},${expr})`;
    filters.push(`stereopan=pan='${expr}'`);
  }

  return filters.length > 0 ? `,${filters.join(',')}` : '';
}

function buildSpatialAudioFilter(clip: ExportClip, settings: ExportSettings): string {
  const spatial = normalizeSpatialAudio(clip.spatialAudio);
  const sofalizerArgs = buildSofalizerArgs(spatial, settings.spatialAudioAssets?.hrtfPath ?? undefined);
  if (sofalizerArgs.length > 0) {
    return `,sofalizer=${sofalizerArgs.map(escapeSofalizerArg).join(':')}`;
  }
  const xFrames = getAnimatedFrames(clip, 'spatialX');
  const yFrames = getAnimatedFrames(clip, 'spatialY');
  if (isDefaultSpatialAudio(spatial) && xFrames.length === 0 && yFrames.length === 0) {
    return '';
  }
  const parts: string[] = [];
  if (xFrames.length >= 2) {
    parts.push(
      `pan=stereo|c0='${buildSpatialPanGainExpression(xFrames, spatial.x, 'left')}'*c0|c1='${buildSpatialPanGainExpression(xFrames, spatial.x, 'right')}'*c1`
    );
  } else {
    const x = xFrames[0]?.value ?? spatial.x;
    const gains = mapSpatialXToPanGains(x);
    if (Math.abs(gains.left - 1) >= 0.001 || Math.abs(gains.right - 1) >= 0.001) {
      parts.push(`pan=stereo|c0=${formatFfmpegNumber(gains.left)}*c0|c1=${formatFfmpegNumber(gains.right)}*c1`);
    }
  }
  if (yFrames.length >= 2) {
    parts.push(`volume='${buildSpatialVolumeExpression(yFrames, spatial)}':eval=frame`);
  } else {
    const gain = calculateSpatialDistanceGain(spatial);
    if (Math.abs(gain - 1) >= 0.001) {
      parts.push(`volume=${formatVolume(gain)}`);
    }
  }
  return parts.length > 0 ? `,${parts.join(',')}` : '';
}

function escapeSofalizerArg(arg: string): string {
  const separator = arg.indexOf('=');
  if (separator < 0) {
    return arg;
  }
  const key = arg.slice(0, separator);
  const value = arg.slice(separator + 1);
  return key === 'sofa' ? `${key}=${escapeFilterFileValue(value)}` : `${key}=${value}`;
}

function escapeFilterFileValue(value: string): string {
  return normalizeFfmpegPath(value)
    .replace(/:/g, '\\:')
    .replace(/'/g, "\\'");
}

function buildSpatialPanGainExpression(frames: Array<{ time: number; value: number; easing?: ExportKeyframe['easing'] }>, fallbackX: number, channel: 'left' | 'right'): string {
  const mapped = frames.map((frame) => ({
    ...frame,
    value: channel === 'left' ? mapSpatialXToPanGains(frame.value).left : mapSpatialXToPanGains(frame.value).right
  }));
  const fallback = channel === 'left' ? mapSpatialXToPanGains(fallbackX).left : mapSpatialXToPanGains(fallbackX).right;
  return buildLocalExpression(mapped, fallback);
}

function buildSpatialVolumeExpression(frames: Array<{ time: number; value: number; easing?: ExportKeyframe['easing'] }>, spatial: ExportClip['spatialAudio']): string {
  const mapped = frames.map((frame) => ({
    ...frame,
    value: calculateSpatialDistanceGain({ ...spatial, y: frame.value })
  }));
  return buildLocalExpression(mapped, calculateSpatialDistanceGain(spatial));
}

function buildAudioChannelRoutingFilter(clip: ExportClip): string {
  switch (clip.audioChannelRouting) {
    case 'mono-left':
      return ',pan=stereo|c0=c0|c1=0*c0';
    case 'mono-right':
      return ',pan=stereo|c0=0*c0|c1=c0';
    case 'mono-both':
      return ',pan=stereo|c0=c0|c1=c0';
    case 'swap-stereo':
      return ',pan=stereo|c0=c1|c1=c0';
    case 'stereo-left-mono':
      return ',pan=stereo|c0=c0|c1=c0';
    case 'stereo-right-mono':
      return ',pan=stereo|c0=c1|c1=c1';
    case 'stereo-to-mono':
      return ',pan=mono|c0=0.5*c0+0.5*c1';
    case 'normal':
      return '';
  }
}

function buildTrackAudioFilters(clip: ExportClip): string {
  const filters: string[] = [];
  if (clip.eq.enabled) {
    filters.push(...buildEqualizerFilters(clip.eq));
  }
  if (clip.compressor.enabled) {
    filters.push(
      `acompressor=threshold=${formatCompressorLinear(clip.compressor.threshold)}:ratio=${formatFfmpegNumber(
        clip.compressor.ratio
      )}:attack=${formatFfmpegNumber(clip.compressor.attack)}:release=${formatFfmpegNumber(clip.compressor.release)}:makeup=${formatCompressorLinear(
        clip.compressor.makeupGain
      )}`
    );
  }
  return filters.length > 0 ? `,${filters.join(',')}` : '';
}

function buildMasterAudioFilters(masterProcessing: ExportSettings['masterProcessing'] | undefined): string[] {
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

function buildEqualizerFilters(eq: Pick<ExportMasterEq, 'bands'>): string[] {
  const filters: string[] = [];
  for (const band of eq.bands) {
    if (Math.abs(band.gain) < 0.001) {
      continue;
    }
    filters.push(`equalizer=f=${formatFfmpegNumber(band.frequency)}:width_type=o:width=${formatFfmpegNumber(band.q)}:g=${formatFfmpegNumber(band.gain)}`);
  }
  return filters;
}

function buildAudioFadeFilters(clip: ExportClip): string {
  const filters: string[] = [];
  if (clip.fadeInDuration > 0) {
    filters.push(`afade=t=in:st=0:d=${formatFfmpegSeconds(Math.min(clip.fadeInDuration, clip.duration))}${formatAudioFadeCurve(clip.fadeInCurve)}`);
  }
  if (clip.fadeOutDuration > 0) {
    const duration = Math.min(clip.fadeOutDuration, clip.duration);
    filters.push(`afade=t=out:st=${formatFfmpegSeconds(Math.max(0, clip.duration - duration))}:d=${formatFfmpegSeconds(duration)}${formatAudioFadeCurve(clip.fadeOutCurve)}`);
  }
  return filters.length > 0 ? `,${filters.join(',')}` : '';
}

function formatAudioFadeCurve(curve: ExportClip['fadeInCurve']): string {
  if (curve === 'ease-in') {
    return ':curve=qsin';
  }
  if (curve === 'ease-out') {
    return ':curve=hsin';
  }
  if (curve === 'ease-in-out') {
    return ':curve=esin';
  }
  return '';
}

function buildVolumeFilter(clip: ExportClip): string {
  const frames = getAnimatedFrames(clip, 'volume');
  if (frames.length >= 2) {
    return `volume='${buildLocalExpression(frames, clip.volume)}':eval=frame`;
  }
  if (frames.length === 1) {
    return `volume=${formatVolume(frames[0].value)}`;
  }
  return `volume=${formatVolume(clip.volume)}`;
}

export function buildAtempoFilters(speed: number): string[] {
  let remaining = getClipSpeed({ speed });
  const filters: string[] = [];
  while (remaining < 0.5 - 0.0001) {
    filters.push('atempo=0.5');
    remaining /= 0.5;
  }
  while (remaining > 2 + 0.0001) {
    filters.push('atempo=2.0');
    remaining /= 2;
  }
  if (Math.abs(remaining - 1) >= 0.0001) {
    filters.push(`atempo=${formatAtempo(remaining)}`);
  }
  return filters;
}

type AnimatedProperty = keyof NonNullable<ExportClip['keyframes']>;

function getAnimatedFrames(clip: ExportClip, property: AnimatedProperty): ExportKeyframe[] {
  return [...(clip.keyframes?.[property] ?? [])].sort((left, right) => left.time - right.time || left.id.localeCompare(right.id));
}

function buildLocalExpression(frames: Array<{ time: number; value: number; easing?: ExportKeyframe['easing'] }>, fallback: number, variable = 't'): string {
  if (frames.length < 2) {
    return formatFfmpegNumber(frames[0]?.value ?? fallback);
  }
  const first = frames[0];
  const last = frames[frames.length - 1];
  let expression = formatFfmpegNumber(last.value);
  for (let index = frames.length - 2; index >= 0; index -= 1) {
    const left = frames[index];
    const right = frames[index + 1];
    expression = `if(lte(${variable},${formatFfmpegSeconds(right.time)}),${buildSegmentExpression(left, right, variable)},${expression})`;
  }
  return `if(lt(${variable},${formatFfmpegSeconds(first.time)}),${formatFfmpegNumber(first.value)},${expression})`;
}

function buildTimelineExpression(frames: Array<{ time: number; value: number; easing?: ExportKeyframe['easing'] }>, clipStart: number, fallback: number, variable = 't'): string {
  if (frames.length < 2) {
    return formatFfmpegNumber(frames[0]?.value ?? fallback);
  }
  const shifted = frames.map((frame) => ({ ...frame, time: clipStart + frame.time }));
  return buildLocalExpression(shifted, fallback, variable);
}

function buildSegmentExpression(
  left: { time: number; value: number; easing?: ExportKeyframe['easing'] },
  right: { time: number; value: number },
  variable: string
): string {
  const start = formatFfmpegSeconds(left.time);
  const startValue = formatFfmpegNumber(left.value);
  const endValue = formatFfmpegNumber(right.value);
  const span = formatFfmpegSeconds(Math.max(0.001, right.time - left.time));
  const progress = `((${variable}-${start})/${span})`;
  return `${startValue}+(${endValue}-${startValue})*${buildEasingExpression(progress, left.easing ?? 'linear')}`;
}

function buildEasingExpression(progress: string, easing: ExportKeyframe['easing']): string {
  if (easing === 'ease-in') {
    return `(${progress})*(${progress})`;
  }
  if (easing === 'ease-out') {
    return `1-(1-(${progress}))*(1-(${progress}))`;
  }
  if (easing === 'ease-in-out') {
    return `if(lt(${progress},0.5),2*(${progress})*(${progress}),1-pow(-2*(${progress})+2,2)/2)`;
  }
  if (easing === 'elastic') {
    return `if(eq(${progress},0),0,if(eq(${progress},1),1,min(1,max(0,pow(2,-10*(${progress}))*sin(((${progress})*10-0.75)*2*PI/3)+1))))`;
  }
  if (easing === 'bounce') {
    return buildBounceEasingExpression(progress);
  }
  return progress;
}

function buildBounceEasingExpression(progress: string): string {
  const n1 = '7.5625';
  const d1 = '2.75';
  const second = `${n1}*((${progress})-1.5/${d1})*((${progress})-1.5/${d1})+0.75`;
  const third = `${n1}*((${progress})-2.25/${d1})*((${progress})-2.25/${d1})+0.9375`;
  const fourth = `${n1}*((${progress})-2.625/${d1})*((${progress})-2.625/${d1})+0.984375`;
  return `if(lt(${progress},1/${d1}),${n1}*(${progress})*(${progress}),if(lt(${progress},2/${d1}),${second},if(lt(${progress},2.5/${d1}),${third},${fourth})))`;
}

function formatAtempo(value: number): string {
  const fixed = value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
  return fixed.includes('.') ? fixed : `${fixed}.0`;
}

function formatPitchRatio(semitones: number): string {
  return formatFfmpegNumber(2 ** (semitones / 12));
}

function formatFfmpegNumber(value: number): string {
  const rounded = Math.round(value * 1000) / 1000;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(/0+$/g, '').replace(/\.$/g, '');
}

function safeLabel(value: string): string {
  return value.replace(/[^a-zA-Z0-9_]/g, '_');
}

function nestedInputPlaceholder(sequenceId: string): string {
  return `__NESTED_SEQUENCE_${safeLabel(sequenceId)}__.mp4`;
}

function formatScale(value: number): string {
  return formatFfmpegSeconds(Math.max(0.01, value || 1));
}

function formatOpacity(value: number): string {
  return formatFfmpegSeconds(Math.min(1, Math.max(0, value)));
}

function formatVolume(value: number): string {
  return formatFfmpegSeconds(Math.min(4, Math.max(0, value)));
}

function formatPan(value: number): string {
  return formatFfmpegNumber(Math.min(1, Math.max(-1, value)));
}

function formatCompressorLinear(db: number): string {
  return formatFfmpegNumber(Math.min(64, Math.max(0.000976563, 10 ** (db / 20))));
}

function formatSigned(value: number): string {
  const formatted = formatFfmpegSeconds(Math.abs(value));
  return value < 0 ? `-${formatted}` : formatted;
}

function formatOffsetExpression(value: number): string {
  const formatted = formatSigned(value);
  return value < 0 ? formatted : `+${formatted}`;
}

function cssColorToAssColor(value: string, opacity?: number): string {
  const match = /^#?([a-fA-F0-9]{6})$/.exec(value.trim());
  const hex = match ? match[1] : 'ffffff';
  const red = hex.slice(0, 2);
  const green = hex.slice(2, 4);
  const blue = hex.slice(4, 6);
  if (opacity === undefined) {
    return `&H${blue}${green}${red}&`;
  }
  const alpha = Math.round((1 - Math.min(1, Math.max(0, opacity))) * 255)
    .toString(16)
    .padStart(2, '0');
  return `&H${alpha}${blue}${green}${red}&`;
}
