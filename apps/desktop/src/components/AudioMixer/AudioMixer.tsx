import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import {
  BatchUpdateKeyframeCommand,
  UpdateProjectAudioCommand,
  UpdateTrackCommand,
  buildDuckingKeyframePlan,
  detectDuckingRegions,
  type Track,
  type TrackPatch,
} from '@open-factory/editor-core';
import { Volume2 } from 'lucide-react';
import { t, zhCN } from '../../i18n/strings';
import { saveFileDialog, writeFile } from '../../lib/tauri-bridge';
import { commandManager, projectAccessor, timelineAccessor } from '../../store/commandManager';
import { getSilentMeterLevel, useAudioMeterStore } from '../../store/audioMeterStore';
import { useEditorStore } from '../../store/editorStore';
import {
  buildChannelAnalysisSnapshot,
  serializeChannelAnalysisJson,
  type ChannelAnalysisFrame,
  type ChannelAnalysisSnapshot,
  type PhasePoint,
} from '../../media/channelAnalysis';
import {
  DuckingPanel,
  makeDefaultDuckingSettings,
  normalizeDuckingSettings,
  collectTrackLoudnessSamples,
  type DuckingSettings,
  type DuckingPreview,
} from './DuckingPanel';
import { ChannelStrip, MasterStrip, summarizeTrackChannelRouting } from './MixerStrips';

// ─── Lazy-loaded components (chunk splitting) ──────────────────
const LazyNoiseReductionDialog = lazy(() =>
  import('./NoiseReductionDialog').then((m) => ({ default: m.NoiseReductionDialog })),
);
const LazySpectrumAnalyzer = lazy(() => import('./SpectrumAnalyzer').then((m) => ({ default: m.SpectrumAnalyzer })));

const CHANNEL_ANALYSIS_HISTORY_LIMIT = 60;
const CHANNEL_ANALYSIS_RECORD_INTERVAL_MS = 500;

type MixerTab = 'mix' | 'channel-analysis' | 'spectrum';

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
        sampleDuration: 1 / 8,
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
      const updates = plans.map((plan) => ({
        clipId: plan.clipId,
        property: 'volume' as const,
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
    if (!duckingPreview) return;
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
    if (!recording) return undefined;
    const startedAt = Date.now();
    setHistory([]);
    setPlaybackIndex(0);
    const capture = () => {
      const snapshot = snapshotRef.current;
      if (snapshot) setHistory((current) => [...current, snapshot].slice(-CHANNEL_ANALYSIS_HISTORY_LIMIT));
      if (Date.now() - startedAt >= 30_000) setRecording(false);
    };
    capture();
    const interval = window.setInterval(capture, CHANNEL_ANALYSIS_RECORD_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [recording]);

  const displayedSnapshot = history.length > 0 ? history[Math.min(playbackIndex, history.length - 1)] : currentSnapshot;

  async function handleExport(): Promise<void> {
    if (!displayedSnapshot) return;
    try {
      const json = serializeChannelAnalysisJson([displayedSnapshot]);
      const path = await saveFileDialog(`channel-analysis-${selectedTrackId}.json`, [
        { name: 'JSON', extensions: ['json'] },
      ]);
      if (path) await writeFile(path, json);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Export failed');
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 p-3">
      <div className="flex items-center gap-2">
        <select
          className="h-8 rounded border border-line bg-white px-2 text-xs"
          value={selectedTrackId}
          data-testid="channel-analysis-track-select"
          onChange={(event) => onTrackChange(event.target.value)}
        >
          {tracks.map((track) => (
            <option key={track.id} value={track.id}>
              {track.name}
            </option>
          ))}
        </select>
        <button
          className={`h-8 rounded border px-3 text-xs font-semibold ${recording ? 'border-red-500 bg-red-500 text-white' : 'border-line bg-white text-slate-700 hover:bg-panel'}`}
          type="button"
          data-testid="channel-analysis-record-button"
          onClick={() => setRecording(!recording)}
        >
          {recording ? '停止录制' : '录制快照'}
        </button>
        {history.length > 0 ? (
          <>
            <input
              className="flex-1"
              type="range"
              min={0}
              max={history.length - 1}
              value={playbackIndex}
              data-testid="channel-analysis-playback-slider"
              onChange={(event) => setPlaybackIndex(Number(event.target.value))}
            />
            <span className="text-xs text-slate-500">
              {playbackIndex + 1}/{history.length}
            </span>
          </>
        ) : null}
        <button
          className="h-8 rounded border border-line bg-white px-2 text-xs text-slate-700 hover:bg-panel disabled:opacity-50"
          type="button"
          disabled={!displayedSnapshot}
          data-testid="channel-analysis-export-button"
          onClick={() => void handleExport()}
        >
          导出JSON
        </button>
      </div>
      {exportError ? <div className="text-xs text-red-600">{exportError}</div> : null}
      <div className="grid min-h-0 flex-1 grid-cols-2 gap-3">
        <FrequencyResponseChart snapshot={displayedSnapshot} />
        <PhaseScope points={displayedSnapshot?.phase ?? []} />
      </div>
      {displayedSnapshot ? (
        <div className="grid grid-cols-4 gap-2 text-center text-[11px]">
          <div>
            <div className="font-medium text-slate-500">相关性</div>
            <div className="tabular-nums">{formatCorrelation(displayedSnapshot.correlation)}</div>
          </div>
          <div>
            <div className="font-medium text-slate-500">峰值</div>
            <div className="tabular-nums">{displayedSnapshot.peaks[0]?.hz.toFixed(0) ?? '—'} Hz</div>
          </div>
          <div>
            <div className="font-medium text-slate-500">峰值幅度</div>
            <div className="tabular-nums">{displayedSnapshot.peaks[0]?.magnitude.toFixed(1) ?? '—'}</div>
          </div>
          <div>
            <div className="font-medium text-slate-500">频率点</div>
            <div className="tabular-nums">{displayedSnapshot.frequency.length}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FrequencyResponseChart({ snapshot }: { snapshot?: ChannelAnalysisSnapshot }) {
  const polyline = buildFrequencyPolyline(snapshot);
  return (
    <div className="flex min-h-0 flex-col">
      <div className="mb-1 text-[11px] font-medium text-slate-600">频率响应</div>
      <svg
        className="min-h-0 flex-1 rounded border border-line bg-white"
        viewBox="0 0 320 120"
        role="img"
        data-testid="channel-analysis-frequency-chart"
      >
        <line x1="0" y1="60" x2="320" y2="60" stroke="#e2e8f0" strokeWidth="1" />
        <line x1="0" y1="30" x2="320" y2="30" stroke="#f1f5f9" strokeWidth="0.5" strokeDasharray="4 2" />
        <line x1="0" y1="90" x2="320" y2="90" stroke="#f1f5f9" strokeWidth="0.5" strokeDasharray="4 2" />
        <text x="4" y="12" fontSize="8" fill="#94a3b8">
          +24
        </text>
        <text x="4" y="64" fontSize="8" fill="#94a3b8">
          0
        </text>
        <text x="4" y="116" fontSize="8" fill="#94a3b8">
          -24
        </text>
        <text x="20" y="116" fontSize="8" fill="#94a3b8">
          20Hz
        </text>
        <text x="150" y="116" fontSize="8" fill="#94a3b8">
          1kHz
        </text>
        <text x="290" y="116" fontSize="8" fill="#94a3b8">
          20kHz
        </text>
        {polyline ? <polyline fill="none" stroke="#2563eb" strokeWidth="1.5" points={polyline} /> : null}
      </svg>
    </div>
  );
}

function PhaseScope({ points }: { points: PhasePoint[] }) {
  const dots = points.slice(-200);
  return (
    <div className="flex min-h-0 flex-col">
      <div className="mb-1 text-[11px] font-medium text-slate-600">相位表</div>
      <svg
        className="min-h-0 flex-1 rounded border border-line bg-white"
        viewBox="0 0 120 120"
        role="img"
        data-testid="channel-analysis-phase-scope"
      >
        <line x1="60" y1="0" x2="60" y2="120" stroke="#e2e8f0" strokeWidth="0.5" />
        <line x1="0" y1="60" x2="120" y2="60" stroke="#e2e8f0" strokeWidth="0.5" />
        <circle cx="60" cy="60" r="50" fill="none" stroke="#f1f5f9" strokeWidth="0.5" />
        {dots.map((point, index) => {
          const x = 60 + point.left * 50;
          const y = 60 - point.right * 50;
          const opacity = 0.15 + (index / dots.length) * 0.85;
          return <circle key={index} cx={x} cy={y} r={1.5} fill="#2563eb" opacity={opacity} />;
        })}
      </svg>
    </div>
  );
}

function buildFrequencyPolyline(snapshot: ChannelAnalysisSnapshot | undefined): string {
  if (!snapshot || snapshot.frequency.length === 0) return '';
  const maxBands = Math.min(snapshot.frequency.length, 64);
  return Array.from({ length: maxBands }, (_, index) => {
    const point = snapshot.frequency[index];
    const x = (index / (maxBands - 1)) * 320;
    const y = 60 - Math.max(-24, Math.min(24, point.magnitude)) * (30 / 24);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
}

function buildFallbackChannelAnalysisFrame(trackId: string, bands: number[] = []): ChannelAnalysisFrame {
  return {
    sampleRate: 48000,
    frequencyData: bands,
    leftTimeDomain: [],
    rightTimeDomain: [],
    recordedAtMs: Date.now(),
  };
}

function formatCorrelation(value: number | undefined): string {
  return value !== undefined ? value.toFixed(2) : '—';
}
