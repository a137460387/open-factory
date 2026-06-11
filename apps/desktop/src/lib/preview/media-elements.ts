import type { MediaAsset } from '@open-factory/editor-core';
import { zhCN } from '../../i18n/strings';
import { getAudioPreviewMediaPath, getPreviewMediaPath } from '../../media/proxy';
import { sourceUrl } from '../media';

export function createVideoElement(asset: MediaAsset): HTMLVideoElement {
  const video = document.createElement('video');
  video.preload = 'auto';
  video.muted = true;
  video.playsInline = true;
  video.crossOrigin = 'anonymous';
  video.src = sourceUrl(getPreviewMediaPath(asset));
  return video;
}

export function createAudioElement(asset: MediaAsset): HTMLAudioElement {
  const audio = document.createElement('audio');
  audio.preload = 'auto';
  audio.src = sourceUrl(getAudioPreviewMediaPath(asset));
  return audio;
}

export async function seekVideo(video: HTMLVideoElement, time: number): Promise<void> {
  if (video.readyState < HTMLMediaElement.HAVE_METADATA) {
    await once(video, 'loadedmetadata');
  }
  if (Math.abs(video.currentTime - time) < 0.035) {
    return;
  }
  video.currentTime = Math.min(time, Number.isFinite(video.duration) ? video.duration : time);
  await once(video, 'seeked');
}

export function loadImage(asset: MediaAsset): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`无法加载图片 ${asset.name}`));
    img.src = sourceUrl(getPreviewMediaPath(asset));
  });
}

export function loadThumbnail(asset: MediaAsset): Promise<HTMLImageElement | undefined> {
  if (!asset.thumbnail) {
    return Promise.resolve(undefined);
  }
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(undefined);
    img.src = asset.thumbnail ?? '';
  });
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
      reject(new Error(zhCN.errors.mediaEventFailed(eventName)));
    };
    target.addEventListener(eventName, onEvent, { once: true });
    target.addEventListener('error', onError, { once: true });
  });
}
