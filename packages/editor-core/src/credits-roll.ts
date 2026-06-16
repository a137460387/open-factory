import { round } from './time';
import type { CreditsRow, CreditsStyle } from './model-types';
export type { CreditsRow, CreditsStyle } from './model-types';

export const DEFAULT_CREDITS_ROLL_SPEED = 80;

export const DEFAULT_CREDITS_STYLE: CreditsStyle = {
  fontSize: 42,
  color: '#ffffff',
  backgroundColor: '#000000',
  backgroundOpacity: 1,
  fontFamily: 'Inter, Arial, sans-serif',
  bold: false,
  italic: false,
  lineSpacing: 18,
  horizontalMargin: 96
};

export function parseCreditsText(input: string): CreditsRow[] {
  return input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseCreditsLine)
    .filter((row) => row.role || row.name);
}

export function formatCreditsRowsForTextfile(rows: CreditsRow[]): string {
  return rows
    .map((row) => {
      if (!row.role) {
        return row.name;
      }
      if (!row.name) {
        return row.role;
      }
      return `${row.role}    ${row.name}`;
    })
    .join('\n');
}

export function calculateCreditsContentHeight(rows: CreditsRow[], style: Pick<CreditsStyle, 'fontSize' | 'lineSpacing'>): number {
  const lineHeight = Math.max(1, style.fontSize + style.lineSpacing);
  return Math.max(lineHeight, rows.length * lineHeight);
}

export function buildCreditsRollYExpression(speed: number): string {
  return `h-t*${formatSpeed(speed)}`;
}

export function calculateCreditsRollYRange(input: { speed: number; duration: number; canvasHeight: number }): { startY: number; endY: number } {
  const speed = normalizeCreditsRollSpeed(input.speed);
  const duration = Number.isFinite(input.duration) ? Math.max(0, input.duration) : 0;
  const canvasHeight = Number.isFinite(input.canvasHeight) ? Math.max(0, input.canvasHeight) : 0;
  return {
    startY: round(canvasHeight),
    endY: round(canvasHeight - speed * duration)
  };
}

export function normalizeCreditsRows(rows: readonly Partial<CreditsRow>[] | undefined, fallbackText = ''): CreditsRow[] {
  const normalized = (rows ?? [])
    .map((row) => ({
      role: normalizeCreditsCell(row.role),
      name: normalizeCreditsCell(row.name)
    }))
    .filter((row) => row.role || row.name);
  return normalized.length > 0 ? normalized : parseCreditsText(fallbackText);
}

export function normalizeCreditsStyle(style: Partial<CreditsStyle> | undefined): CreditsStyle {
  return {
    ...DEFAULT_CREDITS_STYLE,
    ...style,
    fontSize: Math.round(clampNumber(style?.fontSize, DEFAULT_CREDITS_STYLE.fontSize, 8, 240)),
    backgroundOpacity: clampNumber(style?.backgroundOpacity, DEFAULT_CREDITS_STYLE.backgroundOpacity, 0, 1),
    lineSpacing: Math.round(clampNumber(style?.lineSpacing, DEFAULT_CREDITS_STYLE.lineSpacing, 0, 120)),
    horizontalMargin: Math.round(clampNumber(style?.horizontalMargin, DEFAULT_CREDITS_STYLE.horizontalMargin, 0, 960)),
    color: normalizeColor(style?.color, DEFAULT_CREDITS_STYLE.color),
    backgroundColor: normalizeColor(style?.backgroundColor, DEFAULT_CREDITS_STYLE.backgroundColor),
    fontFamily: typeof style?.fontFamily === 'string' && style.fontFamily.trim() ? style.fontFamily.trim() : DEFAULT_CREDITS_STYLE.fontFamily,
    bold: style?.bold === true,
    italic: style?.italic === true
  };
}

export function normalizeCreditsRollSpeed(speed: unknown): number {
  return Math.round(clampNumber(Number(speed), DEFAULT_CREDITS_ROLL_SPEED, 1, 1000));
}

function parseCreditsLine(line: string): CreditsRow {
  const separator = line.includes('|') ? '|' : line.includes(',') ? ',' : undefined;
  if (!separator) {
    return { role: '', name: normalizeCreditsCell(line) };
  }
  const [role, ...rest] = splitDelimitedLine(line, separator);
  return {
    role: normalizeCreditsCell(role),
    name: normalizeCreditsCell(rest.join(separator))
  };
}

function splitDelimitedLine(line: string, separator: string): string[] {
  const output: string[] = [];
  let current = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (char === separator && !quoted) {
      output.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  output.push(current);
  return output;
}

function normalizeCreditsCell(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeColor(value: unknown, fallback: string): string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value.trim()) ? value.trim() : fallback;
}

function clampNumber(value: number | undefined, fallback: number, min: number, max: number): number {
  const numeric = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return Math.min(max, Math.max(min, numeric));
}

function formatSpeed(speed: number): string {
  return String(normalizeCreditsRollSpeed(speed));
}
