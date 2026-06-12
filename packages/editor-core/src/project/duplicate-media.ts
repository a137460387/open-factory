export interface MediaContentSignature {
  assetId: string;
  name: string;
  path: string;
  size: number;
  headHash: string;
}

export interface DuplicateMediaCandidate {
  assetId: string;
  name: string;
  path: string;
}

export interface DuplicateMediaGroup {
  id: string;
  size: number;
  headHash: string;
  keepAssetId: string;
  assets: DuplicateMediaCandidate[];
}

export function detectDuplicateMediaGroups(signatures: MediaContentSignature[]): DuplicateMediaGroup[] {
  const bySignature = new Map<string, MediaContentSignature[]>();
  for (const signature of signatures) {
    if (!Number.isFinite(signature.size) || signature.size <= 0 || !signature.headHash.trim()) {
      continue;
    }
    const key = `${signature.size}|${signature.headHash.trim()}`;
    const group = bySignature.get(key) ?? [];
    group.push(signature);
    bySignature.set(key, group);
  }

  const groups: DuplicateMediaGroup[] = [];
  for (const group of bySignature.values()) {
    const distinctPaths = new Set(group.map((signature) => normalizePathKey(signature.path)));
    if (distinctPaths.size < 2) {
      continue;
    }
    const sorted = [...group].sort((left, right) => left.path.localeCompare(right.path) || left.assetId.localeCompare(right.assetId));
    groups.push({
      id: `duplicate-media-${groups.length}`,
      size: sorted[0].size,
      headHash: sorted[0].headHash,
      keepAssetId: sorted[0].assetId,
      assets: sorted.map(({ assetId, name, path }) => ({ assetId, name, path }))
    });
  }
  return groups.sort((left, right) => left.assets[0].path.localeCompare(right.assets[0].path) || left.id.localeCompare(right.id));
}

function normalizePathKey(path: string): string {
  return path.replace(/\\/g, '/').toLowerCase();
}
