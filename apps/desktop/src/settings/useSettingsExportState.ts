import {useState} from 'react';
import {DEFAULT_POST_EXPORT_QUALITY_ASSURANCE_SETTINGS, type PostExportQualityAssuranceSettings} from '@open-factory/editor-core';
import {zhCN} from '../i18n/strings';
import {parseAutomationRulesJson, serializeAutomationRulesJson} from '../automation/automation-rules';
import {openDirectoryDialog, readExportPresetSyncWebdavPassword, readWebdavPassword, writeExportPresetSyncWebdavPassword, writeWebdavPassword} from '../lib/tauri-bridge';
import {showToast} from '../lib/toast';
import {
  EXPORT_RULE_COPY_SUCCESS_ID,
  defaultExportCopyRule,
  getExportRule,
  upsertExportRule,
} from './ExportRulesPanel';
import {
  DEFAULT_BACKUP_SETTINGS,
  DEFAULT_EXPORT_PRESET_SYNC_SETTINGS,
  readAutomationRules,
  readBackupSettings,
  readExportBackgroundSettings,
  readExportQualityAssuranceSettings,
  readExportPresetSyncSettings,
  readExportRules,
  saveAutomationRules,
  saveBackupSettings,
  saveExportBackgroundSettings,
  saveExportQualityAssuranceSettings,
  saveExportPresetSyncSettings,
  saveExportRules,
  type AutomationRule,
  type BackupSettings,
  type ExportBackgroundSettings,
  type ExportPresetSyncSettings,
  type ExportConditionRule,
} from './appSettings';

export function useSettingsExportState() {
  const t = zhCN.settings;

  const [backupSettings, setBackupSettings] = useState<BackupSettings>(() => ({
    ...DEFAULT_BACKUP_SETTINGS,
    local: {...DEFAULT_BACKUP_SETTINGS.local},
    webdav: {...DEFAULT_BACKUP_SETTINGS.webdav},
  }));
  const [exportPresetSyncSettings, setExportPresetSyncSettings] = useState<ExportPresetSyncSettings>(() => ({
    ...DEFAULT_EXPORT_PRESET_SYNC_SETTINGS,
  }));
  const [exportBackgroundSettings, setExportBackgroundSettings] = useState<ExportBackgroundSettings>(() => ({
    allowPowerActions: false,
    postExportScriptAcknowledged: false,
    lowPowerMode: false,
  }));
  const [exportQualityAssuranceSettings, setExportQualityAssuranceSettings] =
    useState<PostExportQualityAssuranceSettings>(() => ({...DEFAULT_POST_EXPORT_QUALITY_ASSURANCE_SETTINGS}));
  const [exportRules, setExportRules] = useState<ExportConditionRule[]>([]);
  const [automationRules, setAutomationRules] = useState<AutomationRule[]>([]);
  const [automationRulesJson, setAutomationRulesJson] = useState('[]');
  const [automationRulesError, setAutomationRulesError] = useState<string>();
  const [webdavPassword, setWebdavPassword] = useState('');
  const [exportPresetSyncPassword, setExportPresetSyncPassword] = useState('');

  async function loadBackupSettings() {
    try {
      setBackupSettings(await readBackupSettings());
      setWebdavPassword((await readWebdavPassword()) ?? '');
    } catch (backupError) {
      showToast({
        kind: 'warning',
        title: t.backup.saveFailed,
        message: backupError instanceof Error ? backupError.message : t.backup.saveFailedMessage,
      });
    }
  }

  async function loadExportPresetSyncSettings() {
    try {
      setExportPresetSyncSettings(await readExportPresetSyncSettings());
      setExportPresetSyncPassword((await readExportPresetSyncWebdavPassword()) ?? '');
    } catch (settingsError) {
      showToast({
        kind: 'warning',
        title: t.exportPresetSync.saveFailed,
        message: settingsError instanceof Error ? settingsError.message : t.exportPresetSync.saveFailedMessage,
      });
    }
  }

  async function loadExportBackgroundSettings() {
    try {
      setExportBackgroundSettings(await readExportBackgroundSettings());
    } catch (exportBackgroundError) {
      showToast({
        kind: 'warning',
        title: t.general.saveFailed,
        message: exportBackgroundError instanceof Error ? exportBackgroundError.message : t.general.saveFailedMessage,
      });
    }
  }

  async function loadExportQualityAssuranceSettings() {
    try {
      setExportQualityAssuranceSettings(await readExportQualityAssuranceSettings());
    } catch (qualityError) {
      showToast({
        kind: 'warning',
        title: t.general.saveFailed,
        message: qualityError instanceof Error ? qualityError.message : t.general.saveFailedMessage,
      });
    }
  }

  async function loadExportRules() {
    try {
      setExportRules(await readExportRules());
    } catch (exportRulesError) {
      showToast({
        kind: 'warning',
        title: t.general.saveFailed,
        message: exportRulesError instanceof Error ? exportRulesError.message : t.general.saveFailedMessage,
      });
    }
  }

  async function loadAutomationRules() {
    try {
      const rules = await readAutomationRules();
      setAutomationRules(rules);
      setAutomationRulesJson(serializeAutomationRulesJson(rules));
      setAutomationRulesError(undefined);
    } catch (automationError) {
      showToast({
        kind: 'warning',
        title: t.automation.saveFailed,
        message: automationError instanceof Error ? automationError.message : t.automation.saveFailedMessage,
      });
    }
  }

  async function saveAutomationRulesFromJson() {
    const parsed = parseAutomationRulesJson(automationRulesJson);
    if (!parsed.ok) {
      setAutomationRulesError(parsed.error);
      return;
    }
    try {
      const saved = await saveAutomationRules(parsed.rules);
      setAutomationRules(saved);
      setAutomationRulesJson(serializeAutomationRulesJson(saved));
      setAutomationRulesError(undefined);
      showToast({kind: 'success', title: t.automation.saved});
    } catch (automationError) {
      const message = automationError instanceof Error ? automationError.message : t.automation.saveFailedMessage;
      setAutomationRulesError(message);
      showToast({kind: 'warning', title: t.automation.saveFailed, message});
    }
  }

  async function toggleAutomationRule(ruleId: string, enabled: boolean) {
    const nextRules = automationRules.map((rule) => (rule.id === ruleId ? {...rule, enabled} : rule));
    setAutomationRules(nextRules);
    setAutomationRulesJson(serializeAutomationRulesJson(nextRules));
    try {
      const saved = await saveAutomationRules(nextRules);
      setAutomationRules(saved);
      setAutomationRulesJson(serializeAutomationRulesJson(saved));
      setAutomationRulesError(undefined);
    } catch (automationError) {
      const message = automationError instanceof Error ? automationError.message : t.automation.saveFailedMessage;
      setAutomationRulesError(message);
      showToast({kind: 'warning', title: t.automation.saveFailed, message});
    }
  }

  async function updateExportBackgroundSettings(nextSettings: ExportBackgroundSettings) {
    setExportBackgroundSettings(nextSettings);
    try {
      setExportBackgroundSettings(await saveExportBackgroundSettings(nextSettings));
    } catch (exportBackgroundError) {
      showToast({
        kind: 'warning',
        title: t.general.saveFailed,
        message: exportBackgroundError instanceof Error ? exportBackgroundError.message : t.general.saveFailedMessage,
      });
    }
  }

  async function updateExportQualityAssuranceSettings(patch: Partial<PostExportQualityAssuranceSettings>) {
    const nextSettings = {...exportQualityAssuranceSettings, ...patch};
    setExportQualityAssuranceSettings(nextSettings);
    try {
      setExportQualityAssuranceSettings(await saveExportQualityAssuranceSettings(nextSettings));
    } catch (qualityError) {
      showToast({
        kind: 'warning',
        title: t.general.saveFailed,
        message: qualityError instanceof Error ? qualityError.message : t.general.saveFailedMessage,
      });
    }
  }

  async function updateExportRule(nextRule: ExportConditionRule) {
    const nextRules = upsertExportRule(exportRules, nextRule);
    setExportRules(nextRules);
    try {
      setExportRules(await saveExportRules(nextRules));
    } catch (exportRulesError) {
      showToast({
        kind: 'warning',
        title: t.general.saveFailed,
        message: exportRulesError instanceof Error ? exportRulesError.message : t.general.saveFailedMessage,
      });
    }
  }

  async function chooseExportRuleCopyDirectory() {
    try {
      const directory = await openDirectoryDialog();
      if (directory) {
        const currentRule = getExportRule(exportRules, EXPORT_RULE_COPY_SUCCESS_ID, defaultExportCopyRule());
        await updateExportRule({...currentRule, targetDirectory: directory});
      }
    } catch (exportRulesError) {
      showToast({
        kind: 'warning',
        title: t.general.saveFailed,
        message: exportRulesError instanceof Error ? exportRulesError.message : t.general.saveFailedMessage,
      });
    }
  }

  async function updateBackupSettings(nextSettings: BackupSettings) {
    setBackupSettings(nextSettings);
    try {
      setBackupSettings(await saveBackupSettings(nextSettings));
    } catch (backupError) {
      showToast({
        kind: 'warning',
        title: t.backup.saveFailed,
        message: backupError instanceof Error ? backupError.message : t.backup.saveFailedMessage,
      });
    }
  }

  async function updateExportPresetSyncSettings(nextSettings: ExportPresetSyncSettings) {
    setExportPresetSyncSettings(nextSettings);
    try {
      setExportPresetSyncSettings(await saveExportPresetSyncSettings(nextSettings));
    } catch (settingsError) {
      showToast({
        kind: 'warning',
        title: t.exportPresetSync.saveFailed,
        message: settingsError instanceof Error ? settingsError.message : t.exportPresetSync.saveFailedMessage,
      });
    }
  }

  async function chooseBackupDirectory() {
    try {
      const directory = await openDirectoryDialog();
      if (directory) {
        await updateBackupSettings({
          ...backupSettings,
          local: {...backupSettings.local, directory},
        });
      }
    } catch (backupError) {
      showToast({
        kind: 'warning',
        title: t.backup.saveFailed,
        message: backupError instanceof Error ? backupError.message : t.backup.saveFailedMessage,
      });
    }
  }

  async function updateWebdavPassword(password: string) {
    setWebdavPassword(password);
    try {
      await writeWebdavPassword(password);
    } catch (passwordError) {
      showToast({
        kind: 'warning',
        title: t.backup.passwordSaveFailed,
        message: passwordError instanceof Error ? passwordError.message : t.backup.passwordSaveFailedMessage,
      });
    }
  }

  async function updateExportPresetSyncPassword(password: string) {
    setExportPresetSyncPassword(password);
    try {
      await writeExportPresetSyncWebdavPassword(password);
    } catch (passwordError) {
      showToast({
        kind: 'warning',
        title: t.exportPresetSync.passwordSaveFailed,
        message: passwordError instanceof Error ? passwordError.message : t.exportPresetSync.passwordSaveFailedMessage,
      });
    }
  }

  return {
    // State
    backupSettings,
    webdavPassword,
    exportPresetSyncSettings,
    exportPresetSyncPassword,
    exportBackgroundSettings,
    exportQualityAssuranceSettings,
    exportRules,
    automationRules,
    automationRulesJson,
    setAutomationRulesJson,
    automationRulesError,
    setAutomationRulesError,
    // Load functions
    loadBackupSettings,
    loadExportPresetSyncSettings,
    loadExportBackgroundSettings,
    loadExportQualityAssuranceSettings,
    loadExportRules,
    loadAutomationRules,
    // Handlers
    saveAutomationRulesFromJson,
    toggleAutomationRule,
    updateExportBackgroundSettings,
    updateExportQualityAssuranceSettings,
    updateExportRule,
    chooseExportRuleCopyDirectory,
    updateBackupSettings,
    updateExportPresetSyncSettings,
    chooseBackupDirectory,
    updateWebdavPassword,
    updateExportPresetSyncPassword,
  };
}
