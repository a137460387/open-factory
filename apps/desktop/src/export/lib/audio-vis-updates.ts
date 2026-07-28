import type { Dispatch, SetStateAction } from 'react';
import {
  expandAudioVisualizationTheme,
  normalizeSubtitleLanguage,
  normalizeSubtitleLanguageList,
  type AudioVisualizationThemeDefinition,
  type CustomAudioVisualizationTheme,
  type ExportAudioVisualizationBackground,
  type ExportAudioVisualizationStyle,
} from '@open-factory/editor-core';
import type { ExportPresetSettings } from '../export-presets';
import {
  AUDIO_VISUALIZATION_BACKGROUND_TYPES,
  AUDIO_VISUALIZATION_STYLES,
  DEFAULT_AUDIO_VISUALIZATION,
  MANUAL_AUDIO_VISUALIZATION_THEME_ID,
  type SubtitleLanguageOption,
} from './constants';
import {
  normalizeAudioVisualizationDraft,
  normalizeHexColor,
  normalizeSubtitleFormat,
} from './draft-normalizers';

// ---------------------------------------------------------------------------
// Audio visualization updates
// ---------------------------------------------------------------------------

export function updateAudioVisualizationStyle(
  setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>,
  value: string,
): void {
  setDraftSettings((current) => ({
    ...current,
    audioVisualization: {
      ...normalizeAudioVisualizationDraft(current.audioVisualization),
      style: AUDIO_VISUALIZATION_STYLES.includes(value as ExportAudioVisualizationStyle)
        ? (value as ExportAudioVisualizationStyle)
        : 'waveform-line',
    },
  }));
}

export function updateAudioVisualizationTheme(
  setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>,
  theme: AudioVisualizationThemeDefinition | undefined,
  customThemes: readonly CustomAudioVisualizationTheme[],
): void {
  setDraftSettings((current) => {
    const visualization = normalizeAudioVisualizationDraft(current.audioVisualization);
    if (!theme) {
      const nextVisualization = {
        ...visualization,
        themeId: MANUAL_AUDIO_VISUALIZATION_THEME_ID,
      };
      delete nextVisualization.theme;
      return { ...current, audioVisualization: nextVisualization };
    }
    const isCustom = customThemes.some((item) => item.id === theme.id);
    const expanded = expandAudioVisualizationTheme({ themeId: theme.id, theme: isCustom ? theme : undefined });
    const nextVisualization: NonNullable<ExportPresetSettings['audioVisualization']> = {
      ...visualization,
      themeId: theme.id,
      color: expanded.colorStart,
      background: audioVisualizationBackgroundFromTheme(expanded.background),
    };
    if (isCustom) {
      nextVisualization.theme = theme;
    } else {
      delete nextVisualization.theme;
    }
    return {
      ...current,
      audioVisualization: nextVisualization,
    };
  });
}

export function updateAudioVisualizationColor(
  setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>,
  value: string,
): void {
  setDraftSettings((current) => {
    const nextVisualization = {
      ...normalizeAudioVisualizationDraft(current.audioVisualization),
      color: normalizeHexColor(value, DEFAULT_AUDIO_VISUALIZATION.color),
      themeId: MANUAL_AUDIO_VISUALIZATION_THEME_ID,
    };
    delete nextVisualization.theme;
    return { ...current, audioVisualization: nextVisualization };
  });
}

export function updateAudioVisualizationBackgroundType(
  setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>,
  value: string,
): void {
  setDraftSettings((current) => {
    const visualization = normalizeAudioVisualizationDraft(current.audioVisualization);
    const type = AUDIO_VISUALIZATION_BACKGROUND_TYPES.includes(value as ExportAudioVisualizationBackground['type'])
      ? (value as ExportAudioVisualizationBackground['type'])
      : 'solid';
    const nextVisualization = {
      ...visualization,
      themeId: MANUAL_AUDIO_VISUALIZATION_THEME_ID,
      background:
        type === 'image'
          ? {
              type: 'image' as const,
              path: visualization.background.type === 'image' ? visualization.background.path : '',
            }
          : type === 'gradient'
            ? { type: 'gradient' as const, color: backgroundPrimaryColor(visualization.background), color2: '#1d4ed8' }
            : { type: 'solid' as const, color: backgroundPrimaryColor(visualization.background) },
    };
    delete nextVisualization.theme;
    return {
      ...current,
      audioVisualization: nextVisualization,
    };
  });
}

export function updateAudioVisualizationBackgroundColor(
  setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>,
  key: 'color' | 'color2',
  value: string,
): void {
  setDraftSettings((current) => {
    const visualization = normalizeAudioVisualizationDraft(current.audioVisualization);
    const background = visualization.background;
    if (background.type === 'gradient') {
      const nextVisualization: NonNullable<ExportPresetSettings['audioVisualization']> = {
        ...visualization,
        themeId: MANUAL_AUDIO_VISUALIZATION_THEME_ID,
        background: { ...background, [key]: normalizeHexColor(value, key === 'color' ? '#050816' : '#1d4ed8') },
      };
      delete nextVisualization.theme;
      return {
        ...current,
        audioVisualization: nextVisualization,
      };
    }
    const nextVisualization: NonNullable<ExportPresetSettings['audioVisualization']> = {
      ...visualization,
      themeId: MANUAL_AUDIO_VISUALIZATION_THEME_ID,
      background: { type: 'solid' as const, color: normalizeHexColor(value, '#050816') },
    };
    delete nextVisualization.theme;
    return {
      ...current,
      audioVisualization: nextVisualization,
    };
  });
}

export function updateAudioVisualizationBackgroundImagePath(
  setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>,
  path: string,
): void {
  setDraftSettings((current) => {
    const visualization = normalizeAudioVisualizationDraft(current.audioVisualization);
    const nextVisualization = {
      ...visualization,
      themeId: MANUAL_AUDIO_VISUALIZATION_THEME_ID,
      background: { type: 'image' as const, path },
    };
    delete nextVisualization.theme;
    return {
      ...current,
      audioVisualization: nextVisualization,
    };
  });
}

// ---------------------------------------------------------------------------
// Subtitle updates
// ---------------------------------------------------------------------------

export function updateSubtitleMode(
  setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>,
  value: string,
): void {
  setDraftSettings((current) => {
    const next = { ...current };
    if (value === 'burn-in' || value === 'soft-sub') {
      next.subtitleMode = value;
    } else {
      delete next.subtitleMode;
    }
    return next;
  });
}

export function updateSubtitleFormat(
  setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>,
  value: string,
): void {
  setDraftSettings((current) => ({ ...current, subtitleFormat: normalizeSubtitleFormat(value) }));
}

export function updateExportSidecarSubtitle(
  setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>,
  checked: boolean,
): void {
  setDraftSettings((current) => ({ ...current, exportSidecarSubtitle: checked }));
}

export function updateSubtitleLanguageSelection(
  setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>,
  language: string,
  checked: boolean,
  options: SubtitleLanguageOption[],
): void {
  const normalized = normalizeSubtitleLanguage(language);
  setDraftSettings((current) => {
    const selected =
      normalizeSubtitleLanguageList(current.subtitleLanguages) ?? options.map((option) => option.language);
    const next = checked
      ? Array.from(new Set([...selected, normalized]))
      : selected.filter((item) => item !== normalized);
    const available = new Set(options.map((option) => option.language));
    return {
      ...current,
      subtitleLanguages: next.filter((item) => available.has(item)),
    };
  });
}

export function updateSubtitleBurnInLanguage(
  setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>,
  language: string,
): void {
  setDraftSettings((current) => ({ ...current, subtitleBurnInLanguage: normalizeSubtitleLanguage(language) }));
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function audioVisualizationBackgroundFromTheme(
  background: ReturnType<typeof expandAudioVisualizationTheme>['background'],
): ExportAudioVisualizationBackground {
  return background.type === 'gradient'
    ? { type: 'gradient', color: background.color, color2: background.color2 }
    : { type: 'solid', color: background.color };
}

function backgroundPrimaryColor(background: ExportAudioVisualizationBackground): string {
  return background.type === 'image' ? '#050816' : background.color;
}
