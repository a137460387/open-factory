import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MediaAsset } from '@open-factory/editor-core';
import type { TauriMocks } from '../lib/tauri-bridge';
import { getWaveform, NATIVE_AUDIO_ANALYSIS_THRESHOLD_BYTES } from './waveform';

describe('desktop waveform native analysis', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('uses native analysis instead of fetch for large media files', async () => {
    const fetchMock = vi.fn(() => {
      throw new Error('fetch should not be called for large waveform analysis');
    });
    const getFileStat = vi.fn(() => ({
      path: 'C:/Media/large.wav',
      size: NATIVE_AUDIO_ANALYSIS_THRESHOLD_BYTES + 1,
      mtimeMs: 2_000
    }));
    const analyzeWaveform = vi.fn(() => [0, 0.5, 0.25]);
    const writeCache = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('window', {
      __TAURI_MOCKS__: {
        getFileStat,
        analyzeWaveform,
        writeCache
      } satisfies TauriMocks
    });

    const asset: MediaAsset = {
      id: 'asset-large-audio',
      type: 'audio',
      name: 'large.wav',
      path: 'C:/Media/large.wav',
      duration: 3,
      width: 0,
      height: 0,
      hasAudio: true,
      audioChannels: 1
    };

    const waveform = await getWaveform(asset, 3);

    expect(getFileStat).toHaveBeenCalledWith('C:/Media/large.wav');
    expect(analyzeWaveform).toHaveBeenCalledWith('C:/Media/large.wav', 3);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(waveform).toEqual({
      peaks: [0, 0.5, 0.25],
      duration: 3,
      channels: 1,
      isSampled: true
    });
  });
});
