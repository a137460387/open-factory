import {zhCN} from '../i18n/strings';
import type {DisplaySettings} from './appSettings';

interface DisplaySettingsPanelProps {
  displaySettings: DisplaySettings;
  onDisplaySettingsChange(patch: Partial<DisplaySettings>): void;
}

export function DisplaySettingsPanel({displaySettings, onDisplaySettingsChange}: DisplaySettingsPanelProps) {
  const t = zhCN.settings;

  return (
    <div className="space-y-4" data-testid="settings-display-panel">
      <div>
        <h3 className="text-sm font-semibold text-ink">{t.display.title}</h3>
        <p className="text-xs text-slate-500">{t.display.description}</p>
      </div>
      <label className="block text-xs font-medium text-slate-600">
        {t.display.colorGamut}
        <select
          className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink"
          value={displaySettings.colorGamut}
          data-testid="display-color-gamut-select"
          onChange={(event) =>
            onDisplaySettingsChange({colorGamut: event.target.value as DisplaySettings['colorGamut']})
          }
        >
          <option value="srgb">{t.display.colorGamutOptions.srgb}</option>
          <option value="p3">{t.display.colorGamutOptions.p3}</option>
          <option value="rec2020">{t.display.colorGamutOptions.rec2020}</option>
        </select>
      </label>
      <div
        className="rounded-md border border-line bg-panel p-3 text-xs text-slate-600"
        data-testid="display-color-gamut-css-hint"
      >
        <span className="display-gamut-indicator display-gamut-indicator-srgb">
          {t.display.cssGamut.srgb}
        </span>
        <span className="display-gamut-indicator display-gamut-indicator-p3">{t.display.cssGamut.p3}</span>
        <span className="display-gamut-indicator display-gamut-indicator-rec2020">
          {t.display.cssGamut.rec2020}
        </span>
      </div>
    </div>
  );
}
