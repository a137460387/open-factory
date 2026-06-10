import { UpdateProjectAudioCommand, UpdateTrackCommand, type Track } from '@open-factory/editor-core';
import { Volume2 } from 'lucide-react';
import { commandManager, projectAccessor, timelineAccessor } from '../../store/commandManager';
import { getSilentMeterLevel, useAudioMeterStore, type AudioMeterLevel } from '../../store/audioMeterStore';
import { useEditorStore } from '../../store/editorStore';

export function AudioMixer() {
  const project = useEditorStore((state) => state.project);
  const trackLevels = useAudioMeterStore((state) => state.trackLevels);
  const masterLevel = useAudioMeterStore((state) => state.masterLevel);
  const tracks = project.timeline.tracks.filter((track) => track.type === 'audio' || track.type === 'video');

  function updateTrack(trackId: string, patch: Partial<Pick<Track, 'muted' | 'solo' | 'volume' | 'pan'>>): void {
    commandManager.execute(new UpdateTrackCommand(timelineAccessor, trackId, patch));
  }

  function updateMasterVolume(masterVolume: number): void {
    commandManager.execute(new UpdateProjectAudioCommand(projectAccessor, { masterVolume }));
  }

  return (
    <section className="flex min-h-0 flex-col bg-white" data-testid="audio-mixer">
      <div className="flex h-10 items-center gap-2 border-b border-line px-3">
        <Volume2 size={16} className="text-brand" />
        <div>
          <div className="text-sm font-semibold">Audio Mixer</div>
        </div>
      </div>
      <div className="mixer-scrollbar flex min-h-0 flex-1 gap-2 overflow-x-auto px-3 py-2">
        {tracks.map((track) => (
          <ChannelStrip
            key={track.id}
            track={track}
            level={trackLevels[track.id] ?? getSilentMeterLevel()}
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
  onUpdate
}: {
  track: Track;
  level: AudioMeterLevel;
  onUpdate(patch: Partial<Pick<Track, 'muted' | 'solo' | 'volume' | 'pan'>>): void;
}) {
  return (
    <div className="grid h-full min-w-[92px] grid-rows-[32px_86px_30px_26px] gap-1 rounded-md border border-line bg-panel px-2 py-2" data-testid={`mixer-channel-${track.id}`}>
      <div className="min-w-0">
        <div className="truncate text-[11px] font-semibold text-slate-700" title={track.name}>
          {track.name}
        </div>
        <div className="text-[10px] uppercase text-slate-500">{track.type}</div>
      </div>
      <div className="grid min-h-0 grid-cols-[18px_1fr] items-center gap-2">
        <VuMeter level={level} />
        <VolumeFader value={track.volume ?? 1} testId={`mixer-volume-${track.id}`} onChange={(volume) => onUpdate({ volume })} />
      </div>
      <PanControl value={track.pan ?? 0} testId={`mixer-pan-${track.id}`} onChange={(pan) => onUpdate({ pan })} />
      <div className="flex items-center justify-center gap-1">
        <MixerToggle label="M" title="Mute track" active={Boolean(track.muted)} testId={`mixer-mute-${track.id}`} onClick={() => onUpdate({ muted: !track.muted })} />
        <MixerToggle label="S" title="Solo track" active={Boolean(track.solo)} testId={`mixer-solo-${track.id}`} onClick={() => onUpdate({ solo: !track.solo })} />
      </div>
    </div>
  );
}

function MasterStrip({ level, volume, onVolumeChange }: { level: AudioMeterLevel; volume: number; onVolumeChange(value: number): void }) {
  return (
    <div className="grid h-full min-w-[92px] grid-rows-[32px_92px_24px] gap-1 rounded-md border border-slate-300 bg-white px-2 py-2" data-testid="mixer-master">
      <div>
        <div className="text-[11px] font-semibold text-slate-800">Master</div>
        <div className="text-[10px] uppercase text-slate-500">output</div>
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
        title="Volume"
        data-testid={testId}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  );
}

function PanControl({ value, testId, onChange }: { value: number; testId: string; onChange(value: number): void }) {
  const angle = value * 135;
  return (
    <label className="flex min-w-0 items-center justify-center gap-2 text-[10px] text-slate-600" title="Pan">
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
          aria-label="Pan"
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

function dbToPercent(db: number): number {
  return Math.min(100, Math.max(0, ((db + 60) / 60) * 100));
}
