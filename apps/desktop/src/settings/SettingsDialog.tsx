import {logger} from '@open-factory/editor-core/utils';
import {useEffect} from 'react';
import {X} from 'lucide-react';
import {BUILTIN_TIMELINE_SCRIPTS} from '@open-factory/editor-core';
import {zhCN} from '../i18n/strings';
import {isTauriRuntime} from '../lib/tauri';
import {resolveTheme} from '../theme/theme';
import {getCurrentThemeSettings} from '../theme/useTheme';
import {AIServicesSettingsPanel} from './AIServicesSettingsPanel';
import {AppearanceSettingsPanel} from './AppearanceSettingsPanel';
import {AutomationSettingsPanel} from './AutomationSettingsPanel';
import {BackupSettingsPanel} from './BackupSettingsPanel';
import {EffectPresetCommunityPanel} from './EffectPresetPanel';
import {ExportPresetSyncSettingsPanel} from './ExportPresetSyncPanel';
import {HardwareAccelerationSettingsPanel} from './HardwareAccelerationSettingsPanel';
import {GeneralSettingsPanel} from './GeneralSettingsPanel';
import {LutLibraryPanel} from './LutLibraryPanel';
import {ShortcutMacrosPanel} from './ShortcutMacrosPanel';
import {GesturePracticePanel} from '../components/GestureControl/GestureTutorial';
import {LocalModelsSettingsPanel} from './LocalModelsPanel';
import {PluginsSettingsPanel} from './PluginsSettingsPanel';
import {PresetMarketPanel} from './PresetMarketPanel';
import {ProxySettingsPanel} from './ProxySettingsPanel';
import {TaskMonitorSettingsPanel} from './TaskMonitorSettingsPanel';
import {TimelineScriptsSettingsPanel} from './TimelineScriptsSettingsPanel';
import {TranslationSettingsPanel} from './TranslationSettingsPanel';
import {DisplaySettingsPanel} from './DisplaySettingsPanel';
import {SettingsTabNav} from './SettingsTabNav';
import {useSettingsGeneralState} from './useSettingsGeneralState';
import {useSettingsExportState} from './useSettingsExportState';
import type {SettingsDialogProps} from './settingsTypes';

export function SettingsDialog({
  open,
  project,
  selectedClip,
  shortcutBindings,
  macros,
  previewPerformance,
  timelineInteractionSettings,
  onShortcutBindingsChange,
  onMacrosChange,
  onExecuteMacro,
  onPreviewPerformanceChange,
  onPreviewSkipFramesChange,
  onTimelineInteractionSettingsChange,
  onDeleteProxies,
  onRegenerateProxies,
  onMigrateProxies,
  onClose,
}: SettingsDialogProps) {
  const t = zhCN.settings;

  const general = useSettingsGeneralState(project, selectedClip, onClose);
  const exportState = useSettingsExportState();

  useEffect(() => {
    if (!open) {
      return;
    }
    void exportState.loadBackupSettings();
    void exportState.loadExportPresetSyncSettings();
    void general.loadPresetMarketPanel();
    void general.loadEffectPresetLibraryPanel();
    void general.loadTimelineScriptsPanel();
    void exportState.loadExportBackgroundSettings();
    void exportState.loadExportQualityAssuranceSettings();
    void exportState.loadExportRules();
    void exportState.loadAutomationRules();
    void general.loadCollaborationIdentity();
    void general.loadLocalCoediting();
    void general.loadDisplaySettings();
    void general.loadUpdateSettings();
    void general.loadLocalModelsSettings();
    void general.readTouchOptimizationSettings()
      .then(general.setTouchOptimizationSettings)
      .catch((error) => logger.warn('[Settings] Unable to load touch optimization', error));
    void general.loadTranslationApiKey();
    void general.loadCurrentVersion();
    general.hydrateThemeForm(getCurrentThemeSettings());
    general.showCurrentPlugins();
    void general.refreshPluginCatalog();
    return () => general.setPreviewTimeline(undefined);
  }, [general.loadTranslationApiKey, open, general.setPreviewTimeline]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" data-testid="settings-dialog">
      <div className="flex max-h-[86vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-white shadow-soft">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div>
            <h2 className="text-base font-semibold text-ink">{t.title}</h2>
            <div className="text-xs text-slate-500">{t.subtitle}</div>
          </div>
          <button
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-panel"
            type="button"
            title={zhCN.common.close}
            aria-label={zhCN.common.close}
            data-testid="settings-close-button"
            onClick={general.close}
          >
            <X size={16} />
          </button>
        </div>
        <div className="flex min-h-0 flex-1">
          <SettingsTabNav tab={general.tab} onTabChange={general.setTab} />
          <main className="min-w-0 flex-1 overflow-y-auto p-4">
            {general.tab === 'general' ? (
              <GeneralSettingsPanel
                language={general.language}
                updateLanguage={general.updateLanguage}
                updateSettings={general.updateSettings}
                updateAppUpdateSettings={general.updateAppUpdateSettings}
                previewPerformance={previewPerformance}
                onPreviewPerformanceChange={onPreviewPerformanceChange}
                onPreviewSkipFramesChange={onPreviewSkipFramesChange}
                timelineInteractionSettings={timelineInteractionSettings}
                onTimelineInteractionSettingsChange={onTimelineInteractionSettingsChange}
                collaborationIdentity={general.collaborationIdentity}
                updateCollaborationIdentity={general.updateCollaborationIdentity}
                localCoediting={general.localCoediting}
                updateLocalCoediting={general.updateLocalCoediting}
                demucsExecutablePath={general.demucsExecutablePath}
                setDemucsExecutablePath={general.setDemucsExecutablePath}
                chooseDemucsExecutable={general.chooseDemucsExecutable}
                privacyDetectionModelPath={general.privacyDetectionModelPath}
                setPrivacyDetectionModelPath={general.setPrivacyDetectionModelPath}
                choosePrivacyDetectionModel={general.choosePrivacyDetectionModel}
                recordingSettings={general.recordingSettings}
                setRecordingSettings={general.setRecordingSettings}
                project={project}
                updateProjectFrameRate={general.updateProjectFrameRate}
                updateProjectTimecodeFormat={general.updateProjectTimecodeFormat}
                updateProjectVfrHandling={general.updateProjectVfrHandling}
                updateProjectColorPipeline={general.updateProjectColorPipeline}
                updateProjectWorkingColorSpace={general.updateProjectWorkingColorSpace}
                exportBackgroundSettings={exportState.exportBackgroundSettings}
                updateExportBackgroundSettings={exportState.updateExportBackgroundSettings}
                exportQualityAssuranceSettings={exportState.exportQualityAssuranceSettings}
                updateExportQualityAssuranceSettings={exportState.updateExportQualityAssuranceSettings}
                touchOptimizationSettings={general.touchOptimizationSettings}
                updateTouchOptimizationSettings={general.updateTouchOptimizationSettings}
                exportRules={exportState.exportRules}
                updateExportRule={exportState.updateExportRule}
                chooseExportRuleCopyDirectory={exportState.chooseExportRuleCopyDirectory}
                developerMode={general.developerMode}
                setDeveloperMode={general.setDeveloperMode}
                stressTestResult={general.stressTestResult}
                setStressTestResult={general.setStressTestResult}
                currentVersion={general.currentVersion}
                onCheckForUpdates={general.handleCheckForUpdates}
                isTauri={isTauriRuntime()}
              />
            ) : null}
            {general.tab === 'display' ? (
              <DisplaySettingsPanel
                displaySettings={general.displaySettings}
                onDisplaySettingsChange={general.updateDisplaySettings}
              />
            ) : null}
            {general.tab === 'appearance' ? (
              <AppearanceSettingsPanel
                settings={general.themeSettings}
                activeTheme={resolveTheme(general.themeSettings)}
                liveTheme={general.currentTheme}
                customName={general.customThemeName}
                customColors={general.customThemeColors}
                onThemeChange={(themeId) => void general.selectTheme(themeId)}
                onCustomNameChange={general.setCustomThemeName}
                onCustomColorChange={general.updateCustomThemeColor}
                onSaveCustom={() => void general.saveCustomTheme()}
                onDeleteCustom={() => void general.removeCustomTheme()}
              />
            ) : null}
            {general.tab === 'lut-library' ? (
              <LutLibraryPanel
                selectedClip={selectedClip}
                project={project}
              />
            ) : null}
            {general.tab === 'effect-presets' ? (
              <EffectPresetCommunityPanel
                cards={general.filteredEffectPresetCards}
                filters={general.effectPresetFilters}
                loading={general.effectPresetLoading}
                source={general.effectPresetSource}
                warning={general.effectPresetWarning}
                installingCardId={general.installingEffectPresetCardId}
                canShare={Boolean(selectedClip)}
                onFiltersChange={general.setEffectPresetFilters}
                onRefresh={() => void general.loadEffectPresetLibraryPanel()}
                onInstall={(card) => void general.installEffectPreset(card)}
                onShare={() => void general.shareSelectedEffectPreset()}
              />
            ) : null}
            {general.tab === 'shortcuts' || general.tab === 'macros' ? (
              <ShortcutMacrosPanel
                tab={general.tab as 'shortcuts' | 'macros'}
                shortcutBindings={shortcutBindings}
                onShortcutBindingsChange={onShortcutBindingsChange}
                macros={macros}
                onMacrosChange={onMacrosChange}
                onExecuteMacro={onExecuteMacro}
              />
            ) : null}
            {general.tab === 'automation' ? (
              <AutomationSettingsPanel
                rules={exportState.automationRules}
                rulesJson={exportState.automationRulesJson}
                error={exportState.automationRulesError}
                onRulesJsonChange={(value) => {
                  exportState.setAutomationRulesJson(value);
                  exportState.setAutomationRulesError(undefined);
                }}
                onSave={() => void exportState.saveAutomationRulesFromJson()}
                onToggleRule={(ruleId, enabled) => void exportState.toggleAutomationRule(ruleId, enabled)}
              />
            ) : null}
            {general.tab === 'scripts' ? (
              <TimelineScriptsSettingsPanel
                builtins={BUILTIN_TIMELINE_SCRIPTS}
                files={general.timelineScripts}
                selectedId={general.selectedTimelineScriptId}
                name={general.timelineScriptName}
                code={general.timelineScriptCode}
                path={general.timelineScriptPath}
                apiNames={general.timelineScriptApiNames}
                running={general.timelineScriptRunning}
                output={general.timelineScriptOutput}
                error={general.timelineScriptError}
                onSelectBuiltin={general.selectBuiltinTimelineScript}
                onSelectFile={general.selectTimelineScriptFile}
                onNameChange={general.setTimelineScriptName}
                onCodeChange={general.setTimelineScriptCode}
                onNew={general.createNewTimelineScript}
                onSave={() => void general.saveCurrentTimelineScript()}
                onDelete={() => void general.deleteCurrentTimelineScript()}
                onImport={() => void general.importTimelineScript()}
                onExport={() => void general.exportTimelineScript()}
                onRun={() => void general.runCurrentTimelineScript()}
              />
            ) : null}
            {general.tab === 'translation' ? (
              <TranslationSettingsPanel
                provider={general.translationProvider}
                apiKey={general.translationApiKey}
                apiKeyError={general.translationApiKeyError}
                targetLanguage={general.translationTargetLanguage}
                onProviderChange={general.setTranslationProvider}
                onApiKeyChange={general.setTranslationApiKey}
                onTargetLanguageChange={general.setTranslationTargetLanguage}
              />
            ) : null}
            {general.tab === 'local-models' ? (
              <LocalModelsSettingsPanel
                settings={general.localModelsSettings}
                statuses={general.localModelStatuses}
                onChoose={(id) => void general.chooseLocalModelFile(id)}
                onDownload={general.openLocalModelDownload}
              />
            ) : null}
            {general.tab === 'proxy' ? (
              <ProxySettingsPanel
                project={project}
                resolutionPreset={general.proxyResolutionPreset}
                triggerShortEdge={general.proxyTriggerShortEdge}
                onResolutionPresetChange={general.setProxyResolutionPreset}
                onTriggerShortEdgeChange={general.setProxyTriggerShortEdge}
                onDeleteProxies={onDeleteProxies}
                onRegenerateProxies={onRegenerateProxies}
                onMigrateProxies={onMigrateProxies}
                onReset={general.resetProxySettings}
              />
            ) : null}
            {general.tab === 'task-monitor' ? <TaskMonitorSettingsPanel /> : null}
            {general.tab === 'export-presets' ? (
              <div className="space-y-4">
                <PresetMarketPanel
                  cards={general.filteredPresetMarketCards}
                  ratings={general.presetMarketRatings}
                  filters={general.presetMarketFilters}
                  loading={general.presetMarketLoading}
                  source={general.presetMarketSource}
                  warning={general.presetMarketWarning}
                  installingCardId={general.installingPresetMarketCardId}
                  onFiltersChange={general.setPresetMarketFilters}
                  onRefresh={() => void general.loadPresetMarketPanel()}
                  onInstall={(card) => void general.installMarketPreset(card)}
                  onRate={(cardId, rating) => void general.ratePresetMarketCard(cardId, rating)}
                  onShare={() => void general.shareCustomExportPresets()}
                />
                <ExportPresetSyncSettingsPanel
                  settings={exportState.exportPresetSyncSettings}
                  password={exportState.exportPresetSyncPassword}
                  onSettingsChange={(settings) => void exportState.updateExportPresetSyncSettings(settings)}
                  onPasswordChange={(password) => void exportState.updateExportPresetSyncPassword(password)}
                />
              </div>
            ) : null}
            {general.tab === 'backup' ? (
              <BackupSettingsPanel
                settings={exportState.backupSettings}
                password={exportState.webdavPassword}
                onSettingsChange={(settings) => void exportState.updateBackupSettings(settings)}
                onChooseDirectory={() => void exportState.chooseBackupDirectory()}
                onPasswordChange={(password) => void exportState.updateWebdavPassword(password)}
              />
            ) : null}
            {general.tab === 'plugins' ? (
              <PluginsSettingsPanel
                registry={general.pluginRegistry}
                loading={general.pluginsLoading}
                error={general.pluginsError}
                catalog={general.pluginCatalog}
                catalogLoading={general.pluginCatalogLoading}
                catalogError={general.pluginCatalogError}
                installingPluginId={general.installingPluginId}
                onRefresh={() => void general.refreshPlugins()}
                onRefreshCatalog={() => void general.refreshPluginCatalog()}
                onInstallCatalogPlugin={(entry) => void general.installMarketPlugin(entry)}
                onInstallFromFile={() => void general.installPluginFile()}
                onTogglePlugin={(entry) => void general.togglePlugin(entry)}
                onUninstallPlugin={(entry) => void general.removePlugin(entry)}
              />
            ) : null}
            {general.tab === 'ai-services' ? <AIServicesSettingsPanel /> : null}
            {general.tab === 'hardware-acceleration' ? <HardwareAccelerationSettingsPanel /> : null}
            {general.tab === 'gesture' ? (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-ink">手势控制</h3>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  使用摄像头进行手势控制，支持播放/暂停、前进/后退等操作。
                </p>
                <GesturePracticePanel />
              </div>
            ) : null}
          </main>
        </div>
      </div>
    </div>
  );
}
