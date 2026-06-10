import type { MediaAsset } from '../model';

export interface BatchRelinkCandidate {
  path: string;
}

export interface BatchRelinkReplacement {
  assetId: string;
  candidatePath: string;
}

export interface BatchRelinkWarning {
  assetId: string;
  fileName: string;
  reason: 'no-match' | 'duplicate-candidates';
  candidatePaths: string[];
}

export interface BatchRelinkPlan {
  replacements: BatchRelinkReplacement[];
  warnings: BatchRelinkWarning[];
}

export interface BatchRelinkOptions {
  caseInsensitive?: boolean;
}

export function planBatchRelinkByFileName(
  media: MediaAsset[],
  candidates: BatchRelinkCandidate[],
  options: BatchRelinkOptions = {}
): BatchRelinkPlan {
  const caseInsensitive = options.caseInsensitive ?? false;
  const candidateIndex = new Map<string, string[]>();

  for (const candidate of candidates) {
    const key = normalizeKey(fileNameFromPath(candidate.path), caseInsensitive);
    const paths = candidateIndex.get(key) ?? [];
    paths.push(candidate.path);
    candidateIndex.set(key, paths);
  }

  const replacements: BatchRelinkReplacement[] = [];
  const warnings: BatchRelinkWarning[] = [];

  for (const asset of media.filter((item) => item.missing)) {
    const fileName = asset.name || fileNameFromPath(asset.path);
    const candidatePaths = candidateIndex.get(normalizeKey(fileName, caseInsensitive)) ?? [];
    if (candidatePaths.length === 0) {
      warnings.push({ assetId: asset.id, fileName, reason: 'no-match', candidatePaths: [] });
      continue;
    }
    if (candidatePaths.length > 1) {
      warnings.push({ assetId: asset.id, fileName, reason: 'duplicate-candidates', candidatePaths });
      continue;
    }
    replacements.push({ assetId: asset.id, candidatePath: candidatePaths[0] });
  }

  return { replacements, warnings };
}

export function fileNameFromPath(path: string): string {
  return path.replace(/\\/g, '/').split('/').pop() ?? path;
}

function normalizeKey(value: string, caseInsensitive: boolean): string {
  return caseInsensitive ? value.toLocaleLowerCase() : value;
}
