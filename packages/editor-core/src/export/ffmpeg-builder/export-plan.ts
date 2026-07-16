import { DEFAULT_SUBTITLE_MODE, MAX_NESTED_SEQUENCE_DEPTH, normalizeMasterVolume } from '../../model';
import { getRenderableTracks } from '../../timeline';
import { round } from '../../time';
import { normalizeExportRenderRange } from '../export-ranges';
import { normalizeExportPostScript } from '../post-export-script';
import { formatFfmpegSeconds, normalizeFfmpegPath, quoteForDisplay } from '../ffmpeg-escape';
import type {
  ExportClip,
  ExportPreviewSampleKind,
  ExportPreviewSamplePlan,
  ExportProject,
  ExportSettings,
  FfmpegCapabilities,
  FfmpegExportPlan,
  FfmpegInput,
  NestedFfmpegExportPlan,
  TextArtifact,
} from '../export-types';
import {
  type BuildFfmpegExportPlanOptions,
  EXPORT_PREVIEW_SAMPLE_KINDS,
  SLATE_DURATION_SECONDS,
  buildExportRangeOutputArgs,
  buildFfmpegFullArgs,
  buildGifExportPasses,
  buildLoudnessNormalizationPasses,
  buildSlateVideoFilters,
  buildTimecodeBurnInFilter,
  buildWatermarkFilters,
  normalizeExportAudioVisualization,
  normalizeExportSlate,
  normalizeExportWatermark,
  normalizeSettingsForExportFormat,
  normalizeTimecodeBurnIn,
} from './settings-normalize';
import {
  buildAdjustmentLayerFilters,
  buildMediaCompositeFilter,
  buildPlaybackStartByClipId,
  buildVisualItems,
  hasSphericalVideoClips,
} from './visual-filters';
import {
  buildCreditsRollFilter,
  buildCustomShaderSequenceArtifact,
  buildCustomShaderSequenceClip,
  buildCustomShaderSequenceInputArgs,
  buildImageSequenceArtifact,
  buildInputArgs,
  buildMotionGraphicSequenceArtifact,
  buildPathTextSequenceArtifact,
  buildPathTextSequenceOverlayFilter,
  buildSoftSubtitleCodec,
  buildSubtitleArtifact,
  buildSubtitleBurnInFilter,
  buildSubtitleInputArgs,
  buildSubtitleLanguageGroups,
  buildTextFilter,
  normalizeSubtitleFormat,
  pngSequenceOutputPath,
  resolveAudioVisualizationBackground,
  selectSubtitleBurnInGroup,
  subtitleLanguageToFfmpegMetadata,
} from './text-subtitle-filters';
import {
  buildAudioSpectrumFilter,
  buildAudioSpectrumOverlayYExpression,
  buildAudioVisualizationBackgroundFilters,
  buildAudioVisualizationFilter,
  buildAudioVisualizationOverlayPosition,
  collectAudioSpectrumEffects,
} from './audio-visualization';
import { buildAudioFilters, buildMasterAudioFilters, buildLoudnormAnalysisFilter, buildLoudnormRenderFilter, getLoudnessNormalizationPreset } from './audio-filters';
import {
  buildBitrateArgs,
  buildContainerArgs,
  buildExportColorManagementFilters,
  buildExportColorMetadataArgs,
  buildExportContainerMetadataArgs,
  buildVideoEncodingArgs,
  formatVolume,
  nestedInputPlaceholder,
} from './utils';

export function buildFfmpegExportPlan(
  project: ExportProject,
  capabilities?: FfmpegCapabilities,
  depth = 0,
  sequenceStack: string[] = [],
  options: BuildFfmpegExportPlanOptions = {},
): FfmpegExportPlan {
  const duration = Math.max(project.timeline.duration, 0.001);
  const settings = normalizeSettingsForExportFormat(project.settings);

  // Validate export format
  const SUPPORTED_FORMATS = new Set([
    'mp4', 'mov', 'webm', 'mkv', 'avi',
    'm4a', 'mp3', 'wav', 'aac', 'flac', 'ogg',
    'gif', 'webp', 'apng', 'png-sequence',
    'jpg', 'jpeg', 'png', 'bmp', 'tiff',
  ]);
  if (!SUPPORTED_FORMATS.has(settings.format)) {
    throw new Error(`Unsupported export format: "${settings.format}". Supported: ${[...SUPPORTED_FORMATS].join(', ')}`);
  }

  const audioVisualization = settings.outputMode === 'audio-visualization';
  const stemMode = typeof options.stemTrackIndex === 'number' && Number.isFinite(options.stemTrackIndex);
  const audioOnly = !audioVisualization && (settings.outputMode === 'audio' || settings.format === 'm4a' || stemMode);
  const audioVisualizationSettings = audioVisualization
    ? normalizeExportAudioVisualization(settings.audioVisualization)
    : undefined;
  const pngSequence = settings.format === 'png-sequence';
  const gifExport = settings.format === 'gif';
  const webpAnimation = settings.format === 'webp';
  const apngExport = settings.format === 'apng';
  const animatedImage = gifExport || webpAnimation || apngExport;
  const frameExportTime = options.frameExport ? Math.min(duration, Math.max(0, options.frameExport.time)) : null;
  const videoFramesOnly = frameExportTime !== null || pngSequence || animatedImage;
  const watermark =
    !audioOnly && !videoFramesOnly && !audioVisualization ? normalizeExportWatermark(settings.watermark) : null;
  const drawtextAvailable = !capabilities || (capabilities.hasDrawtext && capabilities.hasLibfreetype);
  const requestedTimecodeBurnIn =
    !audioOnly && !videoFramesOnly && !audioVisualization ? normalizeTimecodeBurnIn(settings.timecodeBurnIn) : null;
  const requestedSlate =
    !audioOnly && !videoFramesOnly && !audioVisualization ? normalizeExportSlate(settings.slate) : null;
  const timecodeBurnIn = drawtextAvailable ? requestedTimecodeBurnIn : null;
  const slate = drawtextAvailable ? requestedSlate : null;
  const slateDuration = slate?.enabled ? SLATE_DURATION_SECONDS : 0;
  const outputDuration = duration + slateDuration;
  const outputRange =
    frameExportTime === null ? normalizeExportRenderRange(options.exportRange, duration, settings.fps) : null;
  const encodedDuration = outputRange ? outputRange.duration + slateDuration : outputDuration;
  const warnings: string[] = [];
  if (requestedTimecodeBurnIn?.enabled && !drawtextAvailable) {
    warnings.push(
      capabilities?.drawtextWarning ??
        'Current FFmpeg does not support drawtext/libfreetype. Install an FFmpeg build with libfreetype to export timecode burn-in.',
    );
  }
  if (requestedSlate?.enabled && !drawtextAvailable) {
    warnings.push(
      capabilities?.drawtextWarning ??
        'Current FFmpeg does not support drawtext/libfreetype. Install an FFmpeg build with libfreetype to export slate overlays.',
    );
  }
  const inputs: FfmpegInput[] = [];
  const visualInputByClipId = new Map<string, number>();
  const audioInputByClipId = new Map<string, number>();
  const customShaderSequenceClips = new Map<string, ExportClip>();
  const pathTextSequenceInputByClipId = new Map<string, number>();
  const filters: string[] = [];
  const textArtifacts: TextArtifact[] = [];
  const allClips = project.timeline.tracks.flatMap((track) => track.clips).filter((clip) => clip.duration > 0);
  const sphericalMetadataArgs =
    hasSphericalVideoClips(allClips) && !audioOnly && !videoFramesOnly ? ['-metadata:s:v:0', 'spherical=true'] : [];
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
    start: playbackStartByClipId.get(clip.id) ?? clip.start,
  }));
  const audioSpectrumEffects =
    !audioOnly && !videoFramesOnly && !audioVisualization ? collectAudioSpectrumEffects(orderedPlaybackClips) : [];

  if (
    !audioOnly &&
    !videoFramesOnly &&
    !audioVisualization &&
    (!capabilities || (capabilities.hasDrawtext && capabilities.hasLibfreetype))
  ) {
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
        args: buildCustomShaderSequenceInputArgs(settings),
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
        args: buildCustomShaderSequenceInputArgs(settings),
      });
      visualInputByClipId.set(clip.id, inputs[inputs.length - 1].index);
    }
  }

  for (const clip of orderedClips) {
    if (!clip.mediaPath || clip.type === 'text' || clip.type === 'subtitle' || clip.type === 'credits') {
      continue;
    }
    const customShaderArtifact =
      !audioOnly && !videoFramesOnly ? buildCustomShaderSequenceArtifact(clip, settings) : undefined;
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
      args: customShaderArtifact ? buildCustomShaderSequenceInputArgs(settings) : buildInputArgs(clip),
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
      args: buildInputArgs(clip),
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
      args: ['-loop', '1', '-t', formatFfmpegSeconds(outputDuration)],
    });
  }
  if (watermark?.enabled && watermark.type === 'image') {
    imageWatermarkInputIndex = inputs.length;
    inputs.push({
      index: imageWatermarkInputIndex,
      path: normalizeFfmpegPath(watermark.path),
      args: ['-loop', '1', '-t', formatFfmpegSeconds(outputDuration)],
    });
  }

  let currentVideo = 'base0';
  let videoStep = 0;

  if (!audioOnly) {
    if (audioVisualizationSettings) {
      filters.push(
        ...buildAudioVisualizationBackgroundFilters(
          resolveAudioVisualizationBackground(audioVisualizationSettings),
          settings,
          duration,
          audioVisualizationBackgroundImageInputIndex,
        ),
      );
    } else {
      filters.push(
        `color=c=black:s=${settings.width}x${settings.height}:r=${settings.fps}:d=${formatFfmpegSeconds(duration)}[base0]`,
      );
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
        capabilities,
      );

      for (const item of visualItems) {
        if (item.kind === 'adjustment') {
          const nextVideo = `base${videoStep + 1}`;
          const adjustmentFilters = buildAdjustmentLayerFilters(
            currentVideo,
            nextVideo,
            item.clip,
            textArtifacts,
            settings,
          );
          if (adjustmentFilters.length > 0) {
            filters.push(...adjustmentFilters);
            currentVideo = nextVideo;
            videoStep += 1;
          }
          continue;
        }
        if (item.kind === 'text' || item.kind === 'credits') {
          if (capabilities && (!capabilities.hasDrawtext || !capabilities.hasLibfreetype)) {
            warnings.push(
              capabilities.drawtextWarning ??
                `Text clip ${item.clip.id} was skipped because FFmpeg drawtext/libfreetype is unavailable.`,
            );
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

  const subtitleClips = orderedPlaybackClips.filter(
    (clip) => clip.type === 'subtitle' && clip.subtitleStyle && clip.textStyle === null,
  );
  const subtitleMode =
    settings.subtitleMode ?? subtitleClips.find((clip) => clip.subtitleMode)?.subtitleMode ?? DEFAULT_SUBTITLE_MODE;
  const subtitleFormat = normalizeSubtitleFormat(settings.subtitleFormat);
  const allSubtitleGroups = buildSubtitleLanguageGroups(project.timeline, subtitleClips, undefined);
  const selectedSubtitleGroups = buildSubtitleLanguageGroups(
    project.timeline,
    subtitleClips,
    settings.subtitleLanguages,
  );
  const multipleSubtitleLanguages = allSubtitleGroups.length > 1;
  const softSubtitleInputs: Array<{ inputIndex: number; language: string }> = [];
  if (!audioOnly && subtitleClips.length > 0 && subtitleMode === 'burn-in') {
    const selectedGroup = selectSubtitleBurnInGroup(allSubtitleGroups, settings.subtitleBurnInLanguage);
    if (selectedGroup) {
      const nextVideo = `base${videoStep + 1}`;
      const { filter, artifact } = buildSubtitleBurnInFilter(
        currentVideo,
        nextVideo,
        selectedGroup.clips,
        subtitleFormat,
        {
          language: selectedGroup.language,
          includeLanguageInFileName: multipleSubtitleLanguages,
        },
      );
      filters.push(filter);
      textArtifacts.push(artifact);
      currentVideo = nextVideo;
      videoStep += 1;
    }
  } else if (!audioOnly && !videoFramesOnly && subtitleClips.length > 0 && subtitleMode === 'soft-sub') {
    for (const group of selectedSubtitleGroups) {
      const artifact = buildSubtitleArtifact(group.clips, 'argument', subtitleFormat, {
        language: group.language,
        includeLanguageInFileName: multipleSubtitleLanguages,
      });
      const inputIndex = inputs.length;
      inputs.push({
        index: inputIndex,
        path: artifact.placeholder,
        args: buildSubtitleInputArgs(subtitleFormat),
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
          includeLanguageInFileName: multipleSubtitleLanguages,
        }),
      );
    }
  }

  let loudnessAnalysisFilterComplex: string | undefined;
  const audioVisualizationAudioLabel = audioVisualization ? 'audio_visualization_mix' : undefined;
  if (!videoFramesOnly) {
    const masterVolume = normalizeMasterVolume(project.masterVolume);
    const audioFilters: string[] = [];
    const audioLabels = buildAudioFilters(
      orderedPlaybackClips,
      audioInputByClipId,
      settings,
      audioFilters,
      capabilities,
      warnings,
    );
    const loudnessPreset =
      audioLabels.length > 0 ? getLoudnessNormalizationPreset(settings.loudnessNormalization) : undefined;
    const spectrumSplitLabels = audioSpectrumEffects.map((_, index) => `spectrum_audio_${index}`);
    const audioSplitLabels = [
      ...spectrumSplitLabels,
      ...(audioVisualizationAudioLabel ? [audioVisualizationAudioLabel] : []),
    ];
    const needsAudioSplit = audioSplitLabels.length > 0;
    const masterFilters = buildMasterAudioFilters(settings.masterProcessing);
    const finalAudioLabel = loudnessPreset ? 'apremaster' : 'aout';
    const masterOutputLabel = needsAudioSplit ? (loudnessPreset ? 'apremaster_mix' : 'amixout') : finalAudioLabel;
    const mixedAudioLabel = masterFilters.length > 0 ? 'amixpremaster' : masterOutputLabel;
    if (audioLabels.length === 0) {
      audioFilters.push(
        `anullsrc=channel_layout=stereo:sample_rate=${settings.sampleRate}:d=${formatFfmpegSeconds(duration)},volume=${formatVolume(masterVolume)}[${mixedAudioLabel}]`,
      );
    } else {
      audioFilters.push(
        `${audioLabels.map((label) => `[${label}]`).join('')}amix=inputs=${audioLabels.length}:duration=longest:normalize=0,atrim=duration=${formatFfmpegSeconds(
          duration,
        )},asetpts=PTS-STARTPTS,aresample=${settings.sampleRate},volume=${formatVolume(masterVolume)}[${mixedAudioLabel}]`,
      );
    }
    if (masterFilters.length > 0) {
      audioFilters.push(`[${mixedAudioLabel}]${masterFilters.join(',')}[${masterOutputLabel}]`);
    }
    if (loudnessPreset) {
      loudnessAnalysisFilterComplex = [
        ...audioFilters,
        `[${masterOutputLabel}]${buildLoudnormAnalysisFilter(loudnessPreset)}[aout]`,
      ].join(';');
      if (needsAudioSplit) {
        filters.push(
          ...audioFilters,
          `[${masterOutputLabel}]asplit=${audioSplitLabels.length + 1}[${finalAudioLabel}]${audioSplitLabels.map((label) => `[${label}]`).join('')}`,
          `[${finalAudioLabel}]${buildLoudnormRenderFilter(loudnessPreset)}[aout]`,
        );
      } else {
        filters.push(...audioFilters, `[${masterOutputLabel}]${buildLoudnormRenderFilter(loudnessPreset)}[aout]`);
      }
    } else {
      if (needsAudioSplit) {
        filters.push(
          ...audioFilters,
          `[${masterOutputLabel}]asplit=${audioSplitLabels.length + 1}[aout]${audioSplitLabels.map((label) => `[${label}]`).join('')}`,
        );
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
          item.params,
        )}':eval=frame:enable='between(t,${formatFfmpegSeconds(item.start)},${formatFfmpegSeconds(item.start + item.duration)})'[${nextVideo}]`,
      );
      currentVideo = nextVideo;
      videoStep += 1;
    });
  }

  if (!audioOnly && !videoFramesOnly && audioVisualizationSettings && audioVisualizationAudioLabel) {
    const visualizationLabel = 'audio_visualization_layer';
    filters.push(
      buildAudioVisualizationFilter(
        audioVisualizationAudioLabel,
        visualizationLabel,
        audioVisualizationSettings,
        settings,
      ),
    );
    const nextVideo = `base${videoStep + 1}`;
    const position = buildAudioVisualizationOverlayPosition(audioVisualizationSettings.style, settings);
    filters.push(
      `[${currentVideo}][${visualizationLabel}]overlay=x='${position.x}':y='${position.y}':eval=frame[${nextVideo}]`,
    );
    currentVideo = nextVideo;
    videoStep += 1;
  }

  if (watermark?.enabled) {
    if (watermark.type === 'text' && capabilities && (!capabilities.hasDrawtext || !capabilities.hasLibfreetype)) {
      warnings.push(
        capabilities.drawtextWarning ??
          'Current FFmpeg does not support drawtext/libfreetype. Install an FFmpeg build with libfreetype to export text overlays.',
      );
    } else {
      const nextVideo = `base${videoStep + 1}`;
      const watermarkFilters = buildWatermarkFilters(
        currentVideo,
        nextVideo,
        watermark,
        settings,
        imageWatermarkInputIndex,
      );
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
    filters.push(
      `[${currentVideo}]trim=duration=${formatFfmpegSeconds(duration)},setpts=PTS-STARTPTS[${trimmedMainLabel}]`,
    );
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
      `[${currentVideo}]trim=duration=${formatFfmpegSeconds(outputDuration)},setpts=PTS-STARTPTS,fps=${settings.fps}${colorManagementFilters.length > 0 ? `,${colorManagementFilters.join(',')}` : ''},format=${outputPixelFormat}[vout]`,
    );
  }

  const audioOutputLabel = slate?.enabled && !videoFramesOnly ? 'aout_slate' : 'aout';
  if (slate?.enabled && !videoFramesOnly) {
    filters.push(
      `anullsrc=channel_layout=stereo:sample_rate=${settings.sampleRate}:d=${formatFfmpegSeconds(slateDuration)}[slate_audio]`,
    );
    filters.push(`[slate_audio][aout]concat=n=2:v=0:a=1[${audioOutputLabel}]`);
  }

  const filterComplex = filters.join(';');
  const maps = videoFramesOnly
    ? ['-map', '[vout]']
    : audioOnly
      ? ['-map', '[aout]']
      : ['-map', '[vout]', '-map', `[${audioOutputLabel}]`];
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
      ? [
          '-ss',
          formatFfmpegSeconds(frameExportTime),
          '-frames:v',
          '1',
          '-f',
          'image2',
          normalizeFfmpegPath(settings.outputPath),
        ]
      : pngSequence
        ? ['-r', String(settings.fps), '-f', 'image2', pngSequenceOutputPath(settings.outputPath)]
        : webpAnimation
          ? [
              '-c:v',
              'libwebp_anim',
              '-loop',
              '0',
              '-r',
              String(settings.fps),
              '-f',
              'webp',
              normalizeFfmpegPath(settings.outputPath),
            ]
          : apngExport
            ? ['-plays', '0', '-f', 'apng', normalizeFfmpegPath(settings.outputPath)]
            : [
                ...exportRangeOutputArgs,
                ...(audioOnly ? [] : videoEncodingArgs),
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
                normalizeFfmpegPath(settings.outputPath),
              ];
  const fullArgs = buildFfmpegFullArgs(inputs, filterComplex, maps, outputArgs);
  const gifPlan =
    gifExport && frameExportTime === null
      ? buildGifExportPasses(inputs, filterComplex, settings, encodedDuration, textArtifacts, outputRange)
      : undefined;
  const loudnessPlan = loudnessAnalysisFilterComplex
    ? buildLoudnessNormalizationPasses(inputs, loudnessAnalysisFilterComplex, fullArgs, encodedDuration)
    : undefined;
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
    duration: planDuration,
  };
}

export function buildFfmpegCurrentFrameExportPlan(
  project: ExportProject,
  time: number,
  capabilities?: FfmpegCapabilities,
): FfmpegExportPlan {
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
  outputDir: string,
): StemExportPlan[] {
  return stemTracks.map((stem) => {
    const stemOutputPath = buildStemOutputPath(outputDir, project.name, stem.trackName, stem.trackIndex, stem.format);
    const stemSettings: ExportSettings = {
      ...project.settings,
      outputPath: stemOutputPath,
      format: stem.format === 'default' ? (project.settings.format === 'm4a' ? 'm4a' : 'wav') : stem.format,
      outputMode: 'audio' as const,
    };
    const stemProject: ExportProject = {
      ...project,
      settings: stemSettings,
      timeline: {
        ...project.timeline,
        tracks: project.timeline.tracks.map((track) => ({
          ...track,
          muted: track.index !== stem.trackIndex,
          solo: track.index === stem.trackIndex,
        })),
      },
    };
    const plan = buildFfmpegExportPlan(stemProject, capabilities, 0, [], { stemTrackIndex: stem.trackIndex });
    return {
      trackIndex: stem.trackIndex,
      trackName: stem.trackName,
      format: stem.format,
      outputPath: stemProject.settings.outputPath,
      plan,
    };
  });
}

export function sanitizeStemPathComponent(name: string): string {
  return name
    .replace(/[<>:"/\\|?*() ]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .trim();
}

export function buildStemOutputPath(
  outputDir: string,
  projectName: string,
  stemName: string,
  trackIndex: number,
  format: string,
): string {
  const ext = format === 'default' ? 'wav' : format;
  const safeProject = sanitizeStemPathComponent(projectName || 'project');
  const safeStem = sanitizeStemPathComponent(stemName || `track-${trackIndex}`);
  const dir = outputDir.replace(/[\\/]+$/, '');
  return `${dir}/${safeProject}_${safeStem}_${trackIndex}.${ext}`;
}

export function calculateExportPreviewSampleTimes(
  duration: number,
): Array<{ kind: ExportPreviewSampleKind; time: number }> {
  const safeDuration = Number.isFinite(duration) ? Math.max(0, duration) : 0;
  return EXPORT_PREVIEW_SAMPLE_KINDS.map((kind) => ({
    kind,
    time: round(kind === 'start' ? 0 : kind === 'middle' ? safeDuration / 2 : safeDuration),
  }));
}

export function buildFfmpegPreviewSamplePlans(
  project: ExportProject,
  outputPaths: string[],
  capabilities?: FfmpegCapabilities,
): ExportPreviewSamplePlan[] {
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
          outputPath,
        },
      },
      sample.time,
      capabilities,
    );
    return {
      id: `export-preview-${sample.kind}`,
      kind: sample.kind,
      label: sample.kind,
      time: sample.time,
      outputPath,
      plan,
    };
  });
}

export function buildNestedSequencePlans(
  project: ExportProject,
  capabilities: FfmpegCapabilities | undefined,
  warnings: string[],
  depth: number,
  sequenceStack: string[],
): NestedFfmpegExportPlan[] {
  const sequenceIds = new Set(
    project.timeline.tracks.flatMap((track) =>
      track.clips.flatMap((clip) =>
        clip.type === 'nested-sequence' && clip.nestedSequenceId ? [clip.nestedSequenceId] : [],
      ),
    ),
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
      timeline: sequence.timeline,
    };
    nestedPlans.push({
      sequenceId,
      placeholder,
      plan: buildFfmpegExportPlan(nestedProject, capabilities, depth + 1, [...sequenceStack, sequenceId]),
    });
  }
  return nestedPlans;
}
