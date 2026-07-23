import type { Dispatch, SetStateAction, ReactNode } from "react";
import type {
  ExportPipeline,
  ExportPipelineNodeStatus,
  ExportPublishNodeLog,
  ExportStemFormat,
  ExportStemMode,
  ExportTaskPriority,
  FfmpegCapabilities,
  PreflightResult,
  Project,
} from "@open-factory/editor-core";
import { zhCN } from "../../i18n/strings";
import type { ExportCompletionAction } from "../export-background";
import type { ExportJob, ExportRangeMode } from "../lib/pipelineHelpers";
import type { ExportPreset, ExportPresetSettings } from "../export-presets";
import type { ExportBackgroundSettings, ExportUploadSettings } from "../../settings/appSettings";
import type { ExportWarmupUiStatus } from "./ExportOptimizationPanel";
import { ExportUploadSection } from "./ExportUploadSection";
import { PostExportScriptSection } from "./MonitoringAndPostScript";
import { PipelineSection } from "./PipelineSection";
import { PreflightPanel } from "./PreflightPanel";
import { ExportWarmupStatusPanel } from "./ExportOptimizationPanel";
import { formatExportWarning } from "../export-utils";

export interface ExportAdvancedPanelProps {
  draftSettings: ExportPresetSettings;
  exportSettings: ExportPresetSettings;
  setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>;
  exportBackgroundSettings: ExportBackgroundSettings;
  exportUploadSettings: ExportUploadSettings;
  exportUploadPassword: string;
  capabilities: FfmpegCapabilities | undefined;
  isAudioOnly: boolean;
  batchOutputPaths: string;
  setBatchOutputPaths: Dispatch<SetStateAction<string>>;
  priority: ExportTaskPriority;
  setPriority: Dispatch<SetStateAction<ExportTaskPriority>>;
  scheduleEnabled: boolean;
  setScheduleEnabled: Dispatch<SetStateAction<boolean>>;
  scheduledStartInput: string;
  setScheduledStartInput: Dispatch<SetStateAction<string>>;
  completionAction: ExportCompletionAction;
  setCompletionAction: Dispatch<SetStateAction<ExportCompletionAction>>;
  progressiveExportEnabled: boolean;
  setProgressiveExportEnabled: Dispatch<SetStateAction<boolean>>;
  progressiveExportSupported: boolean;
  renderFarmEnabled: boolean;
  setRenderFarmEnabled: Dispatch<SetStateAction<boolean>>;
  renderFarmInstances: number;
  setRenderFarmInstances: Dispatch<SetStateAction<number>>;
  suggestedRenderFarmInstances: number;
  spatialDenoiseClipCount: number;
  hardwareEncodingRequested: boolean;
  preflight: { issues: PreflightResult[]; selectedJobs: ExportJob[] } | undefined;
  setPreflight: Dispatch<SetStateAction<{ issues: PreflightResult[]; selectedJobs: ExportJob[] } | undefined>>;
  warmupStatus: ExportWarmupUiStatus | undefined;
  error: string | undefined;
  onPostExportScriptAcknowledgedChange: (checked: boolean) => void;
  onUpdateExportUploadSettings: (next: ExportUploadSettings) => void;
  onUpdateExportUploadPassword: (password: string) => void;
  onChooseExportUploadDirectory: () => void;
  onContinueAfterWarnings: () => void;
  onRelinkMissing?: () => void;
}

export function ExportAdvancedPanel(props: ExportAdvancedPanelProps) {
  const {
    draftSettings, exportSettings, setDraftSettings,
    exportBackgroundSettings, exportUploadSettings, exportUploadPassword,
    capabilities, isAudioOnly,
    batchOutputPaths, setBatchOutputPaths,
    priority, setPriority,
    scheduleEnabled, setScheduleEnabled, scheduledStartInput, setScheduledStartInput,
    completionAction, setCompletionAction,
    progressiveExportEnabled, setProgressiveExportEnabled, progressiveExportSupported,
    renderFarmEnabled, setRenderFarmEnabled, renderFarmInstances, setRenderFarmInstances,
    suggestedRenderFarmInstances,
    spatialDenoiseClipCount, hardwareEncodingRequested,
    preflight, setPreflight, warmupStatus, error,
    onPostExportScriptAcknowledgedChange,
    onUpdateExportUploadSettings, onUpdateExportUploadPassword, onChooseExportUploadDirectory,
    onContinueAfterWarnings, onRelinkMissing,
  } = props;
  const t = zhCN.exportDialog;

  return (
    <>
          <PostExportScriptSection
            script={draftSettings.postExportScript}
            acknowledged={exportBackgroundSettings.postExportScriptAcknowledged}
            setDraftSettings={setDraftSettings}
            onAcknowledgedChange={(checked) => void setPostExportScriptAcknowledged(checked)}
          />
          <ExportUploadSection
            settings={exportUploadSettings}
            password={exportUploadPassword}
            onSettingsChange={(nextSettings) => void updateExportUploadSettings(nextSettings)}
            onPasswordChange={(password) => void updateExportUploadPassword(password)}
            onChooseDirectory={() => void chooseExportUploadDirectory()}
          />
            <div className="grid grid-cols-[110px_1fr] gap-2">
              <label className="pt-1.5 text-xs font-medium text-slate-600">{t.batchPaths}</label>
              <textarea
                className="min-h-16 resize-y rounded-md border border-line px-2 py-1.5 text-xs"
                placeholder={t.batchPlaceholder}
                value={batchOutputPaths}
                onChange={(event) => setBatchOutputPaths(event.target.value)}
                data-testid="export-batch-paths"
              />
            </div>
          )}
          <div className="grid grid-cols-[110px_220px] gap-2">
            <label className="pt-1.5 text-xs font-medium text-slate-600">{t.priority}</label>
            <select
              className="rounded-md border border-line px-2 py-1.5 text-sm"
              value={priority}
              onChange={(event) => setPriority(event.target.value as ExportTaskPriority)}
              data-testid="export-priority-select"
            >
              {(['high', 'normal', 'low'] as const).map((value) => (
                <option key={value} value={value}>
                  {t.priorityOptions[value]}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-[110px_1fr] gap-2 rounded-md border border-line p-3">
            <label className="pt-1 text-xs font-medium text-slate-600">{t.schedule.title}</label>
            <div className="space-y-2">
              <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700">
                <input
                  className="h-4 w-4 accent-brand"
                  type="checkbox"
                  checked={scheduleEnabled}
                  onChange={(event) => setScheduleEnabled(event.target.checked)}
                  data-testid="export-schedule-toggle"
                />
                <span>{t.schedule.enabled}</span>
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  className="h-9 min-w-56 rounded-md border border-line px-2 text-sm disabled:bg-slate-100"
                  type="datetime-local"
                  step={1}
                  value={scheduledStartInput}
                  disabled={!scheduleEnabled}
                  onChange={(event) => setScheduledStartInput(event.target.value)}
                  data-testid="export-schedule-start-input"
                />
                <span className="text-xs text-slate-500">{t.schedule.description}</span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-[110px_1fr] gap-2 rounded-md border border-line p-3">
            <label className="pt-1.5 text-xs font-medium text-slate-600">{t.completionAction.title}</label>
            <div className="space-y-2">
              <select
                className="w-full max-w-xs rounded-md border border-line px-2 py-1.5 text-sm"
                value={completionAction}
                onChange={(event) => setCompletionAction(normalizeExportCompletionAction(event.target.value))}
                data-testid="export-completion-action-select"
              >
                {EXPORT_COMPLETION_ACTIONS.map((action) => (
                  <option key={action} value={action}>
                    {t.completionAction.options[action]}
                  </option>
                ))}
              </select>
              {(completionAction === 'shutdown' || completionAction === 'hibernate') &&
              !exportBackgroundSettings.allowPowerActions ? (
                <div className="text-xs text-amber-700" data-testid="export-power-action-disabled-warning">
                  {t.completionAction.powerDisabled}
                </div>
              ) : null}
            </div>
          </div>
          <div className="grid grid-cols-[110px_1fr] gap-2 rounded-md border border-line p-3">
            <label className="pt-1 text-xs font-medium text-slate-600">{t.progressive.title}</label>
            <div className="space-y-2">
              <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700">
                <input
                  className="h-4 w-4 accent-brand"
                  type="checkbox"
                  checked={progressiveExportEnabled}
                  data-testid="export-progressive-toggle"
                  onChange={(event) => {
                    const checked = event.target.checked;
                    setProgressiveExportEnabled(checked);
                    if (checked) {
                      setRenderFarmEnabled(false);
                    }
                  }}
                />
                <span>{t.progressive.enabled}</span>
              </label>
              <div className="text-xs text-slate-500">{t.progressive.description}</div>
              {progressiveExportEnabled && !progressiveExportSupported ? (
                <div className="text-xs text-amber-700" data-testid="export-progressive-unsupported">
                  {t.progressive.unsupportedWarning}
                </div>
              ) : null}
            </div>
          </div>
          <div className="grid grid-cols-[110px_1fr] gap-2 rounded-md border border-line p-3">
            <label className="pt-1 text-xs font-medium text-slate-600">{t.renderFarm.title}</label>
            <div className="space-y-2">
              <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700">
                <input
                  className="h-4 w-4 accent-brand"
                  type="checkbox"
                  checked={renderFarmEnabled}
                  disabled={progressiveExportEnabled}
                  onChange={(event) => setRenderFarmEnabled(event.target.checked)}
                  data-testid="export-render-farm-toggle"
                />
                <span>{t.renderFarm.enabled}</span>
              </label>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                <span>{t.renderFarm.instances}</span>
                <input
                  className="h-8 w-16 rounded-md border border-line px-2 text-right disabled:bg-slate-100"
                  type="number"
                  min={1}
                  max={4}
                  value={renderFarmInstances}
                  disabled={!renderFarmEnabled || progressiveExportEnabled}
                  onChange={(event) =>
                    setRenderFarmInstances(Math.min(4, Math.max(1, Math.round(Number(event.target.value) || 1))))
                  }
                  data-testid="export-render-farm-instances"
                />
                <span>{t.renderFarm.suggested(suggestedRenderFarmInstances)}</span>
              </div>
              {progressiveExportEnabled ? (
                <div className="text-xs text-slate-500">{t.progressive.renderFarmDisabled}</div>
              ) : null}
            </div>
          </div>
          {capabilities?.drawtextWarning ? (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
              {formatExportWarning(capabilities.drawtextWarning)}
            </div>
          ) : null}
          {spatialDenoiseClipCount > 0 ? (
            <div
              className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900"
              data-testid="export-spatial-denoise-warning"
            >
              {t.spatialDenoiseWarning(spatialDenoiseClipCount)}
            </div>
          ) : null}
          {preflight ? (
            <PreflightPanel
              issues={preflight.issues}
              onDismiss={() => setPreflight(undefined)}
              onContinue={() => void continueAfterWarnings()}
              onRelink={onRelinkMissing ? relinkFromPreflight : undefined}
            />
          ) : null}
          {hardwareEncodingRequested && capabilities && !capabilities.hardwareEncoderAvailable ? (
            <div
              className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900"
              data-testid="export-hardware-fallback-warning"
            >
              {t.hardwareEncodingFallback}
            </div>
          ) : null}
          {warmupStatus ? <ExportWarmupStatusPanel status={warmupStatus} /> : null}
    </>
  );
}
