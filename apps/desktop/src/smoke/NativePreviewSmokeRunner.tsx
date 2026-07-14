import { useEffect } from 'react';
import { AddClipCommand, getTimelineDuration } from '@open-factory/editor-core';
import { createClipFromAsset, findPreferredTrack } from '../lib/clipFactory';
import { probeMediaPath, probeMediaPaths, sourceUrl } from '../lib/media';
import { getPreviewMediaPath } from '../media/proxy';
import { forceCloseWindow, getPreviewSmokeConfig, writeFile } from '../lib/tauri-bridge';
import { commandManager, timelineAccessor } from '../store/commandManager';
import { useEditorStore } from '../store/editorStore';

interface PreviewSmokeReport {
  success: boolean;
  error?: string;
  fixtureName?: string;
  fixturePath?: string;
  proxyFixturePath?: string;
  sourceUrl?: string;
  sourceProtocol?: string;
  convertFileSrcUsed?: boolean;
  asset?: {
    type: string;
    name: string;
    duration: number;
    width: number;
    height: number;
    hasAudio?: boolean;
    proxyStatus?: string;
    proxyPath?: string;
  };
  timeline?: {
    clipAdded: boolean;
    clipType?: string;
    duration: number;
  };
  preview?: {
    mode?: 'webgl' | '2d';
    renderCount: number;
    drawCount: number;
    sourceKinds: string[];
    videoFrameDrawn: boolean;
    centerPixel?: number[];
    hasNonBackgroundPixels?: boolean;
    pixelReadbackAvailable: boolean;
    pixelReadbackError?: string;
    lateCanvasPixel?: number[];
    lateCanvasPixelReadbackError?: string;
    proxyUsed?: boolean;
    proxyMediaPath?: string;
    proxySourceUrl?: string;
    proxyWidth?: number;
    proxyHeight?: number;
  };
  durationMs: number;
}

export function NativePreviewSmokeRunner() {
  useEffect(() => {
    void runNativePreviewSmoke();
  }, []);
  return null;
}

async function runNativePreviewSmoke(): Promise<void> {
  const config = await getPreviewSmokeConfig();
  if (!config?.enabled) {
    return;
  }
  window.__OPEN_FACTORY_NATIVE_PREVIEW_SMOKE_ACTIVE__ = true;
  const startedAt = performance.now();

  try {
    const result = await probeMediaPaths([config.mediaPath], useEditorStore.getState().project.media);
    const importedAsset = result.media[0];
    if (!importedAsset) {
      throw new Error('Preview smoke fixture was not imported.');
    }
    const proxyProbe = config.proxyMediaPath ? await probeMediaPath(config.proxyMediaPath) : undefined;
    const asset =
      config.proxyMediaPath && importedAsset.type === 'video'
        ? { ...importedAsset, proxyPath: config.proxyMediaPath, proxyStatus: 'ready' as const }
        : importedAsset;

    useEditorStore.getState().addMedia([asset]);
    const projectWithMedia = useEditorStore.getState().project;
    const track = findPreferredTrack(projectWithMedia.timeline, asset);
    if (!track) {
      throw new Error(`No compatible track for ${asset.type} fixture.`);
    }

    const clip = createClipFromAsset(asset, track, projectWithMedia.timeline);
    commandManager.execute(new AddClipCommand(timelineAccessor, clip));
    useEditorStore.getState().setSelectedClipId(clip.id);
    useEditorStore.getState().setPlayheadTime(Math.min(0.35, Math.max(0, clip.duration / 2)));

    const canvas = await waitFor(
      () => document.querySelector<HTMLCanvasElement>('[data-testid="preview-canvas"]'),
      5_000,
      'Preview canvas was not mounted.',
    );
    const debug = await waitFor(
      () => {
        const value = window.__OPEN_FACTORY_PREVIEW_DEBUG__;
        return value?.sourceKinds?.includes('video') && value.readback?.hasNonBackgroundPixels === true
          ? value
          : undefined;
      },
      15_000,
      'A non-background video pixel was not read back from the preview canvas.',
    );
    const latePixelReadback = readCanvasCenterPixelSafely(canvas);
    const mediaUrl = sourceUrl(asset.path);
    const previewMediaPath = getPreviewMediaPath(asset);
    const previewMediaUrl = sourceUrl(previewMediaPath);

    await writeSmokeReport(config.reportPath, {
      success: true,
      fixtureName: config.fixtureName,
      fixturePath: config.mediaPath,
      proxyFixturePath: config.proxyMediaPath,
      sourceUrl: mediaUrl,
      sourceProtocol: protocolOf(mediaUrl),
      convertFileSrcUsed: mediaUrl !== asset.path || previewMediaUrl !== previewMediaPath,
      asset: {
        type: asset.type,
        name: asset.name,
        duration: asset.duration,
        width: asset.width,
        height: asset.height,
        hasAudio: asset.hasAudio,
        proxyStatus: asset.proxyStatus,
        proxyPath: asset.proxyPath,
      },
      timeline: {
        clipAdded: useEditorStore
          .getState()
          .project.timeline.tracks.some((item) => item.clips.some((itemClip) => itemClip.id === clip.id)),
        clipType: clip.type,
        duration: getTimelineDuration(useEditorStore.getState().project.timeline),
      },
      preview: {
        mode: debug.mode,
        renderCount: debug.renderCount,
        drawCount: debug.drawCount ?? 0,
        sourceKinds: debug.sourceKinds ?? [],
        videoFrameDrawn: true,
        centerPixel: debug.readback?.pixel,
        hasNonBackgroundPixels: debug.readback?.hasNonBackgroundPixels,
        pixelReadbackAvailable: Boolean(debug.readback?.pixel),
        pixelReadbackError: debug.readback?.error,
        lateCanvasPixel: latePixelReadback.pixel,
        lateCanvasPixelReadbackError: latePixelReadback.error,
        proxyUsed: Boolean(config.proxyMediaPath) && previewMediaPath === config.proxyMediaPath,
        proxyMediaPath: config.proxyMediaPath,
        proxySourceUrl: previewMediaUrl,
        proxyWidth: proxyProbe?.width,
        proxyHeight: proxyProbe?.height,
      },
      durationMs: Math.round(performance.now() - startedAt),
    });
  } catch (error) {
    await writeSmokeReport(config.reportPath, {
      success: false,
      fixtureName: config.fixtureName,
      fixturePath: config.mediaPath,
      proxyFixturePath: config.proxyMediaPath,
      error: error instanceof Error ? error.message : String(error),
      durationMs: Math.round(performance.now() - startedAt),
    });
  } finally {
    window.__OPEN_FACTORY_NATIVE_PREVIEW_SMOKE_ACTIVE__ = false;
    await forceCloseWindow();
  }
}

async function writeSmokeReport(path: string, report: PreviewSmokeReport): Promise<void> {
  await writeFile(path, JSON.stringify(report, null, 2));
}

function readCanvasCenterPixelSafely(canvas: HTMLCanvasElement): { pixel?: number[]; error?: string } {
  try {
    const gl = canvas.getContext('webgl');
    if (gl) {
      const pixel = new Uint8Array(4);
      gl.readPixels(
        Math.floor(canvas.width / 2),
        Math.floor(canvas.height / 2),
        1,
        1,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        pixel,
      );
      return { pixel: Array.from(pixel) };
    }

    const context = canvas.getContext('2d');
    if (!context) {
      return { error: 'Preview canvas has no readable rendering context.' };
    }
    return {
      pixel: Array.from(context.getImageData(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1).data),
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

function protocolOf(value: string): string {
  try {
    return new URL(value).protocol;
  } catch {
    return 'path:';
  }
}

async function waitFor<T>(read: () => T | undefined | null, timeoutMs: number, failureMessage: string): Promise<T> {
  const startedAt = performance.now();
  let lastError: unknown;
  while (performance.now() - startedAt < timeoutMs) {
    try {
      const value = read();
      if (value) {
        return value;
      }
    } catch (error) {
      lastError = error;
    }
    await wait(100);
  }
  const detail = lastError instanceof Error ? ` ${lastError.message}` : '';
  throw new Error(`${failureMessage}${detail}`);
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
