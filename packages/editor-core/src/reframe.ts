import { round } from './time';

export const TARGET_ASPECT_RATIOS = ['source', '16:9', '9:16', '1:1', '4:5', '21:9'] as const;
export type TargetAspectRatio = (typeof TARGET_ASPECT_RATIOS)[number];

export interface ReframeSettings {
  targetAspectRatio?: TargetAspectRatio;
  reframeOffsetX?: number;
  reframeOffsetY?: number;
}

export interface ReframeCrop {
  targetAspectRatio: Exclude<TargetAspectRatio, 'source'>;
  ratio: number;
  offsetX: number;
  offsetY: number;
  cropWidthExpression: string;
  cropHeightExpression: string;
  cropXExpression: string;
  cropYExpression: string;
}

const TARGET_ASPECT_RATIO_VALUES: Record<Exclude<TargetAspectRatio, 'source'>, number> = {
  '16:9': 16 / 9,
  '9:16': 9 / 16,
  '1:1': 1,
  '4:5': 4 / 5,
  '21:9': 21 / 9,
};

export function normalizeTargetAspectRatio(value: unknown): TargetAspectRatio {
  return TARGET_ASPECT_RATIOS.includes(value as TargetAspectRatio) ? (value as TargetAspectRatio) : 'source';
}

export function isReframeEnabled(value: unknown): value is Exclude<TargetAspectRatio, 'source'> {
  const normalized = normalizeTargetAspectRatio(value);
  return normalized !== 'source';
}

export function clampReframeOffset(value: unknown): number {
  return round(Math.min(1, Math.max(-1, typeof value === 'number' && Number.isFinite(value) ? value : 0)));
}

export function getTargetAspectRatioValue(value: Exclude<TargetAspectRatio, 'source'>): number {
  return TARGET_ASPECT_RATIO_VALUES[value];
}

export function resolveReframeDimensions(
  width: number,
  height: number,
  targetAspectRatio: TargetAspectRatio | undefined,
): { width: number; height: number } {
  const safeWidth = Math.max(1, Math.round(width || 1));
  const safeHeight = Math.max(1, Math.round(height || 1));
  const normalized = normalizeTargetAspectRatio(targetAspectRatio);
  if (normalized === 'source') {
    return { width: safeWidth, height: safeHeight };
  }
  const ratio = getTargetAspectRatioValue(normalized);
  const longest = Math.max(safeWidth, safeHeight);
  if (ratio >= 1) {
    return {
      width: makeEven(longest),
      height: makeEven(longest / ratio),
    };
  }
  return {
    width: makeEven(longest * ratio),
    height: makeEven(longest),
  };
}

export function calculateReframeCrop(settings: ReframeSettings): ReframeCrop | undefined {
  const targetAspectRatio = normalizeTargetAspectRatio(settings.targetAspectRatio);
  if (targetAspectRatio === 'source') {
    return undefined;
  }
  const ratio = getTargetAspectRatioValue(targetAspectRatio);
  const ratioText = formatFilterNumber(ratio);
  const offsetX = clampReframeOffset(settings.reframeOffsetX);
  const offsetY = clampReframeOffset(settings.reframeOffsetY);
  return {
    targetAspectRatio,
    ratio,
    offsetX,
    offsetY,
    cropWidthExpression: `if(gte(iw/ih\\,${ratioText})\\,ih*${ratioText}\\,iw)`,
    cropHeightExpression: `if(gte(iw/ih\\,${ratioText})\\,ih\\,iw/${ratioText})`,
    cropXExpression: `(iw-ow)/2+(iw-ow)/2*${formatFilterNumber(offsetX)}`,
    cropYExpression: `(ih-oh)/2+(ih-oh)/2*${formatFilterNumber(offsetY)}`,
  };
}

export function buildReframeCropFilter(settings: ReframeSettings): string | undefined {
  const crop = calculateReframeCrop(settings);
  if (!crop) {
    return undefined;
  }
  return `crop=w='${crop.cropWidthExpression}':h='${crop.cropHeightExpression}':x='${crop.cropXExpression}':y='${crop.cropYExpression}'`;
}

function makeEven(value: number): number {
  return Math.max(2, Math.round(value / 2) * 2);
}

function formatFilterNumber(value: number): string {
  return Number(value.toFixed(6)).toString();
}
