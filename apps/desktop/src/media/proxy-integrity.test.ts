import { describe, expect, it, vi } from 'vitest';
import { createProject, createTrack, type MediaAsset, type Project } from '@open-factory/editor-core';
import { runScheduledProxyIntegrityCheck } from './proxy-integrity';

const baseAsset: MediaAsset = {
  id: 'asset-video',
  type: 'video',
  name: 'source.mp4',
  path: 'C:/Media/source.mp4',
  duration: 10,
  width: 3840,
  height: 2160,
  size: 4000,
  mtimeMs: 1000,
  proxyPath: 'C:/Proxy/source.mp4',
  proxyStatus: 'ready',
  hasAudio: true,
  audioChannels: 2,
  audioSampleRate: 48000,
  audioCodec: 'aac'
};

describe('proxy integrity scheduler', () => {
  it('queues expired proxies once per interval', async () => {
    const enqueueProxyAssets = vi.fn();
    const setLastRunAtMs = vi.fn();
    const project = makeProxyProject();

    const result = await runScheduledProxyIntegrityCheck(project, {
      nowMs: 24 * 60 * 60 * 1000,
      getLastRunAtMs: () => undefined,
      setLastRunAtMs,
      fileExists: () => true,
      readFileStat: (path) => ({ size: path.includes('Proxy') ? 1024 : 4000, mtimeMs: path.includes('Proxy') ? 1500 : 3000 }),
      enqueueProxyAssets
    });

    expect(result.ran).toBe(true);
    expect(result.assetIds).toEqual(['asset-video']);
    expect(enqueueProxyAssets).toHaveBeenCalledWith(['asset-video']);
    expect(setLastRunAtMs).toHaveBeenCalledWith(24 * 60 * 60 * 1000);

    const skipped = await runScheduledProxyIntegrityCheck(project, {
      nowMs: 25 * 60 * 60 * 1000,
      getLastRunAtMs: () => 24 * 60 * 60 * 1000,
      enqueueProxyAssets
    });
    expect(skipped).toMatchObject({ ran: false, assetIds: [] });
  });
});

function makeProxyProject(): Project {
  const project = createProject('Proxy Integrity');
  return {
    ...project,
    media: [baseAsset],
    timeline: {
      tracks: [
        createTrack({
          id: 'track-video',
          type: 'video',
          name: 'Video 1',
          clips: [
            {
              id: 'clip-video',
              type: 'video',
              mediaId: 'asset-video',
              trackId: 'track-video',
              name: 'source.mp4',
              start: 0,
              duration: 10,
              trimStart: 0,
              trimEnd: 0,
              speed: 1,
              transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
              colorCorrection: { brightness: 0, contrast: 1, saturation: 1, hue: 0 },
              volume: 1
            }
          ]
        })
      ]
    }
  };
}
