import {DEFAULT_COLOR_CORRECTION, isDefaultColorCorrection, normalizeColorCorrection, normalizeChromaKey, normalizeClipPanoramaView, normalizeLutLayers} from '../../model';
import {isDefaultColorCurves, isNeutralThreeWayColor, normalizeThreeWayColor, serializeColorCurvesToCube, PrimaryWheels, PrimarySliders, toFfmpegSelectiveColor, type ColorWheelValue, type ColorGradingGraph, type CurvesNodeParams, type LUTApplyNodeParams, type PrimaryWheelParams, type PrimarySliderParams, type HSLQualifierParams, type WindowMaskParams, type ThreeWayColor} from '../../color-grading';
import {buildColorNodeGraphFilterPlan, detectColorNodeGraphCycle, normalizeColorNodeGraph} from '../../color-node-graph';
import {getLogToRec709Lut, isLogInputColorSpace, serializeLogToRec709Cube} from '../../color-log-luts';
import {buildMotionBlurExportFilter, normalizeMotionBlurParams} from '../../motion-blur';
import {isReframeEnabled} from '../../reframe';
import {getFfmpegBlendMode, normalizeClipBlendMode, type ClipBlendMode} from '../../blend-modes';
import {getClipSpeed, calculateSpeedCurveSourceDuration} from '../../timeline';
import {round} from '../../time';
import {buildZscaleColorConversionFilter, normalizeProjectWorkingColorSpace} from '../../color-management';
import {buildPrivacyRedactionFFmpegExpressions} from '../../privacy-redaction';
import {cssColorToFfmpeg, escapeDrawtextValue, formatFfmpegSeconds} from '../ffmpeg-escape';
import {formatFfmpegNumber, formatScale, formatOpacity, safeLabel, formatOffsetExpression, getAnimatedFrames, buildTimelineExpression} from './utils';
import {SETPTS_EXPRESSION_LIMIT} from './settings-normalize';
import type {Effect} from '../../effects';
import {getEffectNumberParam} from '../../effects';
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
  buildPrivacyBlurEffectFilter,
  buildMaskTimelineExpression,
} from './visual-filters-masks';

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

// ---- Transform helpers ----

export function isKenBurnsAnimatedScaleClip(clip: ExportClip): boolean {
  return (
    clip.type === 'image' &&
    clip.kenBurns &&
    (getAnimatedFrames(clip, 'scaleX').length >= 2 || getAnimatedFrames(clip, 'scaleY').length >= 2)
  );
}

export function buildSetptsFilter(clip: ExportClip, includeStartOffset: boolean, warnings?: string[]): string {
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

export function buildStaticSetptsFilter(clip: ExportClip, includeStartOffset: boolean, speed: number): string {
  const startOffset = `${formatFfmpegSeconds(clip.start)}/TB`;
  const playbackSpeed = getClipSpeed({ speed });
  if (Math.abs(playbackSpeed - 1) < 0.001 || clip.type === 'image') {
    return includeStartOffset ? `setpts=PTS-STARTPTS+${startOffset}` : 'setpts=PTS-STARTPTS';
  }
  return includeStartOffset
    ? `setpts=(PTS-STARTPTS)/${formatFfmpegSeconds(playbackSpeed)}+${startOffset}`
    : `setpts=(PTS-STARTPTS)/${formatFfmpegSeconds(playbackSpeed)}`;
}

export function buildSpeedRampSetptsExpression(clip: ExportClip, includeStartOffset: boolean): string {
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

export function buildSpeedRampSegments(
  clip: ExportClip,
): Array<{ displayStart: number; displayEnd: number; sourceStart: number; sourceEnd: number; speed: number }> {
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
  const segments: Array<{
    displayStart: number;
    displayEnd: number;
    sourceStart: number;
    sourceEnd: number;
    speed: number;
  }> = [];
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
        { ...right, time: displayDuration },
      ],
    };
    const sourceDuration = calculateSpeedCurveSourceDuration(displayDuration, localSpeedFrames, left.value);
    const segmentSpeed = Math.max(0.001, sourceDuration / displayDuration);
    const sourceEnd = round(sourceStart + sourceDuration);
    segments.push({
      displayStart,
      displayEnd,
      sourceStart,
      sourceEnd,
      speed: segmentSpeed,
    });
    sourceStart = sourceEnd;
  }
  return segments;
}

export function getAverageClipSpeed(clip: ExportClip): number {
  if (clip.duration <= 0.000001) {
    return clip.speed;
  }
  return getClipSpeed({ speed: clip.sourceDuration / clip.duration });
}

export function buildScaleFilter(clip: ExportClip): string {
  const scaleX = getAnimatedFrames(clip, 'scaleX');
  const scaleY = getAnimatedFrames(clip, 'scaleY');
  if (scaleX.length >= 2 || scaleY.length >= 2) {
    const xExpression = buildTimelineExpression(scaleX, clip.start, clip.transform.scaleX ?? clip.transform.scale);
    const yExpression = buildTimelineExpression(scaleY, clip.start, clip.transform.scaleY ?? clip.transform.scale);
    return `scale=w='trunc(iw*(${xExpression})/2)*2':h='trunc(ih*(${yExpression})/2)*2':eval=frame`;
  }
  const staticScaleX = scaleX.length === 1 ? scaleX[0].value : (clip.transform.scaleX ?? clip.transform.scale);
  const staticScaleY = scaleY.length === 1 ? scaleY[0].value : (clip.transform.scaleY ?? clip.transform.scale);
  return `scale=trunc(iw*${formatScale(staticScaleX)}/2)*2:trunc(ih*${formatScale(staticScaleY)}/2)*2`;
}

export function buildKenBurnsZoompanFilter(clip: ExportClip, settings: ExportSettings): string {
  const scaleX = getAnimatedFrames(clip, 'scaleX');
  const scaleY = getAnimatedFrames(clip, 'scaleY');
  const zoomFrames = scaleX.length >= 2 ? scaleX : scaleY;
  const zoomExpression = buildTimelineExpression(zoomFrames, 0, clip.transform.scaleX ?? clip.transform.scale, 'ot');
  return `zoompan=z='${zoomExpression}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=2:s=${settings.width}x${settings.height}:fps=${settings.fps}`;
}

export function buildOpacityFilters(clip: ExportClip, label: string): string[] {
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
      return [
        `colorchannelmixer=aa=1`,
        `fade=t=in:st=${formatFfmpegSeconds(start)}:d=${formatFfmpegSeconds(duration)}:alpha=1[${label}]`,
      ];
    }
    if (first.value >= 0.999 && second.value <= 0.001) {
      return [
        `colorchannelmixer=aa=1`,
        `fade=t=out:st=${formatFfmpegSeconds(start)}:d=${formatFfmpegSeconds(duration)}:alpha=1[${label}]`,
      ];
    }
  }
  const expression = buildTimelineExpression(frames, clip.start, clip.transform.opacity, 'T');
  return [`geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='alpha(X,Y)*(${expression})'[${label}]`];
}

export function buildOverlayXExpression(clip: ExportClip): string {
  const frames = getAnimatedFrames(clip, 'x');
  if (frames.length >= 2) {
    return `main_w/2-overlay_w/2+(main_w/2)*(${buildTimelineExpression(frames, clip.start, 0)})`;
  }
  if (frames.length === 1) {
    return `main_w/2-overlay_w/2+(main_w/2)*${formatFfmpegNumber(frames[0].value)}`;
  }
  return `(main_w-overlay_w)/2${formatOffsetExpression(clip.transform.x)}`;
}

export function buildOverlayYExpression(clip: ExportClip): string {
  const frames = getAnimatedFrames(clip, 'y');
  if (frames.length >= 2) {
    return `main_h/2-overlay_h/2+(main_h/2)*(${buildTimelineExpression(frames, clip.start, 0)})`;
  }
  if (frames.length === 1) {
    return `main_h/2-overlay_h/2+(main_h/2)*${formatFfmpegNumber(frames[0].value)}`;
  }
  return `(main_h-overlay_h)/2${formatOffsetExpression(clip.transform.y)}`;
}

// ---- Color correction ----

export function buildColorCorrectionFilters(clip: ExportClip, textArtifacts: TextArtifact[]): string[] {
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
        pathMode: 'filter',
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
        `[lut${idx}a][lut${idx}c]blend=all_expr='A*(1-${intensity})+B*${intensity}'`,
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
        colorCorrection.contrast,
      )}:saturation=${formatFfmpegNumber(colorCorrection.saturation)}`,
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
      pathMode: 'filter',
    });
    filters.push(`lut1d=file=${placeholder}`);
  }
  return filters;
}

export function buildThreeWayColorFilter(value: ThreeWayColor | undefined): string {
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
    ['bh', colorBalanceValue(color.gain, 'b')],
  ].filter(([, value]) => Math.abs(value as number) > 0.001);
  return `colorbalance=${params.map(([name, value]) => `${name}=${formatFfmpegNumber(value as number)}`).join(':')}`;
}

export function colorBalanceValue(value: ColorWheelValue, channel: 'r' | 'g' | 'b'): number {
  return Math.min(1, Math.max(-1, value[channel] + value.intensity - 1));
}

export function buildEffectFilters(effects: Effect[], fps = 30): string[] {
  return effects.flatMap((effect) => {
    if (!effect.enabled) {
      return [];
    }
    if (effect.type === 'blur') {
      return [`gblur=sigma=${formatFfmpegNumber(getEffectNumberParam(effect.params, 'radius', 8))}`];
    }
    if (effect.type === 'sharpen') {
      return [
        `unsharp=luma_msize_x=5:luma_msize_y=5:luma_amount=${formatFfmpegNumber(getEffectNumberParam(effect.params, 'strength', 1))}`,
      ];
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
 * Build FFmpeg filter chain for color grading graph
 */
export function buildColorGradingFilters(graph: ColorGradingGraph | undefined): string[] {
  if (!graph || graph.nodes.length === 0) return [];

  const filters: string[] = [];

  const wheelNodes = graph.nodes.filter((n) => n.type === 'primary-wheel' && n.enabled);
  const sliderNodes = graph.nodes.filter((n) => n.type === 'primary-slider' && n.enabled);
  const curvesNodes = graph.nodes.filter((n) => n.type === 'curves' && n.enabled);
  const hslNodes = graph.nodes.filter((n) => n.type === 'hsl-qualifier' && n.enabled);
  const windowMaskNodes = graph.nodes.filter((n) => n.type === 'window-mask' && n.enabled);
  const lutNodes = graph.nodes.filter((n) => n.type === 'lut-apply' && n.enabled);

  for (const node of wheelNodes) {
    const filter = PrimaryWheels.toFfmpegFilter(node.params as PrimaryWheelParams);
    if (filter) filters.push(filter);
  }

  for (const node of sliderNodes) {
    const filter = PrimarySliders.toFfmpegFilter(node.params as PrimarySliderParams);
    if (filter) filters.push(filter);
  }

  for (const node of curvesNodes) {
    const p = node.params as CurvesNodeParams;
    const rStr = p.red.map((pt) => `${pt.x}/${pt.y}`).join(' ');
    const gStr = p.green.map((pt) => `${pt.x}/${pt.y}`).join(' ');
    const bStr = p.blue.map((pt) => `${pt.x}/${pt.y}`).join(' ');
    filters.push(`curves=r='${rStr}':g='${gStr}':b='${bStr}'`);
  }

  for (const node of hslNodes) {
    const hslFilter = toFfmpegSelectiveColor(node.params as HSLQualifierParams);
    if (hslFilter) filters.push(hslFilter);
  }

  for (const node of windowMaskNodes) {
    const maskFilter = buildWindowMaskFfmpegFilter(node.params as WindowMaskParams);
    if (maskFilter) filters.push(maskFilter);
  }

  for (const node of lutNodes) {
    const p = node.params as LUTApplyNodeParams;
    if (p.lutId) {
      filters.push(`lut3d=file='${escapeDrawtextValue(p.lutId)}'`);
    }
  }

  return filters;
}

/**
 * Convert window mask params to FFmpeg geq filter
 */
export function buildWindowMaskFfmpegFilter(params: WindowMaskParams): string {
  if (params.shape === 'circle' && params.circle) {
    const cx = formatFfmpegNumber(params.circle.center.x);
    const cy = formatFfmpegNumber(params.circle.center.y);
    const r = formatFfmpegNumber(params.circle.radius);
    const s = formatFfmpegNumber(Math.max(0.001, params.circle.softness));
    const invert = params.invert ? 1 : 0;
    const maskExpr = `if(lte(pow((X/iw-${cx}),2)+pow((Y/ih-${cy}),2),pow(${r},2)),${invert ? 0 : 255},${invert ? 255 : 0})`;
    return `geq=lum='clip(lum_expr,0,255)':cr='cb(X,Y)':cb='cr(X,Y)'`;
  }
  if (params.shape === 'linear-gradient' && params.linearGradient) {
    const sx = formatFfmpegNumber(params.linearGradient.startPoint.x);
    const sy = formatFfmpegNumber(params.linearGradient.startPoint.y);
    const ex = formatFfmpegNumber(params.linearGradient.endPoint.x);
    const ey = formatFfmpegNumber(params.linearGradient.endPoint.y);
    const invert = params.invert ? 1 : 0;
    return `geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='clip(${invert ? '(1-' : ''}255*clamp(((X/iw-(${sx}))*(${ex}-${sx})+(Y/ih-(${sy}))*(${ey}-${sy}))/(pow(${ex}-${sx},2)+pow(${ey}-${sy},2)+0.001),0,1)${invert ? ')' : ''},0,255)'`;
  }
  return '';
}

export function buildSourceColorSpaceConversionFilters(clip: ExportClip, settings: ExportSettings): string[] {
  const source = clip.sourceColorProfile;
  if (!source?.autoConvertToWorkingSpace) {
    return [];
  }
  const target = normalizeProjectWorkingColorSpace(settings.workingColorSpace);
  const filter = buildZscaleColorConversionFilter(source.sourceColorSpace, target);
  return filter ? [filter] : [];
}

export function getExportClipSourceDuration(clip: ExportClip): number {
  return clip.type === 'video' || clip.type === 'audio' || clip.type === 'nested-sequence'
    ? Math.max(0.001, clip.sourceDuration)
    : Math.max(0.001, clip.duration);
}
