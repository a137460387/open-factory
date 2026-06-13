import {
  DEFAULT_COLOR_CORRECTION,
  DEFAULT_SUBTITLE_MODE,
  MAX_NESTED_SEQUENCE_DEPTH,
  isDefaultColorCorrection,
  normalizeColorCorrection,
  normalizeMasterVolume,
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
  normalizeAudioDenoise,
  normalizeAudioPitchSemitones,
  normalizeFrameInterpolation,
  normalizeSequenceFrameRate,
  normalizeSlowMotionMode,
  normalizeStabilization,
  normalizeTransform,
  normalizeMasks,
  type ClipKeyframes,
  type Project,
  type Timeline
} from '../model';
import {
  isDefaultColorCurves,
  isNeutralThreeWayColor,
  normalizeThreeWayColor,
  serializeColorCurvesToCube,
  type ColorWheelValue,
  type ThreeWayColor
} from '../color-grading';
import { getLogToRec709Lut, isLogInputColorSpace, serializeLogToRec709Cube } from '../color-log-luts';
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
import { cloneClipKeyframes, normalizeClipKeyframes } from '../keyframes';
import { triangulatePathMask } from '../masks/path-mask';
import { flattenMulticamProjectForExport } from '../multicam';
import { buildReframeCropFilter, clampReframeOffset, isReframeEnabled, normalizeTargetAspectRatio, resolveReframeDimensions } from '../reframe';
import { calculateSpeedCurveSourceDuration, getClipSourceVisibleDuration, getClipSpeed, getRenderableTracks, getTimelinePlaybackDuration, getTrackPan, getTrackVolume } from '../timeline';
import { round } from '../time';
import { serializeSrt } from '../subtitles/srt';
import { cssColorToFfmpeg, escapeDrawtextValue, formatFfmpegSeconds, normalizeFfmpegPath, quoteForDisplay } from './ffmpeg-escape';
import type {
  ExportClip,
  ExportClipKeyframes,
  ExportAudioVisualizationBackground,
  ExportAudioVisualizationSettings,
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
  hardwareEncoding: false,
  loudnessNormalization: 'off',
  platformPreset: undefined,
  videoProfile: undefined,
  watermark: null,
  audioVisualization: {
    style: 'waveform-line',
    color: '#22d3ee',
    background: { type: 'solid', color: '#050816' }
  }
};

export const SETPTS_EXPRESSION_LIMIT = 4096;
const GIF_PALETTE_PLACEHOLDER = '__GIF_PALETTE_open_factory__';
const LOUDNORM_MEASURED_I_PLACEHOLDER = '__LOUDNORM_MEASURED_I__';
const LOUDNORM_MEASURED_TP_PLACEHOLDER = '__LOUDNORM_MEASURED_TP__';
const LOUDNORM_MEASURED_LRA_PLACEHOLDER = '__LOUDNORM_MEASURED_LRA__';
const LOUDNORM_MEASURED_THRESH_PLACEHOLDER = '__LOUDNORM_MEASURED_THRESH__';
const LOUDNORM_OFFSET_PLACEHOLDER = '__LOUDNORM_OFFSET__';
const WATERMARK_MARGIN_PX = 24;
const CUSTOM_SHADER_SEQUENCE_KIND = 'custom-shader-sequence';

interface LoudnessNormalizationPreset {
  mode: Exclude<ExportLoudnessNormalization, 'off'>;
  args: string[];
}

interface BuildFfmpegExportPlanOptions {
  frameExport?: {
    time: number;
  };
}

export function buildExportProjectFromProject(project: Project, options: BuildExportProjectOptions): ExportProject {
  const exportSourceProject = flattenMulticamProjectForExport(project);
  const mediaById = new Map(exportSourceProject.media.map((asset) => [asset.id, asset]));
  const primaryTimeline = getProjectPrimaryTimeline(exportSourceProject);
  const settings = normalizeExportReframeSettings({
    ...DEFAULT_EXPORT_SETTINGS,
    width: exportSourceProject.settings.width || DEFAULT_EXPORT_SETTINGS.width,
    height: exportSourceProject.settings.height || DEFAULT_EXPORT_SETTINGS.height,
    fps: exportSourceProject.settings.fps || DEFAULT_EXPORT_SETTINGS.fps,
    ...options.settings,
    outputPath: normalizeFfmpegPath(options.outputPath)
  });
  return {
    settings,
    masterVolume: normalizeMasterVolume(exportSourceProject.masterVolume),
    timeline: buildExportTimeline(primaryTimeline, mediaById, options),
    sequences: getProjectSequences(exportSourceProject)
      .filter((sequence) => sequence.id !== 'sequence-main')
      .map((sequence) => ({ id: sequence.id, name: sequence.name, timeline: buildExportTimeline(sequence.timeline, mediaById, options) }))
  };
}

function buildExportTimeline(timeline: Timeline, mediaById: Map<string, Project['media'][number]>, options: BuildExportProjectOptions): ExportTimeline {
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
            colorCorrection: normalizeColorCorrection(clip.colorCorrection),
            chromaKey: normalizeChromaKey(clip.chromaKey),
            stabilization: normalizeStabilization(clip.stabilization),
            frameInterpolation: normalizeFrameInterpolation(clip.frameInterpolation),
            audioDenoise: normalizeAudioDenoise(clip.audioDenoise),
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
            keyframes: buildExportClipKeyframes(clip.keyframes, clip.duration, trackVolume),
            kenBurns: clip.type === 'image' ? Boolean(clip.kenBurns) : false,
            volume: ('volume' in clip ? clip.volume : 1) * trackVolume,
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
                    italic: clip.style.italic
                  }
                : null,
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
                    yOffset: clip.style.yOffset
                  }
                : null,
            subtitleMode: clip.type === 'subtitle' ? (clip.subtitleMode ?? DEFAULT_SUBTITLE_MODE) : null
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
  const audioOnly = !audioVisualization && (settings.outputMode === 'audio' || settings.format === 'm4a');
  const audioVisualizationSettings = audioVisualization ? normalizeExportAudioVisualization(settings.audioVisualization) : undefined;
  const pngSequence = settings.format === 'png-sequence';
  const gifExport = settings.format === 'gif';
  const webpAnimation = settings.format === 'webp';
  const apngExport = settings.format === 'apng';
  const animatedImage = gifExport || webpAnimation || apngExport;
  const frameExportTime = options.frameExport ? Math.min(duration, Math.max(0, options.frameExport.time)) : null;
  const videoFramesOnly = frameExportTime !== null || pngSequence || animatedImage;
  const watermark = !audioOnly && !videoFramesOnly && !audioVisualization ? normalizeExportWatermark(settings.watermark) : null;
  const warnings: string[] = [];
  const inputs: FfmpegInput[] = [];
  const visualInputByClipId = new Map<string, number>();
  const audioInputByClipId = new Map<string, number>();
  const customShaderSequenceClips = new Map<string, ExportClip>();
  const filters: string[] = [];
  const textArtifacts: TextArtifact[] = [];
  const allClips = project.timeline.tracks.flatMap((track) => track.clips).filter((clip) => clip.duration > 0);
  const renderableTracks = getRenderableTracks({ tracks: project.timeline.tracks });
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

  for (const clip of orderedClips) {
    if (!clip.mediaPath || clip.type === 'text' || clip.type === 'subtitle') {
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
      args: ['-loop', '1', '-t', formatFfmpegSeconds(duration)]
    });
  }
  if (watermark?.enabled && watermark.type === 'image') {
    imageWatermarkInputIndex = inputs.length;
    inputs.push({
      index: imageWatermarkInputIndex,
      path: normalizeFfmpegPath(watermark.path),
      args: ['-loop', '1', '-t', formatFfmpegSeconds(duration)]
    });
  }

  let currentVideo = 'base0';
  let videoStep = 0;

  if (!audioOnly) {
    if (audioVisualizationSettings) {
      filters.push(...buildAudioVisualizationBackgroundFilters(audioVisualizationSettings.background, settings, duration, audioVisualizationBackgroundImageInputIndex));
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
          const adjustmentFilters = buildAdjustmentLayerFilters(currentVideo, nextVideo, item.clip, textArtifacts);
          if (adjustmentFilters.length > 0) {
            filters.push(...adjustmentFilters);
            currentVideo = nextVideo;
            videoStep += 1;
          }
          continue;
        }
        if (item.kind === 'text') {
          if (capabilities && (!capabilities.hasDrawtext || !capabilities.hasLibfreetype)) {
            warnings.push(capabilities.drawtextWarning ?? `Text clip ${item.clip.id} was skipped because FFmpeg drawtext/libfreetype is unavailable.`);
            continue;
          }
          const nextVideo = `base${videoStep + 1}`;
          const { filter, artifact } = buildTextFilter(currentVideo, nextVideo, item.clip, settings);
          filters.push(filter);
          textArtifacts.push(artifact);
          currentVideo = nextVideo;
          videoStep += 1;
          continue;
        }

        const nextVideo = `base${videoStep + 1}`;
        filters.push(
          `[${currentVideo}][${item.label}]overlay=x='${item.xExpression}':y='${item.yExpression}':eval=frame:enable='between(t,${formatFfmpegSeconds(
            item.start
          )},${formatFfmpegSeconds(item.start + item.duration)})'[${nextVideo}]`
        );
        currentVideo = nextVideo;
        videoStep += 1;
      }
    }
  }

  const subtitleClips = orderedPlaybackClips.filter((clip) => clip.type === 'subtitle' && clip.subtitleStyle && clip.textStyle === null);
  const subtitleMode = settings.subtitleMode ?? subtitleClips.find((clip) => clip.subtitleMode)?.subtitleMode ?? DEFAULT_SUBTITLE_MODE;
  let softSubtitleInputIndex: number | undefined;
  if (!audioOnly && subtitleClips.length > 0 && subtitleMode === 'burn-in') {
    const nextVideo = `base${videoStep + 1}`;
    const { filter, artifact } = buildSubtitleBurnInFilter(currentVideo, nextVideo, subtitleClips);
    filters.push(filter);
    textArtifacts.push(artifact);
    currentVideo = nextVideo;
    videoStep += 1;
  } else if (!audioOnly && !videoFramesOnly && subtitleClips.length > 0 && subtitleMode === 'soft-sub') {
    const artifact = buildSubtitleArtifact(subtitleClips, 'argument');
    softSubtitleInputIndex = inputs.length;
    inputs.push({
      index: softSubtitleInputIndex,
      path: artifact.placeholder,
      args: ['-f', 'srt']
    });
    textArtifacts.push(artifact);
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
    const finalAudioLabel = loudnessPreset ? 'apremaster' : 'aout';
    const mixedAudioLabel = needsAudioSplit ? (loudnessPreset ? 'apremaster_mix' : 'amixout') : finalAudioLabel;
    if (audioLabels.length === 0) {
      audioFilters.push(`anullsrc=channel_layout=stereo:sample_rate=${settings.sampleRate}:d=${formatFfmpegSeconds(duration)},volume=${formatVolume(masterVolume)}[${mixedAudioLabel}]`);
    } else {
      audioFilters.push(
        `${audioLabels.map((label) => `[${label}]`).join('')}amix=inputs=${audioLabels.length}:duration=longest:normalize=0,atrim=duration=${formatFfmpegSeconds(
          duration
        )},asetpts=PTS-STARTPTS,aresample=${settings.sampleRate},volume=${formatVolume(masterVolume)}[${mixedAudioLabel}]`
      );
    }
    if (loudnessPreset) {
      loudnessAnalysisFilterComplex = [...audioFilters, `[${mixedAudioLabel}]${buildLoudnormAnalysisFilter(loudnessPreset)}[aout]`].join(';');
      if (needsAudioSplit) {
        filters.push(
          ...audioFilters,
          `[${mixedAudioLabel}]asplit=${audioSplitLabels.length + 1}[${finalAudioLabel}]${audioSplitLabels.map((label) => `[${label}]`).join('')}`,
          `[${finalAudioLabel}]${buildLoudnormRenderFilter(loudnessPreset)}[aout]`
        );
      } else {
        filters.push(...audioFilters, `[${mixedAudioLabel}]${buildLoudnormRenderFilter(loudnessPreset)}[aout]`);
      }
    } else {
      if (needsAudioSplit) {
        filters.push(...audioFilters, `[${mixedAudioLabel}]asplit=${audioSplitLabels.length + 1}[aout]${audioSplitLabels.map((label) => `[${label}]`).join('')}`);
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

  if (!audioOnly) {
    const outputPixelFormat = pngSequence || animatedImage ? 'rgba' : 'yuv420p';
    filters.push(`[${currentVideo}]trim=duration=${formatFfmpegSeconds(duration)},setpts=PTS-STARTPTS,fps=${settings.fps},format=${outputPixelFormat}[vout]`);
  }

  const filterComplex = filters.join(';');
  const maps = videoFramesOnly ? ['-map', '[vout]'] : audioOnly ? ['-map', '[aout]'] : ['-map', '[vout]', '-map', '[aout]'];
  const subtitleOutputArgs: string[] = [];
  if (softSubtitleInputIndex !== undefined) {
    maps.push('-map', `${softSubtitleInputIndex}:s:0`);
    subtitleOutputArgs.push('-c:s', 'mov_text');
  }
  const videoEncodingArgs = buildVideoEncodingArgs(settings, capabilities, warnings, audioOnly || videoFramesOnly);
  const outputArgs =
    pngSequence
      ? ['-r', String(settings.fps), '-f', 'image2', pngSequenceOutputPath(settings.outputPath)]
      : webpAnimation
      ? ['-c:v', 'libwebp_anim', '-loop', '0', '-r', String(settings.fps), '-f', 'webp', normalizeFfmpegPath(settings.outputPath)]
      : apngExport
      ? ['-plays', '0', '-f', 'apng', normalizeFfmpegPath(settings.outputPath)]
      : frameExportTime === null
      ? [
          ...(audioOnly
            ? []
            : videoEncodingArgs),
          '-c:a',
          settings.audioCodec,
          ...buildBitrateArgs('-b:a', settings.audioBitrate),
          ...subtitleOutputArgs,
          '-t',
          formatFfmpegSeconds(duration),
          ...buildContainerArgs(settings),
          normalizeFfmpegPath(settings.outputPath)
        ]
      : ['-ss', formatFfmpegSeconds(frameExportTime), '-frames:v', '1', '-f', 'image2', normalizeFfmpegPath(settings.outputPath)];
  const fullArgs = buildFfmpegFullArgs(inputs, filterComplex, maps, outputArgs);
  const gifPlan = gifExport ? buildGifExportPasses(inputs, filterComplex, settings, duration, textArtifacts) : undefined;
  const loudnessPlan = loudnessAnalysisFilterComplex ? buildLoudnessNormalizationPasses(inputs, loudnessAnalysisFilterComplex, fullArgs, duration) : undefined;
  const nestedPlans = buildNestedSequencePlans(project, capabilities, warnings, depth, sequenceStack);
  const planDuration = frameExportTime === null ? duration : Math.max(1 / Math.max(1, settings.fps), 0.001);

  return {
    inputs,
    filterComplex: gifPlan?.filterComplex ?? filterComplex,
    maps: gifPlan?.maps ?? maps,
    outputArgs: gifPlan?.outputArgs ?? outputArgs,
    fullArgs: gifPlan?.fullArgs ?? fullArgs,
    passes: gifPlan?.passes ?? loudnessPlan?.passes,
    warnings,
    textArtifacts,
    nestedPlans,
    displayCommand: ['ffmpeg', ...(gifPlan?.fullArgs ?? fullArgs).map(quoteForDisplay)].join(' '),
    duration: planDuration
  };
}

export function buildFfmpegCurrentFrameExportPlan(project: ExportProject, time: number, capabilities?: FfmpegCapabilities): FfmpegExportPlan {
  return buildFfmpegExportPlan(project, capabilities, 0, [], { frameExport: { time } });
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
    watermark: normalizeExportWatermark(settings.watermark),
    audioVisualization: normalizeExportAudioVisualization(settings.audioVisualization)
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
  textArtifacts: TextArtifact[]
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
  const gifOutputArgs = ['-loop', '0', '-t', formatFfmpegSeconds(duration), '-f', 'gif', normalizeFfmpegPath(settings.outputPath)];
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
    filters.push(
      `[${label}_from][${label}_to]xfade=transition=${mapTransitionType(transition.type)}:duration=${formatFfmpegSeconds(
        duration
      )}:offset=${formatFfmpegSeconds(Math.max(0, pair.fromClip.duration - duration))}[${label}_raw]`
    );
    filters.push(`[${label}_raw]setpts=PTS-STARTPTS+${formatFfmpegSeconds(start)}/TB[${label}]`);
    items.push({
      kind: 'media',
      trackIndex: pair.track.index,
      start,
      duration: pairDuration,
      label,
      xExpression: '(main_w-overlay_w)/2+0',
      yExpression: '(main_h-overlay_h)/2+0'
    });
    consumedClipIds.add(pair.fromClip.id);
    consumedClipIds.add(pair.toClip.id);
  }

  for (const clip of orderedPlaybackClips.filter((item) => item.type === 'video' || item.type === 'image' || item.type === 'text' || item.type === 'nested-sequence' || item.type === 'adjustment')) {
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
      yExpression: buildOverlayYExpression(clip)
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
    ...buildReframeFilters(settings),
    ...(isReframeEnabled(settings.targetAspectRatio)
      ? []
      : [`scale=${settings.width}:${settings.height}:force_original_aspect_ratio=decrease`, `pad=${settings.width}:${settings.height}:(ow-iw)/2:(oh-ih)/2:color=black`]),
    `fps=${settings.fps}`,
    ...buildSlowMotionFilters(clip, settings, capabilities, warnings),
    ...buildFrameInterpolationFilters(clip, capabilities, warnings),
    'format=rgba'
  ];
  filters.push(...buildMaskFilters(clip));
  filters.push(...buildColorCorrectionFilters(clip, textArtifacts));
  filters.push(...buildEffectFilters(clip.effects));
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

function mapTransitionType(type: ExportTransition['type']): string {
  return type === 'fade-black' ? 'fadeblack' : 'dissolve';
}

function visualKindOrder(item: VisualItem): number {
  if (item.kind === 'media') {
    return 0;
  }
  return item.kind === 'adjustment' ? 1 : 2;
}

function buildAdjustmentLayerFilters(inputLabel: string, outputLabel: string, clip: ExportClip, textArtifacts: TextArtifact[]): string[] {
  const processingFilters = [...buildColorCorrectionFilters(clip, textArtifacts), ...buildEffectFilters(clip.effects)];
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
  const filters = [`[${inputIndex}:v]${trim}`, ...buildChromaKeyFilters(clip)];
  if (isKenBurnsAnimatedScaleClip(clip)) {
    filters.push(buildSetptsFilter(clip, false, warnings), buildKenBurnsZoompanFilter(clip, settings), 'setsar=1', buildSetptsFilter(clip, true, warnings));
  } else {
    filters.push(buildSetptsFilter(clip, true, warnings), ...buildStabilizationFilters(clip), ...buildReframeFilters(settings), buildScaleFilter(clip), 'setsar=1');
  }
  if (settings.scaleMode === 'fit' && !isReframeEnabled(settings.targetAspectRatio)) {
    filters.push(
      `scale=${settings.width}:${settings.height}:force_original_aspect_ratio=decrease`,
      `pad=${settings.width}:${settings.height}:(ow-iw)/2:(oh-ih)/2:color=black`
    );
  }
  filters.push(...buildSlowMotionFilters(clip, settings, capabilities, warnings));
  filters.push(...buildFrameInterpolationFilters(clip, capabilities, warnings));
  filters.push('format=rgba');
  filters.push(...buildMaskFilters(clip));
  filters.push(...buildColorCorrectionFilters(clip, textArtifacts));
  filters.push(...buildEffectFilters(clip.effects));
  if (Math.abs(clip.transform.rotation) > 0.001) {
    filters.push(`rotate=${formatFfmpegNumber(clip.transform.rotation)}*PI/180:c=none`);
  }
  filters.push(...buildOpacityFilters(clip, label));
  return filters.join(',');
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
  if (!isChromaKeyEnabled(clip.chromaKey)) {
    return [];
  }
  const filters = clip.chromaKey.colors.map(
    (color) =>
      `chromakey=color=0x${formatChromaKeyColor(color)}:similarity=${formatFfmpegNumber(clip.chromaKey.similarity)}:blend=${formatFfmpegNumber(clip.chromaKey.blend)}`
  );
  const erosion = Math.round(clip.chromaKey.erosion);
  const edgeFilter = erosion > 0 ? 'erosion=coordinates=255' : erosion < 0 ? 'dilation=coordinates=255' : undefined;
  if (edgeFilter) {
    filters.push(...Array.from({ length: Math.abs(erosion) }, () => edgeFilter));
  }
  if (clip.chromaKey.spillSuppression) {
    filters.push('hue=s=0');
  }
  return filters;
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
  return [`minterpolate=fps=${fps}:mi_mode=mci:mc_mode=aobmc:vsbmc=1`];
}

function buildFrameInterpolationFilters(clip: ExportClip, capabilities: FfmpegCapabilities | undefined, warnings: string[]): string[] {
  if (!clip.frameInterpolation.enabled || (clip.type !== 'video' && clip.type !== 'nested-sequence')) {
    return [];
  }
  if (capabilities?.hasMinterpolate === false) {
    warnings.push(`Frame interpolation for clip ${clip.id} was skipped because the current FFmpeg build does not support minterpolate.`);
    return [];
  }
  return [`minterpolate=fps=${clip.frameInterpolation.targetFps}:mi_mode=mci:mc_mode=aobmc`];
}

function getMinimumClipSpeed(clip: ExportClip): number {
  const frames = getAnimatedFrames(clip, 'speed');
  if (frames.length === 0) {
    return clip.speed;
  }
  return Math.min(clip.speed, ...frames.map((frame) => frame.value));
}

function buildMaskFilters(clip: ExportClip): string[] {
  const masks = clip.masks.filter((mask) => mask.enabled);
  if (masks.length === 0) {
    return [];
  }
  if (masks.length === 1 && isSimpleRectMask(masks[0])) {
    return [buildSimpleRectMaskFilter(masks[0])];
  }
  return [buildGeqMaskFilter(masks)];
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
  if (colorCorrection.lutPath) {
    filters.push(`lut3d=file=${escapeDrawtextValue(colorCorrection.lutPath)}`);
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

function buildEffectFilters(effects: Effect[]): string[] {
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
    return [];
  });
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
  const color = cssColorToFfmpeg(params.color);
  const audioGain = `volume=${formatFfmpegNumber(params.sensitivity)}`;
  const alphaFilters = 'format=rgba,colorkey=0x000000:0.08:0.12,colorchannelmixer=aa=0.9';
  if (params.style === 'waveform') {
    return `[${inputLabel}]${audioGain},showwaves=s=${width}x${height}:mode=line:colors=${color},${alphaFilters}[${outputLabel}]`;
  }
  if (params.style === 'circle') {
    const size = Math.max(2, Math.min(width, height));
    return `[${inputLabel}]${audioGain},showfreqs=s=${size}x${size}:mode=line:ascale=log:colors=${color},${alphaFilters}[${outputLabel}]`;
  }
  return `[${inputLabel}]${audioGain},showfreqs=s=${width}x${height}:mode=bar:ascale=log:colors=${color},${alphaFilters}[${outputLabel}]`;
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
  const color = cssColorToFfmpeg(visualization.color);
  const alphaFilters = 'format=rgba,colorkey=0x000000:0.08:0.12,colorchannelmixer=aa=0.95';
  if (visualization.style === 'waveform-line') {
    return `[${inputLabel}]showwaves=s=${width}x${height}:mode=line:colors=${color},${alphaFilters}[${outputLabel}]`;
  }
  if (visualization.style === 'circular-spectrum') {
    const size = Math.max(2, Math.round(Math.min(width, height) * 0.72));
    return `[${inputLabel}]showfreqs=s=${size}x${size}:mode=line:ascale=log:colors=${color},${alphaFilters}[${outputLabel}]`;
  }
  return `[${inputLabel}]showfreqs=s=${width}x${height}:mode=bar:ascale=log:colors=${color},${alphaFilters}[${outputLabel}]`;
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
  if (skipVideoCodec) {
    return [];
  }
  if (settings.hardwareEncoding) {
    const format = settings.format.toLowerCase();
    const hardwareAllowedForContainer = format === 'mp4' || format === 'mov';
    const encoder = capabilities?.hardwareEncoderAvailable ? capabilities.hardwareEncoder : null;
    if (hardwareAllowedForContainer && encoder) {
      return ['-c:v', encoder, '-preset', 'p4', '-cq', '23', '-pix_fmt', 'yuv420p', '-r', String(settings.fps)];
    }
    warnings.push('Hardware video encoding was requested but no supported H.264 hardware encoder was detected. Falling back to software encoding.');
  }
  return ['-c:v', settings.videoCodec, ...buildBitrateArgs('-b:v', settings.videoBitrate), ...buildVideoProfileArgs(settings), '-pix_fmt', 'yuv420p', '-r', String(settings.fps)];
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
    return ['-movflags', '+faststart'];
  }
  return [];
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

function buildTextFilter(inputLabel: string, outputLabel: string, clip: ExportClip, settings: ExportSettings): { filter: string; artifact: TextArtifact } {
  const safeId = safeLabel(clip.id);
  const placeholder = `__TEXTFILE_${safeId}__`;
  const textSourceLabel = `textsrc_${safeId}`;
  const textDrawLabel = `textdraw_${safeId}`;
  const textLayerLabel = `textlayer_${safeId}`;
  const artifact: TextArtifact = {
    clipId: clip.id,
    text: clip.textStyle?.text ?? '',
    fileName: `${safeId}.txt`,
    placeholder
  };
  const style = clip.textStyle;
  const fontPath = style?.fontPath ? `:fontfile=${escapeDrawtextValue(style.fontPath)}` : '';
  const fontColor = cssColorToFfmpeg(style?.fontColor ?? 'white');
  const backgroundColor = cssColorToFfmpeg(style?.backgroundColor ?? 'black');
  const backgroundOpacity = formatOpacity(style?.backgroundOpacity ?? 0);
  const fontSize = buildTextFontSizeExpression(clip, Math.max(1, Math.round(style?.fontSize ?? 48)));
  const x = buildDrawtextPositionExpression(clip, 'x', style?.x ?? clip.transform.x);
  const y = buildDrawtextPositionExpression(clip, 'y', style?.y ?? clip.transform.y);
  const layerDuration = Math.max(0.001, clip.start + clip.duration);
  const opacityFilters = buildOpacityFilters(clip, textLayerLabel);
  return {
    artifact,
    filter: [
      `color=c=black@0:s=${settings.width}x${settings.height}:r=${settings.fps}:d=${formatFfmpegSeconds(layerDuration)},format=rgba[${textSourceLabel}]`,
      `[${textSourceLabel}]drawtext=textfile=${placeholder}${fontPath}:fontsize=${fontSize}:fontcolor=${fontColor}:x='${x}':y='${y}':alpha=1:box=1:boxcolor=${backgroundColor}@${backgroundOpacity}:boxborderw=${Math.max(
        0,
        Math.round((style?.fontSize ?? 48) * 0.25)
      )}:enable='between(t,${formatFfmpegSeconds(clip.start)},${formatFfmpegSeconds(clip.start + clip.duration)})'[${textDrawLabel}]`,
      `[${textDrawLabel}]${opacityFilters.join(',')}`,
      `[${inputLabel}][${textLayerLabel}]overlay=x=0:y=0:eval=frame:enable='between(t,${formatFfmpegSeconds(clip.start)},${formatFfmpegSeconds(clip.start + clip.duration)})'[${outputLabel}]`
    ].join(';')
  };
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

function buildSubtitleBurnInFilter(inputLabel: string, outputLabel: string, clips: ExportClip[]): { filter: string; artifact: TextArtifact } {
  const artifact = buildSubtitleArtifact(clips, 'filter');
  const style = clips.find((clip) => clip.subtitleStyle)?.subtitleStyle;
  const forceStyle = [
    `FontSize=${Math.max(1, Math.round(style?.fontSize ?? 42))}`,
    `PrimaryColour=${cssColorToAssColor(style?.fontColor ?? '#ffffff')}`,
    `BackColour=${cssColorToAssColor(style?.backgroundColor ?? '#000000', style?.backgroundOpacity ?? 0)}`,
    'BorderStyle=3',
    'Outline=0',
    'Shadow=0',
    'Alignment=2',
    `MarginV=${Math.max(0, Math.round(style?.yOffset ?? 72))}`
  ].join(',');
  return {
    artifact,
    filter: `[${inputLabel}]subtitles=filename=${artifact.placeholder}:force_style='${forceStyle}'[${outputLabel}]`
  };
}

function buildSubtitleArtifact(clips: ExportClip[], pathMode: TextArtifact['pathMode']): TextArtifact {
  const cues = clips
    .filter((clip) => clip.duration > 0 && (clip.subtitleStyle?.text ?? '').trim().length > 0)
    .sort((left, right) => left.start - right.start || left.id.localeCompare(right.id))
    .map((clip) => ({
      startMs: Math.round(Math.max(0, clip.start) * 1000),
      endMs: Math.round(Math.max(0, clip.start + clip.duration) * 1000),
      text: clip.subtitleStyle?.text ?? ''
    }));
  return {
    clipId: 'subtitles',
    text: serializeSrt(cues),
    fileName: 'subtitles.srt',
    placeholder: '__SUBTITLEFILE_export_subtitles__',
    pathMode
  };
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
    const trackProcessingFilters = buildTrackAudioFilters(clip);
    filters.push(
      `[${inputIndex}:a:0]atrim=start=0:duration=${formatFfmpegSeconds(
        getExportClipSourceDuration(clip)
      )},asetpts=PTS-STARTPTS${pitchAndReverseFilters.length > 0 ? `,${pitchAndReverseFilters.join(',')}` : ''}${speedFilters.length > 0 ? `,${speedFilters.join(',')}` : ''}${fadeFilters}${denoiseFilters}${trackProcessingFilters},adelay=${delay}:all=1,${buildVolumeFilter(
        clip
      )}${buildPanFilter(clip)},aformat=channel_layouts=stereo,aresample=${settings.sampleRate}[${label}]`
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
  return {
    style,
    color: normalizeHexColor(input?.color, defaultVisualization.color),
    background: normalizeAudioVisualizationBackground(input?.background, defaultVisualization.background)
  };
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

function buildPanFilter(clip: ExportClip): string {
  if (Math.abs(clip.pan) < 0.001) {
    return '';
  }
  return `,stereopan=pan=${formatPan(clip.pan)}`;
}

function buildTrackAudioFilters(clip: ExportClip): string {
  const filters: string[] = [];
  if (clip.eq.enabled) {
    for (const band of clip.eq.bands) {
      if (Math.abs(band.gain) < 0.001) {
        continue;
      }
      filters.push(
        `equalizer=f=${formatFfmpegNumber(band.frequency)}:width_type=o:width=${formatFfmpegNumber(band.q)}:g=${formatFfmpegNumber(band.gain)}`
      );
    }
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
  return progress;
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
