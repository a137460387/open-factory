import type { SubtitleStyle } from '../model';
import { round } from '../time';

export type SubtitleDataImportFormat = 'csv' | 'json';
export type SubtitleDataImportMode = 'append' | 'new-track' | 'replace-current-track';

export interface SubtitleDataCue {
  start: number;
  end: number;
  text: string;
  style?: Partial<SubtitleStyle>;
}

export interface SubtitleDataOverlap {
  firstIndex: number;
  secondIndex: number;
  start: number;
  end: number;
}

type CsvRow = string[];

const STYLE_KEYS = ['fontSize', 'color', 'backgroundColor', 'backgroundOpacity', 'fontFamily', 'bold', 'italic', 'yOffset'] as const;

export function parseSubtitleDataImport(contents: string, format: SubtitleDataImportFormat): SubtitleDataCue[] {
  return format === 'json' ? parseSubtitleDataJson(contents) : parseSubtitleDataCsv(contents);
}

export function parseSubtitleDataCsv(contents: string): SubtitleDataCue[] {
  const rows = parseCsvRows(contents).filter((row) => row.some((cell) => cell.trim().length > 0));
  if (rows.length === 0) {
    return [];
  }
  const first = rows[0].map((cell) => cell.trim().toLowerCase());
  const hasHeader = first[0] === 'start_time' && first[1] === 'end_time' && first[2] === 'text';
  const dataRows = hasHeader ? rows.slice(1) : rows;
  return dataRows.map((row, index) => csvRowToCue(row, hasHeader ? index + 2 : index + 1));
}

export function parseSubtitleDataJson(contents: string): SubtitleDataCue[] {
  const value = JSON.parse(contents) as unknown;
  if (!Array.isArray(value)) {
    throw new Error('Subtitle JSON must be an array');
  }
  return value.map((entry, index) => jsonEntryToCue(entry, index + 1));
}

export function parseSubtitleDataTimecode(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return round(Math.max(0, value));
  }
  if (typeof value !== 'string') {
    throw new Error('Subtitle timecode must be a string or number');
  }
  const input = value.trim();
  if (!input) {
    throw new Error('Subtitle timecode is empty');
  }
  const seconds = Number(input.replace(',', '.'));
  if (Number.isFinite(seconds)) {
    return round(Math.max(0, seconds));
  }
  const match = input.match(/^(\d{1,2}):(\d{2}):(\d{2})([.,](\d{1,3}))?$/);
  if (!match) {
    throw new Error(`Invalid subtitle timecode: ${input}`);
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const wholeSeconds = Number(match[3]);
  if (minutes > 59 || wholeSeconds > 59) {
    throw new Error(`Invalid subtitle timecode: ${input}`);
  }
  const milliseconds = Number((match[5] ?? '0').padEnd(3, '0'));
  return round(hours * 3600 + minutes * 60 + wholeSeconds + milliseconds / 1000);
}

export function detectSubtitleDataOverlaps(cues: SubtitleDataCue[]): SubtitleDataOverlap[] {
  const sorted = cues
    .map((cue, index) => ({ cue, index }))
    .sort((left, right) => left.cue.start - right.cue.start || left.cue.end - right.cue.end);
  const overlaps: SubtitleDataOverlap[] = [];
  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1];
    const current = sorted[index];
    if (current.cue.start < previous.cue.end) {
      overlaps.push({
        firstIndex: previous.index,
        secondIndex: current.index,
        start: round(current.cue.start),
        end: round(Math.min(previous.cue.end, current.cue.end))
      });
    }
  }
  return overlaps;
}

export function mergeOverlappingSubtitleDataCues(cues: SubtitleDataCue[]): SubtitleDataCue[] {
  const sorted = [...cues].sort((left, right) => left.start - right.start || left.end - right.end);
  const merged: SubtitleDataCue[] = [];
  for (const cue of sorted) {
    const previous = merged.at(-1);
    if (!previous || cue.start >= previous.end) {
      merged.push({ ...cue, style: cue.style ? { ...cue.style } : undefined });
      continue;
    }
    previous.end = round(Math.max(previous.end, cue.end));
    previous.text = [previous.text, cue.text].filter(Boolean).join('\n');
    previous.style = { ...previous.style, ...cue.style };
  }
  return merged;
}

function csvRowToCue(row: CsvRow, rowNumber: number): SubtitleDataCue {
  if (row.length < 3) {
    throw new Error(`CSV row ${rowNumber} must contain start_time,end_time,text`);
  }
  return normalizeCue({
    start: row[0],
    end: row[1],
    text: row.slice(2).join(',')
  }, `CSV row ${rowNumber}`);
}

function jsonEntryToCue(entry: unknown, rowNumber: number): SubtitleDataCue {
  if (!entry || typeof entry !== 'object') {
    throw new Error(`JSON subtitle ${rowNumber} must be an object`);
  }
  const input = entry as Record<string, unknown>;
  return normalizeCue(
    {
      start: input.start ?? input.start_time,
      end: input.end ?? input.end_time,
      text: input.text,
      style: normalizeSubtitleStylePatch(input.style)
    },
    `JSON subtitle ${rowNumber}`
  );
}

function normalizeCue(input: { start: unknown; end: unknown; text: unknown; style?: Partial<SubtitleStyle> }, label: string): SubtitleDataCue {
  const start = parseSubtitleDataTimecode(input.start);
  const end = parseSubtitleDataTimecode(input.end);
  if (end <= start) {
    throw new Error(`${label} end time must be after start time`);
  }
  if (typeof input.text !== 'string' || input.text.trim().length === 0) {
    throw new Error(`${label} text is required`);
  }
  return {
    start,
    end,
    text: input.text.trim(),
    style: input.style
  };
}

function normalizeSubtitleStylePatch(value: unknown): Partial<SubtitleStyle> | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  const input = value as Partial<SubtitleStyle>;
  const style: Partial<SubtitleStyle> = {};
  for (const key of STYLE_KEYS) {
    const item = input[key];
    if (typeof item === 'number' && Number.isFinite(item)) {
      (style[key] as number) = item;
    } else if (typeof item === 'string') {
      (style[key] as string) = item;
    } else if (typeof item === 'boolean') {
      (style[key] as boolean) = item;
    }
  }
  return Object.keys(style).length > 0 ? style : undefined;
}

function parseCsvRows(contents: string): CsvRow[] {
  const rows: CsvRow[] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < contents.length; index += 1) {
    const char = contents[index];
    if (quoted) {
      if (char === '"' && contents[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(cell);
      cell = '';
    } else if (char === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (char !== '\r') {
      cell += char;
    }
  }
  if (quoted) {
    throw new Error('CSV has an unterminated quoted field');
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}
