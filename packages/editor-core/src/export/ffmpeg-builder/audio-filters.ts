import { buildAudioRestorationFilterChain } from '../../audio-restoration';
import { EffectChainEngine } from '../../audio/effect-chain';
import type { AudioEffectSlot } from '../../audio/mixer-types';
import {
  buildNoiseReductionFilterString,
  normalizeNoiseReductionParams,
  type NoiseReductionParams,
} from '../../audio/noise-reduction';
import {
  buildSofalizerArgs,
  calculateSpatialDistanceGain,
  isDefaultSpatialAudio,
  mapSpatialXToPanGains,
  normalizeSpatialAudio,
} from '../../spatial-audio';
import { getClipSpeed } from '../../timeline';
import type {
  ExportClip,
  ExportKeyframe,
  ExportLoudnessNormalization,
  ExportMasterEq,
  ExportSettings,
  FfmpegCapabilities,
} from '../export-types';
import { formatFfmpegSeconds, normalizeFfmpegPath } from '../ffmpeg-escape';
import {
  formatFfmpegNumber,
  formatVolume,
  formatPan,
  formatCompressorLinear,
  formatAtempo,
  formatPitchRatio,
} from './utils';
import {
  LOUDNORM_MEASURED_I_PLACEHOLDER,
  LOUDNORM_MEASURED_TP_PLACEHOLDER,
  LOUDNORM_MEASURED_LRA_PLACEHOLDER,
  LOUDNORM_MEASURED_THRESH_PLACEHOLDER,
  LOUDNORM_OFFSET_PLACEHOLDER,
  type LoudnessNormalizationPreset,
  normalizeExportMasterProcessing,
} from './settings-normalize';

// ---------------------------------------------------------------------------
// Local types & helpers
// ---------------------------------------------------------------------------

export type AnimatedProperty = keyof NonNullable<ExportClip['keyframes']>;

export function getAnimatedFrames(clip: ExportClip, property: AnimatedProperty): ExportKeyframe[] {
  return [...(clip.keyframes?.[property] ?? [])].sort(
    (left, right) => left.time - right.time || left.id.localeCompare(right.id),
  );
}

export function getAverageClipSpeed(clip: ExportClip): number {
  if (clip.duration <= 0.000001) {
    return clip.speed;
  }
  return getClipSpeed({ speed: clip.sourceDuration / clip.duration });
}

export function getExportClipSourceDuration(clip: ExportClip): number {
  return clip.type === 'video' || clip.type === 'audio' || clip.type === 'nested-sequence'
    ? Math.max(0.001, clip.sourceDuration)
    : Math.max(0.001, clip.duration);
}

export function buildLocalExpression(
  frames: Array<{ time: number; value: number; easing?: ExportKeyframe['easing'] }>,
  fallback: number,
  variable = 't',
): string {
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

export function buildSegmentExpression(
  left: { time: number; value: number; easing?: ExportKeyframe['easing'] },
  right: { time: number; value: number },
  variable: string,
): string {
  const start = formatFfmpegSeconds(left.time);
  const startValue = formatFfmpegNumber(left.value);
  const endValue = formatFfmpegNumber(right.value);
  const span = formatFfmpegSeconds(Math.max(0.001, right.time - left.time));
  const progress = `((${variable}-${start})/${span})`;
  return `${startValue}+(${endValue}-${startValue})*${buildEasingExpression(progress, left.easing ?? 'linear')}`;
}

export function buildEasingExpression(progress: string, easing: ExportKeyframe['easing']): string {
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

export function buildBounceEasingExpression(progress: string): string {
  const n1 = '7.5625';
  const d1 = '2.75';
  const second = `${n1}*((${progress})-1.5/${d1})*((${progress})-1.5/${d1})+0.75`;
  const third = `${n1}*((${progress})-2.25/${d1})*((${progress})-2.25/${d1})+0.9375`;
  const fourth = `${n1}*((${progress})-2.625/${d1})*((${progress})-2.625/${d1})+0.984375`;
  return `if(lt(${progress},1/${d1}),${n1}*(${progress})*(${progress}),if(lt(${progress},2/${d1}),${second},if(lt(${progress},2.5/${d1}),${third},${fourth})))`;
}

// ---------------------------------------------------------------------------
// Exported audio filter builders
// ---------------------------------------------------------------------------

/**
 * 构建音频效果链的 FFmpeg 滤镜
 */
export function buildAudioEffectChainFilters(effects: AudioEffectSlot[]): string[] {
  if (effects.length === 0) return [];

  const ffmpegFilters = EffectChainEngine.toFfmpegFilters(effects);
  return ffmpegFilters.map((f) => {
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
  effects: AudioEffectSlot[],
): string[] {
  const filters: string[] = [];

  // 音量
  if (channelVolume !== 0) {
    filters.push(`volume=${channelVolume}dB`);
  }

  // 声像
  if (channelPan !== 0) {
    const panValue = channelPan / 100; // -1 to 1
    filters.push(
      `stereopan=stereo=${panValue < 0 ? `l=${1 + panValue}+${Math.abs(panValue)}*c0|r=${Math.abs(panValue)}*c0+${1 + panValue}*c1` : `l=${1 - panValue}*c0+${panValue}*c1|r=${panValue}*c0+${1 - panValue}*c1`}`,
    );
  }

  // 效果链
  filters.push(...buildAudioEffectChainFilters(effects));

  return filters;
}

// ---------------------------------------------------------------------------
// Internal audio filter builders
// ---------------------------------------------------------------------------

export function buildAudioFilters(
  clips: ExportClip[],
  inputByClipId: Map<string, number>,
  settings: ExportSettings,
  filters: string[],
  capabilities: FfmpegCapabilities | undefined,
  warnings: string[],
): string[] {
  const labels: string[] = [];
  for (const clip of clips.filter(
    (item) =>
      item.type === 'audio' || ((item.type === 'video' || item.type === 'nested-sequence') && item.hasEmbeddedAudio),
  )) {
    if (clip.muted || clip.volume <= 0) {
      continue;
    }
    const inputIndex = inputByClipId.get(clip.id);
    if (inputIndex === undefined) {
      continue;
    }
    const label = `${clip.type === 'video' || clip.type === 'nested-sequence' ? 'av' : 'a'}${safeLabel(clip.id)}`;
    const delay = Math.max(0, Math.round(clip.start * 1000));
    const speedFilters = buildAtempoFilters(
      getAnimatedFrames(clip, 'speed').length > 0 ? getAverageClipSpeed(clip) : clip.speed,
    );
    const pitchAndReverseFilters = buildPitchAndReverseAudioFilters(clip, settings.sampleRate);
    const fadeFilters = buildAudioFadeFilters(clip);
    const denoiseFilters = buildAudioDenoiseFilters(clip, capabilities, warnings);
    const restorationFilters = buildAudioRestorationFilters(clip);
    const trackProcessingFilters = buildTrackAudioFilters(clip);
    const effectsChainFilters = clip.effectsChain?.length ? buildAudioEffectChainFilters(clip.effectsChain) : [];
    const automationFilters = buildAutomationFilters(clip);
    filters.push(
      `[${inputIndex}:a:0]atrim=start=0:duration=${formatFfmpegSeconds(
        getExportClipSourceDuration(clip),
      )},asetpts=PTS-STARTPTS${pitchAndReverseFilters.length > 0 ? `,${pitchAndReverseFilters.join(',')}` : ''}${speedFilters.length > 0 ? `,${speedFilters.join(',')}` : ''}${fadeFilters}${restorationFilters}${denoiseFilters}${trackProcessingFilters}${effectsChainFilters.length > 0 ? `,${effectsChainFilters.join(',')}` : ''},adelay=${delay}:all=1,${buildVolumeFilter(
        clip,
      )}${buildAudioChannelRoutingFilter(clip)}${buildPanFilter(clip)}${buildSpatialAudioFilter(clip, settings)}${automationFilters},aformat=channel_layouts=stereo,aresample=${settings.sampleRate}[${label}]`,
    );
    labels.push(label);
  }
  return labels;
}

export function buildPitchAndReverseAudioFilters(clip: ExportClip, sampleRate: number): string[] {
  const filters: string[] = [];
  if (clip.reverseAudio) {
    filters.push('areverse');
  }
  if (Math.abs(clip.pitchSemitones) >= 0.0001) {
    filters.push(
      `asetrate=${Math.round(sampleRate)}*${formatPitchRatio(clip.pitchSemitones)}`,
      `aresample=${Math.round(sampleRate)}`,
    );
  }
  return filters;
}

export function getLoudnessNormalizationPreset(
  mode: ExportLoudnessNormalization | undefined,
): LoudnessNormalizationPreset | undefined {
  if (mode === 'youtube') {
    return { mode, args: ['I=-14', 'TP=-1.5', 'LRA=11'] };
  }
  if (mode === 'ebu-r128') {
    return { mode, args: ['I=-23'] };
  }
  return undefined;
}

export function buildLoudnormAnalysisFilter(preset: LoudnessNormalizationPreset): string {
  return `loudnorm=${[...preset.args, 'print_format=json'].join(':')}`;
}

export function buildLoudnormRenderFilter(preset: LoudnessNormalizationPreset): string {
  return `loudnorm=${[
    ...preset.args,
    `measured_I=${LOUDNORM_MEASURED_I_PLACEHOLDER}`,
    `measured_TP=${LOUDNORM_MEASURED_TP_PLACEHOLDER}`,
    `measured_LRA=${LOUDNORM_MEASURED_LRA_PLACEHOLDER}`,
    `measured_thresh=${LOUDNORM_MEASURED_THRESH_PLACEHOLDER}`,
    `offset=${LOUDNORM_OFFSET_PLACEHOLDER}`,
    'linear=true',
    'print_format=summary',
  ].join(':')}`;
}

export function buildAudioDenoiseFilters(
  clip: ExportClip,
  capabilities: FfmpegCapabilities | undefined,
  warnings: string[],
): string {
  if (!clip.audioDenoise.enabled || clip.audioDenoise.strength <= 0) {
    return '';
  }
  if (capabilities?.hasArnndn === false) {
    warnings.push(
      `Audio denoise for clip ${clip.id} was skipped because the current FFmpeg build does not support arnndn.`,
    );
    return '';
  }
  return `,arnndn=m=model.rnnn:mix=${formatFfmpegNumber(clip.audioDenoise.strength)}`;
}

/**
 * 生成基于 afftdn 的降噪滤镜
 * 用于混音器面板的"一键降噪"功能
 * 使用参数数组风格，不拼接 shell 字符串
 */
export function buildAfftdnNoiseReductionFilter(
  params: NoiseReductionParams,
): string {
  const normalized = normalizeNoiseReductionParams(params);
  const filterString = buildNoiseReductionFilterString(normalized);
  return filterString ? `,${filterString}` : '';
}

/**
 * 从混音器通道效果链中提取降噪滤镜
 * 将 noise-reduction 效果类型转换为 afftdn FFmpeg 滤镜
 */
export function buildMixerChannelNoiseReductionFilter(
  effects: AudioEffectSlot[],
): string {
  const noiseReductionEffects = effects.filter(
    (e) => e.effectType === 'noise-reduction' && e.enabled,
  );
  if (noiseReductionEffects.length === 0) {
    return '';
  }
  // 使用第一个降噪效果的参数
  const effect = noiseReductionEffects[0];
  const params: NoiseReductionParams = {
    noiseFloor: effect.params.threshold ?? -25,
    nrType: Math.round((effect.params.reduction ?? 50) / 50), // 映射 0-100 到 0-2
    autoNoiseSampling: false,
    noiseSampleStart: 0,
    noiseSampleEnd: 0,
  };
  return buildAfftdnNoiseReductionFilter(params);
}

export function buildAudioRestorationFilters(clip: ExportClip): string {
  const filterChain = buildAudioRestorationFilterChain(clip.audioRestoration, { duration: clip.duration });
  return filterChain ? `,${filterChain}` : '';
}

export function buildPanFilter(clip: ExportClip): string {
  if (Math.abs(clip.pan) < 0.001) {
    return '';
  }
  return `,stereopan=pan=${formatPan(clip.pan)}`;
}

export function buildAutomationFilters(clip: ExportClip): string {
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

export function buildSpatialAudioFilter(clip: ExportClip, settings: ExportSettings): string {
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
      `pan=stereo|c0='${buildSpatialPanGainExpression(xFrames, spatial.x, 'left')}'*c0|c1='${buildSpatialPanGainExpression(xFrames, spatial.x, 'right')}'*c1`,
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

export function escapeSofalizerArg(arg: string): string {
  const separator = arg.indexOf('=');
  if (separator < 0) {
    return arg;
  }
  const key = arg.slice(0, separator);
  const value = arg.slice(separator + 1);
  return key === 'sofa' ? `${key}=${escapeFilterFileValue(value)}` : `${key}=${value}`;
}

export function escapeFilterFileValue(value: string): string {
  return normalizeFfmpegPath(value).replace(/:/g, '\\:').replace(/'/g, "\\'");
}

export function buildSpatialPanGainExpression(
  frames: Array<{ time: number; value: number; easing?: ExportKeyframe['easing'] }>,
  fallbackX: number,
  channel: 'left' | 'right',
): string {
  const mapped = frames.map((frame) => ({
    ...frame,
    value: channel === 'left' ? mapSpatialXToPanGains(frame.value).left : mapSpatialXToPanGains(frame.value).right,
  }));
  const fallback = channel === 'left' ? mapSpatialXToPanGains(fallbackX).left : mapSpatialXToPanGains(fallbackX).right;
  return buildLocalExpression(mapped, fallback);
}

export function buildSpatialVolumeExpression(
  frames: Array<{ time: number; value: number; easing?: ExportKeyframe['easing'] }>,
  spatial: ExportClip['spatialAudio'],
): string {
  const mapped = frames.map((frame) => ({
    ...frame,
    value: calculateSpatialDistanceGain({ ...spatial, y: frame.value }),
  }));
  return buildLocalExpression(mapped, calculateSpatialDistanceGain(spatial));
}

export function buildAudioChannelRoutingFilter(clip: ExportClip): string {
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

export function buildTrackAudioFilters(clip: ExportClip): string {
  const filters: string[] = [];
  if (clip.eq.enabled) {
    filters.push(...buildEqualizerFilters(clip.eq));
  }
  if (clip.compressor.enabled) {
    filters.push(
      `acompressor=threshold=${formatCompressorLinear(clip.compressor.threshold)}:ratio=${formatFfmpegNumber(
        clip.compressor.ratio,
      )}:attack=${formatFfmpegNumber(clip.compressor.attack)}:release=${formatFfmpegNumber(clip.compressor.release)}:makeup=${formatCompressorLinear(
        clip.compressor.makeupGain,
      )}`,
    );
  }
  return filters.length > 0 ? `,${filters.join(',')}` : '';
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

export function buildAudioFadeFilters(clip: ExportClip): string {
  const filters: string[] = [];
  if (clip.fadeInDuration > 0) {
    filters.push(
      `afade=t=in:st=0:d=${formatFfmpegSeconds(Math.min(clip.fadeInDuration, clip.duration))}${formatAudioFadeCurve(clip.fadeInCurve)}`,
    );
  }
  if (clip.fadeOutDuration > 0) {
    const duration = Math.min(clip.fadeOutDuration, clip.duration);
    filters.push(
      `afade=t=out:st=${formatFfmpegSeconds(Math.max(0, clip.duration - duration))}:d=${formatFfmpegSeconds(duration)}${formatAudioFadeCurve(clip.fadeOutCurve)}`,
    );
  }
  return filters.length > 0 ? `,${filters.join(',')}` : '';
}

export function formatAudioFadeCurve(curve: ExportClip['fadeInCurve']): string {
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

export function buildVolumeFilter(clip: ExportClip): string {
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

export function safeLabel(value: string): string {
  return value.replace(/[^a-zA-Z0-9_]/g, '_');
}
