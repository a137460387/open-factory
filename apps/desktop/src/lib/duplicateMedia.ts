import {
  createAudioRmsFingerprint,
  createVideoFingerprint,
  detectDuplicateMediaGroups,
  type DuplicateMediaGroup,
  type MediaAsset,
  type MediaContentSignature,
  type MediaFingerprint,
  type MediaMetadata,
} from '@open-factory/editor-core';
import { convertLocalFileSrc, getFileStat } from './tauri-bridge';

const DUPLICATE_HASH_BYTES = 4096;

export async function scanDuplicateMediaGroups(
  media: MediaAsset[],
  mediaMetadata: Record<string, MediaMetadata> = {},
): Promise<DuplicateMediaGroup[]> {
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
        headHash,
        fingerprint: mediaMetadata[asset.id]?.fingerprint,
      });
    } catch {
      continue;
    }
  }
  return detectDuplicateMediaGroups(signatures);
}

export async function generateMediaFingerprint(asset: MediaAsset): Promise<MediaFingerprint | undefined> {
  if (asset.missing || !asset.path.trim()) {
    return undefined;
  }
  const bytes = await readMediaHeadBytes(asset.path);
  if (asset.type === 'audio') {
    return createAudioRmsFingerprint(buildRmsVector(bytes, 10));
  }
  if (asset.type === 'video' || asset.type === 'image') {
    const frameHashes = [0, 1, 2].map((slot) => hashMediaHeadBytes(readByteWindow(bytes, slot)));
    const fingerprint = createVideoFingerprint(frameHashes);
    return asset.type === 'image' ? { ...fingerprint, kind: 'image' } : fingerprint;
  }
  return undefined;
}

export function hashMediaHeadBytes(bytes: Uint8Array): string {
  let hash = 2166136261;
  for (const byte of bytes.slice(0, DUPLICATE_HASH_BYTES)) {
    hash ^= byte;
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function readByteWindow(bytes: Uint8Array, slot: number): Uint8Array {
  if (bytes.length <= DUPLICATE_HASH_BYTES) {
    return bytes;
  }
  const available = Math.max(0, bytes.length - DUPLICATE_HASH_BYTES);
  const start = Math.min(available, Math.round((available * slot) / 2));
  return bytes.slice(start, start + DUPLICATE_HASH_BYTES);
}

function buildRmsVector(bytes: Uint8Array, bins: number): number[] {
  const binCount = Math.max(1, Math.round(bins));
  const binSize = Math.max(1, Math.ceil(bytes.length / binCount));
  return Array.from({ length: binCount }, (_, binIndex) => {
    const start = binIndex * binSize;
    const end = Math.min(bytes.length, start + binSize);
    if (start >= end) {
      return 0;
    }
    let total = 0;
    for (let index = start; index < end; index += 1) {
      const centered = (bytes[index] - 128) / 128;
      total += centered * centered;
    }
    return Math.sqrt(total / (end - start));
  });
}

async function readMediaHeadBytes(path: string): Promise<Uint8Array> {
  const response = await fetch(convertLocalFileSrc(path), {
    headers: { Range: `bytes=0-${DUPLICATE_HASH_BYTES - 1}` },
  });
  if (!response.ok) {
    throw new Error(`Unable to read media head: ${path}`);
  }
  return new Uint8Array(await response.arrayBuffer()).slice(0, DUPLICATE_HASH_BYTES);
}
