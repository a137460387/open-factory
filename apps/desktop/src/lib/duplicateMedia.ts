import { detectDuplicateMediaGroups, type DuplicateMediaGroup, type MediaAsset, type MediaContentSignature } from '@open-factory/editor-core';
import { convertLocalFileSrc, getFileStat } from './tauri-bridge';

export const DUPLICATE_HASH_BYTES = 4096;

export async function scanDuplicateMediaGroups(media: MediaAsset[]): Promise<DuplicateMediaGroup[]> {
  const signatures: MediaContentSignature[] = [];
  for (const asset of media) {
    if (asset.missing || !asset.path.trim()) {
      continue;
    }
    try {
      const stat = await getFileStat(asset.path);
      const headHash = hashMediaHeadBytes(await readMediaHeadBytes(asset.path));
      signatures.push({
        assetId: asset.id,
        name: asset.name,
        path: asset.path,
        size: stat.size,
        headHash
      });
    } catch {
      continue;
    }
  }
  return detectDuplicateMediaGroups(signatures);
}

export function hashMediaHeadBytes(bytes: Uint8Array): string {
  let hash = 2166136261;
  for (const byte of bytes.slice(0, DUPLICATE_HASH_BYTES)) {
    hash ^= byte;
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

async function readMediaHeadBytes(path: string): Promise<Uint8Array> {
  const response = await fetch(convertLocalFileSrc(path), {
    headers: { Range: `bytes=0-${DUPLICATE_HASH_BYTES - 1}` }
  });
  if (!response.ok) {
    throw new Error(`Unable to read media head: ${path}`);
  }
  return new Uint8Array(await response.arrayBuffer()).slice(0, DUPLICATE_HASH_BYTES);
}
