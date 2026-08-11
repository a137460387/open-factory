import type {ExportState} from '../hooks/useExportState';
import type {ExportActions} from '../hooks/useExportActions';
import {Cloud, CloudDownload, Download, FolderOpen, Loader2, Save, Trash2, Upload} from 'lucide-react';
import {zhCN} from '../../i18n/strings';
import {TARGET_ASPECT_RATIOS, PLATFORM_LIMITS, BUILTIN_BROADCAST_SPECS} from '@open-factory/editor-core';
import {EXPORT_COMPLETION_ACTIONS, normalizeExportCompletionAction} from '../export-background';
import {SUBTITLE_FORMATS, DEFAULT_AUDIO_VISUALIZATION, updateNumberSetting, updateStringSetting, updateOutputMode, updateFormat, updateSubtitleMode, updateSubtitleFormat, updateExportSidecarSubtitle, updateScaleMode, updateTargetAspectRatio, updateHardwareEncoding} from '../lib/exportSettingsHelpers';
import {ExportCostEstimatePanel} from './ExportCostEstimatePanel';
import {ExportOptimizationPanel} from './ExportOptimizationPanel';
import {PresetNumberField, PresetFpsField, PresetTextField, PresetSelectField, PresetCheckboxField} from './PresetFields';
import {HardwareEncoderSettingsPanel} from './HardwareEncoderSettingsPanel';
import {MasterProcessingSection} from './MasterProcessingSection';
import {SubtitleLanguageSection} from './SubtitleLanguageSection';
import {ColorManagementSection} from './ColorManagementSection';
import {AudioVisualizationSection} from './AudioVisualizationSection';
import {MonitoringSection, PostExportScriptSection} from './MonitoringAndPostScript';
import {WatermarkSection} from './WatermarkSection';
import {AIExportSuggestionPanel} from './AIExportSuggestionPanel';
import {ReframeOffsetField, ReframePreviewBox} from './ReframePreview';
import {ExportUploadSection} from './ExportUploadSection';
import {AILoudnessSuggestionSection} from '../AILoudnessSuggestionSection';
import {InfoRow} from '../export-utils';
import {formatExportWarning} from '../export-utils';

interface ExportConfigProps {
  state: ExportState;
  actions: ExportActions;
}

export function ExportConfig({ state, actions }: ExportConfigProps) {
  const {
    t,
    project,
    initialPreset,
    selectedClipIds,
    inPoint,
    outPoint,
    onClose,
    onCompleted,
    onRelinkMissing,
    // State
    complianceOpen,
    setComplianceOpen,
    selectedSpecId,
    setSelectedSpecId,
    complianceResults,
    outputPath,
    setOutputPath,
    capabilities,
    availableHwEncoders,
    error,
    setError,
    presets,
    setPresets,
    presetId,
    setPresetId,
    platformFitTarget,
    setPlatformFitTarget,
    platformFitCustomSeconds,
    setPlatformFitCustomSeconds,
    draftSettings,
    setDraftSettings,
    exportRangeMode,
    setExportRangeMode,
    exportMode,
    setExportMode,
    customPresetName,
    setCustomPresetName,
    batchOutputPaths,
    setBatchOutputPaths,
    priority,
    setPriority,
    scheduleEnabled,
    setScheduleEnabled,
    scheduledStartInput,
    setScheduledStartInput,
    completionAction,
    setCompletionAction,
    exportBackgroundSettings,
    exportOptimizationSettings,
    exportUploadSettings,
    exportUploadPassword,
    exportPresetSyncSettings,
    exportPresetSyncPassword,
    presetSyncState,
    warmupStatus,
    disableRecommendations,
    recommendations,
    // Computed
    selectedPreset,
    exportSettings,
    isAudioVisualization,
    isAudioOnly,
    timelineVisualControlsDisabled,
    subtitleLanguageOptions,
    loudnessNormalizationEligible,
    estimatedSize,
    exportCostEstimate,
    exportOptimizationSuggestions,
    exportCostHistoryError,
    historyCostSamples,
    hardwareEncodingEligible,
    hardwareEncodingRequested,
    progressiveExportEnabled,
    setProgressiveExportEnabled,
    progressiveExportSupported,
    formatOptions,
    spatialDenoiseClipCount,
    activeExportRanges,
    rangeModeAvailable,
    renderFarmEnabled,
    setRenderFarmEnabled,
    renderFarmInstances,
    setRenderFarmInstances,
    suggestedRenderFarmInstances,
    // Store
    history,
  } = state;

  // Helper functions
  function choosePath() {
    actions.choosePath();
  }

  function chooseWatermarkImage() {
    actions.chooseWatermarkImage();
  }

  function chooseAudioVisualizationBackgroundImage() {
    actions.chooseAudioVisualizationBackgroundImage();
  }

  return (
    <>
      {/* Broadcast Compliance */}
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
                onClick={actions.runComplianceCheck}
                data-testid="compliance-check-button"
              >
                Check
              </button>
              {complianceResults.some((r) => r.level === 'fail' && r.autoFix) ? (
                <button
                  className="rounded bg-amber-500 px-3 py-1 text-xs font-medium text-white hover:bg-amber-600"
                  type="button"
                  onClick={actions.applyComplianceFix}
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

      {/* Main config area */}
      <div className="max-h-[78vh] space-y-4 overflow-y-auto p-4 text-sm">
        {/* Output path */}
        <div className="grid grid-cols-[110px_1fr_auto] items-center gap-2">
          <label className="text-xs font-medium text-slate-600">{t.output}</label>
          <input
            className="min-w-0 rounded-md border border-line px-2 py-1.5"
            value={outputPath}
            onChange={(event) => setOutputPath(event.target.value)}
            data-testid="export-output-path"
          />
          <button
            className="rounded-md border border-line p-2 hover:bg-panel"
            title={t.chooseOutputPath}
            onClick={() => void choosePath()}
          >
            <FolderOpen size={16} />
          </button>
        </div>

        {/* Export mode tabs */}
        <div className="grid grid-cols-[110px_1fr] items-center gap-2">
          <label className="text-xs font-medium text-slate-600">{t.mode.title}</label>
          <div
            className="inline-flex w-fit rounded-md border border-line bg-panel p-1"
            data-testid="export-mode-tabs"
          >
            {(['single', 'version-batch', 'sequence-batch', 'codec-compare', 'pipeline', 'stem'] as const).map(
              (mode) => (
                <button
                  key={mode}
                  type="button"
                  className={`rounded px-3 py-1.5 text-xs font-semibold ${exportMode === mode ? 'bg-white text-ink shadow-sm' : 'text-slate-600 hover:bg-white/70'}`}
                  data-testid={`export-mode-${mode}-tab`}
                  onClick={() => setExportMode(mode)}
                >
                  {t.mode.options[mode]}
                </button>
              ),
            )}
          </div>
        </div>

        {/* Range selector */}
        <div className="grid grid-cols-[110px_1fr] items-center gap-2">
          <label className="text-xs font-medium text-slate-600">{t.range.title}</label>
          <div className="space-y-1">
            <select
              className="w-full rounded-md border border-line px-2 py-1.5"
              value={exportRangeMode}
              onChange={(event) => setExportRangeMode(event.target.value as typeof exportRangeMode)}
              data-testid="export-range-select"
            >
              {(['all', 'in-out', 'selected-clips'] as const).map((mode) => (
                <option key={mode} value={mode} disabled={!rangeModeAvailable[mode]}>
                  {t.range.options[mode]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Platform fit */}
        <div className="grid grid-cols-[110px_1fr_auto] items-center gap-2">
          <label className="pt-1.5 text-xs font-medium text-slate-600">{zhCN.preview.platformFitTitle}</label>
          <select
            className="w-full rounded-md border border-line px-2 py-1.5"
            value={platformFitTarget}
            onChange={(event) => {
              const val = event.target.value;
              setPlatformFitTarget(val);
              if (val !== 'custom' && val !== '') {
                setPlatformFitCustomSeconds(PLATFORM_LIMITS[val as keyof typeof PLATFORM_LIMITS] ?? 60);
              }
            }}
            data-testid="platform-fit-select"
          >
            <option value="">{'不限制'}</option>
            <option value="tiktok">{zhCN.preview.platformFitTikTok}</option>
            <option value="reels">{zhCN.preview.platformFitReels}</option>
            <option value="shorts">{zhCN.preview.platformFitShorts}</option>
            <option value="custom">{zhCN.preview.platformFitCustom}</option>
          </select>
          {platformFitTarget === 'custom' ? (
            <input
              type="number"
              className="w-20 rounded-md border border-line px-2 py-1.5 text-xs"
              min={5}
              max={600}
              value={platformFitCustomSeconds}
              onChange={(event) => setPlatformFitCustomSeconds(Number(event.target.value) || 60)}
              data-testid="platform-fit-custom-seconds"
            />
          ) : null}
          {platformFitTarget ? (
            <button
              className="rounded-md border border-line bg-white px-2 py-1.5 text-xs font-medium hover:bg-panel"
              type="button"
              data-testid="platform-fit-apply"
              onClick={actions.applyPlatformFit}
            >
              {zhCN.preview.platformFitApply}
            </button>
          ) : null}
        </div>

        {/* Platform fit removed segments */}
        {project.platformFitSuggestion && project.platformFitSuggestion.removedSegments.length > 0 ? (
          <div
            className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs"
            data-testid="platform-fit-removed-list"
          >
            <span className="font-medium text-amber-700">
              {zhCN.preview.platformFitTitle}
              {'：'}
            </span>
            <span className="text-amber-600">
              {project.platformFitSuggestion.removedSegments.length}
              {' 个片段将被裁剪'}
            </span>
            {project.platformFitSuggestion.removedSegments.map((seg) => (
              <button
                key={seg.clipId}
                className="ml-2 inline-flex items-center rounded border border-line px-1.5 py-0.5 text-[10px] font-medium text-slate-600 hover:bg-panel"
                type="button"
                data-testid={`platform-fit-restore-${seg.clipId}`}
                onClick={() => actions.restorePlatformFitClip(seg.clipId)}
              >
                {zhCN.preview.platformFitRestore}
              </button>
            ))}
          </div>
        ) : null}

        {/* Preset selector */}
        <div className="grid grid-cols-[110px_1fr_auto] gap-2">
          <label className="pt-1.5 text-xs font-medium text-slate-600">{t.preset}</label>
          <div>
            <select
              className="w-full rounded-md border border-line px-2 py-1.5"
              value={presetId}
              onChange={(event) => setPresetId(event.target.value)}
              data-testid="export-preset-select"
            >
              {recommendations.length > 0 ? (
                <optgroup label={zhCN.exportRecommendations.groupLabel} data-testid="export-recommendation-group">
                  {recommendations.map((rec) => {
                    const preset = presets.find((p) => p.id === rec.presetId);
                    if (!preset) return null;
                    return (
                      <option
                        key={`rec-${preset.id}`}
                        value={preset.id}
                        data-testid={`export-recommended-${preset.id}`}
                      >
                        {zhCN.exportRecommendations.recommended} {preset.name}
                      </option>
                    );
                  })}
                </optgroup>
              ) : null}
              {presets.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.name}
                </option>
              ))}
            </select>
            <div className="mt-1 text-[11px] text-slate-500">{selectedPreset.description}</div>
            {(() => {
              const rec = recommendations.find((r) => r.presetId === presetId);
              if (!rec) return null;
              return (
                <div className="mt-1 text-[11px] text-emerald-600" data-testid="export-recommendation-reason">
                  {zhCN.exportRecommendations.recommended}：{rec.reasons.map((r) => r.label).join('、')}
                </div>
              );
            })()}
            {exportPresetSyncSettings.lastSyncedAt ? (
              <div className="mt-1 text-[11px] text-slate-500" data-testid="export-preset-cloud-sync-last-time">
                {t.cloudSyncStatus(exportPresetSyncSettings.lastSyncedAt)}
              </div>
            ) : null}
            {presetSyncState.message ? (
              <div
                className={`mt-1 text-[11px] ${presetSyncState.status === 'error' ? 'text-amber-700' : 'text-emerald-700'}`}
                data-testid="export-preset-cloud-sync-status"
              >
                {presetSyncState.message}
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <button
              className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-panel"
              data-testid="export-preset-package-export-button"
              type="button"
              onClick={() => void actions.exportSelectedPresetPackage()}
            >
              <Download size={13} />
              {t.exportPresetPackage}
            </button>
            <button
              className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-panel"
              data-testid="export-preset-package-import-button"
              type="button"
              onClick={() => void actions.importPresetPackageFromFile()}
            >
              <Upload size={13} />
              {t.importPresetPackage}
            </button>
            <button
              className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-panel"
              data-testid="export-preset-package-official-button"
              type="button"
              onClick={() => void actions.importOfficialPresetPackage()}
            >
              <CloudDownload size={13} />
              {t.officialPresetPackage}
            </button>
            <button
              className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-panel disabled:cursor-not-allowed disabled:opacity-45"
              data-testid="export-preset-cloud-sync-button"
              type="button"
              disabled={presetSyncState.status === 'running' || !exportPresetSyncSettings.url}
              onClick={() => void actions.syncPresetPackageFromCloud()}
            >
              {presetSyncState.status === 'running' ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Cloud size={13} />
              )}
              {presetSyncState.status === 'running' ? t.cloudSyncRunning : t.cloudSyncPresetPackage}
            </button>
            <button
              className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-panel disabled:cursor-not-allowed disabled:opacity-45"
              disabled={selectedPreset.builtin}
              data-testid="export-delete-preset-button"
              type="button"
              onClick={() => void actions.deletePreset()}
            >
              <Trash2 size={13} />
              {t.delete}
            </button>
          </div>
        </div>

        {/* Save as preset */}
        <div className="grid grid-cols-[110px_1fr_auto] items-center gap-2">
          <label className="text-xs font-medium text-slate-600">{t.saveAs}</label>
          <input
            className="min-w-0 rounded-md border border-line px-2 py-1.5"
            placeholder={t.customPresetName}
            value={customPresetName}
            onChange={(event) => setCustomPresetName(event.target.value)}
            data-testid="export-preset-name-input"
          />
          <button
            className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-panel"
            data-testid="export-save-preset-button"
            onClick={() => void actions.savePreset()}
          >
            <Save size={13} />
            {t.save}
          </button>
        </div>

        {/* Settings grid */}
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

        {/* Master processing */}
        <MasterProcessingSection
          masterProcessing={exportSettings.masterProcessing}
          loudnessNormalization={exportSettings.loudnessNormalization ?? 'off'}
          loudnessNormalizationEligible={loudnessNormalizationEligible}
          setDraftSettings={setDraftSettings}
        />

        {/* AI loudness suggestion */}
        <AILoudnessSuggestionSection project={project} />

        {/* Subtitle language */}
        {!timelineVisualControlsDisabled && subtitleLanguageOptions.length > 0 ? (
          <SubtitleLanguageSection
            options={subtitleLanguageOptions}
            selectedLanguages={draftSettings.subtitleLanguages}
            burnInLanguage={draftSettings.subtitleBurnInLanguage}
            setDraftSettings={setDraftSettings}
          />
        ) : null}

        {/* Color management */}
        {!timelineVisualControlsDisabled ? (
          <ColorManagementSection
            colorManagement={exportSettings.colorManagement}
            setDraftSettings={setDraftSettings}
          />
        ) : null}

        {/* Audio visualization */}
        {isAudioVisualization ? (
          <AudioVisualizationSection
            visualization={exportSettings.audioVisualization ?? DEFAULT_AUDIO_VISUALIZATION}
            setDraftSettings={setDraftSettings}
            onChooseImage={() => void chooseAudioVisualizationBackgroundImage()}
          />
        ) : null}

        {/* Reframe offset */}
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

        {/* Watermark */}
        {!timelineVisualControlsDisabled ? (
          <WatermarkSection
            watermark={draftSettings.watermark}
            setDraftSettings={setDraftSettings}
            onChooseImage={() => void chooseWatermarkImage()}
          />
        ) : null}

        {/* Monitoring */}
        {!timelineVisualControlsDisabled ? (
          <MonitoringSection
            timecodeBurnIn={draftSettings.timecodeBurnIn}
            slate={draftSettings.slate}
            setDraftSettings={setDraftSettings}
          />
        ) : null}

        {/* Post-export script */}
        <PostExportScriptSection
          script={draftSettings.postExportScript}
          acknowledged={exportBackgroundSettings.postExportScriptAcknowledged}
          setDraftSettings={setDraftSettings}
          onAcknowledgedChange={(checked) => void actions.setPostExportScriptAcknowledged(checked)}
        />

        {/* Upload settings */}
        <ExportUploadSection
          settings={exportUploadSettings}
          password={exportUploadPassword}
          onSettingsChange={(nextSettings) => void actions.updateExportUploadSettings(nextSettings)}
          onPasswordChange={(password) => void actions.updateExportUploadPassword(password)}
          onChooseDirectory={() => void actions.chooseExportUploadDirectory()}
        />

        {/* Info rows */}
        <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 md:grid-cols-5">
          <InfoRow
            label={t.info.resolution}
            value={
              isAudioOnly
                ? zhCN.common.audioOnly
                : `${exportSettings.width ?? project.settings.width} x ${exportSettings.height ?? project.settings.height}`
            }
          />
          <InfoRow
            label={t.info.fps}
            value={isAudioOnly ? zhCN.common.audioOnly : String(exportSettings.fps ?? project.settings.fps)}
          />
          <InfoRow label={t.info.format} value={exportSettings.format ?? 'mp4'} />
          <InfoRow
            label={t.info.bitrate}
            value={`${isAudioOnly ? zhCN.common.noVideo : exportSettings.videoBitrate || zhCN.common.auto} / ${exportSettings.audioBitrate || zhCN.common.auto}`}
          />
          <InfoRow
            label={t.info.videoCodec}
            value={isAudioOnly ? zhCN.common.none : (exportSettings.videoCodec ?? 'libx264')}
          />
          <InfoRow label={t.info.audioCodec} value={exportSettings.audioCodec ?? 'aac'} />
          <InfoRow label={t.info.estimatedSize} value={estimatedSize} />
          <InfoRow
            label={t.info.ffmpeg}
            value={capabilities?.available ? (capabilities.version ?? zhCN.common.available) : zhCN.common.missing}
            tone={capabilities?.available ? 'ok' : 'bad'}
          />
          <InfoRow
            label={t.info.drawtext}
            value={
              capabilities?.hasDrawtext && capabilities.hasLibfreetype
                ? zhCN.common.available
                : zhCN.common.unavailable
            }
            tone={capabilities?.hasDrawtext && capabilities.hasLibfreetype ? 'ok' : 'warn'}
          />
          <InfoRow
            label={t.info.hardwareEncoder}
            value={
              capabilities?.hardwareEncoderAvailable && capabilities.hardwareEncoder
                ? capabilities.hardwareEncoder
                : zhCN.common.unavailable
            }
            tone={capabilities?.hardwareEncoderAvailable ? 'ok' : 'warn'}
          />
        </div>

        {/* Cost estimate */}
        <ExportCostEstimatePanel
          estimate={exportCostEstimate}
          historyErrorPercent={exportCostHistoryError}
          historySamples={historyCostSamples}
        />

        {/* Optimization suggestions */}
        <ExportOptimizationPanel
          suggestions={exportOptimizationSuggestions}
          onApply={actions.applyOptimizationSuggestion}
          onDismiss={(suggestion) => void actions.dismissOptimizationSuggestion(suggestion)}
        />

        {/* AI export suggestion */}
        <AIExportSuggestionPanel
          project={project}
          draftSettings={draftSettings}
          setDraftSettings={setDraftSettings}
        />

        {/* Batch output paths（仅 single 模式）。
            拆分前（bd315fd6^）mode 区是三目链：pipeline/codec-compare/version-batch/
            sequence-batch/stem 各有分支，else 分支即本 textarea；五个非 single 模式
            均有显式分支，故 else 等价于 exportMode === 'single'。拆分提交 bd315fd6
            丢失该 JSX，batchOutputPaths 沦为孤儿 state（后端 useExportActions 换行
            拆分多路径入队逻辑一直存活），导致 export.spec:3/:81 多路径只入队 1 任务。
            此处按拆分前原样接回。 */}
        {exportMode === 'single' ? (
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
        ) : null}

        {/* Priority */}
        <div className="grid grid-cols-[110px_220px] gap-2">
          <label className="pt-1.5 text-xs font-medium text-slate-600">{t.priority}</label>
          <select
            className="rounded-md border border-line px-2 py-1.5 text-sm"
            value={priority}
            onChange={(event) => setPriority(event.target.value as typeof priority)}
            data-testid="export-priority-select"
          >
            {(['high', 'normal', 'low'] as const).map((value) => (
              <option key={value} value={value}>
                {t.priorityOptions[value]}
              </option>
            ))}
          </select>
        </div>

        {/* Schedule */}
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

        {/* Completion action */}
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

        {/* Progressive export */}
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

        {/* Render farm */}
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

        {/* Warnings */}
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
      </div>
    </>
  );
}
