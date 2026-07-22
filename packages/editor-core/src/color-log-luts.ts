import { clamp01 } from './math-utils';

export const REC709_INPUT_COLOR_SPACE = 'rec709' as const;
export const LOG_INPUT_COLOR_SPACES = ['slog2', 'slog3', 'clog', 'clog3', 'llog', 'vlog'] as const;
export const INPUT_COLOR_SPACES = [REC709_INPUT_COLOR_SPACE, ...LOG_INPUT_COLOR_SPACES] as const;
export const LOG_TO_REC709_LUT_SIZE = 17;

export type LogInputColorSpace = (typeof LOG_INPUT_COLOR_SPACES)[number];
export type InputColorSpace = (typeof INPUT_COLOR_SPACES)[number];
export type Lut3dPoint = readonly [number, number, number];

export interface LogToRec709Lut {
  colorSpace: LogInputColorSpace;
  title: string;
  size: number;
  points: readonly Lut3dPoint[];
}

interface LogCurveSpec {
  lift: number;
  gamma: number;
  exposure: number;
  saturation: number;
  shadowTint: Lut3dPoint;
  highlightTint: Lut3dPoint;
}

const LOG_CURVE_SPECS: Record<LogInputColorSpace, LogCurveSpec> = {
  slog2: {
    lift: 0.028,
    gamma: 1.48,
    exposure: 1.1,
    saturation: 1.08,
    shadowTint: [1.02, 1, 0.98],
    highlightTint: [1.01, 1, 0.99],
  },
  slog3: {
    lift: 0.035,
    gamma: 1.55,
    exposure: 1.12,
    saturation: 1.1,
    shadowTint: [1.01, 1, 0.99],
    highlightTint: [1.02, 1.01, 0.98],
  },
  clog: {
    lift: 0.04,
    gamma: 1.42,
    exposure: 1.08,
    saturation: 1.06,
    shadowTint: [1, 1, 1],
    highlightTint: [1.01, 1, 0.99],
  },
  clog3: {
    lift: 0.045,
    gamma: 1.5,
    exposure: 1.1,
    saturation: 1.08,
    shadowTint: [1, 1.01, 1],
    highlightTint: [1.01, 1, 0.99],
  },
  llog: {
    lift: 0.032,
    gamma: 1.46,
    exposure: 1.09,
    saturation: 1.07,
    shadowTint: [1, 1.01, 1.02],
    highlightTint: [1.01, 1, 1],
  },
  vlog: {
    lift: 0.038,
    gamma: 1.52,
    exposure: 1.11,
    saturation: 1.09,
    shadowTint: [0.99, 1, 1.02],
    highlightTint: [1.02, 1.01, 1],
  },
};

const LOG_COLOR_SPACE_TITLES: Record<LogInputColorSpace, string> = {
  slog2: 'S-Log2 to Rec.709',
  slog3: 'S-Log3 to Rec.709',
  clog: 'Canon Log to Rec.709',
  clog3: 'Canon Log 3 to Rec.709',
  llog: 'Leica L-Log to Rec.709',
  vlog: 'Panasonic V-Log to Rec.709',
};

export const LOG_TO_REC709_LUTS: Record<LogInputColorSpace, LogToRec709Lut> = Object.freeze(
  Object.fromEntries(
    LOG_INPUT_COLOR_SPACES.map((colorSpace) => [colorSpace, buildLogToRec709Lut(colorSpace)]),
  ) as Record<LogInputColorSpace, LogToRec709Lut>,
);

export function normalizeInputColorSpace(value: unknown): InputColorSpace {
  return INPUT_COLOR_SPACES.includes(value as InputColorSpace) ? (value as InputColorSpace) : REC709_INPUT_COLOR_SPACE;
}

export function isLogInputColorSpace(value: InputColorSpace): value is LogInputColorSpace {
  return value !== REC709_INPUT_COLOR_SPACE;
}

export function getLogToRec709Lut(colorSpace: InputColorSpace): LogToRec709Lut | undefined {
  return isLogInputColorSpace(colorSpace) ? LOG_TO_REC709_LUTS[colorSpace] : undefined;
}

export function serializeLogToRec709Cube(colorSpace: LogInputColorSpace): string {
  const lut = LOG_TO_REC709_LUTS[colorSpace];
  return [
    `TITLE "Open Factory ${lut.title}"`,
    `LUT_3D_SIZE ${lut.size}`,
    'DOMAIN_MIN 0 0 0',
    'DOMAIN_MAX 1 1 1',
    ...lut.points.map(([r, g, b]) => `${formatCubeNumber(r)} ${formatCubeNumber(g)} ${formatCubeNumber(b)}`),
  ].join('\n');
}

function buildLogToRec709Lut(colorSpace: LogInputColorSpace): LogToRec709Lut {
  const spec = LOG_CURVE_SPECS[colorSpace];
  const scale = LOG_TO_REC709_LUT_SIZE - 1;
  const points: Lut3dPoint[] = [];
  for (let blue = 0; blue < LOG_TO_REC709_LUT_SIZE; blue += 1) {
    for (let green = 0; green < LOG_TO_REC709_LUT_SIZE; green += 1) {
      for (let red = 0; red < LOG_TO_REC709_LUT_SIZE; red += 1) {
        const input: Lut3dPoint = [red / scale, green / scale, blue / scale];
        points.push(convertLogTripletToRec709(input, spec));
      }
    }
  }
  return Object.freeze({
    colorSpace,
    title: LOG_COLOR_SPACE_TITLES[colorSpace],
    size: LOG_TO_REC709_LUT_SIZE,
    points: Object.freeze(points),
  });
}

function mapTuple(tuple: Lut3dPoint, fn: (value: number, index: number) => number): Lut3dPoint {
  return [fn(tuple[0], 0), fn(tuple[1], 1), fn(tuple[2], 2)];
}

function convertLogTripletToRec709(input: Lut3dPoint, spec: LogCurveSpec): Lut3dPoint {
  const expanded = mapTuple(input, (channel, index) => {
    const normalized = Math.max(0, (channel - spec.lift) / Math.max(0.001, 1 - spec.lift));
    const contrast = Math.pow(normalized, spec.gamma) * spec.exposure;
    const tint = spec.shadowTint[index] * (1 - channel) + spec.highlightTint[index] * channel;
    return clamp01(contrast * tint);
  });
  const luma = expanded[0] * 0.2126 + expanded[1] * 0.7152 + expanded[2] * 0.0722;
  return [
    clamp01(luma + (expanded[0] - luma) * spec.saturation),
    clamp01(luma + (expanded[1] - luma) * spec.saturation),
    clamp01(luma + (expanded[2] - luma) * spec.saturation),
  ];
}

function formatCubeNumber(value: number): string {
  return value.toFixed(6).replace(/\.?0+$/, '');
}
