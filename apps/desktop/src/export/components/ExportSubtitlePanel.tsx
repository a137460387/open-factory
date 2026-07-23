import type { Dispatch, SetStateAction } from "react";
import type { ExportPresetSettings, Project } from "@open-factory/editor-core";
import { zhCN } from "../../i18n/strings";
import type { SubtitleLanguageOption } from "../lib/exportSettingsHelpers";
import { SubtitleLanguageSection } from "./SubtitleLanguageSection";
import { ColorManagementSection } from "./ColorManagementSection";
import { ThemePreviewButton, AudioVisualizationSection } from "./AudioVisualizationSection";
import { WatermarkSection } from "./WatermarkSection";
import { MonitoringSection } from "./MonitoringAndPostScript";
import { ReframeOffsetField, ReframePreviewBox } from "./ReframePreview";

export interface ExportSubtitlePanelProps {
  project: Project;
  exportSettings: ExportPresetSettings;
  draftSettings: ExportPresetSettings;
  setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>;
  isAudioVisualization: boolean;
  timelineVisualControlsDisabled: boolean;
  subtitleLanguageOptions: SubtitleLanguageOption[];
  onChooseWatermarkImage: () => void;
  onChooseAudioVisualizationBackgroundImage: () => void;
}

export function ExportSubtitlePanel({
  project,
  exportSettings,
  draftSettings,
  setDraftSettings,
  isAudioVisualization,
  timelineVisualControlsDisabled,
  subtitleLanguageOptions,
  onChooseWatermarkImage,
  onChooseAudioVisualizationBackgroundImage,
}: ExportSubtitlePanelProps) {
  const DEFAULT_AUDIO_VISUALIZATION = { style: "waveform-line", theme: "classic", color: "#4a90d9", background: { type: "solid", color: "#000000" } };

  return (
    <>
          {!timelineVisualControlsDisabled && subtitleLanguageOptions.length > 0 ? (
            <SubtitleLanguageSection
              options={subtitleLanguageOptions}
              selectedLanguages={draftSettings.subtitleLanguages}
              burnInLanguage={draftSettings.subtitleBurnInLanguage}
              setDraftSettings={setDraftSettings}
            />
          ) : null}
          {!timelineVisualControlsDisabled ? (
            <ColorManagementSection
              colorManagement={exportSettings.colorManagement}
              setDraftSettings={setDraftSettings}
            />
          ) : null}
          {isAudioVisualization ? (
            <AudioVisualizationSection
              visualization={exportSettings.audioVisualization ?? DEFAULT_AUDIO_VISUALIZATION}
              setDraftSettings={setDraftSettings}
              onChooseImage={() => void chooseAudioVisualizationBackgroundImage()}
            />
          ) : null}
          {!timelineVisualControlsDisabled &&
          exportSettings.targetAspectRatio &&
          exportSettings.targetAspectRatio !== 'source' ? (
            <div className="grid gap-3 rounded-md border border-line p-3 md:grid-cols-[1fr_1fr_160px]">
              <ReframeOffsetField
                label={t.fields.reframeOffsetX}
                value={exportSettings.reframeOffsetX ?? 0}
                axis="x"
                setDraftSettings={setDraftSettings}
              />
              <ReframeOffsetField
                label={t.fields.reframeOffsetY}
                value={exportSettings.reframeOffsetY ?? 0}
                axis="y"
                setDraftSettings={setDraftSettings}
              />
              <ReframePreviewBox
                aspect={exportSettings.targetAspectRatio}
                offsetX={exportSettings.reframeOffsetX ?? 0}
                offsetY={exportSettings.reframeOffsetY ?? 0}
              />
            </div>
          ) : null}
          {!timelineVisualControlsDisabled ? (
            <WatermarkSection
              watermark={draftSettings.watermark}
              setDraftSettings={setDraftSettings}
              onChooseImage={() => void chooseWatermarkImage()}
            />
          ) : null}
          {!timelineVisualControlsDisabled ? (
            <MonitoringSection
              timecodeBurnIn={draftSettings.timecodeBurnIn}
              slate={draftSettings.slate}
              setDraftSettings={setDraftSettings}
            />
          ) : null}

    </>
  );
}
