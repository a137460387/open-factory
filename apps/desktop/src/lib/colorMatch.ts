import {
  buildColorMatchCurves,
  getClipSourceVisibleDuration,
  type Clip,
  type ColorCurves,
  type ColorMatchFrameSample,
  type MediaAsset,
} from '@open-factory/editor-core';
import { sourceUrl } from './media';
import { readColorMatchFrameSample } from './tauri-bridge';

const SAMPLE_SIZE = 64;

export async function buildClipColorMatchCurves(
  targetClip: Clip,
  referenceClip: Clip,
  media: MediaAsset[],
): Promise<ColorCurves> {
  const targetSample = await readClipFrameSample(targetClip, media);
  const referenceSample = await readClipFrameSample(referenceClip, media);
  return buildColorMatchCurves(targetSample, referenceSample);
}

async function readClipFrameSample(clip: Clip, media: MediaAsset[]): Promise<ColorMatchFrameSample> {
  if (!('mediaId' in clip)) {
    throw new Error('Color match requires a media clip.');
  }
  const asset = media.find((item) => item.id === clip.mediaId);
  if (!asset) {
    throw new Error('Color match media is missing.');
  }
  const mockSample = await readColorMatchFrameSample(asset.path);
  if (mockSample) {
    return mockSample;
  }
  if (asset.type === 'image') {
    return readImageSample(asset.path);
  }
  if (asset.type === 'video') {
    const sourceTime = Math.max(0, clip.trimStart + getClipSourceVisibleDuration(clip) * 0.5);
    return readVideoSample(asset.path, sourceTime);
  }
  throw new Error('Color match supports video and image clips.');
}

async function readImageSample(path: string): Promise<ColorMatchFrameSample> {
  const image = new Image();
  image.decoding = 'async';
  image.src = sourceUrl(path);
  await image.decode();
  return drawElementSample(image, image.naturalWidth, image.naturalHeight);
}

async function readVideoSample(path: string, time: number): Promise<ColorMatchFrameSample> {
  const video = document.createElement('video');
  video.preload = 'auto';
  video.muted = true;
  video.src = sourceUrl(path);
  await waitForVideoMetadata(video);
  const seekTime = Math.min(
    Math.max(0, time),
    Math.max(0, (Number.isFinite(video.duration) ? video.duration : time) - 0.001),
  );
  await seekVideoFrame(video, seekTime);
  return drawElementSample(video, video.videoWidth, video.videoHeight);
}

function drawElementSample(
  element: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
): ColorMatchFrameSample {
  const width = Math.max(1, Math.min(SAMPLE_SIZE, sourceWidth || SAMPLE_SIZE));
  const height = Math.max(1, Math.min(SAMPLE_SIZE, sourceHeight || SAMPLE_SIZE));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    throw new Error('Color match readback is unavailable.');
  }
  context.drawImage(element, 0, 0, width, height);
  const data = context.getImageData(0, 0, width, height).data;
  return { width, height, data };
}

function waitForVideoMetadata(video: HTMLVideoElement): Promise<void> {
  if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    video.addEventListener('loadedmetadata', () => resolve(), { once: true });
    video.addEventListener('error', () => reject(new Error('Color match video metadata is unavailable.')), {
      once: true,
    });
  });
}

function seekVideoFrame(video: HTMLVideoElement, time: number): Promise<void> {
  if (Math.abs(video.currentTime - time) < 0.001 && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      video.removeEventListener('seeked', onReady);
      video.removeEventListener('loadeddata', onReady);
      video.removeEventListener('error', onError);
    };
    const onReady = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error('Color match video frame readback failed.'));
    };
    video.addEventListener('seeked', onReady, { once: true });
    video.addEventListener('loadeddata', onReady, { once: true });
    video.addEventListener('error', onError, { once: true });
    video.currentTime = time;
  });
}
