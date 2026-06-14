import type { SubtitleClip } from '../model';

export interface SrtCue {
  index: number;
  startMs: number;
  endMs: number;
  text: string;
}

export type SubtitleTextFormat = 'srt' | 'vtt' | 'ass' | 'ssa';

export interface SubtitleCueStyle {
  fontFamily?: string;
  fontSize?: number;
  color?: string;
  backgroundColor?: string;
  backgroundOpacity?: number;
  outlineColor?: string;
  outlineWidth?: number;
  shadowColor?: string;
  shadowOffset?: number;
  bold?: boolean;
  italic?: boolean;
  yOffset?: number;
  x?: number;
  y?: number;
}

export interface SubtitleCueInput {
  id: string;
  start: number;
  duration: number;
  text: string;
  style?: SubtitleCueStyle;
}

const TIMECODE_PATTERN = /^(\d{1,2}):(\d{2}):(\d{2})[,.](\d{3})$/;

export function parseSrt(contents: string): SrtCue[] {
  const normalized = contents.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!normalized) {
    return [];
  }
  return normalized
    .split(/\n{2,}/)
    .map((block, blockIndex) => parseSrtBlock(block, blockIndex))
    .filter((cue): cue is SrtCue => Boolean(cue));
}

export function parseSrtTimecodeMs(value: string): number {
  const match = TIMECODE_PATTERN.exec(value.trim());
  if (!match) {
    throw new Error(`Invalid SRT timecode: ${value}`);
  }
  const [, hours, minutes, seconds, milliseconds] = match;
  return (
    Number(hours) * 60 * 60 * 1000 +
    Number(minutes) * 60 * 1000 +
    Number(seconds) * 1000 +
    Number(milliseconds)
  );
}

export function serializeSrt(cues: Array<Pick<SrtCue, 'startMs' | 'endMs' | 'text'>>): string {
  return cues
    .map((cue, index) =>
      [
        String(index + 1),
        `${formatSrtTimecode(cue.startMs)} --> ${formatSrtTimecode(cue.endMs)}`,
        cue.text.trimEnd()
      ].join('\n')
    )
    .join('\n\n')
    .concat(cues.length > 0 ? '\n' : '');
}

export function serializeSubtitleClipsToSrt(clips: SubtitleClip[]): string {
  const cues = toSortedSubtitleCueInputs(clips.map(subtitleClipToCueInput)).map((clip) => ({
    startMs: secondsToMs(clip.start),
    endMs: secondsToMs(clip.start + clip.duration),
    text: clip.text
  }));
  return serializeSrt(cues);
}

export function serializeSubtitleCueInputsToSrt(clips: SubtitleCueInput[]): string {
  return serializeSrt(
    toSortedSubtitleCueInputs(clips).map((clip) => ({
      startMs: secondsToMs(clip.start),
      endMs: secondsToMs(clip.start + clip.duration),
      text: clip.text
    }))
  );
}

export function serializeSubtitleClipsToVtt(clips: SubtitleClip[]): string {
  return serializeSubtitleCueInputsToVtt(clips.map(subtitleClipToCueInput));
}

export function serializeSubtitleCueInputsToVtt(clips: SubtitleCueInput[]): string {
  const cues = toSortedSubtitleCueInputs(clips);
  if (cues.length === 0) {
    return 'WEBVTT\n';
  }
  return ['WEBVTT', '', cues
    .map((clip) =>
      [`${formatVttTimecode(secondsToMs(clip.start))} --> ${formatVttTimecode(secondsToMs(clip.start + clip.duration))} ${buildVttCueSettings(clip.style)}`, clip.text.trimEnd()].join('\n')
    )
    .join('\n\n')].join('\n').concat('\n');
}

export function serializeSubtitleClipsToAss(clips: SubtitleClip[], format: 'ass' | 'ssa' = 'ass'): string {
  return serializeSubtitleCueInputsToAss(clips.map(subtitleClipToCueInput), format);
}

export function serializeSubtitleCueInputsToAss(clips: SubtitleCueInput[], format: 'ass' | 'ssa' = 'ass'): string {
  const cues = toSortedSubtitleCueInputs(clips);
  const style = cues.find((clip) => clip.style)?.style;
  const styleName = 'OpenFactory';
  const header =
    format === 'ssa'
      ? [
          '[Script Info]',
          'ScriptType: v4.00',
          'Collisions: Normal',
          '',
          '[V4 Styles]',
          'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, TertiaryColour, BackColour, Bold, Italic, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, AlphaLevel, Encoding',
          `Style: ${buildSsaStyle(styleName, style)}`
        ]
      : [
          '[Script Info]',
          'ScriptType: v4.00+',
          'WrapStyle: 0',
          'ScaledBorderAndShadow: yes',
          '',
          '[V4+ Styles]',
          'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
          `Style: ${buildAssStyle(styleName, style)}`
        ];
  const events =
    format === 'ssa'
      ? ['[Events]', 'Format: Marked, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text', ...cues.map((cue) => buildSsaDialogue(cue, styleName))]
      : ['[Events]', 'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text', ...cues.map((cue) => buildAssDialogue(cue, styleName))];
  return [...header, '', ...events].join('\n').concat('\n');
}

export function formatSrtTimecode(milliseconds: number): string {
  const total = Math.max(0, Math.round(milliseconds));
  const ms = total % 1000;
  const totalSeconds = Math.floor(total / 1000);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);
  return `${pad(hours, 2)}:${pad(minutes, 2)}:${pad(seconds, 2)},${pad(ms, 3)}`;
}

function formatVttTimecode(milliseconds: number): string {
  return formatSrtTimecode(milliseconds).replace(',', '.');
}

function formatAssTimecode(seconds: number): string {
  const totalCentiseconds = Math.max(0, Math.round(seconds * 100));
  const centiseconds = totalCentiseconds % 100;
  const totalSeconds = Math.floor(totalCentiseconds / 100);
  const sec = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);
  return `${hours}:${pad(minutes, 2)}:${pad(sec, 2)}.${pad(centiseconds, 2)}`;
}

function parseSrtBlock(block: string, blockIndex: number): SrtCue | undefined {
  const lines = block.split('\n').map((line) => line.trimEnd());
  const timingIndex = lines.findIndex((line) => line.includes('-->'));
  if (timingIndex === -1) {
    return undefined;
  }
  const [startRaw, endRaw] = lines[timingIndex].split('-->').map((part) => part.trim());
  if (!startRaw || !endRaw) {
    return undefined;
  }
  const startMs = parseSrtTimecodeMs(startRaw);
  const endMs = parseSrtTimecodeMs(endRaw.split(/\s+/)[0]);
  if (endMs <= startMs) {
    return undefined;
  }
  const explicitIndex = timingIndex > 0 ? Number(lines[timingIndex - 1]) : NaN;
  return {
    index: Number.isFinite(explicitIndex) && explicitIndex > 0 ? explicitIndex : blockIndex + 1,
    startMs,
    endMs,
    text: lines.slice(timingIndex + 1).join('\n').trim()
  };
}

function secondsToMs(seconds: number): number {
  return Math.round(Math.max(0, seconds) * 1000);
}

function subtitleClipToCueInput(clip: SubtitleClip): SubtitleCueInput {
  return {
    id: clip.id,
    start: clip.start,
    duration: clip.duration,
    text: clip.text,
    style: {
      ...clip.style,
      x: clip.transform.x,
      y: clip.transform.y
    }
  };
}

function toSortedSubtitleCueInputs(clips: SubtitleCueInput[]): SubtitleCueInput[] {
  return clips
    .filter((clip) => clip.duration > 0 && clip.text.trim().length > 0)
    .sort((left, right) => left.start - right.start || left.id.localeCompare(right.id));
}

function buildVttCueSettings(style: SubtitleCueStyle | undefined): string {
  const position = clampPercent(50 + finiteNumber(style?.x, 0) * 50);
  const y = finiteNumber(style?.y, 0);
  const line = Math.abs(y) > 0.001 ? clampPercent(50 + y * 50) : clampPercent(100 - finiteNumber(style?.yOffset, 72) / 10);
  const align = position < 40 ? 'start' : position > 60 ? 'end' : 'center';
  return `line:${formatPercent(line)}% position:${formatPercent(position)}% align:${align}`;
}

function buildAssStyle(name: string, style: SubtitleCueStyle | undefined): string {
  return [
    name,
    normalizeAssFontName(style?.fontFamily),
    Math.max(1, Math.round(finiteNumber(style?.fontSize, 42))),
    cssColorToAss(style?.color ?? '#ffffff'),
    cssColorToAss(style?.color ?? '#ffffff'),
    cssColorToAss(style?.outlineColor ?? '#000000'),
    cssColorToAss(
      finiteNumber(style?.backgroundOpacity, 0) > 0 ? style?.backgroundColor ?? '#000000' : style?.shadowColor ?? style?.backgroundColor ?? '#000000',
      finiteNumber(style?.backgroundOpacity, 0)
    ),
    style?.bold ? '-1' : '0',
    style?.italic ? '-1' : '0',
    '0',
    '0',
    '100',
    '100',
    '0',
    '0',
    finiteNumber(style?.backgroundOpacity, 0) > 0 ? '3' : '1',
    Math.max(0, Math.round(finiteNumber(style?.outlineWidth, 0))),
    Math.max(0, Math.round(finiteNumber(style?.shadowOffset, 0))),
    '2',
    '24',
    '24',
    Math.max(0, Math.round(finiteNumber(style?.yOffset, 72))),
    '1'
  ].join(',');
}

function buildSsaStyle(name: string, style: SubtitleCueStyle | undefined): string {
  return [
    name,
    normalizeAssFontName(style?.fontFamily),
    Math.max(1, Math.round(finiteNumber(style?.fontSize, 42))),
    cssColorToAss(style?.color ?? '#ffffff'),
    cssColorToAss(style?.color ?? '#ffffff'),
    cssColorToAss(style?.outlineColor ?? style?.color ?? '#ffffff'),
    cssColorToAss(
      finiteNumber(style?.backgroundOpacity, 0) > 0 ? style?.backgroundColor ?? '#000000' : style?.shadowColor ?? style?.backgroundColor ?? '#000000',
      finiteNumber(style?.backgroundOpacity, 0)
    ),
    style?.bold ? '-1' : '0',
    style?.italic ? '-1' : '0',
    finiteNumber(style?.backgroundOpacity, 0) > 0 ? '3' : '1',
    Math.max(0, Math.round(finiteNumber(style?.outlineWidth, 0))),
    Math.max(0, Math.round(finiteNumber(style?.shadowOffset, 0))),
    '2',
    '24',
    '24',
    Math.max(0, Math.round(finiteNumber(style?.yOffset, 72))),
    '0',
    '1'
  ].join(',');
}

function buildAssDialogue(cue: SubtitleCueInput, styleName: string): string {
  return ['Dialogue: 0', formatAssTimecode(cue.start), formatAssTimecode(cue.start + cue.duration), styleName, '', '0000', '0000', '0000', '', escapeAssText(cue.text)].join(',');
}

function buildSsaDialogue(cue: SubtitleCueInput, styleName: string): string {
  return ['Dialogue: Marked=0', formatAssTimecode(cue.start), formatAssTimecode(cue.start + cue.duration), styleName, '', '0000', '0000', '0000', '', escapeAssText(cue.text)].join(',');
}

function cssColorToAss(value: string, opacity = 1): string {
  const match = /^#?([a-fA-F0-9]{6})$/.exec(value.trim());
  const hex = match ? match[1] : 'ffffff';
  const red = hex.slice(0, 2);
  const green = hex.slice(2, 4);
  const blue = hex.slice(4, 6);
  const alpha = Math.round((1 - Math.min(1, Math.max(0, opacity))) * 255)
    .toString(16)
    .padStart(2, '0');
  return `&H${alpha}${blue}${green}${red}`.toUpperCase();
}

function normalizeAssFontName(value: string | undefined): string {
  const [firstFamily] = (value || 'Arial').split(',');
  return firstFamily.replace(/["']/g, '').trim().replace(/,/g, ' ') || 'Arial';
}

function escapeAssText(value: string): string {
  return value
    .trimEnd()
    .replace(/[{}]/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n/g, '\\N');
}

function finiteNumber(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, value));
}

function formatPercent(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/g, '').replace(/\.$/, '');
}

function pad(value: number, width: number): string {
  return String(value).padStart(width, '0');
}
