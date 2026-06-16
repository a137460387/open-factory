export type PreviewWindowSyncSource = 'main' | 'preview-window';

export interface PreviewWindowPlaybackState {
  source: PreviewWindowSyncSource;
  playheadTime: number;
  isPlaying: boolean;
  updatedAt: number;
}

export function createPreviewWindowPlaybackState(
  source: PreviewWindowSyncSource,
  playheadTime: number,
  isPlaying: boolean,
  now: number = Date.now()
): PreviewWindowPlaybackState {
  return {
    source,
    playheadTime: normalizePlayheadTime(playheadTime),
    isPlaying,
    updatedAt: Number.isFinite(now) ? now : Date.now()
  };
}

export function normalizePreviewWindowPlaybackState(value: unknown): PreviewWindowPlaybackState | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  const input = value as Partial<PreviewWindowPlaybackState>;
  if (input.source !== 'main' && input.source !== 'preview-window') {
    return undefined;
  }
  if (typeof input.playheadTime !== 'number' || !Number.isFinite(input.playheadTime)) {
    return undefined;
  }
  return {
    source: input.source,
    playheadTime: normalizePlayheadTime(input.playheadTime),
    isPlaying: input.isPlaying === true,
    updatedAt: typeof input.updatedAt === 'number' && Number.isFinite(input.updatedAt) ? input.updatedAt : Date.now()
  };
}

export function shouldApplyPreviewWindowPlaybackState(
  current: { playheadTime: number; isPlaying: boolean },
  incoming: PreviewWindowPlaybackState,
  localSource: PreviewWindowSyncSource,
  frameDuration = 1 / 60
): boolean {
  if (incoming.source === localSource) {
    return false;
  }
  const epsilon = Math.max(0.0001, frameDuration / 2);
  return Math.abs(current.playheadTime - incoming.playheadTime) > epsilon || current.isPlaying !== incoming.isPlaying;
}

function normalizePlayheadTime(value: number): number {
  return Math.max(0, Math.round(value * 1000) / 1000);
}
