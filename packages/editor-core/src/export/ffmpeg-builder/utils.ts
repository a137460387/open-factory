import {
  buildExportColorTagArgs,
  buildIccMetadataArgs,
  buildZscaleColorConversionFilter,
  getFfmpegColorSpaceProfile,
  normalizeExportColorManagement,
  normalizeProjectWorkingColorSpace,
} from '../../color-management';
import { buildAcesOdtFilterChain, normalizeProjectColorPipeline } from '../../color-pipeline';
import type {
  ExportClip,
  ExportKeyframe,
  ExportProject,
  ExportSettings,
  FfmpegCapabilities,
  HardwareEncoderSettings,
} from '../export-types';
import { formatFfmpegSeconds } from '../ffmpeg-escape';

export function buildBitrateArgs(flag: '-b:v' | '-b:a', bitrate: string | null | undefined): string[] {
  const value = bitrate?.trim();
  return value ? [flag, value] : [];
}

export function buildVideoEncodingArgs(
  settings: ExportSettings,
  capabilities: FfmpegCapabilities | undefined,
  warnings: string[],
  skipVideoCodec: boolean,
): string[] {
  if (skipVideoCodec) {
    return [];
  }
  if (settings.hardwareEncoding) {
    const format = settings.format.toLowerCase();
    const hwOk = format === 'mp4' || format === 'mov';
    const hw = settings.hardwareEncoderSettings;
    if (hwOk && hw?.encoderId && capabilities) {
      return buildHardwareEncoderArgs(hw, settings.fps, capabilities, warnings);
    }
    const enc = capabilities?.hardwareEncoderAvailable ? capabilities.hardwareEncoder : null;
    if (hwOk && enc) {
      return ['-c:v', enc, '-preset', 'p4', '-cq', '23', '-pix_fmt', 'yuv420p', '-r', String(settings.fps)];
    }
    warnings.push(
      'Hardware video encoding was requested but no supported H.264 hardware encoder was detected. Falling back to software encoding.',
    );
  }
  return [
    '-c:v',
    settings.videoCodec,
    ...buildBitrateArgs('-b:v', settings.videoBitrate),
    ...buildVideoProfileArgs(settings),
    '-pix_fmt',
    'yuv420p',
    '-r',
    String(settings.fps),
  ];
}

export function buildVideoProfileArgs(settings: ExportSettings): string[] {
  const codec = settings.videoCodec.toLowerCase();
  return settings.videoProfile && (codec.includes('264') || codec === 'h264')
    ? ['-profile:v', settings.videoProfile]
    : [];
}

export function buildContainerArgs(settings: ExportSettings): string[] {
  const format = settings.format.toLowerCase();
  if (settings.outputMode === 'audio' || format === 'm4a' || format === 'png-sequence') {
    return [];
  }
  if (format === 'mp4' || format === 'mov') {
    return ['-movflags', shouldGenerateIccProfile(settings) ? '+faststart+prefer_icc' : '+faststart'];
  }
  return [];
}

export function buildExportColorMetadataArgs(settings: ExportSettings): string[] {
  const colorManagement = normalizeExportColorManagement(settings.colorManagement);
  const args = buildExportColorTagArgs(colorManagement.outputColorSpace);
  const format = settings.format.toLowerCase();
  if ((format === 'mp4' || format === 'mov') && shouldGenerateIccProfile(settings)) {
    args.push(...buildIccMetadataArgs(colorManagement.outputColorSpace));
  }
  return args;
}

export function buildExportContainerMetadataArgs(metadata: ExportProject['metadata']): string[] {
  if (!metadata) {
    return [];
  }
  const entries: Array<[string, string | undefined]> = [
    ['title', metadata.title],
    ['artist', metadata.author],
    ['comment', metadata.description],
    ['copyright', metadata.copyright],
    ['date', metadata.date],
  ];
  return entries.flatMap(([key, value]) => {
    const normalized = value?.replace(/[\r\n\t]+/g, ' ').trim();
    return normalized ? ['-metadata', `${key}=${normalized}`] : [];
  });
}

export function buildExportColorManagementFilters(settings: ExportSettings): string[] {
  const colorManagement = normalizeExportColorManagement(settings.colorManagement);
  const colorPipeline = normalizeProjectColorPipeline(settings.colorPipeline);
  const input = getFfmpegColorSpaceProfile(colorManagement.inputColorSpace);
  const output = getFfmpegColorSpaceProfile(colorManagement.outputColorSpace);
  const filters: string[] = [...buildAcesOdtFilterChain(colorPipeline, colorManagement.outputColorSpace)];
  if (colorManagement.inputColorSpace !== colorManagement.outputColorSpace) {
    filters.push(
      `colorspace=ispace=${input.space}:iprimaries=${input.primaries}:itrc=${input.trc}:space=${output.space}:primaries=${output.primaries}:trc=${output.trc}`,
    );
  }
  if (shouldGenerateIccProfile(settings)) {
    filters.push(`iccgen=force=1:color_primaries=${output.primaries}:color_trc=${output.trc}`);
  }
  return filters;
}

export function shouldGenerateIccProfile(settings: ExportSettings): boolean {
  const colorManagement = normalizeExportColorManagement(settings.colorManagement);
  return (
    colorManagement.embedIccProfile &&
    (colorManagement.inputColorSpace !== colorManagement.outputColorSpace ||
      colorManagement.outputColorSpace !== 'srgb')
  );
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

export type AnimatedProperty = keyof NonNullable<ExportClip['keyframes']>;

export function getAnimatedFrames(clip: ExportClip, property: AnimatedProperty): ExportKeyframe[] {
  return [...(clip.keyframes?.[property] ?? [])].sort(
    (left, right) => left.time - right.time || left.id.localeCompare(right.id),
  );
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

export function buildTimelineExpression(
  frames: Array<{ time: number; value: number; easing?: ExportKeyframe['easing'] }>,
  clipStart: number,
  fallback: number,
  variable = 't',
): string {
  if (frames.length < 2) {
    return formatFfmpegNumber(frames[0]?.value ?? fallback);
  }
  const shifted = frames.map((frame) => ({ ...frame, time: clipStart + frame.time }));
  return buildLocalExpression(shifted, fallback, variable);
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

export function formatAtempo(value: number): string {
  const fixed = value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
  return fixed.includes('.') ? fixed : `${fixed}.0`;
}

export function formatPitchRatio(semitones: number): string {
  return formatFfmpegNumber(2 ** (semitones / 12));
}

export function formatFfmpegNumber(value: number): string {
  const rounded = Math.round(value * 1000) / 1000;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(/0+$/g, '').replace(/\.$/g, '');
}

export function safeLabel(value: string): string {
  return value.replace(/[^a-zA-Z0-9_]/g, '_');
}

export function nestedInputPlaceholder(sequenceId: string): string {
  return `__NESTED_SEQUENCE_${safeLabel(sequenceId)}__.mp4`;
}

export function formatScale(value: number): string {
  return formatFfmpegSeconds(Math.max(0.01, value || 1));
}

export function formatOpacity(value: number): string {
  return formatFfmpegSeconds(Math.min(1, Math.max(0, value)));
}

export function formatVolume(value: number): string {
  return formatFfmpegSeconds(Math.min(4, Math.max(0, value)));
}

export function formatPan(value: number): string {
  return formatFfmpegNumber(Math.min(1, Math.max(-1, value)));
}

export function formatCompressorLinear(db: number): string {
  return formatFfmpegNumber(Math.min(64, Math.max(0.000976563, 10 ** (db / 20))));
}

export function formatSigned(value: number): string {
  const formatted = formatFfmpegSeconds(Math.abs(value));
  return value < 0 ? `-${formatted}` : formatted;
}

export function formatOffsetExpression(value: number): string {
  const formatted = formatSigned(value);
  return value < 0 ? formatted : `+${formatted}`;
}

export function cssColorToAssColor(value: string, opacity?: number): string {
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

export function buildHardwareEncoderArgs(
  settings: HardwareEncoderSettings,
  fps: number,
  capabilities: FfmpegCapabilities,
  warnings: string[],
): string[] {
  const args: string[] = [];
  const encoderId = settings.encoderId;
  const encoderInfo = capabilities.hardwareEncoders?.find((e) => e.id === encoderId);

  // Check if the requested encoder is available
  if (!encoderInfo || !capabilities.hardwareEncoderAvailable) {
    warnings.push(`Hardware encoder ${encoderId ?? 'none'} not available, falling back to libx264`);
    args.push('-c:v', 'libx264');
    // Apply basic quality settings for software fallback
    if (settings.rateControlMode === 'cqp' && settings.cq !== undefined) {
      // Map hardware CQP to libx264 CRF (approximate)
      const crf = Math.min(51, Math.max(0, Math.round((settings.cq * 51) / 100)));
      args.push('-crf', String(crf));
    }
    return args;
  }

  // Use the requested encoder
  args.push('-c:v', encoderId ?? 'libx264');

  // Apply preset if supported
  if (settings.preset) {
    args.push('-preset', settings.preset);
  }

  // Apply rate control
  const mode = settings.rateControlMode ?? 'cqp';
  const vendor = encoderInfo.vendor;

  switch (mode) {
    case 'cqp': {
      const cq = settings.cq ?? encoderInfo.defaultCq;
      // Different encoders use different flags for constant quality
      if (vendor === 'nvidia') {
        args.push('-cq', String(cq));
      } else if (vendor === 'amd') {
        args.push('-qp_i', String(cq));
      } else if (vendor === 'intel') {
        args.push('-global_quality', String(cq));
      } else if (vendor === 'apple') {
        args.push('-q', String(cq));
      } else if (vendor === 'vaapi') {
        args.push('-qp', String(cq));
      } else {
        args.push('-cq', String(cq));
      }
      break;
    }
    case 'vbr': {
      if (settings.videoBitrate) {
        args.push('-b:v', settings.videoBitrate);
      }
      if (settings.maxBitrate) {
        args.push('-maxrate', settings.maxBitrate);
      }
      break;
    }
    case 'cbr': {
      if (settings.videoBitrate) {
        args.push('-b:v', settings.videoBitrate);
      }
      // For CBR, set bufsize to bitrate
      if (settings.videoBitrate) {
        args.push('-bufsize', settings.videoBitrate);
      }
      break;
    }
  }

  // Apply GOP size
  if (settings.gopSize !== undefined) {
    args.push('-g', String(settings.gopSize));
  } else {
    // Default GOP size based on fps
    args.push('-g', String(Math.round(fps * 2)));
  }

  // Apply B-frames (only if encoder supports them)
  if (settings.bFrames !== undefined && settings.bFrames > 0) {
    if (encoderInfo.supportsBFrames) {
      args.push('-bf', String(settings.bFrames));
    }
    // If encoder doesn't support B-frames, silently skip
  }

  return args;
}
