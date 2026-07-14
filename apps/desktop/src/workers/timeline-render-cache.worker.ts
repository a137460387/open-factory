import {
  TIMELINE_RENDER_CACHE_DEFAULT_MEMORY_BYTES,
  TIMELINE_RENDER_CACHE_RETAIN_SECONDS,
  TimelineRenderFrameCache,
  type TimelineRenderFrameCacheSnapshot,
  type TimelineRenderRange,
} from '@open-factory/editor-core';

export type TimelineRenderCacheWorkerInput =
  | {
      type: 'put';
      key: string;
      bitmap: ImageBitmap;
      time: number;
      duration: number;
      bytes: number;
      playheadTime: number;
    }
  | { type: 'get'; requestId: string; key: string }
  | { type: 'invalidate-ranges'; ranges: TimelineRenderRange[] }
  | { type: 'retain-around'; playheadTime: number }
  | { type: 'clear' };

export type TimelineRenderCacheWorkerOutput =
  | { type: 'snapshot'; snapshot: TimelineRenderFrameCacheSnapshot }
  | { type: 'frame'; requestId: string; key: string; hit: boolean; bitmap?: ImageBitmap }
  | { type: 'error'; requestId?: string; message: string };

const cache = new TimelineRenderFrameCache<ImageBitmap>({
  maxBytes: TIMELINE_RENDER_CACHE_DEFAULT_MEMORY_BYTES,
  disposeBitmap: (bitmap) => bitmap.close(),
});

self.onmessage = async (event: MessageEvent<TimelineRenderCacheWorkerInput>) => {
  try {
    const message = event.data;
    if (message.type === 'put') {
      cache.put({
        key: message.key,
        bitmap: message.bitmap,
        time: message.time,
        duration: message.duration,
        bytes: message.bytes,
      });
      postSnapshot(cache.retainAround(message.playheadTime, TIMELINE_RENDER_CACHE_RETAIN_SECONDS));
      return;
    }

    if (message.type === 'get') {
      const bitmap = cache.get(message.key);
      if (!bitmap) {
        postMessage({
          type: 'frame',
          requestId: message.requestId,
          key: message.key,
          hit: false,
        } satisfies TimelineRenderCacheWorkerOutput);
        return;
      }
      const copy = await createImageBitmap(bitmap);
      postMessage({
        type: 'frame',
        requestId: message.requestId,
        key: message.key,
        hit: true,
        bitmap: copy,
      } satisfies TimelineRenderCacheWorkerOutput);
      return;
    }

    if (message.type === 'invalidate-ranges') {
      let snapshot = cache.snapshot();
      for (const range of message.ranges) {
        snapshot = cache.invalidateRange(range.start, range.end);
      }
      postSnapshot(snapshot);
      return;
    }

    if (message.type === 'retain-around') {
      postSnapshot(cache.retainAround(message.playheadTime, TIMELINE_RENDER_CACHE_RETAIN_SECONDS));
      return;
    }

    postSnapshot(cache.clear());
  } catch (error) {
    postMessage({
      type: 'error',
      requestId: 'requestId' in event.data ? event.data.requestId : undefined,
      message: error instanceof Error ? error.message : String(error),
    } satisfies TimelineRenderCacheWorkerOutput);
  }
};

function postSnapshot(snapshot: TimelineRenderFrameCacheSnapshot): void {
  postMessage({ type: 'snapshot', snapshot } satisfies TimelineRenderCacheWorkerOutput);
}
