import {
  BUILTIN_AUDIO_VISUALIZATION_THEMES,
  expandAudioVisualizationTheme,
  upsertCustomAudioVisualizationTheme,
  removeCustomAudioVisualizationTheme,
  MANUAL_AUDIO_VISUALIZATION_THEME_ID,
  type CustomAudioVisualizationTheme,
  type ExportAudioVisualizationStyle,
} from '@open-factory/editor-core';
import { useState, useEffect, useMemo, useRef, type Dispatch, type SetStateAction, type ReactNode } from 'react';
import { zhCN } from '../../i18n/strings';
import { Save, Trash2 } from 'lucide-react';
import { PresetSelectField, PresetColorField } from './PresetFields';
import {
  AUDIO_VISUALIZATION_BACKGROUND_TYPES,
  AUDIO_VISUALIZATION_STYLES,
  updateAudioVisualizationBackgroundColor,
  updateAudioVisualizationBackgroundImagePath,
  updateAudioVisualizationBackgroundType,
  updateAudioVisualizationColor,
  updateAudioVisualizationStyle,
  updateAudioVisualizationTheme,
} from '../lib/exportSettingsHelpers';
import { readAudioVisualizationThemeSettings, saveAudioVisualizationThemeSettings } from '../../settings/appSettings';
import { showToast } from '../../lib/toast';
import { drawAudioVisualizationThemePreviewFrame } from '../../media/audioVisualizationThemePreview';

export function ThemePreviewButton({
  label,
  selected,
  source,
  style,
  testId,
  action,
  onSelect,
}: {
  label: string;
  selected: boolean;
  source: Parameters<typeof drawAudioVisualizationThemePreviewFrame>[1];
  style: ExportAudioVisualizationStyle;
  testId: string;
  action?: ReactNode;
  onSelect(): void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) {
      return;
    }
    drawAudioVisualizationThemePreviewFrame(context, source, style, canvas.width, canvas.height);
  }, [source, style]);

  return (
    <div className="relative">
      <button
        className={`w-full overflow-hidden rounded-md border text-left transition ${selected ? 'border-brand ring-2 ring-brand/30' : 'border-line hover:border-slate-400'}`}
        type="button"
        data-testid={testId}
        onClick={onSelect}
      >
        <canvas
          ref={canvasRef}
          className="block aspect-[16/9] w-full bg-slate-950"
          width={192}
          height={108}
          aria-hidden="true"
        />
        <span className="block truncate bg-white px-2 py-1.5 text-xs font-semibold text-slate-700">{label}</span>
      </button>
      {action ? <div className="absolute right-1 top-1">{action}</div> : null}
    </div>
  );
}

export function AudioVisualizationSection({
  visualization,
  setDraftSettings,
  onChooseImage,
}: {
  visualization: NonNullable<ExportPresetSettings['audioVisualization']>;
  setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>;
  onChooseImage(): void;
}) {
  const t = zhCN.exportDialog.audioVisualization;
  const [customThemes, setCustomThemes] = useState<CustomAudioVisualizationTheme[]>([]);
  const [customThemeName, setCustomThemeName] = useState('');
  const background = visualization.background;
  const backgroundType = background.type;
  const backgroundColor = background.type === 'image' ? '#050816' : background.color;
  const backgroundColor2 = background.type === 'gradient' ? background.color2 : '#1d4ed8';
  const backgroundPath = background.type === 'image' ? background.path : '';
  const selectedThemeId = visualization.themeId ?? MANUAL_AUDIO_VISUALIZATION_THEME_ID;
  const themeOptions = useMemo(() => [...BUILTIN_AUDIO_VISUALIZATION_THEMES, ...customThemes], [customThemes]);

  useEffect(() => {
    let canceled = false;
    void readAudioVisualizationThemeSettings()
      .then((settings) => {
        if (!canceled) {
          setCustomThemes(settings.customThemes);
        }
      })
      .catch(() => {
        if (!canceled) {
          setCustomThemes([]);
        }
      });
    return () => {
      canceled = true;
    };
  }, []);

  const saveCurrentTheme = async () => {
    try {
      const name = customThemeName.trim() || `${t.customThemes} ${customThemes.length + 1}`;
      const expanded = expandAudioVisualizationTheme({
        themeId: visualization.themeId,
        theme: visualization.theme,
        color: visualization.color,
        background: visualization.background.type === 'image' ? undefined : visualization.background,
      });
      const nextThemes = upsertCustomAudioVisualizationTheme(customThemes, {
        id: name,
        name,
        colorStart: expanded.colorStart,
        colorEnd: expanded.colorEnd,
        background: expanded.background,
        glow: expanded.glow,
        glowColor: expanded.glowColor,
        glowStrength: expanded.glowStrength,
        particles: expanded.particles,
        particleColor: expanded.particleColor,
        border: expanded.border,
        borderColor: expanded.borderColor,
        borderWidth: expanded.borderWidth,
      });
      const saved = await saveAudioVisualizationThemeSettings({ customThemes: nextThemes });
      setCustomThemes(saved.customThemes);
      const savedTheme = saved.customThemes.find((theme) => theme.id === nextThemes.at(-1)?.id);
      if (savedTheme) {
        updateAudioVisualizationTheme(setDraftSettings, savedTheme, saved.customThemes);
      }
      setCustomThemeName('');
    } catch (error) {
      showToast({
        kind: 'warning',
        title: t.saveThemeFailed,
        message: error instanceof Error ? error.message : t.saveThemeFailed,
      });
    }
  };

  const deleteCustomTheme = async (themeId: string) => {
    const nextThemes = removeCustomAudioVisualizationTheme(customThemes, themeId);
    const saved = await saveAudioVisualizationThemeSettings({ customThemes: nextThemes });
    setCustomThemes(saved.customThemes);
    if (selectedThemeId === themeId) {
      updateAudioVisualizationTheme(setDraftSettings, undefined, saved.customThemes);
    }
  };

  return (
    <section className="rounded-md border border-line p-3" data-testid="export-audio-viz-section">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-xs font-semibold text-slate-700">{t.title}</h3>
          <p className="mt-0.5 text-[11px] text-slate-500">{t.description}</p>
        </div>
      </div>
      <div className="mt-3 space-y-2">
        <div className="text-xs font-semibold text-slate-700">{t.theme}</div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3" data-testid="export-audio-viz-theme-grid">
          <ThemePreviewButton
            label={t.manualTheme}
            selected={selectedThemeId === MANUAL_AUDIO_VISUALIZATION_THEME_ID}
            source={{ color: visualization.color, background: backgroundType === 'image' ? undefined : background }}
            style={visualization.style}
            testId="export-audio-viz-theme-manual"
            onSelect={() => updateAudioVisualizationTheme(setDraftSettings, undefined, customThemes)}
          />
          {themeOptions.map((theme) => (
            <ThemePreviewButton
              key={theme.id}
              label={theme.name}
              selected={selectedThemeId === theme.id}
              source={{
                themeId: theme.id,
                theme: customThemes.some((item) => item.id === theme.id) ? theme : undefined,
              }}
              style={visualization.style}
              testId={`export-audio-viz-theme-${theme.id}`}
              onSelect={() => updateAudioVisualizationTheme(setDraftSettings, theme, customThemes)}
              action={
                customThemes.some((item) => item.id === theme.id) ? (
                  <button
                    className="rounded p-1 text-slate-400 hover:bg-white/10 hover:text-white"
                    type="button"
                    title={t.deleteTheme}
                    aria-label={t.deleteTheme}
                    data-testid={`export-audio-viz-theme-delete-${theme.id}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      void deleteCustomTheme(theme.id);
                    }}
                  >
                    <Trash2 size={12} />
                  </button>
                ) : undefined
              }
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            className="min-w-48 flex-1 rounded-md border border-line px-2 py-1.5 text-xs"
            value={customThemeName}
            placeholder={t.customThemeName}
            data-testid="export-audio-viz-custom-theme-name"
            onChange={(event) => setCustomThemeName(event.target.value)}
          />
          <button
            className="inline-flex items-center gap-2 rounded-md border border-line px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-panel"
            type="button"
            data-testid="export-audio-viz-save-theme"
            onClick={() => void saveCurrentTheme()}
          >
            <Save size={13} />
            {t.saveCustomTheme}
          </button>
        </div>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-4">
        <PresetSelectField
          label={t.style}
          value={visualization.style}
          onChange={(value) => updateAudioVisualizationStyle(setDraftSettings, value)}
          options={[...AUDIO_VISUALIZATION_STYLES]}
          testId="export-audio-viz-style-select"
        />
        <PresetColorField
          label={t.color}
          value={visualization.color}
          onChange={(value) => updateAudioVisualizationColor(setDraftSettings, value)}
          testId="export-audio-viz-color-input"
        />
        <PresetSelectField
          label={t.backgroundType}
          value={backgroundType}
          onChange={(value) => updateAudioVisualizationBackgroundType(setDraftSettings, value)}
          options={[...AUDIO_VISUALIZATION_BACKGROUND_TYPES]}
          testId="export-audio-viz-background-select"
        />
        {backgroundType === 'image' ? (
          <div className="space-y-1 text-xs font-medium text-slate-600 md:col-span-2">
            <span>{t.backgroundImage}</span>
            <div className="flex gap-2">
              <input
                className="min-w-0 flex-1 rounded-md border border-line px-2 py-1.5"
                value={backgroundPath}
                onChange={(event) => updateAudioVisualizationBackgroundImagePath(setDraftSettings, event.target.value)}
                data-testid="export-audio-viz-background-image-input"
              />
              <button
                className="rounded-md border border-line px-2 py-1.5 text-xs font-medium hover:bg-panel"
                type="button"
                data-testid="export-audio-viz-background-image-button"
                onClick={onChooseImage}
              >
                {t.chooseImage}
              </button>
            </div>
          </div>
        ) : (
          <>
            <PresetColorField
              label={t.backgroundColor}
              value={backgroundColor}
              onChange={(value) => updateAudioVisualizationBackgroundColor(setDraftSettings, 'color', value)}
              testId="export-audio-viz-background-color-input"
            />
            {backgroundType === 'gradient' ? (
              <PresetColorField
                label={t.backgroundColor2}
                value={backgroundColor2}
                onChange={(value) => updateAudioVisualizationBackgroundColor(setDraftSettings, 'color2', value)}
                testId="export-audio-viz-background-color2-input"
              />
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}

