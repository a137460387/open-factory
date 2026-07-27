import {
  peakToDb,
  type BatchUpdateKeyframeItem,
  type DuckingRegion,
  type LoudnessSample,
  type Project,
  type Track,
} from '@open-factory/editor-core';
import {t} from '../../i18n/strings';
import {analyzeWaveform} from '../../lib/tauri-bridge';

const DUCKING_POINTS_PER_SECOND = 8;

export interface DuckingSettings {
  leadTrackId: string;
  backgroundTrackId: string;
  thresholdDb: number;
  targetRatio: number;
  attack: number;
  release: number;
}

export interface DuckingPreview {
  regions: DuckingRegion[];
  updates: BatchUpdateKeyframeItem[];
  keyframeCount: number;
}

export function DuckingPanel({
  tracks,
  settings,
  preview,
  error,
  analyzing,
  onChange,
  onAnalyze,
  onApply,
  onCancel,
}: {
  tracks: Track[];
  settings: DuckingSettings;
  preview?: DuckingPreview;
  error?: string;
  analyzing: boolean;
  onChange(patch: Partial<DuckingSettings>): void;
  onAnalyze(): void;
  onApply(): void;
  onCancel(): void;
}) {
  return (
    <div className="border-b border-line bg-panel px-3 py-2 text-xs text-slate-700" data-testid="audio-ducking-panel">
      <div className="grid gap-2 lg:grid-cols-[1.1fr_1.1fr_1fr_1fr_1fr_1fr_auto]">
        <label className="min-w-0">
          <div className="mb-1 font-medium">{t('mixer.duckingLeadTrack')}</div>
          <select
            className="h-8 w-full rounded border border-line bg-white px-2"
            value={settings.leadTrackId}
            data-testid="audio-ducking-lead-select"
            onChange={(event) => onChange({leadTrackId: event.target.value})}
          >
            {tracks.map((track) => (
              <option key={track.id} value={track.id}>{track.name}</option>
            ))}
          </select>
        </label>
        <label className="min-w-0">
          <div className="mb-1 font-medium">{t('mixer.duckingBackgroundTrack')}</div>
          <select
            className="h-8 w-full rounded border border-line bg-white px-2"
            value={settings.backgroundTrackId}
            data-testid="audio-ducking-background-select"
            onChange={(event) => onChange({backgroundTrackId: event.target.value})}
          >
            {tracks.map((track) => (
              <option key={track.id} value={track.id}>{track.name}</option>
            ))}
          </select>
        </label>
        <DuckingNumberField label={t('mixer.threshold')} value={settings.thresholdDb} min={-60} max={0} step={1} unit="dB" testId="audio-ducking-threshold" onChange={(thresholdDb) => onChange({thresholdDb})} />
        <DuckingNumberField label={t('mixer.duckingTargetRatio')} value={Math.round(settings.targetRatio * 100)} min={0} max={100} step={1} unit="%" testId="audio-ducking-target" onChange={(targetPercent) => onChange({targetRatio: targetPercent / 100})} />
        <DuckingNumberField label={t('mixer.attack')} value={settings.attack} min={0.1} max={1} step={0.1} unit="s" testId="audio-ducking-attack" onChange={(attack) => onChange({attack})} />
        <DuckingNumberField label={t('mixer.release')} value={settings.release} min={0.1} max={3} step={0.1} unit="s" testId="audio-ducking-release" onChange={(release) => onChange({release})} />
        <div className="flex items-end gap-1">
          <button className="h-8 rounded border border-brand bg-brand px-3 font-semibold text-white disabled:cursor-wait disabled:opacity-60" type="button" disabled={analyzing} data-testid="audio-ducking-analyze-button" onClick={onAnalyze}>
            {analyzing ? t('mixer.duckingAnalyzing') : t('mixer.duckingAnalyze')}
          </button>
          <button className="h-8 rounded border border-line bg-white px-2 text-slate-600 hover:bg-white" type="button" data-testid="audio-ducking-cancel-button" onClick={onCancel}>
            {t('common.cancel')}
          </button>
        </div>
      </div>
      {preview ? (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-800">
          <span data-testid="audio-ducking-preview-summary">
            {t<(regions: number, keyframes: number) => string>('mixer.duckingPreviewSummary')(preview.regions.length, preview.keyframeCount)}
          </span>
          <button className="h-7 rounded bg-emerald-700 px-2 font-semibold text-white" type="button" data-testid="audio-ducking-apply-button" onClick={onApply}>
            {t('mixer.duckingApply')}
          </button>
        </div>
      ) : null}
      {error ? (
        <div className="mt-2 rounded border border-red-200 bg-red-50 px-2 py-1 text-red-700" data-testid="audio-ducking-error">{error}</div>
      ) : null}
    </div>
  );
}

function DuckingNumberField({label, value, min, max, step, unit, testId, onChange}: {
  label: string; value: number; min: number; max: number; step: number; unit: string; testId: string; onChange(value: number): void;
}) {
  return (
    <label className="min-w-0">
      <div className="mb-1 flex items-center justify-between gap-1 font-medium">
        <span className="truncate">{label}</span>
        <span className="tabular-nums text-slate-500">{value}{unit}</span>
      </div>
      <input className="h-8 w-full rounded border border-line bg-white px-2 text-right tabular-nums" type="number" min={min} max={max} step={step} value={value} data-testid={testId} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

export function makeDefaultDuckingSettings(tracks: Track[]): DuckingSettings {
  const leadTrackId = tracks[0]?.id ?? '';
  const backgroundTrackId = tracks.find((track) => track.id !== leadTrackId)?.id ?? leadTrackId;
  return {leadTrackId, backgroundTrackId, thresholdDb: -30, targetRatio: 0.35, attack: 0.25, release: 0.6};
}

export function normalizeDuckingSettings(settings: DuckingSettings, tracks: Track[]): DuckingSettings {
  const fallback = makeDefaultDuckingSettings(tracks);
  const trackIds = new Set(tracks.map((track) => track.id));
  const leadTrackId = trackIds.has(settings.leadTrackId) ? settings.leadTrackId : fallback.leadTrackId;
  let backgroundTrackId = trackIds.has(settings.backgroundTrackId) ? settings.backgroundTrackId : fallback.backgroundTrackId;
  if (leadTrackId && backgroundTrackId === leadTrackId) {
    backgroundTrackId = tracks.find((track) => track.id !== leadTrackId)?.id ?? backgroundTrackId;
  }
  return {
    leadTrackId,
    backgroundTrackId,
    thresholdDb: clampNumber(settings.thresholdDb, -60, 0, fallback.thresholdDb),
    targetRatio: clampNumber(settings.targetRatio, 0, 1, fallback.targetRatio),
    attack: clampNumber(settings.attack, 0.1, 1, fallback.attack),
    release: clampNumber(settings.release, 0.1, 3, fallback.release),
  };
}

export async function collectTrackLoudnessSamples(project: Project, track: Track): Promise<LoudnessSample[]> {
  const samples: LoudnessSample[] = [];
  for (const clip of track.clips) {
    if (!('mediaId' in clip)) continue;
    const asset = project.media.find((item) => item.id === clip.mediaId);
    if (!asset || (asset.type !== 'audio' && !asset.hasAudio)) continue;
    const peaks = await analyzeWaveform(asset.path, DUCKING_POINTS_PER_SECOND);
    const duration = Math.max(0, clip.duration);
    const maxPoints = Math.min(peaks.length, Math.ceil(duration * DUCKING_POINTS_PER_SECOND));
    for (let index = 0; index < maxPoints; index += 1) {
      const localTime = index / DUCKING_POINTS_PER_SECOND;
      samples.push({time: clip.start + localTime, db: peakToDb(peaks[index]), duration: 1 / DUCKING_POINTS_PER_SECOND});
    }
  }
  return samples;
}

function clampNumber(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}
