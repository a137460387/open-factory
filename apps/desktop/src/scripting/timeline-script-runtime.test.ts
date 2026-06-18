import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TimelineScriptSnapshot } from '@open-factory/editor-core';
import {
  TIMELINE_SCRIPT_DISABLED_GLOBALS,
  TIMELINE_SCRIPT_TIMEOUT_MS,
  createTimelineScriptWorkerSource,
  executeTimelineScriptInIsolatedScope,
  runTimelineScriptInWorker,
  type TimelineScriptWorkerLike
} from './timeline-script-runtime';

const snapshot: TimelineScriptSnapshot = {
  clips: [
    {
      id: 'clip-a',
      type: 'video',
      name: 'A',
      mediaId: 'media-a',
      trackId: 'track-video',
      start: 0,
      duration: 2,
      trimStart: 0,
      trimEnd: 0,
      speed: 1,
      colorCorrection: { brightness: 0, contrast: 1, saturation: 1, hue: 0 },
      transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
      volume: 1
    }
  ],
  markers: [],
  duration: 2
};

describe('timeline script runtime', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('captures console.log output and queued timeline operations', async () => {
    const result = await executeTimelineScriptInIsolatedScope('console.log("clips", getClips().length); updateClip("clip-a", { speed: 1.25 });', snapshot);

    expect(result.logs).toEqual(['clips 1']);
    expect(result.operations).toEqual([{ type: 'updateClip', clipId: 'clip-a', patch: { speed: 1.25 } }]);
  });

  it('isolates fetch and XMLHttpRequest from scripts', async () => {
    expect(TIMELINE_SCRIPT_DISABLED_GLOBALS).toEqual(['fetch', 'XMLHttpRequest']);

    const result = await executeTimelineScriptInIsolatedScope('console.log(typeof fetch); console.log(typeof XMLHttpRequest);', snapshot);

    expect(result.logs).toEqual(['undefined', 'undefined']);
    expect(createTimelineScriptWorkerSource()).toContain('XMLHttpRequest');
  });

  it('terminates a worker through the 10s watchdog', async () => {
    vi.useFakeTimers();
    const terminations: string[] = [];

    class HangingWorker implements TimelineScriptWorkerLike {
      onmessage: TimelineScriptWorkerLike['onmessage'] = null;
      onerror: TimelineScriptWorkerLike['onerror'] = null;

      constructor(private readonly url: string) {}

      postMessage(): void {
        // Intentionally never responds.
      }

      terminate(): void {
        terminations.push(this.url);
      }
    }

    const promise = runTimelineScriptInWorker(
      { script: 'while (true) {}', snapshot, timeoutMs: TIMELINE_SCRIPT_TIMEOUT_MS },
      {
        WorkerCtor: HangingWorker,
        createObjectUrl: () => 'blob:timeline-script-test',
        revokeObjectUrl: () => undefined
      }
    );
    const assertion = expect(promise).rejects.toThrow('10s');

    await vi.advanceTimersByTimeAsync(TIMELINE_SCRIPT_TIMEOUT_MS);

    await assertion;
    expect(terminations).toEqual(['blob:timeline-script-test']);
  });
});
