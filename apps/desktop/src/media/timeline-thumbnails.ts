import {
  TIMELINE_THUMBNAIL_WIDTH,
  buildTimelineThumbnailCacheKey,
  calculateTimelineThumbnailTimestamps,
  type Clip,
  type MediaAsset
} from '@open-factory/editor-core';
import { zhCN } from '../i18n/strings';
import { sourceUrl } from '../lib/media';
import { getPreviewMediaPath } from './proxy';
import { runBackgroundMediaTask } from './background-media-task-queue';
import type { TimelineThumbnailWorkerInput, TimelineThumbnailWorkerOutput } from '../workers/timeline-thumbnail.worker';

type VideoClip = Extract<Clip, { type: 'video' }>;

export interface TimelineThumbnailFrame {
  key: string;
  timestamp: number;
  dataUrl?: string;
}

const THUMBNAIL_HEIGHT = 45;
const thumbnailCache = new Map<string, string>();
const pendingFrames = new Map<string, Promise<string>>();
const videos = new Map<string, HTMLVideoElement>();
const workerRequests = new Map<string, { resolve(dataUrl: string): void; reject(error: Error): void }>();
let worker: Worker | undefined;
let workerUnavailable = false;
let workerRequestId = 0;

export function getTimelineThumbnailPlaceholders(asset: MediaAsset, clip: VideoClip, pixelWidth: number): TimelineThumbnailFrame[] {
  const mediaPath = getPreviewMediaPath(asset);
  return calculateTimelineThumbnailTimestamps({
    clipDuration: clip.duration,
    clipPixelWidth: pixelWidth,
    trimStart: clip.trimStart,
    speed: clip.speed,
    keyframes: clip.keyframes
  }).map((timestamp) => {
    const key = buildTimelineThumbnailCacheKey(mediaPath, timestamp);
    return { key, timestamp, dataUrl: thumbnailCache.get(key) };
  });
}

export function getTimelineThumbnailPlaceholder(asset: MediaAsset, timestamp: number): TimelineThumbnailFrame {
  const mediaPath = getPreviewMediaPath(asset);
  const key = buildTimelineThumbnailCacheKey(mediaPath, timestamp);
  return { key, timestamp, dataUrl: thumbnailCache.get(key) };
}

export async function getTimelineThumbnails(asset: MediaAsset, clip: VideoClip, pixelWidth: number): Promise<TimelineThumbnailFrame[]> {
  const frames = getTimelineThumbnailPlaceholders(asset, clip, pixelWidth);
  if (frames.every((frame) => thumbnailCache.has(frame.key))) {
    return frames.map((frame) => ({ ...frame, dataUrl: thumbnailCache.get(frame.key) }));
  }
  return runBackgroundMediaTask(() => getTimelineThumbnailsUnthrottled(asset, clip, pixelWidth));
}

export async function getTimelineThumbnailFrame(asset: MediaAsset, timestamp: number): Promise<TimelineThumbnailFrame> {
  const frame = getTimelineThumbnailPlaceholder(asset, timestamp);
  if (thumbnailCache.has(frame.key)) {
    return { ...frame, dataUrl: thumbnailCache.get(frame.key) };
  }
  return runBackgroundMediaTask(async () => {
    const mediaPath = getPreviewMediaPath(asset);
    const pending = pendingFrames.get(frame.key) ?? generateTimelineThumbnail(mediaPath, timestamp).finally(() => pendingFrames.delete(frame.key));
    pendingFrames.set(frame.key, pending);
    const dataUrl = await pending.catch(() => undefined);
    if (dataUrl) {
      thumbnailCache.set(frame.key, dataUrl);
    }
    return { ...frame, dataUrl: thumbnailCache.get(frame.key) };
  });
}

async function getTimelineThumbnailsUnthrottled(asset: MediaAsset, clip: VideoClip, pixelWidth: number): Promise<TimelineThumbnailFrame[]> {
  const mediaPath = getPreviewMediaPath(asset);
  const frames = getTimelineThumbnailPlaceholders(asset, clip, pixelWidth);
  for (const frame of frames) {
    if (thumbnailCache.has(frame.key)) {
      continue;
    }
    const pending = pendingFrames.get(frame.key) ?? generateTimelineThumbnail(mediaPath, frame.timestamp).finally(() => pendingFrames.delete(frame.key));
    pendingFrames.set(frame.key, pending);
    const dataUrl = await pending.catch(() => undefined);
    if (dataUrl) {
      thumbnailCache.set(frame.key, dataUrl);
    }
  }
  return frames.map((frame) => ({ ...frame, dataUrl: thumbnailCache.get(frame.key) }));
}

async function generateTimelineThumbnail(mediaPath: string, timestamp: number): Promise<string> {
  const video = await getVideo(mediaPath);
  const duration = Number.isFinite(video.duration) ? video.duration : timestamp;
  const safeTime = Math.min(Math.max(0, timestamp), Math.max(0, duration - 0.035));
  await seekVideo(video, safeTime);
  const bitmap = await createImageBitmap(video).catch(() => undefined);
  if (bitmap) {
    return renderBitmapInWorker(bitmap, TIMELINE_THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT).catch(() => drawThumbnailOnMainThread(video));
  }
  return drawThumbnailOnMainThread(video);
}

async function getVideo(mediaPath: string): Promise<HTMLVideoElement> {
  const existing = videos.get(mediaPath);
  if (existing) {
    return existing;
  }
  const video = document.createElement('video');
  video.preload = 'auto';
  video.muted = true;
  video.playsInline = true;
  video.crossOrigin = 'anonymous';
  video.src = sourceUrl(mediaPath);
  videos.set(mediaPath, video);
  await once(video, 'loadedmetadata');
  return video;
}

function seekVideo(video: HTMLVideoElement, time: number): Promise<void> {
  if (Math.abs(video.currentTime - time) < 0.035 && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
    return Promise.resolve();
  }
  video.currentTime = time;
  return once(video, 'seeked');
}

function drawThumbnailOnMainThread(source: CanvasImageSource): string {
  const canvas = document.createElement('canvas');
  canvas.width = TIMELINE_THUMBNAIL_WIDTH;
  canvas.height = THUMBNAIL_HEIGHT;
  const context = canvas.getContext('2d');
  if (!context) {
    return '';
  }
  context.fillStyle = '#dbeafe';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.72);
}

function renderBitmapInWorker(bitmap: ImageBitmap, width: number, height: number): Promise<string> {
  const currentWorker = getWorker();
  if (!currentWorker) {
    bitmap.close();
    return Promise.reject(new Error('时间线缩略图 worker 不可用。'));
  }
  return new Promise((resolve, reject) => {
    const id = `thumb-${workerRequestId++}`;
    workerRequests.set(id, { resolve, reject });
    const payload: TimelineThumbnailWorkerInput = { id, bitmap, width, height };
    currentWorker.postMessage(payload, [bitmap]);
  });
}

function getWorker(): Worker | undefined {
  if (workerUnavailable) {
    return undefined;
  }
  if (worker) {
    return worker;
  }
  try {
    worker = new Worker(new URL('../workers/timeline-thumbnail.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<TimelineThumbnailWorkerOutput>) => {
      const request = workerRequests.get(event.data.id);
      if (!request) {
        return;
      }
      workerRequests.delete(event.data.id);
      if (event.data.success && event.data.dataUrl) {
        request.resolve(event.data.dataUrl);
      } else {
        request.reject(new Error(event.data.error ?? '时间线缩略图 worker 失败。'));
      }
    };
    worker.onerror = (event) => {
      workerUnavailable = true;
      worker?.terminate();
      worker = undefined;
      for (const [id, request] of workerRequests) {
        request.reject(new Error(event.message));
        workerRequests.delete(id);
      }
    };
  } catch {
    workerUnavailable = true;
  }
  return worker;
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
