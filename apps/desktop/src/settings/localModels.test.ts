import { describe, expect, it } from 'vitest';
import {
  isLocalModelFileSizeValid,
  normalizeLocalAiModelsSettings,
  resolveLocalModelStatus,
  type LocalAiModelId,
} from './localModels';

describe('local AI model settings', () => {
  it('normalizes independent model paths', () => {
    expect(
      normalizeLocalAiModelsSettings({
        whisper: { path: ' C:/Models/base.bin ', version: ' whisper.cpp ' },
        demucs: { path: 'C:/Tools/demucs.exe' },
        unknown: { path: 'C:/Other/model.bin' },
      }),
    ).toEqual({
      whisper: { path: 'C:/Models/base.bin', version: 'whisper.cpp' },
      demucs: { path: 'C:/Tools/demucs.exe' },
    });
  });

  it('validates model file sizes against per-model ranges', () => {
    expect(isLocalModelFileSizeValid('whisper', 4096)).toBe(true);
    expect(isLocalModelFileSizeValid('whisper', 1)).toBe(false);
    expect(isLocalModelFileSizeValid('yunet', 200 * 1024 * 1024)).toBe(false);
  });

  it('resolves installed, missing, and invalid statuses', async () => {
    const sizes: Partial<Record<LocalAiModelId, number>> = {
      whisper: 4096,
      demucs: 512,
      yunet: 4096,
    };
    const dependencies = {
      exists: async (path: string) => path !== 'C:/Missing/model.bin',
      stat: async (path: string) => {
        const id = path.includes('demucs') ? 'demucs' : path.includes('yunet') ? 'yunet' : 'whisper';
        return { path, size: sizes[id] ?? 4096, mtimeMs: 1_000 };
      },
    };

    await expect(
      resolveLocalModelStatus('whisper', { path: 'C:/Models/base.bin' }, dependencies),
    ).resolves.toMatchObject({
      status: 'installed',
      size: 4096,
    });
    await expect(
      resolveLocalModelStatus('whisper', { path: 'C:/Missing/model.bin' }, dependencies),
    ).resolves.toMatchObject({
      status: 'missing',
      reason: 'missing',
    });
    await expect(
      resolveLocalModelStatus('demucs', { path: 'C:/Models/demucs.pt' }, dependencies),
    ).resolves.toMatchObject({
      status: 'invalid',
      reason: 'size',
    });
  });
});
