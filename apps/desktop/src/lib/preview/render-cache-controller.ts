import {
  TIMELINE_RENDER_CACHE_DEFAULT_MEMORY_BYTES,
  TIMELINE_RENDER_CACHE_RETAIN_SECONDS,
  TimelineRenderFrameCache,
  type TimelineRenderFrameCacheSnapshot,
  type TimelineRenderRange
} from '@open-factory/editor-core';
import { useRenderCacheStore } from '../../store/renderCacheStore';
import type { TimelineRenderCacheWorkerInput, TimelineRenderCacheWorkerOutput } from '../../workers/timeline-render-cache.worker';

export interface PutTimelineRenderFrameInput {
  key: string;
  bitmap: ImageBitmap;
  time: number;
  duration: number;
  bytes: number;
  playheadTime: number;
}

class TimelineRenderCacheController {
  private worker?: Worker;
  private workerUnavailable = false;
  private requestId = 0;
  private readonly pending = new Map<string, { resolve(bitmap?: ImageBitmap): void; reject(error: Error): void }>();
  private readonly localCache = new TimelineRenderFrameCache<ImageBitmap>({
    maxBytes: TIMELINE_RENDER_CACHE_DEFAULT_MEMORY_BYTES,
    disposeBitmap: (bitmap) => bitmap.close()
  });

  async getFrame(key: string): Promise<ImageBitmap | undefined> {
    const worker = this.getWorker();
    if (!worker) {
      const bitmap = this.localCache.get(key);
      return bitmap ? createImageBitmap(bitmap) : undefined;
    }

    return new Promise((resolve, reject) => {
      const requestId = `render-cache-${this.requestId++}`;
      this.pending.set(requestId, { resolve, reject });
      worker.postMessage({ type: 'get', requestId, key } satisfies TimelineRenderCacheWorkerInput);
    });
  }

  putFrame(input: PutTimelineRenderFrameInput): void {
    const worker = this.getWorker();
    if (!worker) {
      this.updateSnapshot(
        this.localCache.put({
          key: input.key,
          bitmap: input.bitmap,
          time: input.time,
          duration: input.duration,
          bytes: input.bytes
        })
      );
      this.updateSnapshot(this.localCache.retainAround(input.playheadTime, TIMELINE_RENDER_CACHE_RETAIN_SECONDS));
      return;
    }

    worker.postMessage(
      {
        type: 'put',
        key: input.key,
        bitmap: input.bitmap,
        time: input.time,
        duration: input.duration,
        bytes: input.bytes,
        playheadTime: input.playheadTime
      } satisfies TimelineRenderCacheWorkerInput,
      [input.bitmap]
    );
  }

  retainAround(playheadTime: number): void {
    const worker = this.getWorker();
    if (!worker) {
      this.updateSnapshot(this.localCache.retainAround(playheadTime, TIMELINE_RENDER_CACHE_RETAIN_SECONDS));
      return;
    }
    worker.postMessage({ type: 'retain-around', playheadTime } satisfies TimelineRenderCacheWorkerInput);
  }

  invalidateRanges(ranges: TimelineRenderRange[]): void {
    if (ranges.length === 0) {
      return;
    }
    const worker = this.getWorker();
    if (!worker) {
      let snapshot = this.localCache.snapshot();
      for (const range of ranges) {
        snapshot = this.localCache.invalidateRange(range.start, range.end);
      }
      this.updateSnapshot(snapshot);
      return;
    }
    worker.postMessage({ type: 'invalidate-ranges', ranges } satisfies TimelineRenderCacheWorkerInput);
  }

  clear(): void {
    const worker = this.getWorker();
    if (!worker) {
      this.updateSnapshot(this.localCache.clear());
      return;
    }
    worker.postMessage({ type: 'clear' } satisfies TimelineRenderCacheWorkerInput);
  }

  private getWorker(): Worker | undefined {
    if (this.workerUnavailable) {
      return undefined;
    }
    if (this.worker) {
      return this.worker;
    }
    try {
      this.worker = new Worker(new URL('../../workers/timeline-render-cache.worker.ts', import.meta.url), { type: 'module' });
      this.worker.onmessage = (event: MessageEvent<TimelineRenderCacheWorkerOutput>) => this.onWorkerMessage(event.data);
      this.worker.onerror = (event) => {
        this.workerUnavailable = true;
        this.worker?.terminate();
        this.worker = undefined;
        for (const [id, request] of this.pending) {
          request.reject(new Error(event.message));
          this.pending.delete(id);
        }
      };
    } catch {
      this.workerUnavailable = true;
    }
    return this.worker;
  }

  private onWorkerMessage(message: TimelineRenderCacheWorkerOutput): void {
    if (message.type === 'snapshot') {
      this.updateSnapshot(message.snapshot);
      return;
    }
    if (message.type === 'frame') {
      const request = this.pending.get(message.requestId);
      if (!request) {
        message.bitmap?.close();
        return;
      }
      this.pending.delete(message.requestId);
      request.resolve(message.hit ? message.bitmap : undefined);
      return;
    }
    if (message.requestId) {
      const request = this.pending.get(message.requestId);
      if (request) {
        this.pending.delete(message.requestId);
        request.reject(new Error(message.message));
      }
    }
  }

  private updateSnapshot(snapshot: TimelineRenderFrameCacheSnapshot): void {
    useRenderCacheStore.getState().setSnapshot(snapshot);
  }
}

let controller: TimelineRenderCacheController | undefined;

export function getTimelineRenderCacheController(): TimelineRenderCacheController {
  controller ??= new TimelineRenderCacheController();
  return controller;
}
