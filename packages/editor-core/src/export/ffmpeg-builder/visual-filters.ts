import {normalizeChromaKey, normalizeClipPanoramaView} from '../../model';
import {buildColorNodeGraphFilterPlan, detectColorNodeGraphCycle, normalizeColorNodeGraph} from '../../color-node-graph';
import {isReframeEnabled} from '../../reframe';
import {getFfmpegBlendMode, normalizeClipBlendMode, type ClipBlendMode} from '../../blend-modes';
import {round} from '../../time';
import {buildPrivacyRedactionFFmpegExpressions} from '../../privacy-redaction';
import {escapeDrawtextValue, formatFfmpegSeconds} from '../ffmpeg-escape';
import {formatFfmpegNumber, formatOpacity, safeLabel} from './utils';
import type {ExportClip, ExportTransition, ExportTimeline, ExportTrack, ExportSettings, FfmpegCapabilities, TextArtifact} from '../export-types';

// Re-export from sub-modules for backward compatibility
export {
  findExportTransitionPair,
  isTransitionVisualClip,
  areExportClipsAdjacent,
  clampExportTransitionDuration,
  buildSmartTransitionFilters,
  mapTransitionType,
  buildShapeWipeGeqExpression,
  type TransitionPreviewArgsOptions,
  buildTransitionPreviewArgs,
} from './visual-filters-transitions';

export {
  buildReframeFilters,
  buildChromaKeyFilters,
  isDifferenceMatteEnabled,
  formatChromaKeyColor,
  buildStabilizationFilters,
  buildSlowMotionFilters,
  buildFrameInterpolationFilters,
  buildFrameInterpolationFilterArg,
  buildVideoRestorationFilters,
  buildQualityEnhancementFilters,
  getMinimumClipSpeed,
} from './visual-filters-effects';

export {
  buildPrivacyBlurMaskGraph,
  buildPrivacyBlurEffectFilter,
  buildMaskTimelineExpression,
  hasPrivacyBlurMasks,
  getPrivacyBlurMasks,
  buildMaskFilters,
  buildClipBorderFilters,
  isSimpleRectMask,
  buildSimpleRectMaskFilter,
  buildGeqMaskFilter,
  buildRectMaskExpression,
  buildEllipseMaskExpression,
  buildPathMaskExpression,
  getPathVertex,
  buildPathTriangleExpression,
  buildPathEdgeExpression,
  triangleArea,
} from './visual-filters-masks';

export {
  isKenBurnsAnimatedScaleClip,
  buildSetptsFilter,
  buildStaticSetptsFilter,
  buildSpeedRampSetptsExpression,
  buildSpeedRampSegments,
  getAverageClipSpeed,
  buildScaleFilter,
  buildKenBurnsZoompanFilter,
  buildOpacityFilters,
  buildOverlayXExpression,
  buildOverlayYExpression,
} from './visual-filters-compositing';

export {
  buildColorCorrectionFilters,
  buildThreeWayColorFilter,
  colorBalanceValue,
  buildEffectFilters,
  buildColorGradingFilters,
  buildWindowMaskFfmpegFilter,
  buildSourceColorSpaceConversionFilters,
} from './visual-filters-color';

// Import for internal use from sub-modules
import {
  findExportTransitionPair,
  isTransitionVisualClip,
  areExportClipsAdjacent,
  clampExportTransitionDuration,
  buildSmartTransitionFilters,
} from './visual-filters-transitions';
import {
  buildChromaKeyFilters,
  buildStabilizationFilters,
  buildReframeFilters,
  buildSlowMotionFilters,
  buildFrameInterpolationFilters,
  buildVideoRestorationFilters,
  buildQualityEnhancementFilters,
  isDifferenceMatteEnabled,
} from './visual-filters-effects';
import {
  buildMaskFilters,
  buildClipBorderFilters,
  buildPrivacyBlurMaskGraph,
  hasPrivacyBlurMasks,
  getPrivacyBlurMasks,
} from './visual-filters-masks';
import {
  isKenBurnsAnimatedScaleClip,
  buildSetptsFilter,
  buildScaleFilter,
  buildKenBurnsZoompanFilter,
  buildOpacityFilters,
  buildOverlayXExpression,
  buildOverlayYExpression,
} from './visual-filters-compositing';
import {
  buildColorCorrectionFilters,
  buildEffectFilters,
  buildColorGradingFilters,
  buildSourceColorSpaceConversionFilters,
} from './visual-filters-color';

// ---- Types ----

export type AnimatedProperty = 'x' | 'y' | 'scaleX' | 'scaleY' | 'speed' | 'opacity';

export type VisualItem =
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

// ---- Timeline / clip construction ----

export function buildVisualItems(
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
  capabilities: FfmpegCapabilities | undefined,
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
      warnings.push(
        `Transition ${transition.id} was skipped because chained transitions are not yet supported in one export segment.`,
      );
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
    filters.push(
      buildTransitionClipFilter(
        fromInput,
        customShaderSequenceClips.get(pair.fromClip.id) ?? pair.fromClip,
        `${label}_from`,
        settings,
        textArtifacts,
        warnings,
        capabilities,
      ),
    );
    filters.push(
      buildTransitionClipFilter(
        toInput,
        customShaderSequenceClips.get(pair.toClip.id) ?? pair.toClip,
        `${label}_to`,
        settings,
        textArtifacts,
        warnings,
        capabilities,
      ),
    );
    filters.push(
      ...buildSmartTransitionFilters(
        transition,
        label,
        duration,
        Math.max(0, pair.fromClip.duration - duration),
        settings,
      ),
    );
    filters.push(`[${label}_raw]setpts=PTS-STARTPTS+${formatFfmpegSeconds(start)}/TB[${label}]`);
    items.push({
      kind: 'media',
      trackIndex: pair.track.index,
      start,
      duration: pairDuration,
      label,
      xExpression: '(main_w-overlay_w)/2+0',
      yExpression: '(main_h-overlay_h)/2+0',
      blendMode: normalizeClipBlendMode(pair.toClip.blendMode),
    });
    consumedClipIds.add(pair.fromClip.id);
    consumedClipIds.add(pair.toClip.id);
  }

  for (const clip of orderedPlaybackClips.filter(
    (item) =>
      item.type === 'video' ||
      item.type === 'image' ||
      item.type === 'text' ||
      item.type === 'credits' ||
      item.type === 'nested-sequence' ||
      item.type === 'adjustment' ||
      item.type === 'motion-graphic',
  )) {
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
    filters.push(
      buildVisualClipFilter(
        inputIndex,
        customShaderSequenceClips.get(clip.id) ?? clip,
        clipLabel,
        settings,
        textArtifacts,
        warnings,
        capabilities,
      ),
    );
    items.push({
      kind: 'media',
      trackIndex: clip.trackIndex,
      start: clip.start,
      duration: clip.duration,
      label: clipLabel,
      xExpression: buildOverlayXExpression(clip),
      yExpression: buildOverlayYExpression(clip),
      blendMode: normalizeClipBlendMode(clip.blendMode),
    });
  }

  return items.sort(
    (left, right) =>
      left.trackIndex - right.trackIndex || left.start - right.start || visualKindOrder(left) - visualKindOrder(right),
  );
}

export function buildPlaybackStartByClipId(timeline: ExportTimeline): Map<string, number> {
  const starts = new Map<string, number>();
  for (const track of timeline.tracks) {
    let transitionOffset = 0;
    const clips = [...track.clips].sort((left, right) => left.start - right.start || left.id.localeCompare(right.id));
    for (let index = 0; index < clips.length; index += 1) {
      const clip = clips[index];
      const previous = clips[index - 1];
      const transition = previous
        ? timeline.transitions.find((item) => item.fromClipId === previous.id && item.toClipId === clip.id)
        : undefined;
      if (previous && transition && areExportClipsAdjacent(previous, clip)) {
        transitionOffset = round(transitionOffset + clampExportTransitionDuration(transition, previous, clip));
      }
      starts.set(clip.id, round(clip.start - transitionOffset));
    }
  }
  return starts;
}

// ---- Transition clip filter (orchestrator) ----

export function buildTransitionClipFilter(
  inputIndex: number,
  clip: ExportClip,
  label: string,
  settings: ExportSettings,
  textArtifacts: TextArtifact[],
  warnings: string[],
  capabilities: FfmpegCapabilities | undefined,
): string {
  const sourceDuration = getExportClipSourceDuration(clip);
  const trim =
    clip.type === 'video' || clip.type === 'nested-sequence'
      ? `trim=start=0:duration=${formatFfmpegSeconds(sourceDuration)}`
      : `trim=duration=${formatFfmpegSeconds(sourceDuration)}`;
  const filters = [
    `[${inputIndex}:v]${trim}`,
    ...buildChromaKeyFilters(clip),
    buildSetptsFilter(clip, false, warnings),
    ...buildStabilizationFilters(clip),
    ...buildPanoramaProjectionFilters(clip),
    ...buildReframeFilters(settings),
    ...(isReframeEnabled(settings.targetAspectRatio)
      ? []
      : [
          `scale=${settings.width}:${settings.height}:force_original_aspect_ratio=decrease`,
          `pad=${settings.width}:${settings.height}:(ow-iw)/2:(oh-ih)/2:color=black`,
        ]),
    `fps=${settings.fps}`,
    ...buildSlowMotionFilters(clip, settings, capabilities, warnings),
    ...buildFrameInterpolationFilters(clip, capabilities, warnings),
    ...buildVideoRestorationFilters(clip),
    ...buildQualityEnhancementFilters(clip),
    'format=rgba',
  ];
  filters.push(...buildMaskFilters(clip));
  filters.push(...buildColorCorrectionFilters(clip, textArtifacts));
  filters.push(...buildEffectFilters(clip.effects, settings.fps));
  filters.push(`colorchannelmixer=aa=${formatOpacity(clip.transform.opacity)}[${label}]`);
  return filters.join(',');
}

// ---- Visual compositing helpers ----

export function visualKindOrder(item: VisualItem): number {
  if (item.kind === 'media') {
    return 0;
  }
  return item.kind === 'adjustment' ? 1 : 2;
}

export function buildMediaCompositeFilter(
  currentVideo: string,
  nextVideo: string,
  item: Extract<VisualItem, { kind: 'media' }>,
  settings: ExportSettings,
  duration: number,
): string {
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
    `[${currentVideo}][${blendedRgbaLabel}]overlay=x=0:y=0:eval=frame:enable='${enable}'[${nextVideo}]`,
  ].join(';');
}

export function buildAdjustmentLayerFilters(
  inputLabel: string,
  outputLabel: string,
  clip: ExportClip,
  textArtifacts: TextArtifact[],
  settings: ExportSettings,
): string[] {
  const processingFilters = [
    ...buildColorCorrectionFilters(clip, textArtifacts),
    ...buildEffectFilters(clip.effects, settings.fps),
  ];
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
    `[${baseLabel}][${processedLabel}]overlay=x=0:y=0:eval=frame:enable='between(t,${formatFfmpegSeconds(clip.start)},${formatFfmpegSeconds(clip.start + clip.duration)})'[${outputLabel}]`,
  ];
}

export function buildVisualClipFilter(
  inputIndex: number,
  clip: ExportClip,
  label: string,
  settings: ExportSettings,
  textArtifacts: TextArtifact[],
  warnings: string[],
  capabilities: FfmpegCapabilities | undefined,
): string {
  const sourceDuration = getExportClipSourceDuration(clip);
  const trim =
    clip.type === 'video' || clip.type === 'nested-sequence'
      ? `trim=start=0:duration=${formatFfmpegSeconds(sourceDuration)}`
      : `trim=duration=${formatFfmpegSeconds(sourceDuration)}`;
  const key = normalizeChromaKey(clip.chromaKey);
  if (isDifferenceMatteEnabled(key)) {
    return buildDifferenceMatteClipFilter(
      inputIndex,
      clip,
      label,
      settings,
      textArtifacts,
      warnings,
      capabilities,
      trim,
      key,
    );
  }
  if (hasPrivacyBlurMasks(clip)) {
    return buildPrivacyBlurClipFilter(inputIndex, clip, label, settings, textArtifacts, warnings, capabilities, trim);
  }
  if (clip.colorGradingGraph?.nodes?.length) {
    const gradingFilter = buildColorGradingGraphVisualFilter(
      inputIndex,
      clip,
      label,
      settings,
      textArtifacts,
      warnings,
      capabilities,
      trim,
    );
    if (gradingFilter) {
      return gradingFilter;
    }
  }
  if (clip.colorNodeGraph) {
    const graphFilter = buildColorNodeGraphVisualFilter(
      inputIndex,
      clip,
      label,
      settings,
      textArtifacts,
      warnings,
      capabilities,
      trim,
    );
    if (graphFilter) {
      return graphFilter;
    }
  }
  const filters = [`[${inputIndex}:v]${trim}`, ...buildChromaKeyFilters(clip)];
  filters.push(...buildVisualPostKeyFilters(clip, settings, textArtifacts, warnings, capabilities, label));
  const redactionExprs = buildPrivacyRedactionFFmpegExpressions(
    clip.privacyRedactions ?? [],
    settings.width,
    settings.height,
    'boxblur',
  );
  if (redactionExprs.length > 0) filters.push(...redactionExprs);
  return filters.join(',');
}

export function buildColorNodeGraphVisualFilter(
  inputIndex: number,
  clip: ExportClip,
  label: string,
  settings: ExportSettings,
  textArtifacts: TextArtifact[],
  warnings: string[],
  capabilities: FfmpegCapabilities | undefined,
  trim: string,
): string | null {
  const normalized = normalizeColorNodeGraph(clip.colorNodeGraph, clip.colorCorrection);
  const cycle = detectColorNodeGraphCycle(normalized);
  if (cycle) {
    warnings.push(
      `Color node graph for clip ${clip.id} contains a cycle (${cycle.join(' -> ')}); falling back to the legacy color correction chain.`,
    );
    return null;
  }
  const baseLabel = `${safeLabel(label)}_node_base`;
  const graphOutputLabel = `${safeLabel(label)}_node_graph_output`;
  const baseFilters = [
    `[${inputIndex}:v]${trim}`,
    ...buildChromaKeyFilters(clip),
    ...buildVisualPreColorFilters(clip, settings, warnings, capabilities),
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
        pathMode: 'filter',
      });
      return artifact.placeholder;
    },
  }).filters;
  const postFilters = [
    `[${graphOutputLabel}]${buildVisualPostColorFilters(clip, settings, textArtifacts, label, false).join(',')}`,
  ];
  return [`${baseFilters.join(',')}[${baseLabel}]`, ...graphFilters, ...postFilters].join(',');
}

export function buildColorGradingGraphVisualFilter(
  inputIndex: number,
  clip: ExportClip,
  label: string,
  settings: ExportSettings,
  textArtifacts: TextArtifact[],
  warnings: string[],
  capabilities: FfmpegCapabilities | undefined,
  trim: string,
): string | null {
  const gradingFilters = buildColorGradingFilters(clip.colorGradingGraph);
  if (gradingFilters.length === 0) return null;

  const baseLabel = `${safeLabel(label)}_grading_base`;
  const gradingOutputLabel = `${safeLabel(label)}_grading_output`;
  const baseFilters = [
    `[${inputIndex}:v]${trim}`,
    ...buildChromaKeyFilters(clip),
    ...buildVisualPreColorFilters(clip, settings, warnings, capabilities),
  ];
  const gradingChain = gradingFilters.join(',');
  const postFilters = [
    `[${gradingOutputLabel}]${buildVisualPostColorFilters(clip, settings, textArtifacts, label, false).join(',')}`,
  ];
  return [
    `${baseFilters.join(',')}[${baseLabel}]`,
    `[${baseLabel}]${gradingChain}[${gradingOutputLabel}]`,
    ...postFilters,
  ].join(';');
}

export function buildVisualPreColorFilters(
  clip: ExportClip,
  settings: ExportSettings,
  warnings: string[],
  capabilities: FfmpegCapabilities | undefined,
): string[] {
  const filters: string[] = [];
  if (isKenBurnsAnimatedScaleClip(clip)) {
    filters.push(
      buildSetptsFilter(clip, false, warnings),
      buildKenBurnsZoompanFilter(clip, settings),
      'setsar=1',
      buildSetptsFilter(clip, true, warnings),
    );
  } else {
    filters.push(
      buildSetptsFilter(clip, true, warnings),
      ...buildStabilizationFilters(clip),
      ...buildPanoramaProjectionFilters(clip),
      ...buildReframeFilters(settings),
      buildScaleFilter(clip),
      'setsar=1',
    );
  }
  if (settings.scaleMode === 'fit' && !isReframeEnabled(settings.targetAspectRatio)) {
    filters.push(
      `scale=${settings.width}:${settings.height}:force_original_aspect_ratio=decrease`,
      `pad=${settings.width}:${settings.height}:(ow-iw)/2:(oh-ih)/2:color=black`,
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

export function buildVisualPostColorFilters(
  clip: ExportClip,
  settings: ExportSettings,
  textArtifacts: TextArtifact[],
  label: string,
  includeColorCorrection = true,
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

export function buildVisualPostKeyFilters(
  clip: ExportClip,
  settings: ExportSettings,
  textArtifacts: TextArtifact[],
  warnings: string[],
  capabilities: FfmpegCapabilities | undefined,
  label: string,
): string[] {
  const filters: string[] = [];
  if (isKenBurnsAnimatedScaleClip(clip)) {
    filters.push(
      buildSetptsFilter(clip, false, warnings),
      buildKenBurnsZoompanFilter(clip, settings),
      'setsar=1',
      buildSetptsFilter(clip, true, warnings),
    );
  } else {
    filters.push(
      buildSetptsFilter(clip, true, warnings),
      ...buildStabilizationFilters(clip),
      ...buildPanoramaProjectionFilters(clip),
      ...buildReframeFilters(settings),
      buildScaleFilter(clip),
      'setsar=1',
    );
  }
  if (settings.scaleMode === 'fit' && !isReframeEnabled(settings.targetAspectRatio)) {
    filters.push(
      `scale=${settings.width}:${settings.height}:force_original_aspect_ratio=decrease`,
      `pad=${settings.width}:${settings.height}:(ow-iw)/2:(oh-ih)/2:color=black`,
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

export function buildPanoramaProjectionFilters(clip: ExportClip): string[] {
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
    `v_fov=${formatFfmpegNumber(panorama.fov)}`,
  ];
  return [`v360=${args.join(':')}`];
}

export function hasSphericalVideoClips(clips: ExportClip[]): boolean {
  return clips.some((clip) => (clip.type === 'video' || clip.type === 'nested-sequence') && clip.projection !== 'flat');
}

// ---- Privacy / difference matte ----

export function buildDifferenceMatteClipFilter(
  inputIndex: number,
  clip: ExportClip,
  label: string,
  settings: ExportSettings,
  textArtifacts: TextArtifact[],
  warnings: string[],
  capabilities: FfmpegCapabilities | undefined,
  trim: string,
  key: ReturnType<typeof normalizeChromaKey>,
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
      referenceLabel,
    ).join(',')}`,
    `[${mainBlendLabel}][${referenceLabel}]blend=all_mode=difference,format=gray,lutyuv=y='if(gt(val,${threshold}),255,0)'[${matteLabel}]`,
    `[${mainAlphaLabel}][${matteLabel}]alphamerge,colorchannelmixer=aa=${formatOpacity(clip.transform.opacity)}[${label}]`,
  ].join(';');
}

export function buildPrivacyBlurClipFilter(
  inputIndex: number,
  clip: ExportClip,
  label: string,
  settings: ExportSettings,
  textArtifacts: TextArtifact[],
  warnings: string[],
  capabilities: FfmpegCapabilities | undefined,
  trim: string,
): string {
  const sourceLabel = `${safeLabel(label)}_privacy_src`;
  const filters = [
    `[${inputIndex}:v]${trim}`,
    ...buildChromaKeyFilters(clip),
    ...buildVisualPostKeyFilters(clip, settings, textArtifacts, warnings, capabilities, sourceLabel),
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

// ---- Utility ----

export function getExportClipSourceDuration(clip: ExportClip): number {
  return clip.type === 'video' || clip.type === 'audio' || clip.type === 'nested-sequence'
    ? Math.max(0.001, clip.sourceDuration)
    : Math.max(0.001, clip.duration);
}
