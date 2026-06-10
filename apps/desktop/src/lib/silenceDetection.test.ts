import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_CLIP_SPEED,
  DEFAULT_COLOR_CORRECTION,
  DEFAULT_TRANSFORM,
  type Clip,
  type MediaAsset
} from '@open-factory/editor-core';
import type { TauriMocks } from './tauri-bridge';
import { detectClipSilence, NATIVE_AUDIO_ANALYSIS_THRESHOLD_BYTES } from './silenceDetection';

describe('desktop silence native detection', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('uses native silence detection instead of fetch for large media files', async () => {
    const fetchMock = vi.fn(() => {
      throw new Error('fetch should not be called for large silence detection');
    });
    const getFileStat = vi.fn(() => ({
      path: 'C:/Media/large.wav',
      size: NATIVE_AUDIO_ANALYSIS_THRESHOLD_BYTES + 1,
      mtimeMs: 2_000
    }));
    const detectSilence = vi.fn(() => [[1, 1.5] satisfies [number, number]]);
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('window', {
      __TAURI_MOCKS__: {
        getFileStat,
        detectSilence
      } satisfies TauriMocks
    });

    const clip: Clip = {
      id: 'clip-large-audio',
      type: 'audio',
      name: 'large.wav',
      mediaId: 'asset-large-audio',
      trackId: 'track-audio',
      start: 0,
      duration: 2,
      trimStart: 0,
      trimEnd: 0,
      speed: DEFAULT_CLIP_SPEED,
      colorCorrection: { ...DEFAULT_COLOR_CORRECTION },
      transform: { ...DEFAULT_TRANSFORM },
      volume: 1
    };
    const asset: MediaAsset = {
      id: 'asset-large-audio',
      type: 'audio',
      name: 'large.wav',
      path: 'C:/Media/large.wav',
      duration: 2,
      width: 0,
      height: 0,
      hasAudio: true
    };

    const ranges = await detectClipSilence(clip, asset, {
      thresholdDb: -40,
      minSilenceDuration: 0.5,
      marginDuration: 0
    });

    expect(getFileStat).toHaveBeenCalledWith('C:/Media/large.wav');
    expect(detectSilence).toHaveBeenCalledWith('C:/Media/large.wav', -40, 500);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(ranges).toEqual([{ start: 1, end: 1.5, duration: 0.5 }]);
  });
});
