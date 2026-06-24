import type { TimelineRenderFrameCacheSnapshot, TimelineRenderRange } from '@open-factory/editor-core';
import { create } from 'zustand';

export interface RenderCacheState {
  ranges: TimelineRenderRange[];
  staleRanges: TimelineRenderRange[];
  bytes: number;
  count: number;
  setSnapshot: (snapshot: TimelineRenderFrameCacheSnapshot) => void;
  setStaleRanges: (ranges: TimelineRenderRange[]) => void;
  clear: () => void;
}

export const useRenderCacheStore = create<RenderCacheState>((set) => ({
  ranges: [],
  staleRanges: [],
  bytes: 0,
  count: 0,
  setSnapshot: (snapshot) => set({ ranges: snapshot.ranges, bytes: snapshot.bytes, count: snapshot.count }),
  setStaleRanges: (staleRanges) => set({ staleRanges }),
  clear: () => set({ ranges: [], staleRanges: [], bytes: 0, count: 0 })
}));
