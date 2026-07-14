import {
  applyColorCurvesToRgb,
  applyThreeWayColor,
  createDefaultColorCurves,
  createDefaultThreeWayColor,
  normalizeColorCurves,
  normalizeThreeWayColor,
  type ColorCurves,
  type RgbColor,
  type ThreeWayColor,
} from './color-grading';
import {
  applyColorMatchTransformToRgb,
  buildColorMatchTransform,
  calculateColorMatchStats,
  type ColorMatchChannelTransform,
  type ColorMatchFrameSample,
  type ColorMatchTransform,
} from './color-match';
import { clamp, round } from './time';

export type LutCreatorPrecision = 17 | 33 | 65;

export interface LutCreatorState {
  title: string;
  precision: LutCreatorPrecision;
  threeWayColor: ThreeWayColor;
  colorCurves: ColorCurves;
  referenceTransform: ColorMatchTransform | null;
  referenceName: string | null;
}

export interface LutCreatorMatrix {
  size: LutCreatorPrecision;
  values: RgbColor[];
}

const DEFAULT_LUT_CREATOR_TITLE = 'open-factory custom LUT';
const LUT_CREATOR_PRECISIONS: LutCreatorPrecision[] = [17, 33, 65];

export function createDefaultLutCreatorState(): LutCreatorState {
  return {
    title: DEFAULT_LUT_CREATOR_TITLE,
    precision: 17,
    threeWayColor: createDefaultThreeWayColor(),
    colorCurves: createDefaultColorCurves(),
    referenceTransform: null,
    referenceName: null,
  };
}

export function normalizeLutCreatorPrecision(value: unknown): LutCreatorPrecision {
  const numeric = typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : 17;
  return LUT_CREATOR_PRECISIONS.includes(numeric as LutCreatorPrecision) ? (numeric as LutCreatorPrecision) : 17;
}

export function normalizeLutCreatorState(state: Partial<LutCreatorState> | undefined): LutCreatorState {
  return {
    title: sanitizeCubeTitle(state?.title ?? DEFAULT_LUT_CREATOR_TITLE),
    precision: normalizeLutCreatorPrecision(state?.precision),
    threeWayColor: normalizeThreeWayColor(state?.threeWayColor),
    colorCurves: normalizeColorCurves(state?.colorCurves),
    referenceTransform: normalizeColorMatchTransform(state?.referenceTransform),
    referenceName:
      typeof state?.referenceName === 'string' && state.referenceName.trim() ? state.referenceName.trim() : null,
  };
}

export function buildLutCreatorReferenceTransform(
  reference: ColorMatchFrameSample | undefined,
): ColorMatchTransform | null {
  if (!reference) {
    return null;
  }
  const source = buildNeutralReferenceSource(reference.width, reference.height);
  return buildColorMatchTransform(calculateColorMatchStats(source), calculateColorMatchStats(reference));
}

export function applyLutCreatorGrade(input: RgbColor, state: Partial<LutCreatorState> | undefined): RgbColor {
  const normalized = normalizeLutCreatorState(state);
  const wheel = applyThreeWayColor(clampRgb(input), normalized.threeWayColor);
  const curved = applyColorCurvesToRgb(wheel, normalized.colorCurves);
  const matched = normalized.referenceTransform
    ? applyColorMatchTransformToRgb(curved, normalized.referenceTransform)
    : curved;
  return clampRgb(matched);
}

export function buildLutCreatorMatrix(state: Partial<LutCreatorState> | undefined): LutCreatorMatrix {
  const normalized = normalizeLutCreatorState(state);
  const size = normalized.precision;
  const values: RgbColor[] = [];
  for (let blue = 0; blue < size; blue += 1) {
    for (let green = 0; green < size; green += 1) {
      for (let red = 0; red < size; red += 1) {
        values.push(
          applyLutCreatorGrade(
            {
              r: red / (size - 1),
              g: green / (size - 1),
              b: blue / (size - 1),
            },
            normalized,
          ),
        );
      }
    }
  }
  return { size, values };
}

export function serializeLutCreatorCube(state: Partial<LutCreatorState> | undefined, title?: string): string {
  const normalized = normalizeLutCreatorState(state);
  const matrix = buildLutCreatorMatrix(normalized);
  const lines = [
    `TITLE "${sanitizeCubeTitle(title ?? normalized.title)}"`,
    `LUT_3D_SIZE ${matrix.size}`,
    'DOMAIN_MIN 0 0 0',
    'DOMAIN_MAX 1 1 1',
    ...matrix.values.map(
      (color) => `${formatCubeNumber(color.r)} ${formatCubeNumber(color.g)} ${formatCubeNumber(color.b)}`,
    ),
  ];
  return `${lines.join('\n')}\n`;
}

function buildNeutralReferenceSource(width: number, height: number): ColorMatchFrameSample {
  const sampleWidth = Math.max(1, Math.round(width || 1));
  const sampleHeight = Math.max(1, Math.round(height || 1));
  const pixelCount = sampleWidth * sampleHeight;
  const data: number[] = [];
  for (let index = 0; index < pixelCount; index += 1) {
    const value = pixelCount <= 1 ? 128 : Math.round((index / (pixelCount - 1)) * 255);
    data.push(value, value, value, 255);
  }
  return { width: sampleWidth, height: sampleHeight, data };
}

function normalizeColorMatchTransform(value: ColorMatchTransform | null | undefined): ColorMatchTransform | null {
  if (!value) {
    return null;
  }
  return {
    r: normalizeChannelTransform(value.r),
    g: normalizeChannelTransform(value.g),
    b: normalizeChannelTransform(value.b),
  };
}

function normalizeChannelTransform(value: ColorMatchChannelTransform): ColorMatchChannelTransform {
  return {
    slope: normalizeFinite(value.slope, 1, -8, 8),
    intercept: normalizeFinite(value.intercept, 0, -2, 2),
    sourceMean: normalizeFinite(value.sourceMean, 0.5, 0, 1),
  };
}

function normalizeFinite(value: number | undefined, fallback: number, min: number, max: number): number {
  return round(clamp(typeof value === 'number' && Number.isFinite(value) ? value : fallback, min, max));
}

function clampRgb(input: RgbColor): RgbColor {
  return {
    r: round(clamp(input.r, 0, 1)),
    g: round(clamp(input.g, 0, 1)),
    b: round(clamp(input.b, 0, 1)),
  };
}

function formatCubeNumber(value: number): string {
  return value.toFixed(6).replace(/0+$/g, '').replace(/\.$/g, '') || '0';
}

function sanitizeCubeTitle(value: string): string {
  return value.replace(/["\r\n]/g, ' ').trim() || DEFAULT_LUT_CREATOR_TITLE;
}
