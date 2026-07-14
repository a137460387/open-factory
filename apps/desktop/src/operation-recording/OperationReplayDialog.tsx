import type { OperationRecordingFile, OperationReplaySpeed } from '@open-factory/editor-core';
import { buildOperationRecordingSlides, normalizeOperationReplaySpeed } from '@open-factory/editor-core';
import { Pause, Play, Save, Upload, X } from 'lucide-react';
import { zhCN } from '../i18n/strings';

interface OperationReplayDialogProps {
  recording?: OperationRecordingFile;
  recordingActive: boolean;
  replaying: boolean;
  currentStep: number;
  speed: OperationReplaySpeed;
  onStartRecording(): void;
  onStopRecording(): void;
  onSaveRecording(): void;
  onLoadRecording(): void;
  onReplay(): void;
  onPauseReplay(): void;
  onJump(stepIndex: number): void;
  onSpeedChange(speed: OperationReplaySpeed): void;
  onExportSlides(): void;
  onClose(): void;
}

export default function OperationReplayDialog({
  recording,
  recordingActive,
  replaying,
  currentStep,
  speed,
  onStartRecording,
  onStopRecording,
  onSaveRecording,
  onLoadRecording,
  onReplay,
  onPauseReplay,
  onJump,
  onSpeedChange,
  onExportSlides,
  onClose,
}: OperationReplayDialogProps) {
  const t = zhCN.operationRecording;
  const commandCount = recording?.commands.length ?? 0;
  const slides = recording ? buildOperationRecordingSlides(recording, 2) : [];
  const activeCommand = currentStep >= 0 ? recording?.commands[currentStep] : undefined;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4"
      data-testid="operation-recording-dialog"
    >
      <section className="flex max-h-[82vh] w-full max-w-3xl flex-col rounded-md border border-line bg-white shadow-soft">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-ink">{t.title}</h2>
            <p className="text-xs text-slate-500">{recordingActive ? t.recordingActive : t.summary(commandCount)}</p>
          </div>
          <button
            className="rounded p-1 text-slate-500 hover:bg-panel"
            type="button"
            aria-label={t.close}
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <button
              className="inline-flex items-center gap-1 rounded-md border border-line px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-panel disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              data-testid="operation-recording-start"
              disabled={recordingActive || replaying}
              onClick={onStartRecording}
            >
              <Play size={14} />
              {t.start}
            </button>
            <button
              className="inline-flex items-center gap-1 rounded-md border border-line px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-panel disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              data-testid="operation-recording-stop"
              disabled={!recordingActive}
              onClick={onStopRecording}
            >
              <Pause size={14} />
              {t.stop}
            </button>
            <button
              className="inline-flex items-center gap-1 rounded-md border border-line px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-panel disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              data-testid="operation-recording-save"
              disabled={!recording || commandCount === 0 || recordingActive}
              onClick={onSaveRecording}
            >
              <Save size={14} />
              {t.save}
            </button>
            <button
              className="inline-flex items-center gap-1 rounded-md border border-line px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-panel"
              type="button"
              data-testid="operation-recording-load"
              onClick={onLoadRecording}
            >
              <Upload size={14} />
              {t.load}
            </button>
            <button
              className="rounded-md border border-line px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-panel disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              data-testid="operation-recording-export-slides"
              disabled={!recording || commandCount === 0}
              onClick={onExportSlides}
            >
              {t.exportSlides}
            </button>
          </div>

          <div className="grid gap-3 rounded-md border border-line bg-panel p-3 text-xs text-slate-600 md:grid-cols-[1fr_auto]">
            <label className="block">
              <span className="mb-1 block font-semibold text-slate-700">{t.progress}</span>
              <input
                className="w-full accent-brand"
                type="range"
                min={-1}
                max={Math.max(-1, commandCount - 1)}
                value={Math.min(currentStep, Math.max(-1, commandCount - 1))}
                data-testid="operation-recording-progress"
                disabled={!recording || commandCount === 0 || replaying}
                onChange={(event) => onJump(Number(event.target.value))}
              />
            </label>
            <label className="block min-w-28">
              <span className="mb-1 block font-semibold text-slate-700">{t.speed}</span>
              <select
                className="w-full rounded-md border border-line bg-white px-2 py-1.5"
                value={speed}
                data-testid="operation-recording-speed"
                onChange={(event) => onSpeedChange(normalizeOperationReplaySpeed(Number(event.target.value)))}
              >
                <option value={1}>1x</option>
                <option value={2}>2x</option>
                <option value={4}>4x</option>
              </select>
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              className="rounded-md bg-brand px-3 py-2 text-xs font-semibold text-white hover:bg-[#176858] disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              data-testid="operation-recording-replay"
              disabled={!recording || commandCount === 0 || recordingActive || replaying}
              onClick={onReplay}
            >
              {t.replay}
            </button>
            <button
              className="rounded-md border border-line px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-panel disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              data-testid="operation-recording-pause"
              disabled={!replaying}
              onClick={onPauseReplay}
            >
              {t.pause}
            </button>
            <span className="text-xs text-slate-500" data-testid="operation-recording-current-step">
              {t.currentStep(currentStep + 1, commandCount)}
            </span>
          </div>

          <div className="grid gap-3 md:grid-cols-[1fr_220px]">
            <div className="rounded-md border border-line bg-white">
              <div className="border-b border-line px-3 py-2 text-xs font-semibold text-slate-700">{t.commandList}</div>
              <div className="max-h-64 overflow-y-auto p-2" data-testid="operation-recording-command-list">
                {recording?.commands.length ? (
                  recording.commands.map((command) => (
                    <button
                      key={command.id}
                      className={`mb-1 flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-xs ${command.index === currentStep ? 'bg-brand text-white' : 'text-slate-700 hover:bg-panel'}`}
                      type="button"
                      data-testid="operation-recording-command"
                      data-command-index={command.index}
                      onClick={() => onJump(command.index)}
                    >
                      <span className="min-w-0 truncate">{command.description}</span>
                      <span className="shrink-0 tabular-nums">{command.index + 1}</span>
                    </button>
                  ))
                ) : (
                  <div
                    className="rounded border border-dashed border-line px-3 py-8 text-center text-xs text-slate-500"
                    data-testid="operation-recording-empty"
                  >
                    {t.empty}
                  </div>
                )}
              </div>
            </div>
            <div className="rounded-md border border-line bg-panel p-3 text-xs text-slate-600">
              <div className="font-semibold text-slate-700">{t.preview}</div>
              <div className="mt-2 space-y-1">
                <div data-testid="operation-recording-active-command">
                  {activeCommand?.description ?? t.initialState}
                </div>
                <div>{t.slideCount(slides.length)}</div>
                <div>{t.fileFormat}</div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
