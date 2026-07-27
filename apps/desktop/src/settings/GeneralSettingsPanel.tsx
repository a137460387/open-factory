import type {Project, ProjectColorPipeline, PostExportQualityAssuranceSettings, StressScenarioId} from '@open-factory/editor-core';
import {
  EXPORT_COLOR_SPACES,
  PROJECT_COLOR_PIPELINES,
  SUPPORTED_PROJECT_FPS,
  generateStressScenario,
  measurePerfMetrics,
  buildStressReport,
  serializeStressReport,
  normalizeProjectColorPipeline,
  normalizeProjectFps,
  normalizeProjectWorkingColorSpace,
  normalizeTimecodeFormat,
  normalizeVfrHandlingStrategy,
  supportsDropFrameTimecode,
  getColorSpaceDisplayName,
} from '@open-factory/editor-core';
import type {TouchOptimizationSettings} from '@open-factory/editor-core';
import {FolderOpen, RefreshCw, CheckCircle, AlertCircle, Loader2} from 'lucide-react';
import {useState, useCallback} from 'react';
import {zhCN} from '../i18n/strings';
import {PREVIEW_QUALITY_MODES, PREVIEW_SKIP_FRAME_OPTIONS, type PreviewPerformanceSettings, type PreviewQualityMode, type PreviewSkipFrames} from '../lib/preview/preview-performance';
import type {TimelineInteractionSettings, ExportBackgroundSettings, CollaborationIdentitySettings, LocalCoeditingSettings, ExportConditionRule} from './appSettings';
import type {VfrHandlingStrategy} from '@open-factory/editor-core';
import type {UpdateSettings} from '../updater/update-settings';
import {getEffectiveUpdaterEndpoint, DEFAULT_UPDATE_SETTINGS} from '../updater/update-settings';
import {ExportQualityAssuranceSettingsPanel} from './ExportQualityAssurancePanel';
import {ExportRulesSettingsPanel} from './ExportRulesPanel';

const VFR_HANDLING_OPTIONS: VfrHandlingStrategy[] = ['ignore', 'auto-cfr', 'ask'];

function formatProjectFps(fps: number): string {
  return `${Number.isInteger(fps) ? fps.toFixed(0) : fps.toFixed(3)} fps`;
}

type UpdateCheckStatus = 'idle' | 'checking' | 'no-update' | 'update-available' | 'downloading' | 'downloaded' | 'error';

interface GeneralSettingsPanelProps {
  language: string;
  updateLanguage: (value: string) => void;
  updateSettings: UpdateSettings;
  updateAppUpdateSettings: (patch: Partial<UpdateSettings>) => void;
  previewPerformance: PreviewPerformanceSettings;
  onPreviewPerformanceChange: (settings: Partial<PreviewPerformanceSettings>) => void;
  onPreviewSkipFramesChange: (skipFrames: PreviewSkipFrames) => void;
  timelineInteractionSettings: TimelineInteractionSettings;
  onTimelineInteractionSettingsChange: (settings: Partial<TimelineInteractionSettings>) => void;
  collaborationIdentity: CollaborationIdentitySettings;
  updateCollaborationIdentity: (patch: Partial<CollaborationIdentitySettings>) => void;
  localCoediting: LocalCoeditingSettings;
  updateLocalCoediting: (patch: Partial<LocalCoeditingSettings>) => void;
  demucsExecutablePath: string;
  setDemucsExecutablePath: (path: string) => void;
  chooseDemucsExecutable: () => void;
  privacyDetectionModelPath: string;
  setPrivacyDetectionModelPath: (path: string) => void;
  choosePrivacyDetectionModel: () => void;
  recordingSettings: {width: number; height: number; frameRate: number};
  setRecordingSettings: (patch: Partial<{width: number; height: number; frameRate: number}>) => void;
  project: Project;
  updateProjectFrameRate: (value: string) => void;
  updateProjectTimecodeFormat: (value: string) => void;
  updateProjectVfrHandling: (value: string) => void;
  updateProjectColorPipeline: (value: string) => void;
  updateProjectWorkingColorSpace: (value: string) => void;
  exportBackgroundSettings: ExportBackgroundSettings;
  updateExportBackgroundSettings: (settings: ExportBackgroundSettings) => void;
  exportQualityAssuranceSettings: PostExportQualityAssuranceSettings;
  updateExportQualityAssuranceSettings: (patch: Partial<PostExportQualityAssuranceSettings>) => void;
  touchOptimizationSettings: TouchOptimizationSettings;
  updateTouchOptimizationSettings: (patch: Partial<TouchOptimizationSettings>) => void;
  exportRules: ExportConditionRule[];
  updateExportRule: (rule: ExportConditionRule) => void;
  chooseExportRuleCopyDirectory: () => void;
  developerMode: boolean;
  setDeveloperMode: (value: boolean) => void;
  stressTestResult: string | null;
  setStressTestResult: (value: string | null) => void;
  currentVersion?: string;
  onCheckForUpdates?: () => Promise<{version: string} | null>;
  isTauri?: boolean;
}

export function GeneralSettingsPanel({
  language,
  updateLanguage,
  updateSettings,
  updateAppUpdateSettings,
  previewPerformance,
  onPreviewPerformanceChange,
  onPreviewSkipFramesChange,
  timelineInteractionSettings,
  onTimelineInteractionSettingsChange,
  collaborationIdentity,
  updateCollaborationIdentity,
  localCoediting,
  updateLocalCoediting,
  demucsExecutablePath,
  setDemucsExecutablePath,
  chooseDemucsExecutable,
  privacyDetectionModelPath,
  setPrivacyDetectionModelPath,
  choosePrivacyDetectionModel,
  recordingSettings,
  setRecordingSettings,
  project,
  updateProjectFrameRate,
  updateProjectTimecodeFormat,
  updateProjectVfrHandling,
  updateProjectColorPipeline,
  updateProjectWorkingColorSpace,
  exportBackgroundSettings,
  updateExportBackgroundSettings,
  exportQualityAssuranceSettings,
  updateExportQualityAssuranceSettings,
  touchOptimizationSettings,
  updateTouchOptimizationSettings,
  exportRules,
  updateExportRule,
  chooseExportRuleCopyDirectory,
  developerMode,
  setDeveloperMode,
  stressTestResult,
  setStressTestResult,
  currentVersion,
  onCheckForUpdates,
  isTauri,
}: GeneralSettingsPanelProps) {
  const t = zhCN.settings;
  const [updateCheckStatus, setUpdateCheckStatus] = useState<UpdateCheckStatus>('idle');
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);

  const handleCheckForUpdates = useCallback(async () => {
    if (!onCheckForUpdates) return;

    setUpdateCheckStatus('checking');
    setUpdateError(null);
    setLatestVersion(null);

    try {
      const result = await onCheckForUpdates();
      if (result) {
        setUpdateCheckStatus('update-available');
        setLatestVersion(result.version);
      } else {
        setUpdateCheckStatus('no-update');
      }
    } catch (error) {
      setUpdateCheckStatus('error');
      setUpdateError(error instanceof Error ? error.message : t.general.updateCheckFailedMessage);
    }
  }, [onCheckForUpdates, t.general.updateCheckFailedMessage]);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-ink">{t.general.title}</h3>
        <p className="text-xs text-slate-500">{t.general.description}</p>
      </div>
      <label className="block text-xs font-medium text-slate-600">
        {t.general.language}
        <select
          className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink"
          value={language}
          data-testid="settings-language-select"
          onChange={(event) => void updateLanguage(event.target.value)}
        >
          <option value="zh">{t.general.options.zh}</option>
          <option value="en">{t.general.options.en}</option>
        </select>
      </label>
      <div className="rounded-md border border-line bg-panel p-3 text-xs text-slate-600">
        {t.general.languageDescription}
      </div>
      {isTauri && (
        <div className="rounded-md border border-line bg-panel p-3" data-testid="settings-update-section">
          <div className="mb-3">
            <h4 className="text-xs font-semibold text-slate-700">{t.general.updatesTitle}</h4>
            <p className="mt-1 text-xs text-slate-500">{t.general.updatesDescription}</p>
          </div>

          {/* Version Info */}
          {currentVersion && (
            <div className="mb-3 flex items-center justify-between rounded-md border border-line bg-white px-3 py-2">
              <div>
                <span className="text-xs font-medium text-slate-600">{t.general.currentVersion}</span>
                <span className="ml-2 text-sm font-semibold text-ink">v{currentVersion}</span>
              </div>
              {onCheckForUpdates && (
                <button
                  className="inline-flex items-center gap-1.5 rounded-md border border-line bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-panel disabled:cursor-not-allowed disabled:opacity-60"
                  type="button"
                  disabled={updateCheckStatus === 'checking'}
                  data-testid="settings-check-updates-button"
                  onClick={() => void handleCheckForUpdates()}
                >
                  {updateCheckStatus === 'checking' ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      {t.general.checkingForUpdates}
                    </>
                  ) : (
                    <>
                      <RefreshCw size={14} />
                      {t.general.checkForUpdates}
                    </>
                  )}
                </button>
              )}
            </div>
          )}

          {/* Update Status */}
          {updateCheckStatus === 'no-update' && (
            <div className="mb-3 flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700">
              <CheckCircle size={14} />
              {t.general.noUpdatesAvailable}
            </div>
          )}
          {updateCheckStatus === 'update-available' && latestVersion && (
            <div className="mb-3 flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
              <RefreshCw size={14} />
              {t.general.updateAvailable(latestVersion)}
            </div>
          )}
          {updateCheckStatus === 'error' && (
            <div className="mb-3 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              <AlertCircle size={14} />
              {updateError || t.general.updateCheckFailed}
            </div>
          )}

          <label className="mb-3 flex items-start gap-2 text-xs text-slate-600">
            <input
              className="mt-0.5 h-4 w-4 accent-brand"
              type="checkbox"
              checked={updateSettings.autoCheckEnabled}
              data-testid="settings-update-auto-check"
              onChange={(event) => void updateAppUpdateSettings({ autoCheckEnabled: event.target.checked })}
            />
            <span>
              <span className="block font-semibold text-slate-700">{t.general.autoUpdateCheck}</span>
              <span className="mt-1 block">{t.general.autoUpdateCheckDescription}</span>
            </span>
          </label>
          <label className="block text-xs font-medium text-slate-600">
            {t.general.updateEndpoint}
            <input
              className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink"
              value={updateSettings.customEndpoint ?? ''}
              placeholder={getEffectiveUpdaterEndpoint(DEFAULT_UPDATE_SETTINGS)}
              data-testid="settings-update-endpoint-input"
              onChange={(event) => void updateAppUpdateSettings({ customEndpoint: event.target.value })}
            />
          </label>
          <p className="mt-1 text-[11px] text-slate-500">
            {updateSettings.customEndpoint
              ? t.general.updateEndpointDescription
              : t.general.defaultUpdateEndpoint}
          </p>
        </div>
      )}
      <div className="rounded-md border border-line bg-panel p-3">
        <div className="mb-2">
          <h4 className="text-xs font-semibold text-slate-700">{t.general.previewPerformanceTitle}</h4>
          <p className="mt-1 text-xs text-slate-500">{t.general.previewPerformanceDescription}</p>
        </div>
        <label className="mb-3 flex items-start gap-2 text-xs text-slate-600">
          <input
            className="mt-0.5 h-4 w-4 accent-brand"
            type="checkbox"
            checked={previewPerformance.adaptiveEnabled !== false}
            data-testid="settings-preview-adaptive-toggle"
            onChange={(event) => onPreviewPerformanceChange({ adaptiveEnabled: event.target.checked })}
          />
          <span>
            <span className="block font-semibold text-slate-700">{t.general.previewAdaptiveQuality}</span>
            <span className="mt-1 block">{t.general.previewAdaptiveQualityDescription}</span>
          </span>
        </label>
        <label className="mb-3 block text-xs font-medium text-slate-600">
          {t.general.previewFixedQuality}
          <select
            className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink disabled:cursor-not-allowed disabled:opacity-60"
            value={previewPerformance.qualityMode}
            disabled={previewPerformance.adaptiveEnabled !== false}
            data-testid="settings-preview-fixed-quality-select"
            onChange={(event) =>
              onPreviewPerformanceChange({
                qualityMode: event.target.value as PreviewQualityMode,
                adaptiveEnabled: false,
              })
            }
          >
            {PREVIEW_QUALITY_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {zhCN.toolbar.previewQualityOptions[mode]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium text-slate-600">
          {t.general.previewSkipFrames}
          <select
            className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink disabled:cursor-not-allowed disabled:opacity-60"
            value={previewPerformance.skipFrames}
            disabled={previewPerformance.adaptiveEnabled !== false}
            data-testid="settings-preview-skip-frames-select"
            onChange={(event) => onPreviewSkipFramesChange(Number(event.target.value) as PreviewSkipFrames)}
          >
            {PREVIEW_SKIP_FRAME_OPTIONS.map((frames) => (
              <option key={frames} value={frames}>
                {t.general.previewSkipFrameOptions[frames]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="flex items-start gap-2 rounded-md border border-line bg-panel p-3 text-xs text-slate-600">
        <input
          className="mt-0.5 h-4 w-4 accent-brand"
          type="checkbox"
          checked={timelineInteractionSettings.reduceMotion}
          data-testid="settings-reduce-motion-toggle"
          onChange={(event) => onTimelineInteractionSettingsChange({ reduceMotion: event.target.checked })}
        />
        <span>
          <span className="block font-semibold text-slate-700">{t.general.reduceMotion}</span>
          <span className="mt-1 block">{t.general.reduceMotionDescription}</span>
        </span>
      </label>
      <div className="rounded-md border border-line bg-panel p-3">
        <div className="mb-2">
          <h4 className="text-xs font-semibold text-slate-700">{t.general.collaborationIdentityTitle}</h4>
        </div>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_120px]">
          <label className="block text-xs font-medium text-slate-600">
            {t.general.collaborationName}
            <input
              className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink"
              value={collaborationIdentity.name}
              data-testid="settings-collaboration-name-input"
              onChange={(event) => void updateCollaborationIdentity({ name: event.target.value })}
            />
          </label>
          <label className="block text-xs font-medium text-slate-600">
            {t.general.collaborationColor}
            <input
              className="mt-1 h-9 w-full rounded-md border border-line bg-white px-1"
              type="color"
              value={collaborationIdentity.color}
              data-testid="settings-collaboration-color-input"
              onChange={(event) => void updateCollaborationIdentity({ color: event.target.value })}
            />
          </label>
        </div>
      </div>
      <div
        className="rounded-md border border-line bg-panel p-3"
        data-testid="settings-local-coediting-section"
      >
        <label className="flex items-start gap-2 text-xs text-slate-600">
          <input
            className="mt-0.5 h-4 w-4 accent-brand"
            type="checkbox"
            checked={localCoediting.enabled}
            data-testid="settings-local-coediting-enabled"
            onChange={(event) => void updateLocalCoediting({ enabled: event.target.checked })}
          />
          <span>
            <span className="block font-semibold text-slate-700">{t.general.localCoeditingTitle}</span>
            <span className="mt-1 block">{t.general.localCoeditingDescription}</span>
          </span>
        </label>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-medium text-slate-600">
            {t.general.localCoeditingMode}
            <select
              className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink"
              value={localCoediting.mode}
              data-testid="settings-local-coediting-mode"
              onChange={(event) =>
                void updateLocalCoediting({ mode: event.target.value === 'client' ? 'client' : 'host' })
              }
            >
              <option value="host">{t.general.localCoeditingHost}</option>
              <option value="client">{t.general.localCoeditingClient}</option>
            </select>
          </label>
          <label className="block text-xs font-medium text-slate-600">
            {t.general.localCoeditingPermission}
            <select
              className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink"
              value={localCoediting.permission}
              data-testid="settings-local-coediting-permission"
              onChange={(event) =>
                void updateLocalCoediting({
                  permission: event.target.value === 'read-only' ? 'read-only' : 'edit',
                })
              }
            >
              <option value="edit">{t.general.localCoeditingEdit}</option>
              <option value="read-only">{t.general.localCoeditingReadOnly}</option>
            </select>
          </label>
          <label className="block text-xs font-medium text-slate-600">
            {t.general.localCoeditingPort}
            <input
              className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink"
              type="number"
              min={1}
              max={65535}
              value={localCoediting.port}
              data-testid="settings-local-coediting-port"
              onChange={(event) => void updateLocalCoediting({ port: Number(event.target.value) })}
            />
          </label>
          <label className="block text-xs font-medium text-slate-600">
            {t.general.localCoeditingHostUrl}
            <input
              className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink"
              value={localCoediting.hostUrl ?? ''}
              placeholder="ws://192.168.1.10:37822"
              data-testid="settings-local-coediting-host-url"
              onChange={(event) => void updateLocalCoediting({ hostUrl: event.target.value })}
            />
          </label>
          {localCoediting.mode === 'host' && (
            <>
              <label className="block text-xs font-medium text-slate-600">
                {t.general.localCoeditingNetworkMode}
                <select
                  className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink"
                  value={localCoediting.networkMode ?? 'localhost'}
                  data-testid="settings-local-coediting-network-mode"
                  onChange={(event) =>
                    void updateLocalCoediting({
                      networkMode: event.target.value === 'lan' ? 'lan' : 'localhost',
                    })
                  }
                >
                  <option value="localhost">{t.general.localCoeditingNetworkLocalhost}</option>
                  <option value="lan">{t.general.localCoeditingNetworkLan}</option>
                </select>
              </label>
              <label className="block text-xs font-medium text-slate-600">
                {t.general.localCoeditingAuthToken}
                <input
                  className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink"
                  value={localCoediting.authToken ?? ''}
                  placeholder={t.general.localCoeditingAuthTokenPlaceholder}
                  data-testid="settings-local-coediting-auth-token"
                  onChange={(event) =>
                    void updateLocalCoediting({ authToken: event.target.value || undefined })
                  }
                />
              </label>
            </>
          )}
          {localCoediting.mode === 'host' && localCoediting.networkMode === 'lan' && (
            <div
              className="sm:col-span-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800"
              data-testid="settings-local-coediting-lan-warning"
            >
              {t.general.localCoeditingLanWarning}
            </div>
          )}
        </div>
      </div>
      <div className="rounded-md border border-line bg-panel p-3">
        <div className="mb-2">
          <h4 className="text-xs font-semibold text-slate-700">{t.general.demucsTitle}</h4>
          <p className="mt-1 text-xs text-slate-500">{t.general.demucsDescription}</p>
        </div>
        <div className="flex gap-2">
          <input
            className="min-w-0 flex-1 rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink"
            value={demucsExecutablePath}
            placeholder={t.general.demucsExecutable}
            data-testid="settings-demucs-executable-input"
            onChange={(event) => setDemucsExecutablePath(event.target.value)}
          />
          <button
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-line bg-white text-slate-600 hover:bg-panel"
            type="button"
            title={t.general.chooseDemucsExecutable}
            aria-label={t.general.chooseDemucsExecutable}
            data-testid="settings-demucs-executable-choose-button"
            onClick={() => void chooseDemucsExecutable()}
          >
            <FolderOpen size={15} />
          </button>
        </div>
      </div>
      <div className="rounded-md border border-line bg-panel p-3">
        <div className="mb-2">
          <h4 className="text-xs font-semibold text-slate-700">{t.general.privacyDetectionTitle}</h4>
          <p className="mt-1 text-xs text-slate-500">{t.general.privacyDetectionDescription}</p>
        </div>
        <div className="flex gap-2">
          <input
            className="min-w-0 flex-1 rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink"
            value={privacyDetectionModelPath}
            placeholder={t.general.privacyDetectionModel}
            data-testid="settings-privacy-model-input"
            onChange={(event) => setPrivacyDetectionModelPath(event.target.value)}
          />
          <button
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-line bg-white text-slate-600 hover:bg-panel"
            type="button"
            title={t.general.choosePrivacyDetectionModel}
            aria-label={t.general.choosePrivacyDetectionModel}
            data-testid="settings-privacy-model-choose-button"
            onClick={() => void choosePrivacyDetectionModel()}
          >
            <FolderOpen size={15} />
          </button>
        </div>
      </div>
      <div className="rounded-md border border-line bg-panel p-3">
        <div className="mb-2">
          <h4 className="text-xs font-semibold text-slate-700">{t.general.recordingTitle}</h4>
          <p className="mt-1 text-xs text-slate-500">{t.general.recordingDescription}</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <label className="block text-xs font-medium text-slate-600">
            {t.general.recordingWidth}
            <input
              className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink"
              type="number"
              min={320}
              max={7680}
              step={16}
              value={recordingSettings.width}
              data-testid="settings-recording-width-input"
              onChange={(event) => setRecordingSettings({ width: Number(event.target.value) })}
            />
          </label>
          <label className="block text-xs font-medium text-slate-600">
            {t.general.recordingHeight}
            <input
              className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink"
              type="number"
              min={240}
              max={4320}
              step={16}
              value={recordingSettings.height}
              data-testid="settings-recording-height-input"
              onChange={(event) => setRecordingSettings({ height: Number(event.target.value) })}
            />
          </label>
          <label className="block text-xs font-medium text-slate-600">
            {t.general.recordingFrameRate}
            <input
              className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink"
              type="number"
              min={1}
              max={120}
              step={1}
              value={recordingSettings.frameRate}
              data-testid="settings-recording-framerate-input"
              onChange={(event) => setRecordingSettings({ frameRate: Number(event.target.value) })}
            />
          </label>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-medium text-slate-600">
          {t.general.projectFrameRate}
          <select
            className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink"
            value={String(normalizeProjectFps(project.settings.fps))}
            data-testid="project-fps-select"
            onChange={(event) => updateProjectFrameRate(event.target.value)}
          >
            {SUPPORTED_PROJECT_FPS.map((fps) => (
              <option key={fps} value={fps}>
                {formatProjectFps(fps)}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium text-slate-600">
          {t.general.timecodeFormat}
          <select
            className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink disabled:bg-slate-100"
            value={normalizeTimecodeFormat(project.settings.timecodeFormat, project.settings.fps)}
            disabled={!supportsDropFrameTimecode(project.settings.fps)}
            data-testid="project-timecode-format-select"
            onChange={(event) => updateProjectTimecodeFormat(event.target.value)}
          >
            <option value="ndf">{t.general.timecodeNdf}</option>
            <option value="df">{t.general.timecodeDf}</option>
          </select>
          {!supportsDropFrameTimecode(project.settings.fps) ? (
            <span className="mt-1 block text-[11px] text-slate-500">{t.general.dropFrameUnavailable}</span>
          ) : null}
        </label>
        <label className="block text-xs font-medium text-slate-600">
          {t.general.vfrHandling}
          <select
            className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink"
            value={normalizeVfrHandlingStrategy(project.settings.vfrHandling)}
            data-testid="project-vfr-handling-select"
            onChange={(event) => updateProjectVfrHandling(event.target.value)}
          >
            {VFR_HANDLING_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {t.general.vfrHandlingOptions[option]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium text-slate-600">
          {t.general.colorPipeline}
          <select
            className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink"
            value={normalizeProjectColorPipeline(project.settings.colorPipeline)}
            data-testid="project-color-pipeline-select"
            onChange={(event) => updateProjectColorPipeline(event.target.value)}
          >
            {PROJECT_COLOR_PIPELINES.map((pipeline) => (
              <option key={pipeline} value={pipeline}>
                {t.general.colorPipelineOptions[pipeline as ProjectColorPipeline]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium text-slate-600">
          {t.general.workingColorSpace}
          <select
            className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink"
            value={normalizeProjectWorkingColorSpace(project.settings.workingColorSpace)}
            data-testid="project-working-color-space-select"
            onChange={(event) => updateProjectWorkingColorSpace(event.target.value)}
          >
            {EXPORT_COLOR_SPACES.map((colorSpace) => (
              <option key={colorSpace} value={colorSpace}>
                {getColorSpaceDisplayName(colorSpace)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="flex items-start gap-2 rounded-md border border-line bg-panel p-3 text-xs text-slate-600">
        <input
          className="mt-0.5 h-4 w-4 accent-brand"
          type="checkbox"
          checked={exportBackgroundSettings.allowPowerActions}
          data-testid="settings-export-power-actions-toggle"
          onChange={(event) =>
            void updateExportBackgroundSettings({
              ...exportBackgroundSettings,
              allowPowerActions: event.target.checked,
            })
          }
        />
        <span>
          <span className="block font-semibold text-slate-700">{t.general.allowExportPowerActions}</span>
          <span className="mt-1 block">{t.general.allowExportPowerActionsDescription}</span>
        </span>
      </label>
      <label className="flex items-start gap-2 rounded-md border border-line bg-panel p-3 text-xs text-slate-600">
        <input
          className="mt-0.5 h-4 w-4 accent-brand"
          type="checkbox"
          checked={exportBackgroundSettings.lowPowerMode}
          data-testid="settings-export-low-power-toggle"
          onChange={(event) =>
            void updateExportBackgroundSettings({
              ...exportBackgroundSettings,
              lowPowerMode: event.target.checked,
            })
          }
        />
        <span>
          <span className="block font-semibold text-slate-700">{t.general.lowPowerExportMode}</span>
          <span className="mt-1 block">{t.general.lowPowerExportModeDescription}</span>
        </span>
      </label>
      <ExportQualityAssuranceSettingsPanel
        settings={exportQualityAssuranceSettings}
        onChange={(patch) => void updateExportQualityAssuranceSettings(patch)}
      />
      <label className="flex items-start gap-2 rounded-md border border-line bg-panel p-3 text-xs text-slate-600">
        <input
          className="mt-0.5 h-4 w-4 accent-brand"
          type="checkbox"
          checked={touchOptimizationSettings.enabled}
          data-testid="settings-touch-optimization-toggle"
          onChange={(event) => void updateTouchOptimizationSettings({ enabled: event.target.checked })}
        />
        <span>
          <span className="block font-semibold text-slate-700">触屏优化模式</span>
          <span className="mt-1 block">
            开启后时间线交互元素自动放大、间距增加，适配触屏设备。关闭后使用标准鼠标交互尺寸。
          </span>
        </span>
      </label>
      <ExportRulesSettingsPanel
        rules={exportRules}
        onRuleChange={(rule) => void updateExportRule(rule)}
        onChooseCopyDirectory={() => void chooseExportRuleCopyDirectory()}
      />
      <div className="rounded-md border border-line bg-panel p-3" data-testid="settings-developer-section">
        <label className="flex items-start gap-2 text-xs text-slate-600">
          <input
            className="mt-0.5 h-4 w-4 accent-brand"
            type="checkbox"
            checked={developerMode}
            data-testid="settings-developer-mode-toggle"
            onChange={(e) => setDeveloperMode(e.target.checked)}
          />
          <span>
            <span className="block font-semibold text-slate-700">开发者模式</span>
            <span className="mt-1 block">开启后显示开发者工具，包括项目压力测试。</span>
          </span>
        </label>
        {developerMode ? (
          <div className="mt-3 space-y-2 border-t border-line pt-3" data-testid="stress-test-panel">
            <h4 className="text-xs font-semibold text-slate-700">项目压力测试</h4>
            <p className="text-[11px] text-slate-500">在独立临时项目中模拟极端场景，不影响当前工作。</p>
            <div className="flex flex-wrap gap-2">
              {(['mega-clips', 'long-timeline', 'mass-keyframes', 'deep-nested'] as StressScenarioId[]).map(
                (sid) => (
                  <button
                    key={sid}
                    className="rounded-md border border-line bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                    data-testid={`stress-run-${sid}`}
                    onClick={() => {
                      const { project: stressProject, metrics: baseMetrics } = generateStressScenario(sid);
                      const start = Date.now();
                      const renderStart = performance.now();
                      const _clone = JSON.parse(JSON.stringify(stressProject));
                      const renderTimeMs = performance.now() - renderStart;
                      const metrics = measurePerfMetrics(baseMetrics, renderTimeMs, 0, 0);
                      const report = buildStressReport(sid, start, metrics, undefined, '3.9.0');
                      setStressTestResult(serializeStressReport(report));
                    }}
                  >
                    {sid === 'mega-clips'
                      ? '超大项目'
                      : sid === 'long-timeline'
                        ? '超长TL'
                        : sid === 'mass-keyframes'
                          ? '大量KF'
                          : '深度嵌套'}
                  </button>
                ),
              )}
            </div>
            {stressTestResult ? (
              <pre
                className="mt-2 max-h-48 overflow-auto rounded border border-line bg-white p-2 text-[10px] text-slate-700"
                data-testid="stress-test-result"
              >
                {stressTestResult}
              </pre>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
