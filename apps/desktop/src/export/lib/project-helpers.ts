import {
  normalizeSubtitleLanguage,
  normalizeVideoRestoration,
  type Project,
} from '@open-factory/editor-core';
import { zhCN } from '../../i18n/strings';
import type { ExportPreset, ExportPresetImportConflictMode } from '../export-presets';
import type { SubtitleLanguageOption } from './constants';

// ---------------------------------------------------------------------------
// Project-derived helpers
// ---------------------------------------------------------------------------

export function countSpatialDenoiseClips(project: Project): number {
  return project.timeline.tracks
    .flatMap((track) => track.clips)
    .filter(
      (clip) =>
        (clip.type === 'video' || clip.type === 'nested-sequence') &&
        normalizeVideoRestoration(clip.videoRestoration).spatialDenoise.enabled,
    ).length;
}

export function safePresetPackageFileName(name: string): string {
  const normalized = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return normalized || 'open-factory-presets';
}

export function choosePresetPackageConflictMode(
  packageNames: string[],
  existingPresets: ExportPreset[],
): ExportPresetImportConflictMode | undefined {
  const existing = new Set(existingPresets.map((preset) => preset.name.toLowerCase()));
  const conflictName = packageNames.find((name) => existing.has(name.toLowerCase()));
  if (!conflictName) {
    return 'rename';
  }
  const response = window
    .prompt(zhCN.exportDialog.presetPackageConflictPrompt(conflictName), 'rename')
    ?.trim()
    .toLowerCase();
  if (!response) {
    return undefined;
  }
  return response === 'overwrite' || response === 'skip' || response === 'rename' ? response : 'rename';
}

export function collectSubtitleLanguageOptions(project: Project): SubtitleLanguageOption[] {
  const counts = new Map<string, number>();
  for (const track of project.timeline.tracks) {
    if (track.type !== 'subtitle' || track.clips.length === 0) {
      continue;
    }
    const language = normalizeSubtitleLanguage(track.language);
    counts.set(language, (counts.get(language) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([language, trackCount]) => ({
      language,
      label: formatSubtitleLanguageLabel(language),
      trackCount,
    }));
}

export function formatSubtitleLanguageLabel(language: string): string {
  const normalized = normalizeSubtitleLanguage(language);
  const labels = zhCN.exportDialog.subtitleLanguages.labels as Record<string, string>;
  return labels[normalized] ?? normalized.toUpperCase();
}
