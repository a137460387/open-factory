import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import {
  normalizeAudioChannelRouting,
  BatchUpdateKeyframeCommand,
  UpdateProjectAudioCommand,
  UpdateTrackCommand,
  buildDuckingKeyframePlan,
  detectDuckingRegions,
  normalizeTrackCompressor,
  normalizeTrackEQ,
  peakToDb,
  type AudioChannelRoutingMode,
  type BatchUpdateKeyframeItem,
  type DuckingRegion,
  type LoudnessSample,
  type MediaAsset,
  type Project,
  type Track,
  type TrackCompressor,
  type TrackEQ,
  type TrackEQBand,
  type TrackPatch,
} from '@open-factory/editor-core';
import {
  ArrowLeftRight,
  AudioLines,
  ChevronDown,
  ChevronRight,
  CircleDot,
  SlidersHorizontal,
  Volume2,
} from 'lucide-react';
import { formatTrackType, t, zhCN } from '../../i18n/strings';
import { analyzeWaveform, saveFileDialog, writeFile } from '../../lib/tauri-bridge';
import { commandManager, projectAccessor, timelineAccessor } from '../../store/commandManager';
import { getSilentMeterLevel, useAudioMeterStore, type AudioMeterLevel } from '../../store/audioMeterStore';
import { useEditorStore } from '../../store/editorStore';
import {
  buildChannelAnalysisSnapshot,
  serializeChannelAnalysisJson,
  type ChannelAnalysisFrame,
  type ChannelAnalysisSnapshot,
  type FrequencyPeak,
  type PhasePoint,
} from '../../media/channelAnalysis';

// ─── Lazy-loaded components (chunk splitting) ──────────────────
const LazyNoiseReductionDialog = lazy(() =>
  import('./NoiseReductionDialog').then((m) => ({ default: m.NoiseReductionDialog })),
);
const LazySpectrumAnalyzer = lazy(() => import('./SpectrumAnalyzer').then((m) => ({ default: m.SpectrumAnalyzer })));

const DUCKING_POINTS_PER_SECOND = 8;
const CHANNEL_ANALYSIS_HISTORY_LIMIT = 60;
const CHANNEL_ANALYSIS_RECORD_INTERVAL_MS = 500;

type MixerTab = 'mix' | 'channel-analysis' | 'spectrum';

interface DuckingSettings {
  leadTrackId: string;
  backgroundTrackId: string;
  thresholdDb: number;
  targetRatio: number;
  attack: number;
  release: number;
}

interface DuckingPreview {
  regions: DuckingRegion[];
  updates: BatchUpdateKeyframeItem[];
  keyframeCount: number;
}

type ChannelRoutingKind = 'stereo' | 'mono' | 'routed' | 'mixed' | 'none';

interface ChannelRoutingSummary {
  kind: ChannelRoutingKind;
  title: string;
  routedClipCount: number;
}

export function AudioMixer() {
  const project = useEditorStore((state) => state.project);
  const selectedClipIds = useEditorStore((state) => state.selectedClipIds);
  const trackLevels = useAudioMeterStore((state) => state.trackLevels);
  const masterLevel = useAudioMeterStore((state) => state.masterLevel);
  const trackFrequencyBands = useAudioMeterStore((state) => state.trackFrequencyBands);
  const trackAnalysisFrames = useAudioMeterStore((state) => state.trackAnalysisFrames);
  const tracks = useMemo(
    () => project.timeline.tracks.filter((track) => track.type === 'audio' || track.type === 'video'),
    [project.timeline.tracks],
  );
  const mediaById = useMemo(() => new Map(project.media.map((asset) => [asset.id, asset])), [project.media]);
  const selectedTrackId = useMemo(() => {
    const selected = new Set(selectedClipIds);
    return tracks.find((track) => track.clips.some((clip) => selected.has(clip.id)))?.id;
  }, [selectedClipIds, tracks]);
  const defaultDuckingSettings = useMemo(() => makeDefaultDuckingSettings(tracks), [tracks]);
  const [tab, setTab] = useState<MixerTab>('mix');
  const [analysisTrackId, setAnalysisTrackId] = useState(selectedTrackId ?? tracks[0]?.id ?? '');
  const [expandedTrackIds, setExpandedTrackIds] = useState<Record<string, boolean>>({});
  const [duckingOpen, setDuckingOpen] = useState(false);
  const [duckingSettings, setDuckingSettings] = useState<DuckingSettings>(defaultDuckingSettings);
  const [duckingPreview, setDuckingPreview] = useState<DuckingPreview | undefined>();
  const [duckingError, setDuckingError] = useState<string | undefined>();
  const [duckingAnalyzing, setDuckingAnalyzing] = useState(false);
  const [noiseReductionOpen, setNoiseReductionOpen] = useState(false);
  const [noiseReductionTrackId, setNoiseReductionTrackId] = useState<string | undefined>();

  useEffect(() => {
    setDuckingSettings((current) => normalizeDuckingSettings(current, tracks));
  }, [tracks]);

  useEffect(() => {
    const fallbackTrackId = selectedTrackId ?? tracks[0]?.id ?? '';
    setAnalysisTrackId(
      (current) => selectedTrackId ?? (tracks.some((track) => track.id === current) ? current : fallbackTrackId),
    );
  }, [selectedTrackId, tracks]);

  function updateTrack(trackId: string, patch: TrackPatch): void {
    commandManager.execute(new UpdateTrackCommand(timelineAccessor, trackId, patch));
  }

  function updateMasterVolume(masterVolume: number): void {
    commandManager.execute(new UpdateProjectAudioCommand(projectAccessor, { masterVolume }));
  }

  function toggleTrack(trackId: string): void {
    setExpandedTrackIds((current) => ({ ...current, [trackId]: !current[trackId] }));
  }

  async function analyzeDucking(): Promise<void> {
    const leadTrack = tracks.find((track) => track.id === duckingSettings.leadTrackId);
    const backgroundTrack = tracks.find((track) => track.id === duckingSettings.backgroundTrackId);
    if (!leadTrack || !backgroundTrack || leadTrack.id === backgroundTrack.id) {
      setDuckingError(t('mixer.duckingNoTracks'));
      setDuckingPreview(undefined);
      return;
    }
    setDuckingAnalyzing(true);
    setDuckingError(undefined);
    setDuckingPreview(undefined);
    try {
      const samples = await collectTrackLoudnessSamples(project, leadTrack);
      const regions = detectDuckingRegions(samples, duckingSettings.thresholdDb, {
        sampleDuration: 1 / DUCKING_POINTS_PER_SECOND,
        minRegionDuration: 0.05,
        mergeGap: 0.15,
      });
      if (regions.length === 0) {
        setDuckingError(t('mixer.duckingNoRegions'));
        return;
      }
      const plans = buildDuckingKeyframePlan(project.timeline, backgroundTrack.id, regions, {
        targetRatio: duckingSettings.targetRatio,
        attack: duckingSettings.attack,
        release: duckingSettings.release,
        idPrefix: 'duck',
      });
      const updates: BatchUpdateKeyframeItem[] = plans.map((plan) => ({
        clipId: plan.clipId,
        property: 'volume',
        keyframes: plan.keyframes,
      }));
      const keyframeCount = updates.reduce((total, update) => total + update.keyframes.length, 0);
      if (keyframeCount === 0) {
        setDuckingError(t('mixer.duckingNoKeyframes'));
        return;
      }
      setDuckingPreview({ regions, updates, keyframeCount });
    } catch (error) {
      setDuckingError(
        error instanceof Error
          ? `${t('mixer.duckingAnalysisFailed')} ${error.message}`
          : t('mixer.duckingAnalysisFailed'),
      );
    } finally {
      setDuckingAnalyzing(false);
    }
  }

  function applyDucking(): void {
    if (!duckingPreview) {
      return;
    }
    commandManager.execute(
      new BatchUpdateKeyframeCommand(timelineAccessor, duckingPreview.updates, t('mixer.duckingCommand')),
    );
    setDuckingOpen(false);
    setDuckingPreview(undefined);
    setDuckingError(undefined);
  }

  const activeAnalysisTrack = tracks.find((track) => track.id === analysisTrackId) ?? tracks[0];
  const activeAnalysisFrame = activeAnalysisTrack
    ? (trackAnalysisFrames[activeAnalysisTrack.id] ??
      buildFallbackChannelAnalysisFrame(activeAnalysisTrack.id, trackFrequencyBands[activeAnalysisTrack.id]))
    : undefined;

  return (
    <section className="flex min-h-0 flex-col bg-white" data-testid="audio-mixer">
      <div className="flex h-10 items-center gap-2 border-b border-line px-3">
        <Volume2 size={16} className="text-brand" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">{zhCN.mixer.title}</div>
        </div>
        <div className="flex rounded border border-line bg-panel p-0.5">
          <MixerTabButton active={tab === 'mix'} testId="audio-mixer-tab-mix" onClick={() => setTab('mix')}>
            {zhCN.mixer.mixTab}
          </MixerTabButton>
          <MixerTabButton
            active={tab === 'channel-analysis'}
            testId="audio-mixer-tab-channel-analysis"
            onClick={() => setTab('channel-analysis')}
          >
            {zhCN.mixer.channelAnalysisTab}
          </MixerTabButton>
          <MixerTabButton
            active={tab === 'spectrum'}
            testId="audio-mixer-tab-spectrum"
            onClick={() => setTab('spectrum')}
          >
            频谱
          </MixerTabButton>
        </div>
        {tab === 'mix' ? (
          <button
            className="h-7 rounded border border-line bg-white px-2 text-xs font-semibold text-slate-700 hover:bg-panel disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            disabled={tracks.length < 2}
            title={tracks.length < 2 ? t('mixer.duckingNoTracks') : t('mixer.duckingTitle')}
            data-testid="audio-ducking-button"
            onClick={() => {
              setDuckingOpen((current) => !current);
              setDuckingPreview(undefined);
              setDuckingError(undefined);
            }}
          >
            {t('mixer.duckingButton')}
          </button>
        ) : null}
        {tab === 'mix' ? (
          <button
            className="h-7 rounded border border-line bg-white px-2 text-xs font-semibold text-slate-700 hover:bg-panel"
            type="button"
            data-testid="audio-noise-reduction-button"
            onClick={() => {
              setNoiseReductionTrackId(selectedTrackId);
              setNoiseReductionOpen(true);
            }}
          >
            降噪
          </button>
        ) : null}
      </div>
      {tab === 'mix' && duckingOpen ? (
        <DuckingPanel
          tracks={tracks}
          settings={duckingSettings}
          preview={duckingPreview}
          error={duckingError}
          analyzing={duckingAnalyzing}
          onChange={(patch) => {
            setDuckingSettings((current) => normalizeDuckingSettings({ ...current, ...patch }, tracks));
            setDuckingPreview(undefined);
            setDuckingError(undefined);
          }}
          onAnalyze={() => void analyzeDucking()}
          onApply={applyDucking}
          onCancel={() => {
            setDuckingOpen(false);
            setDuckingPreview(undefined);
            setDuckingError(undefined);
          }}
        />
      ) : null}
      {tab === 'channel-analysis' ? (
        <ChannelAnalysisPanel
          tracks={tracks}
          selectedTrackId={activeAnalysisTrack?.id ?? ''}
          frame={activeAnalysisFrame}
          onTrackChange={setAnalysisTrackId}
        />
      ) : tab === 'spectrum' ? (
        <div className="flex min-h-0 flex-1 flex-col gap-2 p-3">
          <Suspense
            fallback={
              <div className="flex items-center justify-center py-8 text-xs text-slate-400">加载频谱分析器...</div>
            }
          >
            <LazySpectrumAnalyzer
              frequencyData={trackFrequencyBands[analysisTrackId] ?? []}
              sampleRate={48000}
              showControls
              height={220}
            />
          </Suspense>
        </div>
      ) : (
        <div className="mixer-scrollbar flex min-h-0 flex-1 gap-2 overflow-x-auto px-3 py-2">
          {tracks.map((track) => (
            <ChannelStrip
              key={track.id}
              track={track}
              level={trackLevels[track.id] ?? getSilentMeterLevel()}
              channelRoutingSummary={summarizeTrackChannelRouting(track, mediaById)}
              expanded={Boolean(expandedTrackIds[track.id])}
              onToggle={() => toggleTrack(track.id)}
              onUpdate={(patch) => updateTrack(track.id, patch)}
            />
          ))}
          <MasterStrip level={masterLevel} volume={project.masterVolume} onVolumeChange={updateMasterVolume} />
        </div>
      )}
      {/* 降噪对话框 (lazy loaded) */}
      {noiseReductionOpen ? (
        <Suspense fallback={null}>
          <LazyNoiseReductionDialog
            open={noiseReductionOpen}
            onClose={() => setNoiseReductionOpen(false)}
            trackId={noiseReductionTrackId}
          />
        </Suspense>
      ) : null}
    </section>
  );
}

function MixerTabButton({
  active,
  testId,
  children,
  onClick,
}: {
  active: boolean;
  testId: string;
  children: string;
  onClick(): void;
}) {
  return (
    <button
      className={`h-6 rounded px-2 text-xs font-semibold ${active ? 'bg-white text-ink shadow-sm' : 'text-slate-600 hover:bg-white/70'}`}
      type="button"
      data-testid={testId}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function ChannelAnalysisPanel({
  tracks,
  selectedTrackId,
  frame,
  onTrackChange,
}: {
  tracks: Track[];
  selectedTrackId: string;
  frame?: ChannelAnalysisFrame;
  onTrackChange(trackId: string): void;
}) {
  const currentSnapshot = useMemo(
    () => (selectedTrackId && frame ? buildChannelAnalysisSnapshot(selectedTrackId, frame) : undefined),
    [frame, selectedTrackId],
  );
  const snapshotRef = useRef<ChannelAnalysisSnapshot | undefined>(currentSnapshot);
  const [recording, setRecording] = useState(false);
  const [history, setHistory] = useState<ChannelAnalysisSnapshot[]>([]);
  const [playbackIndex, setPlaybackIndex] = useState(0);
  const [exportError, setExportError] = useState<string>();

  useEffect(() => {
    snapshotRef.current = currentSnapshot;
  }, [currentSnapshot]);

  useEffect(() => {
    if (!recording) {
      return undefined;
    }
    const startedAt = Date.now();
    setHistory([]);
    setPlaybackIndex(0);
    const capture = () => {
      const snapshot = snapshotRef.current;
      if (snapshot) {
        setHistory((current) => [...current, snapshot].slice(-CHANNEL_ANALYSIS_HISTORY_LIMIT));
      }
      if (Date.now() - startedAt >= 30_000) {
        setRecording(false);
      }
    };
    capture();
    const interval = window.setInterval(capture, CHANNEL_ANALYSIS_RECORD_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [recording]);

  const displayedSnapshot =
    history.length > 0 && !recording
      ? (history[Math.min(playbackIndex, history.length - 1)] ?? currentSnapshot)
      : currentSnapshot;
  const peaks = displayedSnapshot?.peaks ?? [];

  async function exportJson(): Promise<void> {
    const snapshots = history.length > 0 ? history : displayedSnapshot ? [displayedSnapshot] : [];
    if (snapshots.length === 0) {
      setExportError(zhCN.mixer.channelAnalysisNoData);
      return;
    }
    setExportError(undefined);
    const outputPath = await saveFileDialog('channel-analysis.json', [
      { name: zhCN.fileDialogs.json, extensions: ['json'] },
    ]);
    if (!outputPath) {
      return;
    }
    await writeFile(outputPath, serializeChannelAnalysisJson(snapshots));
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 bg-white p-3" data-testid="audio-channel-analysis-panel">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
          <span>{zhCN.mixer.channelAnalysisTrack}</span>
          <select
            className="h-8 min-w-[180px] rounded border border-line bg-white px-2"
            value={selectedTrackId}
            data-testid="audio-channel-analysis-track-select"
            onChange={(event) => onTrackChange(event.target.value)}
          >
            {tracks.map((track) => (
              <option key={track.id} value={track.id}>
                {track.name}
              </option>
            ))}
          </select>
        </label>
        <button
          className="h-8 rounded border border-line bg-white px-3 text-xs font-semibold hover:bg-panel"
          type="button"
          data-testid="audio-channel-analysis-record-button"
          onClick={() => setRecording((current) => !current)}
        >
          {recording ? zhCN.mixer.channelAnalysisStopRecording : zhCN.mixer.channelAnalysisRecord}
        </button>
        <button
          className="h-8 rounded border border-line bg-white px-3 text-xs font-semibold hover:bg-panel"
          type="button"
          data-testid="audio-channel-analysis-export-button"
          onClick={() => void exportJson()}
        >
          {zhCN.mixer.channelAnalysisExport}
        </button>
        <div
          className="rounded border border-line bg-panel px-2 py-1 text-xs font-semibold text-slate-700"
          data-testid="audio-channel-analysis-correlation"
        >
          {zhCN.mixer.channelAnalysisCorrelation}: {formatCorrelation(displayedSnapshot?.correlation)}
        </div>
        {exportError ? (
          <div className="text-xs font-semibold text-red-700" data-testid="audio-channel-analysis-error">
            {exportError}
          </div>
        ) : null}
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1.4fr)_minmax(260px,0.8fr)] gap-3">
        <div className="grid min-h-0 grid-rows-[minmax(0,1fr)_84px] gap-2">
          <FrequencyResponseChart snapshot={displayedSnapshot} />
          <div className="rounded-md border border-line bg-panel p-2">
            <div className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-700">
              <span>{zhCN.mixer.channelAnalysisHistory}</span>
              <span data-testid="audio-channel-analysis-history-count">{history.length}</span>
            </div>
            <input
              className="w-full accent-brand"
              type="range"
              min={0}
              max={Math.max(0, history.length - 1)}
              value={Math.min(playbackIndex, Math.max(0, history.length - 1))}
              disabled={history.length === 0 || recording}
              data-testid="audio-channel-analysis-history-slider"
              onChange={(event) => setPlaybackIndex(Number(event.target.value))}
            />
          </div>
        </div>
        <div className="grid min-h-0 grid-rows-[minmax(0,1fr)_auto] gap-2">
          <PhaseScope points={displayedSnapshot?.phase ?? []} />
          <div
            className="rounded-md border border-line bg-panel p-2 text-xs text-slate-700"
            data-testid="audio-channel-analysis-peaks"
          >
            <div className="mb-1 font-semibold">{zhCN.mixer.channelAnalysisPeaks}</div>
            {peaks.map((peak) => (
              <div
                key={`${peak.rank}-${peak.hz}`}
                className="flex items-center justify-between gap-2"
                data-testid={`audio-channel-analysis-peak-${peak.rank - 1}`}
              >
                <span>
                  {peak.rank}. {formatHz(peak.hz)}
                </span>
                <span className="tabular-nums">{Math.round(peak.magnitude * 100)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function FrequencyResponseChart({ snapshot }: { snapshot?: ChannelAnalysisSnapshot }) {
  const points = buildFrequencyPolyline(snapshot);
  return (
    <svg
      className="min-h-0 h-full w-full rounded-md border border-line bg-slate-950"
      viewBox="0 0 640 260"
      role="img"
      data-testid="audio-channel-analysis-curve"
    >
      {[0, 1, 2, 3].map((line) => (
        <line key={line} x1="32" y1={24 + line * 54} x2="616" y2={24 + line * 54} stroke="#1e293b" strokeWidth="1" />
      ))}
      {[20, 100, 1000, 10_000, 20_000].map((hz) => {
        const x = frequencyToX(hz);
        return (
          <g key={hz}>
            <line x1={x} y1="24" x2={x} y2="224" stroke="#1e293b" strokeWidth="1" />
            <text x={x} y="246" textAnchor="middle" fill="#94a3b8" fontSize="11">
              {formatHz(hz)}
            </text>
          </g>
        );
      })}
      <polyline fill="none" stroke="#38bdf8" strokeWidth="3" points={points} />
      <text x="32" y="18" fill="#e2e8f0" fontSize="12" fontWeight="600">
        {zhCN.mixer.channelAnalysisFrequencyResponse}
      </text>
    </svg>
  );
}

function PhaseScope({ points }: { points: PhasePoint[] }) {
  return (
    <svg
      className="min-h-0 h-full w-full rounded-md border border-line bg-slate-950"
      viewBox="0 0 260 260"
      role="img"
      data-testid="audio-channel-analysis-phase"
    >
      <line x1="130" y1="20" x2="130" y2="240" stroke="#1e293b" />
      <line x1="20" y1="130" x2="240" y2="130" stroke="#1e293b" />
      <circle cx="130" cy="130" r="92" fill="none" stroke="#1e293b" />
      {points.slice(0, 96).map((point, index) => (
        <circle
          key={`${index}-${point.left}-${point.right}`}
          cx={130 + point.left * 100}
          cy={130 - point.right * 100}
          r="2"
          fill="#34d399"
          opacity="0.75"
        />
      ))}
      <text x="16" y="20" fill="#e2e8f0" fontSize="12" fontWeight="600">
        {zhCN.mixer.channelAnalysisPhase}
      </text>
    </svg>
  );
}

function buildFrequencyPolyline(snapshot: ChannelAnalysisSnapshot | undefined): string {
  const frequency = snapshot?.frequency ?? [];
  if (frequency.length === 0) {
    return '';
  }
  const step = Math.max(1, Math.floor(frequency.length / 180));
  const points: string[] = [];
  for (let index = 0; index < frequency.length; index += step) {
    const point = frequency[index];
    if (!point) {
      continue;
    }
    const x = frequencyToX(point.hz);
    const y = 224 - Math.max(0, Math.min(1, point.magnitude)) * 194;
    points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return points.join(' ');
}

function frequencyToX(hz: number): number {
  const min = Math.log10(20);
  const max = Math.log10(20_000);
  const normalized = (Math.log10(Math.max(20, Math.min(20_000, hz))) - min) / (max - min);
  return 32 + normalized * 584;
}

function buildFallbackChannelAnalysisFrame(trackId: string, bands: number[] = []): ChannelAnalysisFrame {
  const seed = stableTrackSeed(trackId);
  const frequencyData = Array.from({ length: 2048 }, (_, index) => {
    const ratio = index / 2047;
    const band = bands[Math.min(bands.length - 1, Math.floor(ratio * Math.max(1, bands.length)))] ?? 0;
    const lowPeak = Math.exp(-((ratio - 0.08) ** 2) / 0.0008) * 0.72;
    const midPeak = Math.exp(-((ratio - 0.31) ** 2) / 0.0016) * 0.58;
    const highPeak = Math.exp(-((ratio - 0.62) ** 2) / 0.0024) * 0.44;
    const texture = ((Math.sin((index + seed) * 0.19) + 1) / 2) * 0.08;
    return Math.min(1, Math.max(band, 0.04) + lowPeak + midPeak + highPeak + texture);
  });
  const leftTimeDomain = Array.from({ length: 256 }, (_, index) => Math.sin((index / 256) * Math.PI * 8));
  const rightTimeDomain = Array.from({ length: 256 }, (_, index) => Math.sin((index / 256) * Math.PI * 8 + 0.35));
  return {
    sampleRate: 48_000,
    frequencyData,
    leftTimeDomain,
    rightTimeDomain,
    recordedAtMs: performance.now(),
  };
}

function formatCorrelation(value: number | undefined): string {
  return value === undefined ? '0.00' : value.toFixed(2);
}

function formatHz(hz: number): string {
  return hz >= 1000 ? `${(hz / 1000).toFixed(hz >= 10_000 ? 0 : 1)} kHz` : `${Math.round(hz)} Hz`;
}

function stableTrackSeed(trackId: string): number {
  let hash = 0;
  for (let index = 0; index < trackId.length; index += 1) {
    hash = (hash * 31 + trackId.charCodeAt(index)) % 997;
  }
  return hash;
}

function DuckingPanel({
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
            onChange={(event) => onChange({ leadTrackId: event.target.value })}
          >
            {tracks.map((track) => (
              <option key={track.id} value={track.id}>
                {track.name}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-0">
          <div className="mb-1 font-medium">{t('mixer.duckingBackgroundTrack')}</div>
          <select
            className="h-8 w-full rounded border border-line bg-white px-2"
            value={settings.backgroundTrackId}
            data-testid="audio-ducking-background-select"
            onChange={(event) => onChange({ backgroundTrackId: event.target.value })}
          >
            {tracks.map((track) => (
              <option key={track.id} value={track.id}>
                {track.name}
              </option>
            ))}
          </select>
        </label>
        <DuckingNumberField
          label={t('mixer.threshold')}
          value={settings.thresholdDb}
          min={-60}
          max={0}
          step={1}
          unit="dB"
          testId="audio-ducking-threshold"
          onChange={(thresholdDb) => onChange({ thresholdDb })}
        />
        <DuckingNumberField
          label={t('mixer.duckingTargetRatio')}
          value={Math.round(settings.targetRatio * 100)}
          min={0}
          max={100}
          step={1}
          unit="%"
          testId="audio-ducking-target"
          onChange={(targetPercent) => onChange({ targetRatio: targetPercent / 100 })}
        />
        <DuckingNumberField
          label={t('mixer.attack')}
          value={settings.attack}
          min={0.1}
          max={1}
          step={0.1}
          unit="s"
          testId="audio-ducking-attack"
          onChange={(attack) => onChange({ attack })}
        />
        <DuckingNumberField
          label={t('mixer.release')}
          value={settings.release}
          min={0.1}
          max={3}
          step={0.1}
          unit="s"
          testId="audio-ducking-release"
          onChange={(release) => onChange({ release })}
        />
        <div className="flex items-end gap-1">
          <button
            className="h-8 rounded border border-brand bg-brand px-3 font-semibold text-white disabled:cursor-wait disabled:opacity-60"
            type="button"
            disabled={analyzing}
            data-testid="audio-ducking-analyze-button"
            onClick={onAnalyze}
          >
            {analyzing ? t('mixer.duckingAnalyzing') : t('mixer.duckingAnalyze')}
          </button>
          <button
            className="h-8 rounded border border-line bg-white px-2 text-slate-600 hover:bg-white"
            type="button"
            data-testid="audio-ducking-cancel-button"
            onClick={onCancel}
          >
            {t('common.cancel')}
          </button>
        </div>
      </div>
      {preview ? (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-800">
          <span data-testid="audio-ducking-preview-summary">
            {t<(regions: number, keyframes: number) => string>('mixer.duckingPreviewSummary')(
              preview.regions.length,
              preview.keyframeCount,
            )}
          </span>
          <button
            className="h-7 rounded bg-emerald-700 px-2 font-semibold text-white"
            type="button"
            data-testid="audio-ducking-apply-button"
            onClick={onApply}
          >
            {t('mixer.duckingApply')}
          </button>
        </div>
      ) : null}
      {error ? (
        <div
          className="mt-2 rounded border border-red-200 bg-red-50 px-2 py-1 text-red-700"
          data-testid="audio-ducking-error"
        >
          {error}
        </div>
      ) : null}
    </div>
  );
}

function DuckingNumberField({
  label,
  value,
  min,
  max,
  step,
  unit,
  testId,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  testId: string;
  onChange(value: number): void;
}) {
  return (
    <label className="min-w-0">
      <div className="mb-1 flex items-center justify-between gap-1 font-medium">
        <span className="truncate">{label}</span>
        <span className="tabular-nums text-slate-500">
          {value}
          {unit}
        </span>
      </div>
      <input
        className="h-8 w-full rounded border border-line bg-white px-2 text-right tabular-nums"
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        data-testid={testId}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function makeDefaultDuckingSettings(tracks: Track[]): DuckingSettings {
  const leadTrackId = tracks[0]?.id ?? '';
  const backgroundTrackId = tracks.find((track) => track.id !== leadTrackId)?.id ?? leadTrackId;
  return {
    leadTrackId,
    backgroundTrackId,
    thresholdDb: -30,
    targetRatio: 0.35,
    attack: 0.25,
    release: 0.6,
  };
}

function normalizeDuckingSettings(settings: DuckingSettings, tracks: Track[]): DuckingSettings {
  const fallback = makeDefaultDuckingSettings(tracks);
  const trackIds = new Set(tracks.map((track) => track.id));
  const leadTrackId = trackIds.has(settings.leadTrackId) ? settings.leadTrackId : fallback.leadTrackId;
  let backgroundTrackId = trackIds.has(settings.backgroundTrackId)
    ? settings.backgroundTrackId
    : fallback.backgroundTrackId;
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

function summarizeTrackChannelRouting(track: Track, mediaById: Map<string, MediaAsset>): ChannelRoutingSummary {
  const clipsWithMedia = track.clips.filter((clip) => 'mediaId' in clip);
  const routedModes = clipsWithMedia
    .map((clip) => normalizeAudioChannelRouting(clip.audioChannelRouting))
    .filter((mode) => mode !== 'normal');
  if (routedModes.length > 0) {
    const uniqueModes = Array.from(new Set(routedModes));
    if (uniqueModes.length === 1) {
      const mode = uniqueModes[0] as AudioChannelRoutingMode;
      return {
        kind: 'routed',
        title: zhCN.mixer.channelRoutingRouted(zhCN.inspector.audioChannelRoutingOptions[mode], routedModes.length),
        routedClipCount: routedModes.length,
      };
    }
    return {
      kind: 'mixed',
      title: zhCN.mixer.channelRoutingMixed(routedModes.length),
      routedClipCount: routedModes.length,
    };
  }
  const sourceChannels = clipsWithMedia
    .map((clip) => mediaById.get(clip.mediaId)?.audioChannels)
    .filter(
      (channels): channels is number => typeof channels === 'number' && Number.isFinite(channels) && channels > 0,
    );
  if (sourceChannels.some((channels) => channels === 1)) {
    return { kind: 'mono', title: zhCN.mixer.channelRoutingMono, routedClipCount: 0 };
  }
  if (sourceChannels.some((channels) => channels >= 2)) {
    return { kind: 'stereo', title: zhCN.mixer.channelRoutingStereo, routedClipCount: 0 };
  }
  return { kind: 'none', title: zhCN.mixer.channelRoutingNone, routedClipCount: 0 };
}

async function collectTrackLoudnessSamples(project: Project, track: Track): Promise<LoudnessSample[]> {
  const samples: LoudnessSample[] = [];
  for (const clip of track.clips) {
    if (!('mediaId' in clip)) {
      continue;
    }
    const asset = project.media.find((item) => item.id === clip.mediaId);
    if (!asset || (asset.type !== 'audio' && !asset.hasAudio)) {
      continue;
    }
    const peaks = await analyzeWaveform(asset.path, DUCKING_POINTS_PER_SECOND);
    const duration = Math.max(0, clip.duration);
    const maxPoints = Math.min(peaks.length, Math.ceil(duration * DUCKING_POINTS_PER_SECOND));
    for (let index = 0; index < maxPoints; index += 1) {
      const localTime = index / DUCKING_POINTS_PER_SECOND;
      samples.push({
        time: clip.start + localTime,
        db: peakToDb(peaks[index]),
        duration: 1 / DUCKING_POINTS_PER_SECOND,
      });
    }
  }
  return samples;
}

function clampNumber(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, value));
}

function ChannelStrip({
  track,
  level,
  channelRoutingSummary,
  expanded,
  onToggle,
  onUpdate,
}: {
  track: Track;
  level: AudioMeterLevel;
  channelRoutingSummary: ChannelRoutingSummary;
  expanded: boolean;
  onToggle(): void;
  onUpdate(patch: TrackPatch): void;
}) {
  return (
    <div
      className={
        expanded
          ? 'grid h-full min-w-[340px] grid-rows-[32px_86px_30px_26px_minmax(0,1fr)] gap-1 overflow-hidden rounded-md border border-line bg-panel px-2 py-2'
          : 'grid h-full min-w-[92px] grid-rows-[32px_86px_30px_26px] gap-1 rounded-md border border-line bg-panel px-2 py-2'
      }
      data-testid={`mixer-channel-${track.id}`}
    >
      <div className="flex min-w-0 items-start gap-1">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[11px] font-semibold text-slate-700" title={track.name}>
            {track.name}
          </div>
          <div className="text-[10px] uppercase text-slate-500">{formatTrackType(track.type)}</div>
        </div>
        <ChannelRoutingBadge summary={channelRoutingSummary} trackId={track.id} />
        <button
          className="flex h-6 w-6 flex-none items-center justify-center rounded border border-line bg-white text-slate-600 hover:bg-slate-50"
          type="button"
          title={expanded ? zhCN.mixer.collapseChannel : zhCN.mixer.expandChannel}
          data-testid={`mixer-expand-${track.id}`}
          onClick={onToggle}
        >
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
      </div>
      <div className="grid min-h-0 grid-cols-[18px_1fr] items-center gap-2">
        <VuMeter level={level} />
        <VolumeFader
          value={track.volume ?? 1}
          testId={`mixer-volume-${track.id}`}
          onChange={(volume) => onUpdate({ volume })}
        />
      </div>
      <PanControl value={track.pan ?? 0} testId={`mixer-pan-${track.id}`} onChange={(pan) => onUpdate({ pan })} />
      <div className="flex items-center justify-center gap-1">
        <MixerToggle
          label="M"
          title={zhCN.mixer.muteTrack}
          active={Boolean(track.muted)}
          testId={`mixer-mute-${track.id}`}
          onClick={() => onUpdate({ muted: !track.muted })}
        />
        <MixerToggle
          label="S"
          title={zhCN.mixer.soloTrack}
          active={Boolean(track.solo)}
          testId={`mixer-solo-${track.id}`}
          onClick={() => onUpdate({ solo: !track.solo })}
        />
      </div>
      {expanded ? <ChannelProcessingPanel track={track} onUpdate={onUpdate} /> : null}
    </div>
  );
}

function ChannelRoutingBadge({ summary, trackId }: { summary: ChannelRoutingSummary; trackId: string }) {
  const Icon =
    summary.kind === 'routed' || summary.kind === 'mixed'
      ? ArrowLeftRight
      : summary.kind === 'mono'
        ? CircleDot
        : AudioLines;
  const active = summary.kind === 'routed' || summary.kind === 'mixed';
  return (
    <div
      className={`flex h-6 w-6 flex-none items-center justify-center rounded border ${active ? 'border-brand bg-brand text-white' : 'border-line bg-white text-slate-500'}`}
      title={summary.title}
      data-testid={`mixer-channel-routing-${trackId}`}
      data-routing-kind={summary.kind}
      data-routed-clip-count={summary.routedClipCount}
    >
      <Icon size={14} />
    </div>
  );
}

function ChannelProcessingPanel({ track, onUpdate }: { track: Track; onUpdate(patch: TrackPatch): void }) {
  const eq = normalizeTrackEQ(track.eq);
  const compressor = normalizeTrackCompressor(track.compressor);

  function updateEQ(patch: Partial<TrackEQ>): void {
    onUpdate({ eq: normalizeTrackEQ({ ...eq, ...patch }) });
  }

  function updateBand(index: number, patch: Partial<TrackEQBand>): void {
    updateEQ({
      bands: eq.bands.map((band, bandIndex) => (bandIndex === index ? { ...band, ...patch } : band)),
    });
  }

  function updateCompressor(patch: Partial<TrackCompressor>): void {
    onUpdate({ compressor: normalizeTrackCompressor({ ...compressor, ...patch }) });
  }

  return (
    <div className="min-h-0 overflow-y-auto border-t border-line pt-2 text-[11px] text-slate-700">
      <div className="flex items-center gap-2">
        <SlidersHorizontal size={14} className="text-brand" />
        <label className="flex items-center gap-1 font-semibold">
          <input
            type="checkbox"
            checked={eq.enabled}
            data-testid={`mixer-eq-enabled-${track.id}`}
            onChange={(event) => updateEQ({ enabled: event.target.checked })}
          />
          {zhCN.mixer.eq}
        </label>
      </div>
      <EQGraph eq={eq} trackId={track.id} />
      <div className="mt-2 space-y-1">
        {eq.bands.map((band, index) => (
          <EQBandControls
            key={band.id}
            trackId={track.id}
            band={band}
            index={index}
            disabled={!eq.enabled}
            onChange={(patch) => updateBand(index, patch)}
          />
        ))}
      </div>

      <div className="mt-3 flex items-center gap-2 border-t border-line pt-2">
        <label className="flex items-center gap-1 font-semibold">
          <input
            type="checkbox"
            checked={compressor.enabled}
            data-testid={`mixer-compressor-enabled-${track.id}`}
            onChange={(event) => updateCompressor({ enabled: event.target.checked })}
          />
          {zhCN.mixer.compressor}
        </label>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <MiniSlider
          label={zhCN.mixer.threshold}
          value={compressor.threshold}
          min={-60}
          max={0}
          step={1}
          unit="dB"
          disabled={!compressor.enabled}
          testId={`mixer-compressor-threshold-${track.id}`}
          onChange={(threshold) => updateCompressor({ threshold })}
        />
        <MiniSlider
          label={zhCN.mixer.ratio}
          value={compressor.ratio}
          min={1}
          max={20}
          step={0.1}
          unit=":1"
          disabled={!compressor.enabled}
          testId={`mixer-compressor-ratio-${track.id}`}
          onChange={(ratio) => updateCompressor({ ratio })}
        />
        <MiniSlider
          label={zhCN.mixer.attack}
          value={compressor.attack}
          min={0.01}
          max={200}
          step={1}
          unit="ms"
          disabled={!compressor.enabled}
          testId={`mixer-compressor-attack-${track.id}`}
          onChange={(attack) => updateCompressor({ attack })}
        />
        <MiniSlider
          label={zhCN.mixer.release}
          value={compressor.release}
          min={10}
          max={1000}
          step={10}
          unit="ms"
          disabled={!compressor.enabled}
          testId={`mixer-compressor-release-${track.id}`}
          onChange={(release) => updateCompressor({ release })}
        />
        <MiniSlider
          label={zhCN.mixer.makeupGain}
          value={compressor.makeupGain}
          min={0}
          max={24}
          step={0.5}
          unit="dB"
          disabled={!compressor.enabled}
          testId={`mixer-compressor-makeup-${track.id}`}
          onChange={(makeupGain) => updateCompressor({ makeupGain })}
        />
      </div>
    </div>
  );
}

function EQBandControls({
  trackId,
  band,
  index,
  disabled,
  onChange,
}: {
  trackId: string;
  band: TrackEQBand;
  index: number;
  disabled: boolean;
  onChange(patch: Partial<TrackEQBand>): void;
}) {
  const name =
    [zhCN.mixer.bandNames.low, zhCN.mixer.bandNames.lowMid, zhCN.mixer.bandNames.highMid, zhCN.mixer.bandNames.high][
      index
    ] ?? band.id;
  return (
    <div className="grid grid-cols-[38px_1fr_64px_50px] items-center gap-2">
      <div className="truncate font-medium" title={name}>
        {name}
      </div>
      <input
        className="min-w-0 accent-brand"
        type="range"
        min={-24}
        max={24}
        step={0.5}
        value={band.gain}
        disabled={disabled}
        title={zhCN.mixer.gain}
        data-testid={`mixer-eq-gain-${trackId}-${band.id}`}
        onChange={(event) => onChange({ gain: Number(event.target.value) })}
      />
      <input
        className="h-6 min-w-0 rounded border border-line bg-white px-1 text-right tabular-nums"
        type="number"
        min={20}
        max={20000}
        step={10}
        value={band.frequency}
        disabled={disabled}
        title={zhCN.mixer.frequency}
        data-testid={`mixer-eq-frequency-${trackId}-${band.id}`}
        onChange={(event) => onChange({ frequency: Number(event.target.value) })}
      />
      <input
        className="h-6 min-w-0 rounded border border-line bg-white px-1 text-right tabular-nums"
        type="number"
        min={0.1}
        max={4}
        step={0.1}
        value={band.q}
        disabled={disabled}
        title={zhCN.mixer.q}
        data-testid={`mixer-eq-q-${trackId}-${band.id}`}
        onChange={(event) => onChange({ q: Number(event.target.value) })}
      />
    </div>
  );
}

function EQGraph({ eq, trackId }: { eq: TrackEQ; trackId: string }) {
  const points = Array.from({ length: 48 }, (_, index) => {
    const t = index / 47;
    const frequency = 20 * 1000 ** t;
    const gain = eq.enabled
      ? eq.bands.reduce((sum, band) => {
          const octaveDistance = Math.log2(frequency / band.frequency);
          const width = Math.max(0.2, band.q);
          return sum + band.gain * Math.exp(-(octaveDistance * octaveDistance) / (2 * width * width));
        }, 0)
      : 0;
    const x = 4 + t * 152;
    const y = 32 - Math.max(-24, Math.min(24, gain)) * (24 / 24);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  return (
    <svg
      className="mt-2 h-16 w-full rounded border border-line bg-white"
      viewBox="0 0 160 64"
      role="img"
      data-testid={`mixer-eq-graph-${trackId}`}
    >
      <line x1="4" y1="32" x2="156" y2="32" stroke="#cbd5e1" strokeWidth="1" />
      <polyline fill="none" stroke="#2563eb" strokeWidth="2" points={points} />
    </svg>
  );
}

function MiniSlider({
  label,
  value,
  min,
  max,
  step,
  unit,
  disabled,
  testId,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  disabled: boolean;
  testId: string;
  onChange(value: number): void;
}) {
  return (
    <label className={`min-w-0 ${disabled ? 'text-slate-400' : ''}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="truncate">{label}</span>
        <span className="tabular-nums">{formatControlValue(value, unit)}</span>
      </div>
      <input
        className="w-full accent-brand"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        data-testid={testId}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function MasterStrip({
  level,
  volume,
  onVolumeChange,
}: {
  level: AudioMeterLevel;
  volume: number;
  onVolumeChange(value: number): void;
}) {
  return (
    <div
      className="grid h-full min-w-[92px] grid-rows-[32px_92px_24px] gap-1 rounded-md border border-slate-300 bg-white px-2 py-2"
      data-testid="mixer-master"
    >
      <div>
        <div className="text-[11px] font-semibold text-slate-800">{zhCN.mixer.master}</div>
        <div className="text-[10px] uppercase text-slate-500">{zhCN.mixer.output}</div>
      </div>
      <div className="grid min-h-0 grid-cols-[18px_1fr] items-center gap-2">
        <VuMeter level={level} />
        <VolumeFader value={volume} testId="mixer-master-volume" onChange={onVolumeChange} />
      </div>
      <div className="flex items-center justify-center text-[11px] tabular-nums text-slate-600">
        {Math.round(volume * 100)}%
      </div>
    </div>
  );
}

function VolumeFader({ value, testId, onChange }: { value: number; testId: string; onChange(value: number): void }) {
  return (
    <div className="relative h-[84px] min-w-0 overflow-visible">
      <input
        className="absolute left-1/2 top-1/2 h-5 w-[82px] -translate-x-1/2 -translate-y-1/2 -rotate-90 accent-brand"
        type="range"
        min={0}
        max={2}
        step={0.01}
        value={value}
        aria-orientation="vertical"
        title={zhCN.mixer.volume}
        data-testid={testId}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  );
}

function PanControl({ value, testId, onChange }: { value: number; testId: string; onChange(value: number): void }) {
  const angle = value * 135;
  return (
    <label className="flex min-w-0 items-center justify-center gap-2 text-[10px] text-slate-600" title={zhCN.mixer.pan}>
      <span className="relative h-7 w-7 flex-none">
        <span className="absolute inset-0 rounded-full border border-slate-300 bg-white shadow-inner" />
        <span
          className="absolute left-1/2 top-1/2 h-[11px] w-0.5 origin-bottom -translate-x-1/2 -translate-y-full rounded bg-brand"
          style={{ transform: `translate(-50%, -100%) rotate(${angle}deg)` }}
        />
        <span className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand" />
        <input
          className="absolute inset-0 cursor-ew-resize opacity-0"
          type="range"
          min={-1}
          max={1}
          step={0.01}
          value={value}
          aria-label={zhCN.mixer.pan}
          data-testid={testId}
          onChange={(event) => onChange(Number(event.target.value))}
        />
      </span>
      <span className="text-right tabular-nums">{value.toFixed(1)}</span>
    </label>
  );
}

function VuMeter({ level }: { level: AudioMeterLevel }) {
  const levelHeight = `${dbToPercent(level.levelDb)}%`;
  const peakBottom = `${dbToPercent(level.peakDb)}%`;
  return (
    <div
      className="relative h-full min-h-[70px] w-[18px] overflow-hidden rounded-sm border border-slate-300 bg-slate-950"
      title={`${level.levelDb.toFixed(1)} dB`}
    >
      <div className="absolute bottom-0 left-0 right-0 bg-emerald-400" style={{ height: levelHeight }} />
      <div className="absolute left-0 right-0 h-0.5 bg-amber-300" style={{ bottom: peakBottom }} />
    </div>
  );
}

function MixerToggle({
  label,
  title,
  active,
  testId,
  onClick,
}: {
  label: string;
  title: string;
  active: boolean;
  testId: string;
  onClick(): void;
}) {
  return (
    <button
      className={`h-6 w-6 rounded border text-[11px] font-semibold ${active ? 'border-brand bg-brand text-white' : 'border-line bg-white text-slate-600 hover:bg-panel'}`}
      type="button"
      title={title}
      data-testid={testId}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function formatControlValue(value: number, unit: string): string {
  if (unit === ':1') {
    return `${value.toFixed(1)}:1`;
  }
  if (unit === 'ms') {
    return `${Math.round(value)}ms`;
  }
  return `${value.toFixed(1)}${unit}`;
}

function dbToPercent(db: number): number {
  return Math.min(100, Math.max(0, ((db + 60) / 60) * 100));
}
