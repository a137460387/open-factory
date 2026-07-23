import type { Dispatch, SetStateAction } from "react";
import type { FfmpegCapabilities, Project, HardwareEncoderInfo } from "@open-factory/editor-core";
import {
  TARGET_ASPECT_RATIOS,
  BUILTIN_BROADCAST_SPECS,
  checkCompliance,
  buildComplianceFix,
  type ExportComplianceParams,
  type ComplianceCheckResult,
  getTimelinePlaybackDuration,
} from "@open-factory/editor-core";
import { AILoudnessSuggestionSection } from "../AILoudnessSuggestionSection";
import { sendNotification } from "../../lib/tauri-bridge";
import { zhCN } from "../../i18n/strings";
import type { ExportPresetSettings } from "../export-presets";
import {
  SUBTITLE_FORMATS,
  updateNumberSetting,
  updateStringSetting,
  updateOutputMode,
  updateFormat,
  updateSubtitleMode,
  updateSubtitleFormat,
  updateExportSidecarSubtitle,
  updateScaleMode,
  updateTargetAspectRatio,
  updateHardwareEncoding,
  supportsLoudnessNormalization,
} from "../lib/exportSettingsHelpers";
import { HardwareEncoderSettingsPanel } from "./HardwareEncoderSettingsPanel";
import { MasterProcessingSection } from "./MasterProcessingSection";
import {
  PresetNumberField,
  PresetFpsField,
  PresetTextField,
  PresetSelectField,
  PresetCheckboxField,
} from "./PresetFields";

export interface ExportFormatPanelProps {
  project: Project;
  draftSettings: ExportPresetSettings;
  exportSettings: ExportPresetSettings;
  setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>;
  hardwareEncodingRequested: boolean;
  hardwareEncodingEligible: boolean;
  availableHwEncoders: HardwareEncoderInfo[];
  isAudioOnly: boolean;
  timelineVisualControlsDisabled: boolean;
  formatOptions: string[];
  complianceOpen: boolean;
  setComplianceOpen: Dispatch<SetStateAction<boolean>>;
  selectedSpecId: string;
  setSelectedSpecId: Dispatch<SetStateAction<string>>;
  complianceResults: ComplianceCheckResult[];
  setComplianceResults: Dispatch<SetStateAction<ComplianceCheckResult[]>>;
}

export function ExportFormatPanel(props: ExportFormatPanelProps) {
  const {
    project, draftSettings, exportSettings, setDraftSettings,
    hardwareEncodingRequested, hardwareEncodingEligible, availableHwEncoders,
    isAudioOnly, timelineVisualControlsDisabled, formatOptions,
    complianceOpen, setComplianceOpen, selectedSpecId, setSelectedSpecId,
    complianceResults, setComplianceResults,
  } = props;
  const t = zhCN.exportDialog;
  const loudnessNormalizationEligible = supportsLoudnessNormalization(
    exportSettings.format ?? "mp4",
    exportSettings.outputMode,
  );


function runComplianceCheck() {
  const spec = BUILTIN_BROADCAST_SPECS.find((s) => s.id === selectedSpecId);
  if (!spec) return;
  const parseBitrate = (v: string | null | undefined, unit: "mbps" | "kbps"): number | undefined => {
    if (!v) return undefined;
    const m = v.trim().match(/^(\d+(?:\.\d+)?)\s*(k|m)?b?ps?$/i);
    if (!m) return undefined;
    const n = parseFloat(m[1]);
    const prefix = (m[2] ?? "").toLowerCase();
    if (unit === "mbps") return prefix === "k" ? n / 1000 : n;
    return prefix === "m" ? n * 1000 : n;
  };
  const w = draftSettings.width ?? project.settings.width;
  const h = draftSettings.height ?? project.settings.height;
  const params: ExportComplianceParams = {
    videoCodec: exportSettings.videoCodec,
    videoBitrateMbps: parseBitrate(draftSettings.videoBitrate, "mbps"),
    width: w,
    height: h,
    fps: draftSettings.fps ?? project.settings.fps,
    audioCodec: exportSettings.audioCodec,
    audioBitrateKbps: parseBitrate(draftSettings.audioBitrate, "kbps"),
    subtitleFormat: exportSettings.subtitleFormat,
    durationSec: getTimelinePlaybackDuration(project.timeline),
  };
  setComplianceResults(checkCompliance(spec, params));
}

function applyComplianceFix() {
  const spec = BUILTIN_BROADCAST_SPECS.find((s) => s.id === selectedSpecId);
  if (!spec || complianceResults.length === 0) return;
  const fix = buildComplianceFix(spec, complianceResults);
  if (fix.loudnorm) {
    setDraftSettings((current) => ({ ...current, loudnessNormalization: "ebu" }));
    sendNotification("Loudnorm", "Target: " + fix.loudnorm!.targetLufs + " LUFS");
  }
}

  return (
    <>
        <details className="border-b border-line" data-testid="compliance-checker">
          <summary
            className="flex cursor-pointer items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-panel"
            data-testid="compliance-checker-toggle"
            onClick={(e) => {
              e.preventDefault();
              setComplianceOpen(!complianceOpen);
            }}
          >
            {'Broadcast Compliance'}
          </summary>
          {complianceOpen ? (
            <div className="space-y-3 px-4 py-3" data-testid="compliance-checker-content">
              <div className="flex items-center gap-2">
                <select
                  className="rounded border border-line px-2 py-1 text-xs"
                  value={selectedSpecId}
                  onChange={(e) => setSelectedSpecId(e.target.value)}
                  data-testid="compliance-spec-selector"
                >
                  {BUILTIN_BROADCAST_SPECS.map((spec) => (
                    <option key={spec.id} value={spec.id}>
                      {spec.name}
                    </option>
                  ))}
                </select>
                <button
                  className="rounded bg-brand px-3 py-1 text-xs font-medium text-white hover:bg-brand/90"
                  type="button"
                  onClick={runComplianceCheck}
                  data-testid="compliance-check-button"
                >
                  Check
                </button>
                {complianceResults.some((r) => r.level === 'fail' && r.autoFix) ? (
                  <button
                    className="rounded bg-amber-500 px-3 py-1 text-xs font-medium text-white hover:bg-amber-600"
                    type="button"
                    onClick={applyComplianceFix}
                    data-testid="compliance-auto-fix-button"
                  >
                    Auto Fix
                  </button>
                ) : null}
              </div>
              {complianceResults.length > 0 ? (
                <div className="space-y-1" data-testid="compliance-results">
                  {complianceResults.map((result, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs" data-testid={`compliance-result-${i}`}>
                      <span
                        className={
                          result.level === 'pass'
                            ? 'text-emerald-600'
                            : result.level === 'warn'
                              ? 'text-amber-500'
                              : 'text-rose-600'
                        }
                      >
                        {result.level === 'pass' ? '✓' : result.level === 'warn' ? '⚠' : '✗'}
                      </span>
                      <span className="font-medium">{result.name}</span>
                      <span className="text-slate-500">{result.message}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </details>
          <div className="grid grid-cols-2 gap-3 rounded-md border border-line p-3 md:grid-cols-4">
            <PresetSelectField
              label={t.fields.outputMode}
              value={exportSettings.outputMode ?? 'video'}
              onChange={(value) => updateOutputMode(setDraftSettings, value)}
              testId="export-output-mode-select"
              options={['video', 'audio', 'audio-visualization']}
            />
            <PresetNumberField
              label={t.fields.width}
              value={draftSettings.width}
              disabled={isAudioOnly}
              onChange={(value) => updateNumberSetting(setDraftSettings, 'width', value)}
              testId="export-width-input"
            />
            <PresetNumberField
              label={t.fields.height}
              value={draftSettings.height}
              disabled={isAudioOnly}
              onChange={(value) => updateNumberSetting(setDraftSettings, 'height', value)}
              testId="export-height-input"
            />
            <PresetFpsField
              label={t.fields.fps}
              value={draftSettings.fps ?? project.settings.fps}
              disabled={isAudioOnly}
              onChange={(value) => updateNumberSetting(setDraftSettings, 'fps', value)}
              testId="export-fps-select"
            />
            <PresetSelectField
              label={t.fields.format}
              value={exportSettings.format ?? 'mp4'}
              onChange={(value) => updateFormat(setDraftSettings, value)}
              testId="export-format-select"
              options={formatOptions}
            />
            <PresetTextField
              label={t.fields.videoBitrate}
              value={draftSettings.videoBitrate ?? ''}
              disabled={isAudioOnly}
              onChange={(value) => updateStringSetting(setDraftSettings, 'videoBitrate', value)}
              testId="export-video-bitrate-input"
            />
            <PresetTextField
              label={t.fields.audioBitrate}
              value={draftSettings.audioBitrate ?? ''}
              onChange={(value) => updateStringSetting(setDraftSettings, 'audioBitrate', value)}
              testId="export-audio-bitrate-input"
            />
            <PresetSelectField
              label={t.fields.subtitles}
              value={draftSettings.subtitleMode ?? 'default'}
              disabled={timelineVisualControlsDisabled}
              onChange={(value) => updateSubtitleMode(setDraftSettings, value)}
              testId="export-subtitle-mode-select"
              options={['default', 'burn-in', 'soft-sub']}
            />
            <PresetSelectField
              label={t.fields.subtitleFormat}
              value={exportSettings.subtitleFormat ?? 'srt'}
              disabled={timelineVisualControlsDisabled}
              onChange={(value) => updateSubtitleFormat(setDraftSettings, value)}
              testId="export-subtitle-format-select"
              options={SUBTITLE_FORMATS}
            />
            <PresetCheckboxField
              label={t.fields.exportSidecarSubtitle}
              checked={exportSettings.exportSidecarSubtitle === true}
              disabled={timelineVisualControlsDisabled}
              onChange={(checked) => updateExportSidecarSubtitle(setDraftSettings, checked)}
              testId="export-subtitle-sidecar-toggle"
            />
            <PresetSelectField
              label={t.fields.scale}
              value={draftSettings.scaleMode ?? 'none'}
              disabled={timelineVisualControlsDisabled}
              onChange={(value) => updateScaleMode(setDraftSettings, value)}
              testId="export-scale-mode-select"
              options={['none', 'fit']}
            />
            <PresetSelectField
              label={t.fields.targetAspectRatio}
              value={exportSettings.targetAspectRatio ?? 'source'}
              disabled={timelineVisualControlsDisabled}
              onChange={(value) => updateTargetAspectRatio(setDraftSettings, value)}
              testId="export-target-aspect-select"
              options={[...TARGET_ASPECT_RATIOS]}
            />
            <PresetCheckboxField
              label={t.fields.hardwareEncoding}
              checked={hardwareEncodingRequested}
              disabled={!hardwareEncodingEligible}
              onChange={(checked) => updateHardwareEncoding(setDraftSettings, checked)}
              testId="export-hardware-encoding-toggle"
            />
            {hardwareEncodingRequested && availableHwEncoders.length > 0 ? (
              <HardwareEncoderSettingsPanel
                encoders={availableHwEncoders}
                settings={exportSettings.hardwareEncoderSettings}
                setDraftSettings={setDraftSettings}
                disabled={!hardwareEncodingEligible}
              />
            ) : null}
          </div>
          <MasterProcessingSection
            masterProcessing={exportSettings.masterProcessing}
            loudnessNormalization={exportSettings.loudnessNormalization ?? 'off'}
            loudnessNormalizationEligible={loudnessNormalizationEligible}
            setDraftSettings={setDraftSettings}
          />
    </>
  );
}
