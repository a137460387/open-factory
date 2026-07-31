import { useState } from 'react';
import { X } from 'lucide-react';
import { zhCN } from '../../i18n/strings';

export function SequenceSettingsDialog({
  sequence,
  projectSettings,
  onSave,
  onClose,
}: {
  sequence: {
    id: string;
    name?: string;
    settings?: { frameRate?: number; width?: number; height?: number; duration?: number };
  };
  projectSettings: { fps: number; width: number; height: number };
  onSave(settings: { frameRate?: number; width?: number; height?: number } | undefined): void;
  onClose(): void;
}) {
  const seqSettings = sequence.settings;
  const [override, setOverride] = useState(!!seqSettings);
  const [fps, setFps] = useState(String(seqSettings?.frameRate ?? projectSettings.fps));
  const [width, setWidth] = useState(String(seqSettings?.width ?? projectSettings.width));
  const [height, setHeight] = useState(String(seqSettings?.height ?? projectSettings.height));
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
      data-testid="sequence-settings-dialog"
      onPointerDown={(e) => {
        e.stopPropagation();
      }}
    >
      <div
        className="w-[360px] rounded-lg border border-line bg-[var(--color-bg-elevated)] p-4 shadow-lg"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-semibold">{zhCN.timeline.sequenceSettingsTitle}</span>
          <button className="rounded p-1 hover:bg-panel" type="button" onClick={onClose}>
            <X size={14} />
          </button>
        </div>
        <label className="mb-3 flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={override}
            onChange={(e) => setOverride(e.target.checked)}
            data-testid="sequence-settings-override"
          />
          {zhCN.timeline.sequenceSettingsOverride}
        </label>
        <div className="space-y-2 text-xs">
          <label className="flex items-center gap-2">
            <span className="w-16 shrink-0">{zhCN.timeline.sequenceSettingsFps}</span>
            <input
              className="w-20 rounded border border-line px-2 py-1 disabled:opacity-50"
              type="number"
              step="0.001"
              min="1"
              max="240"
              value={fps}
              disabled={!override}
              onChange={(e) => setFps(e.target.value)}
              data-testid="sequence-settings-fps"
            />
            {!override && (
              <span className="text-[var(--color-text-muted)]">{zhCN.timeline.sequenceSettingsInherit}</span>
            )}
          </label>
          <label className="flex items-center gap-2">
            <span className="w-16 shrink-0">{zhCN.timeline.sequenceSettingsWidth}</span>
            <input
              className="w-20 rounded border border-line px-2 py-1 disabled:opacity-50"
              type="number"
              step="1"
              min="1"
              max="16384"
              value={width}
              disabled={!override}
              onChange={(e) => setWidth(e.target.value)}
              data-testid="sequence-settings-width"
            />
            {!override && (
              <span className="text-[var(--color-text-muted)]">{zhCN.timeline.sequenceSettingsInherit}</span>
            )}
          </label>
          <label className="flex items-center gap-2">
            <span className="w-16 shrink-0">{zhCN.timeline.sequenceSettingsHeight}</span>
            <input
              className="w-20 rounded border border-line px-2 py-1 disabled:opacity-50"
              type="number"
              step="1"
              min="1"
              max="16384"
              value={height}
              disabled={!override}
              onChange={(e) => setHeight(e.target.value)}
              data-testid="sequence-settings-height"
            />
            {!override && (
              <span className="text-[var(--color-text-muted)]">{zhCN.timeline.sequenceSettingsInherit}</span>
            )}
          </label>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button className="rounded px-3 py-1.5 text-xs hover:bg-panel" type="button" onClick={onClose}>
            {zhCN.common.cancel}
          </button>
          <button
            className="rounded bg-brand px-3 py-1.5 text-xs text-white hover:opacity-90"
            type="button"
            data-testid="sequence-settings-save"
            onClick={() => {
              if (override) {
                onSave({
                  frameRate: parseFloat(fps) || undefined,
                  width: Number.parseInt(width, 10) || undefined,
                  height: Number.parseInt(height, 10) || undefined,
                });
              } else {
                onSave(undefined);
              }
              onClose();
            }}
          >
            {zhCN.common.save}
          </button>
        </div>
      </div>
    </div>
  );
}
