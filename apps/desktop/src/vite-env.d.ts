/// <reference types="vite/client" />

interface Window {
  __TAURI_INTERNALS__?: unknown;
  __TAURI_MOCKS__?: import('./lib/tauri-bridge').TauriMocks;
  __E2E_ACTIONS__?: Record<string, (...args: unknown[]) => unknown>;
  __OPEN_FACTORY_NATIVE_PREVIEW_SMOKE_ACTIVE__?: boolean;
  __OPEN_FACTORY_PREVIEW_DEBUG__?: {
    mode?: 'webgl' | '2d';
    renderCount: number;
    drawCount?: number;
    drawnClipTypes?: string[];
    sourceKinds?: string[];
    lastText?: string;
    readback?: {
      pixel?: number[];
      hasNonBackgroundPixels: boolean;
      error?: string;
    };
    errors?: string[];
  };
  __OPEN_FACTORY_AUDIO_MIX_DEBUG__?: { clipTypes: string[]; gainValues: number[] };
  webkitAudioContext?: typeof AudioContext;
}
