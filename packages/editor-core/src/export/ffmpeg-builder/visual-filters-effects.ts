import {
  isStabilizationExportable,
  normalizeChromaKey,
  normalizeSlowMotionMode,
  normalizeQualityEnhancement,
  normalizeVideoRestoration,
} from '../../model';
import {buildMotionBlurExportFilter, normalizeMotionBlurParams} from '../../motion-blur';
import {buildReframeCropFilter, isReframeEnabled} from '../../reframe';
import {getClipSpeed, calculateSpeedCurveSourceDuration} from '../../timeline';
import {round} from '../../time';
import {averageClipMotionScore, buildSceneBoundaryProtectionRanges, resolveFrameInterpolationMode} from '../frame-interpolation';
import {escapeDrawtextValue} from '../ffmpeg-escape';
import {formatFfmpegNumber, getAnimatedFrames} from './utils';
import {SETPTS_EXPRESSION_LIMIT} from './settings-normalize';
import type {Effect} from '../../effects';
import {getEffectNumberParam} from '../../effects';
import type {ExportClip, ExportSettings, FfmpegCapabilities} from '../export-types';

export function buildReframeFilters(settings: ExportSettings): string[] {
  const crop = buildReframeCropFilter(settings);
  if (!crop) {
    return [];
  }
  return [crop, `scale=${settings.width}:${settings.height}`];
}

export function buildChromaKeyFilters(clip: ExportClip): string[] {
  const key = normalizeChromaKey(clip.chromaKey);
  if (!key.enabled) {
    return [];
  }
  if (key.mode === 'luma-key') {
    return [
      `lumakey=threshold=${formatFfmpegNumber(key.lumaThreshold)}:tolerance=${formatFfmpegNumber(key.lumaTolerance)}:softness=${formatFfmpegNumber(key.lumaSoftness)}`,
    ];
  }
  if (key.mode === 'difference-matte') {
    return [];
  }
  const filters = key.colors.map(
    (color) =>
      `chromakey=color=0x${formatChromaKeyColor(color)}:similarity=${formatFfmpegNumber(key.similarity)}:blend=${formatFfmpegNumber(key.blend)}`,
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

export function isDifferenceMatteEnabled(key: ReturnType<typeof normalizeChromaKey>): boolean {
  return key.enabled && key.mode === 'difference-matte';
}

export function formatChromaKeyColor(color: [number, number, number]): string {
  return color
    .map((channel) => Math.round(channel).toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

export function buildStabilizationFilters(clip: ExportClip): string[] {
  if (!isStabilizationExportable(clip.stabilization)) {
    return [];
  }
  const trfPath = clip.stabilization.trfPath ?? '';
  return [
    `vidstabtransform=smoothing=${formatFfmpegNumber(clip.stabilization.smoothing)}:zoom=${formatFfmpegNumber(clip.stabilization.zoom)}:input=${escapeDrawtextValue(
      trfPath,
    )}`,
  ];
}

export function buildSlowMotionFilters(
  clip: ExportClip,
  settings: ExportSettings,
  capabilities: FfmpegCapabilities | undefined,
  warnings: string[],
): string[] {
  if (clip.type !== 'video' && clip.type !== 'nested-sequence') {
    return [];
  }
  const mode = normalizeSlowMotionMode(clip.slowMotionMode);
  if (mode === 'none' || getMinimumClipSpeed(clip) >= 1) {
    return [];
  }
  const fps = Math.max(1, Math.round(settings.fps));
  if (mode === 'optical-flow' && capabilities?.hasMinterpolate === false) {
    warnings.push(
      `Optical flow slow motion for clip ${clip.id} fell back to blend because the current FFmpeg build did not report minterpolate support.`,
    );
    return [`minterpolate=fps=${fps}:mi_mode=blend`];
  }
  if (capabilities?.hasMinterpolate === false) {
    warnings.push(
      `Slow motion interpolation for clip ${clip.id} was skipped because the current FFmpeg build does not support minterpolate.`,
    );
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

export function buildFrameInterpolationFilters(
  clip: ExportClip,
  capabilities: FfmpegCapabilities | undefined,
  warnings: string[],
): string[] {
  if (!clip.frameInterpolation.enabled || (clip.type !== 'video' && clip.type !== 'nested-sequence')) {
    return [];
  }
  const mode = resolveFrameInterpolationMode(clip.frameInterpolation.mode, averageClipMotionScore(clip));
  if (mode === 'copy') {
    return [`fps=fps=${clip.frameInterpolation.targetFps}:round=near`];
  }
  if (capabilities?.hasMinterpolate === false) {
    warnings.push(
      `Frame interpolation for clip ${clip.id} was skipped because the current FFmpeg build does not support minterpolate.`,
    );
    return [];
  }
  const sceneRanges = buildSceneBoundaryProtectionRanges(
    clip.scenecuts,
    clip.frameInterpolation.targetFps,
    clip.duration,
    clip.frameInterpolation.protectionFrames,
  );
  if (sceneRanges.length > 0) {
    warnings.push(`Frame interpolation for clip ${clip.id} protects ${sceneRanges.length} scene boundary range(s).`);
  }
  if (mode === 'blend') {
    return [buildFrameInterpolationFilterArg(clip.frameInterpolation.targetFps, 'blend', sceneRanges.length > 0)];
  }
  return [buildFrameInterpolationFilterArg(clip.frameInterpolation.targetFps, 'mci', sceneRanges.length > 0)];
}

export function buildFrameInterpolationFilterArg(fps: number, mode: 'blend' | 'mci', sceneProtected: boolean): string {
  const sceneDetection = sceneProtected ? ':scd=fdiff' : '';
  if (mode === 'blend') {
    return `minterpolate=fps=${fps}:mi_mode=blend${sceneDetection}`;
  }
  return `minterpolate=fps=${fps}:mi_mode=mci:mc_mode=aobmc${sceneDetection}`;
}

export function buildVideoRestorationFilters(clip: ExportClip): string[] {
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
        restoration.temporalDenoise.chromaSpatial,
      )}:luma_tmp=${formatFfmpegNumber(restoration.temporalDenoise.lumaTmp)}`,
    );
  }
  if (restoration.spatialDenoise.enabled) {
    filters.push(
      `nlmeans=s=${formatFfmpegNumber(restoration.spatialDenoise.strength)}:p=${Math.round(restoration.spatialDenoise.patchSize)}:r=${Math.round(
        restoration.spatialDenoise.researchSize,
      )}`,
    );
  }
  return filters;
}

export function buildQualityEnhancementFilters(clip: ExportClip): string[] {
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

export function getMinimumClipSpeed(clip: ExportClip): number {
  const frames = getAnimatedFrames(clip, 'speed');
  if (frames.length === 0) {
    return clip.speed;
  }
  return Math.min(clip.speed, ...frames.map((frame) => frame.value));
}
