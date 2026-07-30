import {zhCN} from '../i18n/strings';
import type {SettingsTab} from './settingsTypes';

interface SettingsTabNavProps {
  tab: SettingsTab;
  onTabChange(tab: SettingsTab): void;
}

const TAB_ITEMS: {key: SettingsTab; label: string; testId: string}[] = [
  {key: 'general', label: zhCN.settings.tabs.general, testId: 'settings-tab-general'},
  {key: 'display', label: zhCN.settings.tabs.display, testId: 'settings-tab-display'},
  {key: 'appearance', label: zhCN.settings.tabs.appearance, testId: 'settings-tab-appearance'},
  {key: 'lut-library', label: zhCN.settings.tabs.lutLibrary, testId: 'settings-tab-lut-library'},
  {key: 'effect-presets', label: zhCN.settings.tabs.effectPresets, testId: 'settings-tab-effect-presets'},
  {key: 'shortcuts', label: zhCN.settings.tabs.shortcuts, testId: 'settings-tab-shortcuts'},
  {key: 'macros', label: zhCN.settings.tabs.macros, testId: 'settings-tab-macros'},
  {key: 'automation', label: zhCN.settings.tabs.automation, testId: 'settings-tab-automation'},
  {key: 'scripts', label: zhCN.settings.tabs.scripts, testId: 'settings-tab-scripts'},
  {key: 'translation', label: zhCN.settings.tabs.translation, testId: 'settings-tab-translation'},
  {key: 'local-models', label: zhCN.settings.tabs.localModels, testId: 'settings-tab-local-models'},
  {key: 'proxy', label: zhCN.settings.tabs.proxy, testId: 'settings-tab-proxy'},
  {key: 'task-monitor', label: zhCN.settings.tabs.taskMonitor, testId: 'settings-tab-task-monitor'},
  {key: 'export-presets', label: zhCN.settings.tabs.exportPresets, testId: 'settings-tab-export-presets'},
  {key: 'backup', label: zhCN.settings.tabs.backup, testId: 'settings-tab-backup'},
  {key: 'plugins', label: zhCN.settings.tabs.plugins, testId: 'settings-tab-plugins'},
  {key: 'ai-services', label: zhCN.settings.tabs.aiServices, testId: 'settings-tab-ai-services'},
  {key: 'hardware-acceleration', label: zhCN.settings.tabs.hardwareAcceleration, testId: 'settings-tab-hardware-acceleration'},
  {key: 'gesture', label: '手势控制', testId: 'settings-tab-gesture'},
];

export function SettingsTabNav({tab, onTabChange}: SettingsTabNavProps) {
  return (
    <nav className="w-44 shrink-0 border-r border-line bg-panel p-2">
      {TAB_ITEMS.map(({key, label, testId}, index) => (
        <button
          key={key}
          className={`${index === 0 ? '' : 'mt-1 '}w-full rounded-md px-3 py-2 text-left text-sm font-semibold ${tab === key ? 'bg-white text-ink shadow-sm' : 'text-slate-600 hover:bg-white/70'}`}
          type="button"
          data-testid={testId}
          onClick={() => onTabChange(key)}
        >
          {label}
        </button>
      ))}
    </nav>
  );
}
