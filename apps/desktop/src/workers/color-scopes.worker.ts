import { computeColorScopes, type ColorScopes, type RgbaFrame } from '@open-factory/editor-core';

export interface ColorScopesWorkerRequest extends RgbaFrame {
  waveformColumns: number;
}

export interface ColorScopesWorkerResponse {
  scopes?: ColorScopes;
}

self.onmessage = (event: MessageEvent<ColorScopesWorkerRequest>) => {
  try {
    const { width, height, data, waveformColumns } = event.data;
    if (!data || width <= 0 || height <= 0) {
      self.postMessage({} satisfies ColorScopesWorkerResponse);
      return;
    }
    self.postMessage({
      scopes: computeColorScopes({ width, height, data }, waveformColumns),
    } satisfies ColorScopesWorkerResponse);
  } catch {
    self.postMessage({} satisfies ColorScopesWorkerResponse);
  }
};
