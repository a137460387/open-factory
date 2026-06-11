import { useState } from 'react';
import {
  UpdateProjectAudioCommand,
  UpdateTrackCommand,
  normalizeTrackCompressor,
  normalizeTrackEQ,
  type Track,
  type TrackCompressor,
  type TrackEQ,
  type TrackEQBand,
  type TrackPatch
} from '@open-factory/editor-core';
import { ChevronDown, ChevronRight, SlidersHorizontal, Volume2 } from 'lucide-react';
import { formatTrackType, zhCN } from '../../i18n/strings';
import { commandManager, projectAccessor, timelineAccessor } from '../../store/commandManager';
import { getSilentMeterLevel, useAudioMeterStore, type AudioMeterLevel } from '../../store/audioMeterStore';
import { useEditorStore } from '../../store/editorStore';

export function AudioMixer() {
  const project = useEditorStore((state) => state.project);
  const trackLevels = useAudioMeterStore((state) => state.trackLevels);
  const masterLevel = useAudioMeterStore((state) => state.masterLevel);
  const tracks = project.timeline.tracks.filter((track) => track.type === 'audio' || track.type === 'video');
  const [expandedTrackIds, setExpandedTrackIds] = useState<Record<string, boolean>>({});

  function updateTrack(trackId: string, patch: TrackPatch): void {
    commandManager.execute(new UpdateTrackCommand(timelineAccessor, trackId, patch));
  }

  function updateMasterVolume(masterVolume: number): void {
    commandManager.execute(new UpdateProjectAudioCommand(projectAccessor, { masterVolume }));
  }

  function toggleTrack(trackId: string): void {
    setExpandedTrackIds((current) => ({ ...current, [trackId]: !current[trackId] }));
  }

  return (
    <section className="flex min-h-0 flex-col bg-white" data-testid="audio-mixer">
      <div className="flex h-10 items-center gap-2 border-b border-line px-3">
        <Volume2 size={16} className="text-brand" />
        <div>
          <div className="text-sm font-semibold">{zhCN.mixer.title}</div>
        </div>
      </div>
      <div className="mixer-scrollbar flex min-h-0 flex-1 gap-2 overflow-x-auto px-3 py-2">
        {tracks.map((track) => (
          <ChannelStrip
            key={track.id}
            track={track}
            level={trackLevels[track.id] ?? getSilentMeterLevel()}
            expanded={Boolean(expandedTrackIds[track.id])}
            onToggle={() => toggleTrack(track.id)}
            onUpdate={(patch) => updateTrack(track.id, patch)}
          />
        ))}
        <MasterStrip level={masterLevel} volume={project.masterVolume} onVolumeChange={updateMasterVolume} />
      </div>
    </section>
  );
}

function ChannelStrip({
  track,
  level,
  expanded,
  onToggle,
  onUpdate
}: {
  track: Track;
  level: AudioMeterLevel;
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
        <VolumeFader value={track.volume ?? 1} testId={`mixer-volume-${track.id}`} onChange={(volume) => onUpdate({ volume })} />
      </div>
      <PanControl value={track.pan ?? 0} testId={`mixer-pan-${track.id}`} onChange={(pan) => onUpdate({ pan })} />
      <div className="flex items-center justify-center gap-1">
        <MixerToggle label="M" title={zhCN.mixer.muteTrack} active={Boolean(track.muted)} testId={`mixer-mute-${track.id}`} onClick={() => onUpdate({ muted: !track.muted })} />
        <MixerToggle label="S" title={zhCN.mixer.soloTrack} active={Boolean(track.solo)} testId={`mixer-solo-${track.id}`} onClick={() => onUpdate({ solo: !track.solo })} />
      </div>
      {expanded ? <ChannelProcessingPanel track={track} onUpdate={onUpdate} /> : null}
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
      bands: eq.bands.map((band, bandIndex) => (bandIndex === index ? { ...band, ...patch } : band))
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
          <EQBandControls key={band.id} trackId={track.id} band={band} index={index} disabled={!eq.enabled} onChange={(patch) => updateBand(index, patch)} />
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
  onChange
}: {
  trackId: string;
  band: TrackEQBand;
  index: number;
  disabled: boolean;
  onChange(patch: Partial<TrackEQBand>): void;
}) {
  const name = [zhCN.mixer.bandNames.low, zhCN.mixer.bandNames.lowMid, zhCN.mixer.bandNames.highMid, zhCN.mixer.bandNames.high][index] ?? band.id;
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
    <svg className="mt-2 h-16 w-full rounded border border-line bg-white" viewBox="0 0 160 64" role="img" data-testid={`mixer-eq-graph-${trackId}`}>
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
  onChange
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

function MasterStrip({ level, volume, onVolumeChange }: { level: AudioMeterLevel; volume: number; onVolumeChange(value: number): void }) {
  return (
    <div className="grid h-full min-w-[92px] grid-rows-[32px_92px_24px] gap-1 rounded-md border border-slate-300 bg-white px-2 py-2" data-testid="mixer-master">
      <div>
        <div className="text-[11px] font-semibold text-slate-800">{zhCN.mixer.master}</div>
        <div className="text-[10px] uppercase text-slate-500">{zhCN.mixer.output}</div>
      </div>
      <div className="grid min-h-0 grid-cols-[18px_1fr] items-center gap-2">
        <VuMeter level={level} />
        <VolumeFader value={volume} testId="mixer-master-volume" onChange={onVolumeChange} />
      </div>
      <div className="flex items-center justify-center text-[11px] tabular-nums text-slate-600">{Math.round(volume * 100)}%</div>
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
    <div className="relative h-full min-h-[70px] w-[18px] overflow-hidden rounded-sm border border-slate-300 bg-slate-950" title={`${level.levelDb.toFixed(1)} dB`}>
      <div className="absolute bottom-0 left-0 right-0 bg-emerald-400" style={{ height: levelHeight }} />
      <div className="absolute left-0 right-0 h-0.5 bg-amber-300" style={{ bottom: peakBottom }} />
    </div>
  );
}

function MixerToggle({ label, title, active, testId, onClick }: { label: string; title: string; active: boolean; testId: string; onClick(): void }) {
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
