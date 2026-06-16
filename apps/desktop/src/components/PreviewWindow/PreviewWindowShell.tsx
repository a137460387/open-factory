import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Pin, Play, Scan, X } from 'lucide-react';
import { secondsToTimecode, type Project } from '@open-factory/editor-core';
import { zhCN } from '../../i18n/strings';
import {
  closePreviewWindow,
  emitBridge,
  listenBridge,
  setPreviewWindowAlwaysOnTop,
  setPreviewWindowFullscreen,
  setPreviewWindowResolutionScale,
  type PreviewWindowResolutionScale
} from '../../lib/tauri-bridge';
import {
  createPreviewWindowPlaybackState,
  normalizePreviewWindowPlaybackState,
  shouldApplyPreviewWindowPlaybackState
} from '../../lib/previewWindowSync';
import { DEFAULT_PREVIEW_PERFORMANCE_SETTINGS, type PreviewPerformanceSettings, type PreviewQualityMode } from '../../lib/preview/preview-performance';
import { useEditorStore } from '../../store/editorStore';

interface PreviewWindowProjectStatePayload {
  source: 'main';
  project: Project;
  playheadTime: number;
  isPlaying: boolean;
  previewPerformance?: PreviewPerformanceSettings;
  resolutionScale?: PreviewWindowResolutionScale;
}

const RESOLUTION_SCALES: PreviewWindowResolutionScale[] = [1, 0.5, 0.25];
const PreviewCanvas = lazy(() => import('../PreviewCanvas/PreviewCanvas').then((module) => ({ default: module.PreviewCanvas })));

export function PreviewWindowShell() {
  const project = useEditorStore((state) => state.project);
  const playheadTime = useEditorStore((state) => state.playheadTime);
  const isPlaying = useEditorStore((state) => state.isPlaying);
  const setProject = useEditorStore((state) => state.setProject);
  const setPlayheadTime = useEditorStore((state) => state.setPlayheadTime);
  const setIsPlaying = useEditorStore((state) => state.setIsPlaying);
  const [alwaysOnTop, setAlwaysOnTopState] = useState(false);
  const [fullscreen, setFullscreenState] = useState(false);
  const [resolutionScale, setResolutionScaleState] = useState<PreviewWindowResolutionScale>(1);
  const [basePreviewPerformance, setBasePreviewPerformance] = useState<PreviewPerformanceSettings>(DEFAULT_PREVIEW_PERFORMANCE_SETTINGS);
  const applyingRemoteRef = useRef(false);
  const fps = project.settings.fps || 30;

  const previewPerformance = useMemo<PreviewPerformanceSettings>(
    () => ({
      ...basePreviewPerformance,
      qualityMode: scaleToPreviewQualityMode(resolutionScale)
    }),
    [basePreviewPerformance, resolutionScale]
  );

  useEffect(() => {
    const disposers: Array<() => void> = [];
    void listenBridge<PreviewWindowProjectStatePayload>('preview-window-project-state', (payload) => {
      if (payload.source !== 'main') {
        return;
      }
      applyingRemoteRef.current = true;
      setProject(payload.project);
      setPlayheadTime(payload.playheadTime);
      setIsPlaying(payload.isPlaying);
      setBasePreviewPerformance(payload.previewPerformance ?? DEFAULT_PREVIEW_PERFORMANCE_SETTINGS);
      if (payload.resolutionScale) {
        setResolutionScaleState(payload.resolutionScale);
      }
      queueMicrotask(() => {
        applyingRemoteRef.current = false;
      });
    }).then((dispose) => disposers.push(dispose));
    void listenBridge('preview-window-sync', (payload) => {
      const incoming = normalizePreviewWindowPlaybackState(payload);
      if (
        incoming &&
        shouldApplyPreviewWindowPlaybackState({ playheadTime: useEditorStore.getState().playheadTime, isPlaying: useEditorStore.getState().isPlaying }, incoming, 'preview-window', 1 / fps)
      ) {
        applyingRemoteRef.current = true;
        setPlayheadTime(incoming.playheadTime);
        setIsPlaying(incoming.isPlaying);
        queueMicrotask(() => {
          applyingRemoteRef.current = false;
        });
      }
    }).then((dispose) => disposers.push(dispose));
    return () => {
      for (const dispose of disposers) {
        dispose();
      }
    };
  }, [fps, setIsPlaying, setPlayheadTime, setProject]);

  useEffect(() => {
    if (applyingRemoteRef.current) {
      return;
    }
    void emitBridge('preview-window-sync', createPreviewWindowPlaybackState('preview-window', playheadTime, isPlaying));
  }, [isPlaying, playheadTime]);

  const toggleFullscreen = useCallback(async () => {
    const next = !fullscreen;
    setFullscreenState(next);
    const state = await setPreviewWindowFullscreen(next).catch(() => undefined);
    if (state) {
      setFullscreenState(state.fullscreen);
    }
  }, [fullscreen]);

  const toggleAlwaysOnTop = useCallback(async () => {
    const next = !alwaysOnTop;
    setAlwaysOnTopState(next);
    const state = await setPreviewWindowAlwaysOnTop(next).catch(() => undefined);
    if (state) {
      setAlwaysOnTopState(state.alwaysOnTop);
    }
  }, [alwaysOnTop]);

  const changeResolutionScale = useCallback(async (value: PreviewWindowResolutionScale) => {
    setResolutionScaleState(value);
    const state = await setPreviewWindowResolutionScale(value).catch(() => undefined);
    if (state) {
      setResolutionScaleState(state.resolutionScale);
    }
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'F11') {
        event.preventDefault();
        void toggleFullscreen();
      }
      if (!event.ctrlKey && !event.metaKey && !event.altKey && event.key.toLowerCase() === 't') {
        event.preventDefault();
        void toggleAlwaysOnTop();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [toggleAlwaysOnTop, toggleFullscreen]);

  return (
    <div className="grid h-screen min-h-0 bg-[#111827] text-white" style={{ gridTemplateRows: '48px minmax(0, 1fr)' }} data-testid="detached-preview-window">
      <header className="flex min-w-0 items-center gap-2 border-b border-white/10 bg-slate-950 px-3">
        <div className="min-w-0 flex-1 truncate text-sm font-semibold">{zhCN.preview.detachedTitle}</div>
        <div className="rounded border border-white/10 px-2 py-1 text-xs tabular-nums text-slate-200" data-testid="detached-preview-timecode">
          {secondsToTimecode(playheadTime, fps, project.settings.timecodeFormat ?? 'ndf')}
        </div>
        <button
          className="inline-flex h-8 w-8 items-center justify-center rounded border border-white/10 bg-white/10 text-white hover:bg-white/20"
          type="button"
          title={isPlaying ? zhCN.toolbar.pause : zhCN.toolbar.play}
          aria-label={isPlaying ? zhCN.toolbar.pause : zhCN.toolbar.play}
          data-testid="detached-preview-playback-button"
          onClick={() => setIsPlaying(!isPlaying)}
        >
          {isPlaying ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <button
          className="inline-flex h-8 w-8 items-center justify-center rounded border border-white/10 bg-white/10 text-white hover:bg-white/20"
          type="button"
          title={zhCN.preview.detachedFullscreen}
          aria-label={zhCN.preview.detachedFullscreen}
          data-testid="detached-preview-fullscreen-button"
          onClick={() => void toggleFullscreen()}
        >
          <Scan size={16} />
        </button>
        <button
          className="inline-flex h-8 w-8 items-center justify-center rounded border border-white/10 bg-white/10 text-white hover:bg-white/20 data-[active=true]:border-brand data-[active=true]:bg-brand"
          type="button"
          title={zhCN.preview.detachedAlwaysOnTop}
          aria-label={zhCN.preview.detachedAlwaysOnTop}
          data-active={alwaysOnTop ? 'true' : 'false'}
          data-testid="detached-preview-pin-button"
          onClick={() => void toggleAlwaysOnTop()}
        >
          <Pin size={16} />
        </button>
        <select
          className="h-8 rounded border border-white/10 bg-slate-900 px-2 text-xs font-medium text-white"
          value={String(resolutionScale)}
          title={zhCN.preview.detachedResolution}
          aria-label={zhCN.preview.detachedResolution}
          data-testid="detached-preview-resolution-select"
          onChange={(event) => void changeResolutionScale(Number(event.target.value) as PreviewWindowResolutionScale)}
        >
          {RESOLUTION_SCALES.map((scale) => (
            <option key={scale} value={scale}>
              {zhCN.preview.detachedResolutionOptions[scale]}
            </option>
          ))}
        </select>
        <button
          className="inline-flex h-8 w-8 items-center justify-center rounded border border-white/10 bg-white/10 text-white hover:bg-white/20"
          type="button"
          title={zhCN.common.close}
          aria-label={zhCN.common.close}
          data-testid="detached-preview-close-button"
          onClick={() => void closePreviewWindow()}
        >
          <X size={16} />
        </button>
      </header>
      <Suspense fallback={<div className="grid place-items-center text-sm text-slate-300">{zhCN.panels.preview}</div>}>
        <PreviewCanvas
          safeFrameGuides={false}
          previewPerformance={previewPerformance}
          colorScopesVisible={false}
          onColorScopesVisibleChange={() => undefined}
          reviewMode={false}
          onAddReviewAnnotation={() => undefined}
          onExportReviewReport={() => undefined}
        />
      </Suspense>
    </div>
  );
}

function scaleToPreviewQualityMode(scale: PreviewWindowResolutionScale): PreviewQualityMode {
  if (scale === 0.5) {
    return 'half';
  }
  if (scale === 0.25) {
    return 'quarter';
  }
  return 'full';
}
