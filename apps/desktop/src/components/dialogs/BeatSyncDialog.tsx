import type { BeatSensitivity } from '@open-factory/editor-core';
import { useEditorUIStore } from '../../store/editorUIStore';
import { useEditorSettingsStore } from '../../store/editorSettingsStore';
import { zhCN } from '../../i18n/strings';

export interface BeatSyncDialogProps {
  detectedBeatBpm: number | undefined;
  beatSyncBeatTimes: number[];
  canDetectBeats: boolean;
  canSnapToBeats: boolean;
  applyManualBeatBpm: () => void;
  detectSelectedBeats: () => void;
  snapSelectedToBeats: () => void;
}

export function BeatSyncDialog({
  detectedBeatBpm,
  beatSyncBeatTimes,
  canDetectBeats,
  canSnapToBeats,
  applyManualBeatBpm,
  detectSelectedBeats,
  snapSelectedToBeats,
}: BeatSyncDialogProps) {
  const beatSyncOpen = useEditorUIStore((s) => s.beatSyncOpen);
  const setBeatSyncOpen = useEditorUIStore((s) => s.setBeatSyncOpen);
  const beatSensitivity = useEditorSettingsStore((s) => s.beatSensitivity);
  const setBeatSensitivity = useEditorSettingsStore((s) => s.setBeatSensitivity);
  const beatSyncManualBpm = useEditorSettingsStore((s) => s.beatSyncManualBpm);
  const setBeatSyncManualBpm = useEditorSettingsStore((s) => s.setBeatSyncManualBpm);
  const beatSyncSpeedEnabled = useEditorSettingsStore((s) => s.beatSyncSpeedEnabled);
  const setBeatSyncSpeedEnabled = useEditorSettingsStore((s) => s.setBeatSyncSpeedEnabled);

  if (!beatSyncOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4" role="dialog" aria-modal="true" data-testid="beat-sync-dialog">
      <div className="w-full max-w-md rounded-lg border border-line bg-white p-4 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-ink">{zhCN.toolbar.beatSync}</h2>
            <p className="mt-1 text-sm text-slate-600" data-testid="beat-sync-bpm-label">{zhCN.toolbar.beatSyncDetectedBpm(detectedBeatBpm)}</p>
            <p className="mt-1 text-xs text-slate-500" data-testid="beat-sync-marker-count">{zhCN.toolbar.beatSyncMarkers(beatSyncBeatTimes.length)}</p>
          </div>
          <button className="rounded-md border border-line px-2 py-1 text-xs text-slate-600 hover:bg-panel" type="button" data-testid="beat-sync-close-button" onClick={() => setBeatSyncOpen(false)}>
            {zhCN.toolbar.beatSyncClose}
          </button>
        </div>
        <div className="space-y-3">
          <label className="flex items-center justify-between gap-3 text-sm text-slate-700">
            <span>{zhCN.toolbar.beatSensitivity}</span>
            <select className="rounded border border-line bg-white px-2 py-1 text-sm" value={beatSensitivity} data-testid="beat-sync-sensitivity-select" onChange={(event) => setBeatSensitivity(event.target.value as BeatSensitivity)}>
              <option value="low">{zhCN.toolbar.beatSensitivityOptions.low}</option>
              <option value="medium">{zhCN.toolbar.beatSensitivityOptions.medium}</option>
              <option value="high">{zhCN.toolbar.beatSensitivityOptions.high}</option>
            </select>
          </label>
          <label className="flex items-center justify-between gap-3 text-sm text-slate-700">
            <span>{zhCN.toolbar.beatSyncManualBpm}</span>
            <input
              className="w-28 rounded border border-line px-2 py-1 text-right text-sm"
              type="number"
              min="1"
              step="0.1"
              value={beatSyncManualBpm}
              data-testid="beat-sync-bpm-input"
              onChange={(event) => setBeatSyncManualBpm(event.target.value)}
            />
          </label>
          <label className="flex items-center justify-between gap-3 text-sm text-slate-700">
            <span>{zhCN.toolbar.beatSyncSpeed}</span>
            <input type="checkbox" checked={beatSyncSpeedEnabled} data-testid="beat-sync-speed-checkbox" onChange={(event) => setBeatSyncSpeedEnabled(event.target.checked)} />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button className="rounded-md border border-line px-3 py-2 text-sm hover:bg-panel" type="button" data-testid="beat-sync-apply-bpm-button" onClick={applyManualBeatBpm}>
            {zhCN.toolbar.beatSyncApplyBpm}
          </button>
          <button className="rounded-md border border-line px-3 py-2 text-sm hover:bg-panel disabled:cursor-not-allowed disabled:opacity-50" type="button" disabled={!canDetectBeats} data-testid="beat-sync-detect-button" onClick={() => void detectSelectedBeats()}>
            {zhCN.toolbar.beatSyncRunDetect}
          </button>
          <button className="rounded-md bg-brand px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50" type="button" disabled={!canSnapToBeats} data-testid="beat-sync-align-button" onClick={snapSelectedToBeats}>
            {zhCN.toolbar.beatSyncRunAlign}
          </button>
        </div>
      </div>
    </div>
  );
}
