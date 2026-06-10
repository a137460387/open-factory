import type { AssetType, MediaAsset } from '@open-factory/editor-core';
import { createId } from '@open-factory/editor-core';
import { readThumbnailFromCache, writeThumbnailToCache } from '../cache/cache-service';
import { extensionFromPath, fileNameFromPath, isTauriRuntime } from './tauri';
import { convertLocalFileSrc, getFileStat, openFileDialog, probeMedia, type MediaProbe } from './tauri-bridge';

export const VIDEO_EXTENSIONS = ['mp4', 'mov', 'webm', 'mkv'];
export const AUDIO_EXTENSIONS = ['mp3', 'wav', 'm4a', 'aac', 'ogg'];
export const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp'];

export function inferAssetType(path: string): AssetType | undefined {
  const extension = extensionFromPath(path);
  if (VIDEO_EXTENSIONS.includes(extension)) {
    return 'video';
  }
  if (AUDIO_EXTENSIONS.includes(extension)) {
    return 'audio';
  }
  if (IMAGE_EXTENSIONS.includes(extension)) {
    return 'image';
  }
  return undefined;
}

export async function pickMediaPaths(): Promise<string[]> {
  if (!isTauriRuntime() && !window.__TAURI_MOCKS__) {
    return pickBrowserFiles();
  }
  return openFileDialog(true, [{ name: 'Media', extensions: [...VIDEO_EXTENSIONS, ...AUDIO_EXTENSIONS, ...IMAGE_EXTENSIONS] }]);
}

export async function probeMediaPath(path: string): Promise<MediaAsset> {
  const type = inferAssetType(path);
  if (!type) {
    throw new Error(`Unsupported media type: ${path}`);
  }
  const mockProbe = window.__TAURI_MOCKS__?.probeMediaPath;
  const src = sourceUrl(path);
  const stat = isTauriRuntime() || window.__TAURI_MOCKS__ ? await getFileStat(path).catch(() => undefined) : undefined;
  const mediaProbe: MediaProbe = isTauriRuntime() || window.__TAURI_MOCKS__ ? await probeMedia(path).catch(() => ({ hasAudio: false })) : { hasAudio: false };
  const base: MediaAsset = {
    id: createId('asset'),
    type,
    name: fileNameFromPath(path),
    path,
    duration: 0,
    width: 0,
    height: 0,
    size: stat?.size,
    mtimeMs: stat?.mtimeMs,
    hasAudio: mediaProbe.hasAudio,
    audioChannels: mediaProbe.audioChannels,
    audioSampleRate: mediaProbe.audioSampleRate,
    audioCodec: mediaProbe.audioCodec,
    proxyStatus: type === 'video' ? 'none' : undefined
  };
  if (mockProbe) {
    const mock = await mockProbe(path);
    const asset = { ...base, ...mock, id: base.id, path, type, name: fileNameFromPath(path) };
    if (asset.thumbnail) {
      await writeThumbnailToCache(asset, asset.thumbnail, asset.width || 320, asset.height || 180);
    }
    return asset;
  }

  if (type === 'video') {
    const metadata = await loadVideoMetadata(src);
    const asset = {
      ...base,
      duration: metadata.duration,
      width: metadata.width,
      height: metadata.height
    };
    const cached = await readThumbnailFromCache(asset);
    const thumbnail = cached ?? (await createVideoThumbnail(src, metadata.duration));
    if (thumbnail && !cached) {
      await writeThumbnailToCache(asset, thumbnail, 320, 180);
    }
    return { ...asset, thumbnail };
  }
  if (type === 'audio') {
    return {
      ...base,
      duration: await loadAudioDuration(src),
      thumbnail: undefined
    };
  }
  const metadata = await loadImageMetadata(src);
  const asset = {
    ...base,
    width: metadata.width,
    height: metadata.height
  };
  const cached = await readThumbnailFromCache(asset);
  if (!cached && metadata.thumbnail) {
    await writeThumbnailToCache(asset, metadata.thumbnail, 320, 180);
  }
  return { ...asset, thumbnail: cached ?? metadata.thumbnail };
}

export async function probeMediaPaths(paths: string[], existingMedia: MediaAsset[]): Promise<{ media: MediaAsset[]; duplicateCount: number }> {
  const existingPaths = new Set(existingMedia.map((asset) => asset.path));
  const uniquePaths = paths.filter((path) => !existingPaths.has(path));
  const media: MediaAsset[] = [];
  for (const path of uniquePaths) {
    media.push(await probeMediaPath(path));
  }
  return {
    media,
    duplicateCount: paths.length - uniquePaths.length
  };
}

export function sourceUrl(path: string): string {
  if (isTauriRuntime()) {
    return convertLocalFileSrc(path);
  }
  return path;
}

async function pickBrowserFiles(): Promise<string[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = [...VIDEO_EXTENSIONS, ...AUDIO_EXTENSIONS, ...IMAGE_EXTENSIONS].map((extension) => `.${extension}`).join(',');
    input.onchange = () => {
      const files = Array.from(input.files ?? []);
      resolve(files.map((file) => URL.createObjectURL(file)));
    };
    input.click();
  });
}

function loadVideoMetadata(src: string): Promise<{ duration: number; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.addEventListener(
      'loadedmetadata',
      () => resolve({ duration: Number.isFinite(video.duration) ? video.duration : 0, width: video.videoWidth, height: video.videoHeight }),
      { once: true }
    );
    video.addEventListener('error', () => reject(new Error('Unable to read video metadata')), { once: true });
    video.src = src;
  });
}

function loadAudioDuration(src: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const audio = document.createElement('audio');
    audio.preload = 'metadata';
    audio.addEventListener('loadedmetadata', () => resolve(Number.isFinite(audio.duration) ? audio.duration : 0), { once: true });
    audio.addEventListener('error', () => reject(new Error('Unable to read audio metadata')), { once: true });
    audio.src = src;
  });
}

function loadImageMetadata(src: string): Promise<{ width: number; height: number; thumbnail?: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight, thumbnail: drawThumbnail(img) });
    };
    img.onerror = () => reject(new Error('Unable to read image metadata'));
    img.src = src;
  });
}

async function createVideoThumbnail(src: string, duration: number): Promise<string | undefined> {
  const video = document.createElement('video');
  video.preload = 'metadata';
  video.muted = true;
  video.src = src;
  await once(video, 'loadedmetadata');
  const seekTo = Math.min(1, Math.max(0, duration * 0.1));
  if (Number.isFinite(seekTo) && seekTo > 0) {
    video.currentTime = seekTo;
    await once(video, 'seeked');
  }
  return drawThumbnail(video);
}

function drawThumbnail(source: CanvasImageSource): string | undefined {
  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 180;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return '';
  }
  ctx.fillStyle = '#dfe5ec';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  try {
    return canvas.toDataURL('image/jpeg', 0.78);
  } catch {
    return undefined;
  }
}

function once(target: EventTarget, eventName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      target.removeEventListener(eventName, onEvent);
      target.removeEventListener('error', onError);
    };
    const onEvent = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error(`Media event failed: ${eventName}`));
    };
    target.addEventListener(eventName, onEvent, { once: true });
    target.addEventListener('error', onError, { once: true });
  });
}
