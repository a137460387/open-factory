import type { MediaAsset, MediaMetadata, Project } from './model';

export type MediaRenameCaseTransform = 'none' | 'lower' | 'upper' | 'title';

export interface MediaRenameRules {
  template?: string;
  sequencePrefix?: boolean;
  datePrefix?: boolean;
  find?: string;
  replace?: string;
  caseTransform?: MediaRenameCaseTransform;
  removeSpecialCharacters?: boolean;
  startIndex?: number;
  date?: string;
}

export interface MediaRenamePreviewItem {
  assetId: string;
  originalName: string;
  requestedName: string;
  nextName: string;
  changed: boolean;
  conflictSuffix?: number;
}

export type BatchEditableMediaMetadata = Pick<MediaMetadata, 'title' | 'author' | 'description' | 'copyright' | 'date'>;

export const DEFAULT_MEDIA_RENAME_TEMPLATE = '{index:03d}_{date}_{originalName}';

export function buildMediaRenamePreview(assets: MediaAsset[], allAssets: MediaAsset[], rules: MediaRenameRules): MediaRenamePreviewItem[] {
  const selectedIds = new Set(assets.map((asset) => asset.id));
  const usedNames = new Set(allAssets.filter((asset) => !selectedIds.has(asset.id)).map((asset) => asset.name));
  return assets.map((asset, offset) => {
    const requestedName = applyMediaRenameRules(asset, rules, offset);
    const { name: nextName, suffix } = makeUniqueMediaName(requestedName, usedNames);
    usedNames.add(nextName);
    return {
      assetId: asset.id,
      originalName: asset.name,
      requestedName,
      nextName,
      changed: nextName !== asset.name,
      conflictSuffix: suffix
    };
  });
}

export function applyMediaRenameRules(asset: MediaAsset, rules: MediaRenameRules, offset = 0): string {
  const date = normalizeRenameDate(rules.date);
  const index = Math.max(1, Math.floor(rules.startIndex ?? 1) + offset);
  let name = rules.template?.trim()
    ? expandMediaRenameTemplate(rules.template, asset, { index, date })
    : asset.name;
  if (rules.datePrefix) {
    name = `${date}_${name}`;
  }
  if (rules.sequencePrefix) {
    name = `${String(index).padStart(3, '0')}_${name}`;
  }
  if (rules.find) {
    name = name.split(rules.find).join(rules.replace ?? '');
  }
  name = transformMediaNameStem(name, (stem) => {
    let next = stem;
    if (rules.caseTransform === 'lower') {
      next = next.toLowerCase();
    } else if (rules.caseTransform === 'upper') {
      next = next.toUpperCase();
    } else if (rules.caseTransform === 'title') {
      next = toTitleCase(next);
    }
    if (rules.removeSpecialCharacters) {
      next = next.replace(/[^\p{L}\p{N}\s._-]+/gu, '').replace(/\s+/g, ' ').trim();
    }
    return next;
  });
  return sanitizeMediaName(name, asset.name);
}

export function expandMediaRenameTemplate(template: string, asset: MediaAsset, context: { index: number; date: string }): string {
  const { stem, extension } = splitMediaName(asset.name);
  return template.replace(/\{([a-zA-Z]+)(?::(0?)(\d+)d)?\}/g, (match, key: string, zero: string | undefined, width: string | undefined) => {
    if (key === 'index') {
      const raw = String(Math.max(0, Math.floor(context.index)));
      return width ? raw.padStart(Number(width), zero ? '0' : ' ') : raw;
    }
    if (key === 'date') {
      return context.date;
    }
    if (key === 'originalName') {
      return asset.name;
    }
    if (key === 'originalStem') {
      return stem;
    }
    if (key === 'extension') {
      return extension.replace(/^\./, '');
    }
    return match;
  });
}

export function makeUniqueMediaName(name: string, usedNames: Set<string>): { name: string; suffix?: number } {
  const candidate = sanitizeMediaName(name, 'media');
  if (!usedNames.has(candidate)) {
    return { name: candidate };
  }
  const { stem, extension } = splitMediaName(candidate);
  for (let suffix = 2; suffix < 10_000; suffix += 1) {
    const next = `${stem}_${suffix}${extension}`;
    if (!usedNames.has(next)) {
      return { name: next, suffix };
    }
  }
  throw new Error(`Unable to resolve media name conflict for ${candidate}`);
}

export function replaceMediaPathBasename(path: string, nextName: string): string {
  const separatorIndex = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
  if (separatorIndex < 0) {
    return nextName;
  }
  return `${path.slice(0, separatorIndex + 1)}${nextName}`;
}

export function collectExportMediaMetadata(project: Pick<Project, 'media'> & Partial<Pick<Project, 'mediaMetadata'>>): BatchEditableMediaMetadata | undefined {
  const output: BatchEditableMediaMetadata = {};
  const mediaMetadata = project.mediaMetadata ?? {};
  for (const asset of project.media) {
    const metadata = mediaMetadata[asset.id];
    if (!metadata) {
      continue;
    }
    output.title ??= metadata.title;
    output.author ??= metadata.author;
    output.description ??= metadata.description;
    output.copyright ??= metadata.copyright;
    output.date ??= metadata.date;
  }
  return Object.keys(output).length > 0 ? output : undefined;
}

function normalizeRenameDate(value: string | undefined): string {
  const trimmed = value?.trim();
  if (trimmed) {
    return trimmed;
  }
  return new Date().toISOString().slice(0, 10).replaceAll('-', '');
}

function sanitizeMediaName(value: string, fallback: string): string {
  const normalized = value.replace(/[<>:"/\\|?*\u0000-\u001f]+/g, '').replace(/\s+/g, ' ').trim();
  if (normalized) {
    return normalized.slice(0, 180);
  }
  return fallback.trim() || 'media';
}

function transformMediaNameStem(name: string, transform: (stem: string) => string): string {
  const { stem, extension } = splitMediaName(name);
  return `${transform(stem)}${extension}`;
}

function toTitleCase(value: string): string {
  return value.toLowerCase().replace(/(^|[\s._-])(\p{L}|\p{N})/gu, (match) => match.toUpperCase());
}

function splitMediaName(name: string): { stem: string; extension: string } {
  const lastSlash = Math.max(name.lastIndexOf('/'), name.lastIndexOf('\\'));
  const fileName = lastSlash >= 0 ? name.slice(lastSlash + 1) : name;
  const dot = fileName.lastIndexOf('.');
  if (dot <= 0) {
    return { stem: fileName, extension: '' };
  }
  return { stem: fileName.slice(0, dot), extension: fileName.slice(dot) };
}
