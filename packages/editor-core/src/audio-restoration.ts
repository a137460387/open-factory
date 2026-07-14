import type { ClipAudioRestoration, ClipAudioRestorationGap } from './model-types';
import { clamp, round } from './time';

export const AUDIO_FILL_GAP_THRESHOLD_SECONDS = 0.1;

export const DEFAULT_AUDIO_RESTORATION: ClipAudioRestoration = {
  declip: { enabled: false },
  dereverb: { enabled: false, strength: 1 },
  dewind: { enabled: false },
  fill: { enabled: false },
};

type PartialAudioRestoration = Partial<{
  [Key in keyof ClipAudioRestoration]: Partial<ClipAudioRestoration[Key]>;
}>;

export interface AudioRestorationFilterOptions {
  duration?: number;
}

export interface AudioRestorationWaveformComparison {
  before: number[];
  after: number[];
  changed: boolean;
}

export function normalizeAudioRestoration(restoration: PartialAudioRestoration | undefined): ClipAudioRestoration {
  return {
    declip: { enabled: restoration?.declip?.enabled === true },
    dereverb: {
      enabled: restoration?.dereverb?.enabled === true,
      strength: round(
        clamp(finiteOrDefault(restoration?.dereverb?.strength, DEFAULT_AUDIO_RESTORATION.dereverb.strength), 0, 1),
      ),
    },
    dewind: { enabled: restoration?.dewind?.enabled === true },
    fill: { enabled: restoration?.fill?.enabled === true },
  };
}

export function isAudioRestorationEnabled(restoration: PartialAudioRestoration | undefined): boolean {
  const normalized = normalizeAudioRestoration(restoration);
  return (
    normalized.declip.enabled ||
    (normalized.dereverb.enabled && normalized.dereverb.strength > 0) ||
    normalized.dewind.enabled ||
    normalized.fill.enabled
  );
}

export function buildAudioRestorationFilterArgs(
  restoration: PartialAudioRestoration | undefined,
  options: AudioRestorationFilterOptions = {},
): string[] {
  const normalized = normalizeAudioRestoration(restoration);
  const filters: string[] = [];

  if (normalized.declip.enabled) {
    filters.push('adeclip=w=55:o=10:arptresh=0.05');
  }
  if (normalized.dereverb.enabled && normalized.dereverb.strength > 0) {
    filters.push(`aecho=0.8:0.9:60:${formatAudioFilterNumber(0.4 * normalized.dereverb.strength)}`);
  }
  if (normalized.dewind.enabled) {
    filters.push('highpass=f=80:poles=2', 'lowpass=f=8000');
  }
  if (normalized.fill.enabled) {
    filters.push('apad');
    if (Number.isFinite(options.duration) && (options.duration ?? 0) > 0) {
      filters.push(`atrim=duration=${formatAudioFilterNumber(options.duration ?? 0)}`);
    }
  }

  return filters;
}

export function buildAudioRestorationFilterChain(
  restoration: PartialAudioRestoration | undefined,
  options: AudioRestorationFilterOptions = {},
): string {
  return buildAudioRestorationFilterArgs(restoration, options).join(',');
}

export function detectAudioFillGaps(
  gaps: ClipAudioRestorationGap[] | undefined,
  threshold = AUDIO_FILL_GAP_THRESHOLD_SECONDS,
): ClipAudioRestorationGap[] {
  if (!Array.isArray(gaps)) {
    return [];
  }
  return gaps
    .map((gap) => ({
      start: round(Math.max(0, finiteOrDefault(gap.start, 0))),
      duration: round(Math.max(0, finiteOrDefault(gap.duration, 0))),
    }))
    .filter((gap) => gap.duration > 0 && gap.duration < threshold)
    .sort((left, right) => left.start - right.start || left.duration - right.duration);
}

export function buildAudioRestorationWaveformComparison(
  peaks: number[] | undefined,
  restoration: PartialAudioRestoration | undefined,
): AudioRestorationWaveformComparison {
  const before = Array.isArray(peaks) ? peaks.map((value) => clamp(finiteOrDefault(value, 0), 0, 1)) : [];
  if (!isAudioRestorationEnabled(restoration)) {
    return { before, after: [...before], changed: false };
  }

  const normalized = normalizeAudioRestoration(restoration);
  const smoothing = normalized.dereverb.enabled ? 0.35 * normalized.dereverb.strength : 0;
  const windReduction = normalized.dewind.enabled ? 0.9 : 1;
  const declipCeiling = normalized.declip.enabled ? 0.92 : 1;
  const after = before.map((value, index) => {
    const left = before[Math.max(0, index - 1)] ?? value;
    const right = before[Math.min(before.length - 1, index + 1)] ?? value;
    const smoothed = smoothing > 0 ? value * (1 - smoothing) + ((left + right) / 2) * smoothing : value;
    return round(clamp(smoothed * windReduction, 0, declipCeiling));
  });

  return { before, after, changed: true };
}

function finiteOrDefault(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function formatAudioFilterNumber(value: number): string {
  const rounded = round(value);
  if (Number.isInteger(rounded)) {
    return String(rounded);
  }
  return String(rounded).replace(/0+$/, '').replace(/\.$/, '');
}
