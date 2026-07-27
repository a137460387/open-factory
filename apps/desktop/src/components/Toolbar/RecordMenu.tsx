import { Monitor, Camera, Square, ChevronDown } from 'lucide-react';
import { zhCN } from '../../i18n/strings';
import { formatRecordingElapsed } from './ToolbarButton';

export function RecordMenu({
  open,
  onToggle,
  recordingActive,
  recordingElapsedSeconds,
  onStartRecording,
  onStopRecording,
}: {
  open: boolean;
  onToggle(): void;
  recordingActive: boolean;
  recordingElapsedSeconds: number;
  onStartRecording(source: 'screen' | 'camera'): void;
  onStopRecording(): void;
}) {
  const t = zhCN.toolbar;
  return (
    <div className="relative">
      <button
        className="inline-flex h-9 items-center gap-1 rounded-md border border-line bg-panel px-2 text-sm font-medium text-slate-700 hover:bg-white"
        type="button"
        data-testid="toolbar-record-menu-button"
        onClick={() => {
          if (recordingActive) {
            onStopRecording();
            return;
          }
          onToggle();
        }}
      >
        {recordingActive ? <Square size={15} /> : <Monitor size={15} />}
        <span>{recordingActive ? t.stopRecording : t.record}</span>
        {recordingActive ? (
          <span className="text-xs tabular-nums text-slate-500">
            {formatRecordingElapsed(recordingElapsedSeconds)}
          </span>
        ) : (
          <ChevronDown size={14} />
        )}
      </button>
      {open ? (
        <div
          className="absolute left-0 top-10 z-20 min-w-40 rounded-md border border-line bg-white py-1 shadow-soft"
          data-testid="toolbar-record-menu"
        >
          <button
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-panel"
            type="button"
            data-testid="toolbar-record-screen-menu-item"
            onClick={() => { onToggle(); onStartRecording('screen'); }}
          >
            <Monitor size={14} />
            <span>{t.recordScreen}</span>
          </button>
          <button
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-panel"
            type="button"
            data-testid="toolbar-record-camera-menu-item"
            onClick={() => { onToggle(); onStartRecording('camera'); }}
          >
            <Camera size={14} />
            <span>{t.recordCamera}</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
