import {useState, useCallback} from 'react';
import {showToast} from '../lib/toast';
import {DEFAULT_CUSTOM_THEME_COLORS, deleteCustomTheme, extractCustomThemeColors, isBuiltinThemeId, resolveTheme, upsertCustomTheme, type CustomThemeColors, type ThemeSettings} from '../theme/theme';
import {getCurrentThemeSettings, setThemeSettings} from '../theme/useTheme';

export function useThemeSettings(t: {defaultCustomName: string; saveFailed: string; saveFailedMessage: string}) {
  const [themeSettings, setThemeSettingsState] = useState<ThemeSettings>(() => getCurrentThemeSettings());
  const [customThemeName, setCustomThemeName] = useState('');
  const [customThemeColors, setCustomThemeColors] = useState<CustomThemeColors>(() => ({
    ...DEFAULT_CUSTOM_THEME_COLORS,
  }));

  const hydrateThemeForm = useCallback((settings: ThemeSettings) => {
    const normalized = getCurrentThemeSettings();
    const nextSettings = settings ?? normalized;
    const activeCustomTheme = nextSettings.customThemes.find((theme) => theme.id === nextSettings.activeThemeId);
    const resolved = resolveTheme(nextSettings);
    setThemeSettingsState(nextSettings);
    setCustomThemeName(activeCustomTheme?.name ?? t.defaultCustomName);
    setCustomThemeColors(activeCustomTheme?.colors ?? extractCustomThemeColors(resolved));
  }, [t.defaultCustomName]);

  const updateThemeSettings = useCallback(async (nextSettings: ThemeSettings) => {
    setThemeSettingsState(nextSettings);
    try {
      await setThemeSettings(nextSettings);
    } catch (themeError) {
      showToast({
        kind: 'warning',
        title: t.saveFailed,
        message: themeError instanceof Error ? themeError.message : t.saveFailedMessage,
      });
    }
  }, [t.saveFailed, t.saveFailedMessage]);

  const selectTheme = useCallback(async (themeId: string) => {
    const nextSettings: ThemeSettings = {
      ...themeSettings,
      activeThemeId: themeId,
    };
    hydrateThemeForm(nextSettings);
    await updateThemeSettings(nextSettings);
  }, [themeSettings, hydrateThemeForm, updateThemeSettings]);

  const saveCustomTheme = useCallback(async () => {
    const activeCustomTheme = themeSettings.customThemes.find((theme) => theme.id === themeSettings.activeThemeId);
    const result = upsertCustomTheme(themeSettings, {
      id: activeCustomTheme?.id,
      name: customThemeName,
      colors: customThemeColors,
    });
    hydrateThemeForm(result.settings);
    await updateThemeSettings(result.settings);
  }, [themeSettings, customThemeName, customThemeColors, hydrateThemeForm, updateThemeSettings]);

  const removeCustomTheme = useCallback(async () => {
    if (isBuiltinThemeId(themeSettings.activeThemeId)) return;
    const nextSettings = deleteCustomTheme(themeSettings, themeSettings.activeThemeId);
    hydrateThemeForm(nextSettings);
    await updateThemeSettings(nextSettings);
  }, [themeSettings, hydrateThemeForm, updateThemeSettings]);

  const updateCustomThemeColor = useCallback((key: keyof CustomThemeColors, value: string) => {
    setCustomThemeColors((current) => ({
      ...current,
      [key]: value,
    }));
  }, []);

  return {
    themeSettings,
    customThemeName,
    setCustomThemeName,
    customThemeColors,
    setCustomThemeColors,
    hydrateThemeForm,
    updateThemeSettings,
    selectTheme,
    saveCustomTheme,
    removeCustomTheme,
    updateCustomThemeColor,
  };
}
