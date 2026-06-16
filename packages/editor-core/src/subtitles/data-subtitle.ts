import type { DataSubtitleRow, DataSubtitleSource, DataSubtitleSourceType, SubtitleClip } from '../model';
import { round } from '../time';
import type { SubtitleCueInput } from './srt';

export interface DataSubtitleRenderContext {
  fps?: number;
  date?: Date;
}

type CsvRow = string[];

const SOURCE_TYPES: DataSubtitleSourceType[] = ['csv', 'json', 'template'];
const DEFAULT_TEMPLATE = '{row.text}';

export function parseDataSubtitleRows(contents: string, sourceType: Exclude<DataSubtitleSourceType, 'template'>): DataSubtitleRow[] {
  return sourceType === 'json' ? parseDataSubtitleJsonRows(contents) : parseDataSubtitleCsvRows(contents);
}

export function parseDataSubtitleCsvRows(contents: string): DataSubtitleRow[] {
  const rows = parseCsvRows(contents).filter((row) => row.some((cell) => cell.trim().length > 0));
  if (rows.length === 0) {
    return [];
  }
  const headers = rows[0].map((cell) => cell.trim());
  const timeIndex = headers.findIndex((header) => ['time', 'timestamp', 'start', 'start_time'].includes(header.toLowerCase()));
  if (timeIndex < 0) {
    throw new Error('Data subtitle CSV requires a time column');
  }
  return normalizeDataSubtitleRows(
    rows.slice(1).map((row) => {
      const values: Record<string, string> = {};
      headers.forEach((header, index) => {
        if (header && index !== timeIndex) {
          values[header] = row[index]?.trim() ?? '';
        }
      });
      return {
        time: parseDataSubtitleTime(row[timeIndex]),
        text: values.text || values.label || undefined,
        values
      };
    })
  ) ?? [];
}

export function parseDataSubtitleJsonRows(contents: string): DataSubtitleRow[] {
  const value = JSON.parse(contents) as unknown;
  if (!Array.isArray(value)) {
    throw new Error('Data subtitle JSON must be an array');
  }
  return normalizeDataSubtitleRows(
    value.map((entry, index) => {
      if (!entry || typeof entry !== 'object') {
        throw new Error(`Data subtitle JSON row ${index + 1} must be an object`);
      }
      const input = entry as Record<string, unknown>;
      const time = parseDataSubtitleTime(input.time ?? input.timestamp ?? input.start ?? input.start_time);
      const values: Record<string, string> = {};
      for (const [key, item] of Object.entries(input)) {
        if (key === 'time' || key === 'timestamp' || key === 'start' || key === 'start_time') {
          continue;
        }
        values[key] = item == null ? '' : String(item);
      }
      return {
        time,
        text: typeof input.text === 'string' && input.text.trim() ? input.text.trim() : undefined,
        values
      };
    })
  ) ?? [];
}

export function normalizeDataSubtitleSource(input: unknown): DataSubtitleSource | undefined {
  if (!input || typeof input !== 'object') {
    return undefined;
  }
  const value = input as Partial<DataSubtitleSource>;
  const sourceType = SOURCE_TYPES.includes(value.sourceType as DataSubtitleSourceType) ? (value.sourceType as DataSubtitleSourceType) : 'template';
  const rows = normalizeDataSubtitleRows(value.rows) ?? [];
  const template = typeof value.template === 'string' && value.template.trim() ? value.template.trim() : DEFAULT_TEMPLATE;
  if (sourceType !== 'template' && rows.length === 0) {
    return undefined;
  }
  const filePath = typeof value.filePath === 'string' && value.filePath.trim() ? value.filePath.trim() : undefined;
  return { sourceType, template, rows, filePath };
}

export function normalizeDataSubtitleRows(input: unknown): DataSubtitleRow[] | undefined {
  if (!Array.isArray(input)) {
    return undefined;
  }
  const rows = input
    .flatMap((row) => {
      if (!row || typeof row !== 'object') {
        return [];
      }
      const value = row as Partial<DataSubtitleRow>;
      const time = Number(value.time);
      if (!Number.isFinite(time) || time < 0) {
        return [];
      }
      const values: Record<string, string> = {};
      if (value.values && typeof value.values === 'object') {
        for (const [key, item] of Object.entries(value.values)) {
          values[key] = item == null ? '' : String(item);
        }
      }
      const text = typeof value.text === 'string' && value.text.trim() ? value.text.trim() : values.text || undefined;
      if (text) {
        values.text = text;
      }
      return [{ time: round(time), text, values }];
    })
    .sort((left, right) => left.time - right.time);
  return rows.length > 0 ? rows : undefined;
}

export function findDataSubtitleRowAtTime(rows: readonly DataSubtitleRow[], time: number): DataSubtitleRow | undefined {
  const normalized = normalizeDataSubtitleRows(rows) ?? [];
  if (normalized.length === 0 || !Number.isFinite(time)) {
    return undefined;
  }
  const safeTime = round(time);
  const first = normalized[0];
  const last = normalized[normalized.length - 1];
  if (safeTime < first.time || safeTime > last.time) {
    return undefined;
  }
  return normalized.reduce((best, row) => {
    const currentDistance = Math.abs(row.time - safeTime);
    const bestDistance = Math.abs(best.time - safeTime);
    return currentDistance < bestDistance ? row : best;
  }, first);
}

export function expandDataSubtitleTemplate(template: string, row: DataSubtitleRow | undefined, time: number, context: DataSubtitleRenderContext = {}): string {
  const source = template.trim() || DEFAULT_TEMPLATE;
  return source.replace(/\{([^}]+)\}/g, (_match, rawKey: string) => {
    const key = rawKey.trim();
    if (key.startsWith('row.')) {
      const field = key.slice(4);
      return row?.values[field] ?? (field === 'text' ? row?.text ?? '' : '');
    }
    if (key === 'frame_count') {
      return String(Math.max(0, Math.floor(round(time) * Math.max(1, context.fps ?? 30))));
    }
    if (key === 'timecode') {
      return formatDataSubtitleTimecode(time, context.fps ?? 30);
    }
    if (key === 'date') {
      return formatDate(context.date ?? new Date());
    }
    return '';
  }).trim();
}

export function resolveDataSubtitleText(source: DataSubtitleSource | undefined, time: number, context: DataSubtitleRenderContext = {}): string {
  const normalized = normalizeDataSubtitleSource(source);
  if (!normalized) {
    return '';
  }
  if (normalized.rows.length === 0) {
    return expandDataSubtitleTemplate(normalized.template, undefined, time, context);
  }
  const row = findDataSubtitleRowAtTime(normalized.rows, time);
  return row ? expandDataSubtitleTemplate(normalized.template, row, time, context) : '';
}

export function expandDataSubtitleClipToCueInputs(clip: SubtitleClip, context: DataSubtitleRenderContext = {}): SubtitleCueInput[] {
  const source = normalizeDataSubtitleSource(clip.dataSubtitle);
  if (!source) {
    return [{
      id: clip.id,
      start: clip.start,
      duration: clip.duration,
      text: clip.text,
      subtitleType: clip.subtitleType,
      speaker: clip.speaker,
      soundDesc: clip.soundDesc,
      style: { ...clip.style, x: clip.transform.x, y: clip.transform.y }
    }];
  }
  const clipEnd = round(clip.start + clip.duration);
  const cueStarts = [clip.start, ...source.rows.map((row) => row.time).filter((time) => time > clip.start && time < clipEnd)].sort((left, right) => left - right);
  return cueStarts.flatMap((start, index) => {
    const end = cueStarts[index + 1] ?? clipEnd;
    const text = resolveDataSubtitleText(source, start, context);
    if (!text || end <= start) {
      return [];
    }
    return [{
      id: `${clip.id}-data-${index + 1}`,
      start,
      duration: round(end - start),
      text,
      subtitleType: clip.subtitleType,
      speaker: clip.speaker,
      soundDesc: clip.soundDesc,
      style: { ...clip.style, x: clip.transform.x, y: clip.transform.y }
    }];
  });
}

function parseDataSubtitleTime(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return round(Math.max(0, value));
  }
  if (typeof value !== 'string') {
    throw new Error('Data subtitle time must be a string or number');
  }
  const input = value.trim();
  if (!input) {
    throw new Error('Data subtitle time is empty');
  }
  const seconds = Number(input.replace(',', '.'));
  if (Number.isFinite(seconds)) {
    return round(Math.max(0, seconds));
  }
  const match = input.match(/^(\d{1,2}):(\d{2}):(\d{2})([.,](\d{1,3}))?$/);
  if (!match) {
    throw new Error(`Invalid data subtitle time: ${input}`);
  }
  const minutes = Number(match[2]);
  const wholeSeconds = Number(match[3]);
  if (minutes > 59 || wholeSeconds > 59) {
    throw new Error(`Invalid data subtitle time: ${input}`);
  }
  const milliseconds = Number((match[5] ?? '0').padEnd(3, '0'));
  return round(Number(match[1]) * 3600 + minutes * 60 + wholeSeconds + milliseconds / 1000);
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

function formatDataSubtitleTimecode(time: number, fps: number): string {
  const safeFps = Math.max(1, Math.round(fps));
  const totalFrames = Math.max(0, Math.floor(round(time) * safeFps));
  const frames = totalFrames % safeFps;
  const totalSeconds = Math.floor(totalFrames / safeFps);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}:${pad(frames)}`;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function formatDate(date: Date): string {
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}
