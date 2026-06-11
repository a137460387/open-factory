import type { TimelineRenderFrameCacheSnapshot, TimelineRenderRange } from '@open-factory/editor-core';
import { create } from 'zustand';

export interface RenderCacheState {
  ranges: TimelineRenderRange[];
  bytes: number;
  count: number;
  setSnapshot: (snapshot: TimelineRenderFrameCacheSnapshot) => void;
  clear: () => void;
}

export const useRenderCacheStore = create<RenderCacheState>((set) => ({
  ranges: [],
  bytes: 0,
  count: 0,
  setSnapshot: (snapshot) => set({ ranges: snapshot.ranges, bytes: snapshot.bytes, count: snapshot.count }),
  clear: () => set({ ranges: [], bytes: 0, count: 0 })
}));
