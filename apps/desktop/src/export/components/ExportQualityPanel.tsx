import type { Dispatch, SetStateAction } from "react";
import type {
  ExportCostHistorySample,
  ExportOptimizationSettings,
  ExportOptimizationSuggestion,
  ExportPresetSettings,
  FfmpegCapabilities,
  Project,
} from "@open-factory/editor-core";
import { zhCN } from "../../i18n/strings";
import { InfoRow } from "../export-utils";
import { ExportCostEstimatePanel } from "./ExportCostEstimatePanel";
import {
  ExportOptimizationPanel,
  formatOptimizationSuggestionTitle,
} from "./ExportOptimizationPanel";
import { AIExportSuggestionPanel } from "./AIExportSuggestionPanel";

export interface ExportQualityPanelProps {
  project: Project;
  exportSettings: ExportPresetSettings;
  draftSettings: ExportPresetSettings;
  setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>;
  estimatedSize: string;
  isAudioOnly: boolean;
  capabilities: FfmpegCapabilities | undefined;
  exportCostEstimate: { estimatedDurationSeconds: number; estimatedCpuLoad: string };
  exportCostHistoryError: number | undefined;
  historyCostSamples: ExportCostHistorySample[];
  exportOptimizationSuggestions: ExportOptimizationSuggestion[];
  exportOptimizationSettings: ExportOptimizationSettings;
  onApplyOptimizationSuggestion: (suggestion: ExportOptimizationSuggestion) => void;
  onDismissOptimizationSuggestion: (suggestion: ExportOptimizationSuggestion) => void;
}

export function ExportQualityPanel({
  project,
  exportSettings,
  draftSettings,
  setDraftSettings,
  estimatedSize,
  isAudioOnly,
  capabilities,
  exportCostEstimate,
  exportCostHistoryError,
  historyCostSamples,
  exportOptimizationSuggestions,
  onApplyOptimizationSuggestion,
  onDismissOptimizationSuggestion,
}: ExportQualityPanelProps) {
  const t = zhCN.exportDialog;

  return (
    <>
          <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 md:grid-cols-5">
            <Info
              label={t.info.resolution}
              value={
                isAudioOnly
                  ? zhCN.common.audioOnly
                  : `${exportSettings.width ?? project.settings.width} x ${exportSettings.height ?? project.settings.height}`
              }
            />
            <Info
              label={t.info.fps}
              value={isAudioOnly ? zhCN.common.audioOnly : String(exportSettings.fps ?? project.settings.fps)}
            />
            <Info label={t.info.format} value={exportSettings.format ?? 'mp4'} />
            <Info
              label={t.info.bitrate}
              value={`${isAudioOnly ? zhCN.common.noVideo : exportSettings.videoBitrate || zhCN.common.auto} / ${exportSettings.audioBitrate || zhCN.common.auto}`}
            />
            <Info
              label={t.info.videoCodec}
              value={isAudioOnly ? zhCN.common.none : (exportSettings.videoCodec ?? 'libx264')}
            />
            <Info label={t.info.audioCodec} value={exportSettings.audioCodec ?? 'aac'} />
            <Info label={t.info.estimatedSize} value={estimatedSize} />
            <Info
              label={t.info.ffmpeg}
              value={capabilities?.available ? (capabilities.version ?? zhCN.common.available) : zhCN.common.missing}
              tone={capabilities?.available ? 'ok' : 'bad'}
            />
            <Info
              label={t.info.drawtext}
              value={
                capabilities?.hasDrawtext && capabilities.hasLibfreetype
                  ? zhCN.common.available
                  : zhCN.common.unavailable
              }
              tone={capabilities?.hasDrawtext && capabilities.hasLibfreetype ? 'ok' : 'warn'}
            />
            <Info
              label={t.info.hardwareEncoder}
              value={
                capabilities?.hardwareEncoderAvailable && capabilities.hardwareEncoder
                  ? capabilities.hardwareEncoder
                  : zhCN.common.unavailable
              }
              tone={capabilities?.hardwareEncoderAvailable ? 'ok' : 'warn'}
            />
          </div>
          <ExportCostEstimatePanel
            estimate={exportCostEstimate}
            historyErrorPercent={exportCostHistoryError}
            historySamples={historyCostSamples}
          />
          <ExportOptimizationPanel
            suggestions={exportOptimizationSuggestions}
            onApply={applyOptimizationSuggestion}
            onDismiss={(suggestion) => void dismissOptimizationSuggestion(suggestion)}
          />
          <AIExportSuggestionPanel
            project={project}
            draftSettings={draftSettings}
            setDraftSettings={setDraftSettings}
          />

    </>
  );
}
