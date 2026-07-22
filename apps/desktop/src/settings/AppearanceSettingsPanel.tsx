import { useMemo, type CSSProperties } from 'react';
import { Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { zhCN } from '../i18n/strings';
import {
  BUILTIN_THEME_IDS,
  isBuiltinThemeId,
  resolveTheme,
  type BuiltinThemeId,
  type CustomThemeColors,
  type ThemeSettings,
} from '../theme/theme';

export function AppearanceSettingsPanel({
  settings,
  activeTheme,
  liveTheme,
  customName,
  customColors,
  onThemeChange,
  onCustomNameChange,
  onCustomColorChange,
  onSaveCustom,
  onDeleteCustom,
}: {
  settings: ThemeSettings;
  activeTheme: ReturnType<typeof resolveTheme>;
  liveTheme: ReturnType<typeof resolveTheme>;
  customName: string;
  customColors: CustomThemeColors;
  onThemeChange(themeId: string): void;
  onCustomNameChange(name: string): void;
  onCustomColorChange(key: keyof CustomThemeColors, value: string): void;
  onSaveCustom(): void;
  onDeleteCustom(): void;
}) {
  const t = zhCN.settings.appearance;
  const canDeleteCustom = !isBuiltinThemeId(settings.activeThemeId);
  const previewTheme = resolveTheme({
    activeThemeId: '__preview-custom-theme',
    customThemes: [{ id: '__preview-custom-theme', name: customName || t.defaultCustomName, colors: customColors }],
  });
  const activeThemePreviewStyle: CSSProperties = useMemo(
    () => ({
      borderColor: activeTheme.colors.border,
      backgroundColor: activeTheme.colors.bgPrimary,
      color: activeTheme.colors.textPrimary,
    }),
    [activeTheme.colors.border, activeTheme.colors.bgPrimary, activeTheme.colors.textPrimary],
  );
  const previewThemeStyle: CSSProperties = useMemo(
    () => ({
      borderColor: previewTheme.colors.border,
      backgroundColor: previewTheme.colors.bgPrimary,
      color: previewTheme.colors.textPrimary,
    }),
    [previewTheme.colors.border, previewTheme.colors.bgPrimary, previewTheme.colors.textPrimary],
  );
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-ink">{t.title}</h3>
        <p className="text-xs text-slate-500">{t.description}</p>
      </div>
      <label className="block text-xs font-medium text-slate-600">
        {t.theme}
        <select
          className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink"
          value={settings.activeThemeId}
          data-testid="theme-select"
          onChange={(event) => onThemeChange(event.target.value)}
        >
          {BUILTIN_THEME_IDS.map((themeId: BuiltinThemeId) => (
            <option key={themeId} value={themeId}>
              {t.themeNames[themeId]}
            </option>
          ))}
          {settings.customThemes.map((theme) => (
            <option key={theme.id} value={theme.id}>
              {theme.name}
            </option>
          ))}
        </select>
      </label>
      <div
        className="rounded-md border p-3"
        data-testid="theme-preview"
        data-active-theme={activeTheme.id}
        data-live-theme={liveTheme.id}
        style={activeThemePreviewStyle}
      >
        <div className="text-xs font-semibold">{activeTheme.name}</div>
        <div className="mt-2 grid grid-cols-4 gap-2">
          {[
            activeTheme.colors.bgSecondary,
            activeTheme.colors.bgElevated,
            activeTheme.colors.accent,
            activeTheme.colors.accentWarm,
          ].map((color) => (
            <span
              key={color}
              className="h-7 rounded border"
              style={{ borderColor: activeTheme.colors.border, backgroundColor: color }}
            />
          ))}
        </div>
      </div>
      <div className="rounded-md border border-line bg-panel p-3">
        <div className="mb-3">
          <div className="text-sm font-semibold text-ink">{t.customTitle}</div>
          <p className="text-xs text-slate-500">{t.customDescription}</p>
        </div>
        <label className="block text-xs font-medium text-slate-600">
          {t.customName}
          <input
            className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink"
            value={customName}
            data-testid="theme-custom-name-input"
            onChange={(event) => onCustomNameChange(event.target.value)}
          />
        </label>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <ThemeColorInput
            label={t.primaryColor}
            value={customColors.primary}
            testId="theme-primary-color-input"
            onChange={(value) => onCustomColorChange('primary', value)}
          />
          <ThemeColorInput
            label={t.accentColor}
            value={customColors.accent}
            testId="theme-accent-color-input"
            onChange={(value) => onCustomColorChange('accent', value)}
          />
          <ThemeColorInput
            label={t.backgroundColor}
            value={customColors.background}
            testId="theme-background-color-input"
            onChange={(value) => onCustomColorChange('background', value)}
          />
          <ThemeColorInput
            label={t.textColor}
            value={customColors.text}
            testId="theme-text-color-input"
            onChange={(value) => onCustomColorChange('text', value)}
          />
        </div>
        <div className="mt-3 rounded-md border p-3 text-xs" style={previewThemeStyle}>
          <div className="font-semibold">{customName || t.defaultCustomName}</div>
          <div className="mt-2 flex gap-2">
            <span className="h-5 w-10 rounded" style={{ backgroundColor: previewTheme.colors.accent }} />
            <span className="h-5 w-10 rounded" style={{ backgroundColor: previewTheme.colors.accentWarm }} />
            <span className="h-5 w-10 rounded" style={{ backgroundColor: previewTheme.colors.bgElevated }} />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" data-testid="theme-save-custom-button" onClick={onSaveCustom}>
            <Save size={14} />
            {t.saveCustom}
          </Button>
          <Button
            variant="outline"
            size="sm"
            title={canDeleteCustom ? t.deleteCustom : t.deleteDisabled}
            disabled={!canDeleteCustom}
            data-testid="theme-delete-custom-button"
            onClick={onDeleteCustom}
          >
            <Trash2 size={14} />
            {t.deleteCustom}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ThemeColorInput({
  label,
  value,
  testId,
  onChange,
}: {
  label: string;
  value: string;
  testId: string;
  onChange(value: string): void;
}) {
  return (
    <label className="block text-xs font-medium text-slate-600">
      {label}
      <input
        className="mt-1 h-9 w-full rounded-md border border-line bg-white p-1"
        type="color"
        value={value}
        data-testid={testId}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
