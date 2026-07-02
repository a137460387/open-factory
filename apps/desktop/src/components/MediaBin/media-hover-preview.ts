const MEDIA_PREVIEW_DELAY_MS = 500;

export type MediaPreviewInput = {
  delayMs?: number;
};

export function computeMediaPreviewDelay(delayMs = MEDIA_PREVIEW_DELAY_MS) {
  return {
    schedule(callback: () => void): ReturnType<typeof setTimeout> {
      return setTimeout(callback, delayMs);
    },
    cancel(timerId: ReturnType<typeof setTimeout> | undefined): void {
      if (timerId !== undefined) clearTimeout(timerId);
    }
  };
}

export function isMediaPreviewable(type: string): boolean {
  return type === 'video' || type === 'audio';
}
