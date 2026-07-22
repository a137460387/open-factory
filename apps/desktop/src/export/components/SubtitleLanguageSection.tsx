import {
  normalizeSubtitleLanguageList,
  normalizeSubtitleLanguage,
} from '@open-factory/editor-core';
import { type Dispatch, type SetStateAction } from 'react';
import { type ExportPresetSettings } from '../export-presets';
import { zhCN } from '../../i18n/strings';
import {
  SubtitleLanguageOption,
  updateSubtitleBurnInLanguage,
  updateSubtitleLanguageSelection,
} from '../lib/exportSettingsHelpers';

export function SubtitleLanguageSection({
  options,
  selectedLanguages,
  burnInLanguage,
  setDraftSettings,
}: {
  options: SubtitleLanguageOption[];
  selectedLanguages?: string[];
  burnInLanguage?: string | null;
  setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>;
}) {
  const selected = normalizeSubtitleLanguageList(selectedLanguages);
  const enabledLanguages = selected ? new Set(selected) : new Set(options.map((option) => option.language));
  const activeBurnInLanguage = burnInLanguage
    ? normalizeSubtitleLanguage(burnInLanguage)
    : (options[0]?.language ?? 'zh');
  const t = zhCN.exportDialog.subtitleLanguages;
  return (
    <section className="rounded-md border border-line p-3 text-xs" data-testid="export-subtitle-language-section">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-semibold text-slate-700">{t.title}</div>
          <div className="mt-0.5 text-slate-500">{t.description}</div>
        </div>
        <label className="flex items-center gap-2 text-slate-600">
          <span>{t.burnInLanguage}</span>
          <select
            className="rounded-md border border-line px-2 py-1"
            value={activeBurnInLanguage}
            data-testid="export-subtitle-burn-language-select"
            onChange={(event) => updateSubtitleBurnInLanguage(setDraftSettings, event.target.value)}
          >
            {options.map((option) => (
              <option key={option.language} value={option.language}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {options.map((option) => (
          <label
            key={option.language}
            className="inline-flex items-center gap-2 rounded-md border border-line px-2 py-1.5 text-slate-700"
          >
            <input
              type="checkbox"
              checked={enabledLanguages.has(option.language)}
              onChange={(event) =>
                updateSubtitleLanguageSelection(setDraftSettings, option.language, event.currentTarget.checked, options)
              }
              data-testid={`export-subtitle-language-${option.language}`}
            />
            <span>{option.label}</span>
            <span className="text-slate-500">{t.trackCount(option.trackCount)}</span>
          </label>
        ))}
      </div>
    </section>
  );
}

