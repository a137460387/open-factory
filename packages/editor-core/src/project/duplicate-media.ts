import type { MediaFingerprint } from '../model-types';
import { areMediaFingerprintsEquivalent } from '../media-fingerprint';

export interface MediaContentSignature {
  assetId: string;
  name: string;
  path: string;
  size: number;
  headHash: string;
  fingerprint?: MediaFingerprint;
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
  fingerprintHash?: string;
  keepAssetId: string;
  assets: DuplicateMediaCandidate[];
}

export function detectDuplicateMediaGroups(signatures: MediaContentSignature[]): DuplicateMediaGroup[] {
  const bySignature = new Map<string, MediaContentSignature[]>();
  const fingerprintSignatures: MediaContentSignature[] = [];
  for (const signature of signatures) {
    if (signature.fingerprint) {
      fingerprintSignatures.push(signature);
      continue;
    }
    if (!Number.isFinite(signature.size) || signature.size <= 0 || !signature.headHash.trim()) {
      continue;
    }
    const key = `${signature.size}|${signature.headHash.trim()}`;
    const group = bySignature.get(key) ?? [];
    group.push(signature);
    bySignature.set(key, group);
  }

  const groups: DuplicateMediaGroup[] = [];
  groups.push(...buildFingerprintDuplicateGroups(fingerprintSignatures));
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

function buildFingerprintDuplicateGroups(signatures: MediaContentSignature[]): DuplicateMediaGroup[] {
  const groups: DuplicateMediaGroup[] = [];
  const visited = new Set<string>();
  for (const signature of signatures) {
    if (visited.has(signature.assetId)) {
      continue;
    }
    const matches = signatures.filter((candidate) => !visited.has(candidate.assetId) && candidate.assetId !== signature.assetId && areMediaFingerprintsEquivalent(signature.fingerprint, candidate.fingerprint));
    const group = [signature, ...matches];
    const distinctPaths = new Set(group.map((item) => normalizePathKey(item.path)));
    if (distinctPaths.size < 2) {
      continue;
    }
    for (const item of group) {
      visited.add(item.assetId);
    }
    const sorted = [...group].sort((left, right) => left.path.localeCompare(right.path) || left.assetId.localeCompare(right.assetId));
    groups.push({
      id: `duplicate-media-${groups.length}`,
      size: sorted[0].size,
      headHash: sorted[0].headHash,
      fingerprintHash: sorted[0].fingerprint?.hash,
      keepAssetId: sorted[0].assetId,
      assets: sorted.map(({ assetId, name, path }) => ({ assetId, name, path }))
    });
  }
  return groups;
}

function normalizePathKey(path: string): string {
  return path.replace(/\\/g, '/').toLowerCase();
}
