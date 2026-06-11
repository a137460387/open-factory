import { BarChart3, Blend, Columns2, GitCompareArrows, Pause, Play, Rows2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CutMulticamClipCommand,
  buildTimelineRenderFrameKey,
  buildTimelineRenderFrameRequests,
  getActiveMulticamAngle,
  getTimelineRenderInvalidationRanges,
  getTimelinePlaybackDuration,
  isNestedSequenceDepthExceeded,
  type Clip,
  type Project,
  type Sequence,
  type Timeline
} from '@open-factory/editor-core';
import { ColorScopesPanel } from '../ColorScopes/ColorScopesPanel';
import { zhCN } from '../../i18n/strings';
import {
  buildPreviewCompareDividerStyle,
  buildPreviewCompareOverlayStyle,
  calculatePreviewCompareSplitRatio,
  drawPreviewDifferenceFrame,
  type PreviewCompareMode
} from '../../lib/preview/compare';
import { PreviewRenderer, type PreviewFrameReadback } from '../../lib/preview/renderer';
import { getTimelineRenderCacheController } from '../../lib/preview/render-cache-controller';
import { showToast } from '../../lib/toast';
import { useAudioMeterStore } from '../../store/audioMeterStore';
import { commandManager, projectAccessor } from '../../store/commandManager';
import { useEditorStore } from '../../store/editorStore';

export function PreviewCanvas() {
  const t = zhCN.preview;
  const compareFrameRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const originalCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const differenceCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef(new PreviewRenderer());
  const originalRendererRef = useRef(new PreviewRenderer());
  const previousTimelineRef = useRef<Timeline | undefined>();
  const scopeFrameCounterRef = useRef(0);
  const project = useEditorStore((state) => state.project);
  const previewTimeline = useEditorStore((state) => state.previewTimeline);
  const selectedClipId = useEditorStore((state) => state.selectedClipId);
  const playheadTime = useEditorStore((state) => state.playheadTime);
  const isPlaying = useEditorStore((state) => state.isPlaying);
  const playbackRate = useEditorStore((state) => state.playbackRate);
  const setPlayheadTime = useEditorStore((state) => state.setPlayheadTime);
  const setIsPlaying = useEditorStore((state) => state.setIsPlaying);
  const setAudioLevels = useAudioMeterStore((state) => state.setLevels);
  const resetAudioLevels = useAudioMeterStore((state) => state.resetLevels);
  const [scopesOpen, setScopesOpen] = useState(false);
  const [scopeFrame, setScopeFrame] = useState<PreviewFrameReadback>();
  const [compareMode, setCompareMode] = useState<PreviewCompareMode | 'off'>('off');
  const [compareSplitRatio, setCompareSplitRatio] = useState(0.5);
  const [compareDividerDragging, setCompareDividerDragging] = useState(false);
  const prerenderCenter = Math.round(playheadTime * 2) / 2;
  const fps = project.settings.fps || 30;
  const compareEnabled = compareMode !== 'off';
  const compareShowsDifference = compareMode === 'difference';
  const activeCompareMode: PreviewCompareMode = compareMode === 'off' ? 'left-right' : compareMode;
  const selectedMulticamClip = useMemo(() => {
    const clip = project.timeline.tracks.flatMap((track) => track.clips).find((item) => item.id === selectedClipId);
    return clip?.type === 'nested-sequence' && clip.multicam ? clip : undefined;
  }, [project.timeline.tracks, selectedClipId]);
  const selectedMulticamSequence = useMemo(
    () => (selectedMulticamClip ? project.sequences.find((sequence) => sequence.id === selectedMulticamClip.sequenceId) : undefined),
    [project.sequences, selectedMulticamClip]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const originalCanvas = originalCanvasRef.current;
    const differenceCanvas = differenceCanvasRef.current;
    const timeline = previewTimeline ?? project.timeline;
    const shouldCaptureScopes = scopesOpen && (!isPlaying || scopeFrameCounterRef.current % 4 === 0);
    const shouldCaptureDifference = compareShowsDifference && Boolean(differenceCanvas);
    const canUseRenderCache = !previewTimeline && !shouldCaptureScopes && !compareEnabled;
    const frame = Math.max(0, Math.round(playheadTime * fps));
    const frameTime = frame / fps;
    const frameKey = buildTimelineRenderFrameKey({
      timeline,
      media: project.media,
      sequences: project.sequences,
      activeSequenceId: project.activeSequenceId,
      frame,
      fps,
      width: canvas.width,
      height: canvas.height
    });
    let canceled = false;
    scopeFrameCounterRef.current += 1;
    void (async () => {
      try {
        if (canUseRenderCache) {
          const cached = await getTimelineRenderCacheController().getFrame(frameKey);
          if (cached) {
            try {
              if (!canceled) {
                rendererRef.current.drawCachedFrame(canvas, cached);
              }
            } finally {
              cached.close();
            }
            return;
          }
        }
        const result = await rendererRef.current.render(canvas, timeline, project.media, playheadTime, {
          captureFrame: shouldCaptureScopes || shouldCaptureDifference,
          sequences: project.sequences
        });
        if (canceled) {
          return;
        }
        if (result.frame && shouldCaptureScopes) {
          setScopeFrame(result.frame);
        }
        if (compareEnabled && originalCanvas) {
          const originalResult = await originalRendererRef.current.render(originalCanvas, timeline, project.media, playheadTime, {
            bypassProcessing: true,
            captureFrame: shouldCaptureDifference,
            sequences: project.sequences
          });
          if (canceled) {
            return;
          }
          if (shouldCaptureDifference && result.frame && originalResult.frame && differenceCanvas) {
            drawPreviewDifferenceFrame(differenceCanvas, result.frame, originalResult.frame);
          }
        }
        if (canUseRenderCache) {
          const bitmap = await createImageBitmap(canvas);
          getTimelineRenderCacheController().putFrame({
            key: frameKey,
            bitmap,
            time: frameTime,
            duration: 1 / fps,
            bytes: canvas.width * canvas.height * 4,
            playheadTime
          });
        }
      } catch (error) {
        showToast({ kind: 'error', title: t.renderFailedTitle, message: error instanceof Error ? error.message : t.renderFailedMessage });
      }
    })();
    rendererRef.current.syncAudio(timeline, project.media, playheadTime, isPlaying && playbackRate > 0, project.masterVolume);
    const levels = rendererRef.current.getAudioLevels();
    setAudioLevels(levels.trackLevels, levels.masterLevel);
    return () => {
      canceled = true;
    };
  }, [
    fps,
    isPlaying,
    playbackRate,
    playheadTime,
    compareEnabled,
    compareShowsDifference,
    previewTimeline,
    project.activeSequenceId,
    project.masterVolume,
    project.media,
    project.sequences,
    project.timeline,
    scopesOpen,
    setAudioLevels
  ]);

  useEffect(() => {
    const previous = previousTimelineRef.current;
    if (previous && previous !== project.timeline) {
      getTimelineRenderCacheController().invalidateRanges(getTimelineRenderInvalidationRanges(previous, project.timeline));
    }
    previousTimelineRef.current = project.timeline;
  }, [project.timeline]);

  useEffect(() => {
    if (previewTimeline) {
      return undefined;
    }
    let canceled = false;
    const timer = window.setTimeout(() => {
      const duration = getTimelinePlaybackDuration(project.timeline);
      const canvas = document.createElement('canvas');
      canvas.width = 1280;
      canvas.height = 720;
      const renderer = new PreviewRenderer();
      const requests = buildTimelineRenderFrameRequests({
        timeline: project.timeline,
        media: project.media,
        sequences: project.sequences,
        activeSequenceId: project.activeSequenceId,
        playheadTime: prerenderCenter,
        duration,
        fps,
        width: canvas.width,
        height: canvas.height
      });

      void (async () => {
        for (const request of requests) {
          if (canceled) {
            break;
          }
          const cached = await getTimelineRenderCacheController().getFrame(request.key);
          if (cached) {
            cached.close();
            continue;
          }
          await renderer.render(canvas, project.timeline, project.media, request.time, { sequences: project.sequences });
          if (canceled) {
            break;
          }
          const bitmap = await createImageBitmap(canvas);
          getTimelineRenderCacheController().putFrame({
            key: request.key,
            bitmap,
            time: request.time,
            duration: 1 / fps,
            bytes: canvas.width * canvas.height * 4,
            playheadTime: prerenderCenter
          });
          await waitForIdleFrame();
        }
      })().catch(() => {
        // Live preview rendering already reports user-facing errors; prerender misses are best-effort.
      });
    }, 80);

    return () => {
      canceled = true;
      window.clearTimeout(timer);
    };
  }, [fps, prerenderCenter, previewTimeline, project.activeSequenceId, project.media, project.sequences, project.timeline]);

  useEffect(() => {
    getTimelineRenderCacheController().retainAround(playheadTime);
  }, [playheadTime]);

  useEffect(() => {
    if (isNestedSequenceDepthExceeded(project)) {
      showToast({ kind: 'warning', title: zhCN.timeline.nestedSequenceDepthTitle, message: zhCN.timeline.nestedSequenceDepthMessage });
    }
  }, [project]);

  function toggleCompareMode(): void {
    setCompareMode((current) => (current === 'off' ? 'left-right' : 'off'));
  }

  function updateCompareSplitFromPointer(event: { clientX: number; clientY: number }): void {
    if (compareMode === 'off' || compareMode === 'difference') {
      return;
    }
    const bounds = compareFrameRef.current?.getBoundingClientRect();
    if (!bounds) {
      return;
    }
    setCompareSplitRatio(calculatePreviewCompareSplitRatio(compareMode, event, bounds));
  }

  useEffect(() => {
    if (!isPlaying) {
      rendererRef.current.pauseAllAudio();
      resetAudioLevels();
      return undefined;
    }
    let frame = 0;
    let last = performance.now();
    const duration = getTimelinePlaybackDuration(project.timeline);
    const tick = (now: number) => {
      const delta = (now - last) / 1000;
      last = now;
      const next = useEditorStore.getState().playheadTime + delta * playbackRate;
      if (playbackRate < 0 && next <= 0) {
        setPlayheadTime(0);
        setIsPlaying(false);
        return;
      }
      if (duration > 0 && next >= duration) {
        setPlayheadTime(duration);
        setIsPlaying(false);
        return;
      }
      setPlayheadTime(next);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [isPlaying, playbackRate, project.timeline, resetAudioLevels, setIsPlaying, setPlayheadTime]);

  return (
    <section className="flex min-h-0 flex-col bg-[#1b2028]">
      <div className="flex items-center justify-between border-b border-black/30 px-3 py-2 text-white">
        <div>
          <div className="text-sm font-semibold">{t.title}</div>
          <div className="text-xs text-slate-300">{t.canvasSize}</div>
        </div>
        <div className="flex items-center gap-2">
          {compareEnabled ? (
            <div className="flex items-center gap-1 rounded-md border border-white/10 bg-white/10 p-0.5" data-testid="preview-compare-mode-group">
              <button
                className={`inline-flex h-8 w-8 items-center justify-center rounded text-white hover:bg-white/20 ${compareMode === 'left-right' ? 'bg-emerald-500/30' : ''}`}
                title={t.compareLeftRight}
                aria-label={t.compareLeftRight}
                data-testid="preview-compare-mode-left-right"
                onClick={() => setCompareMode('left-right')}
              >
                <Columns2 size={16} />
              </button>
              <button
                className={`inline-flex h-8 w-8 items-center justify-center rounded text-white hover:bg-white/20 ${compareMode === 'top-bottom' ? 'bg-emerald-500/30' : ''}`}
                title={t.compareTopBottom}
                aria-label={t.compareTopBottom}
                data-testid="preview-compare-mode-top-bottom"
                onClick={() => setCompareMode('top-bottom')}
              >
                <Rows2 size={16} />
              </button>
              <button
                className={`inline-flex h-8 w-8 items-center justify-center rounded text-white hover:bg-white/20 ${compareMode === 'difference' ? 'bg-emerald-500/30' : ''}`}
                title={t.compareDifference}
                aria-label={t.compareDifference}
                data-testid="preview-compare-mode-difference"
                onClick={() => setCompareMode('difference')}
              >
                <Blend size={16} />
              </button>
            </div>
          ) : null}
          <button
            className={`inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/10 text-white hover:bg-white/20 ${
              compareEnabled ? 'bg-emerald-500/25' : 'bg-white/10'
            }`}
            title={t.compareToggle}
            aria-label={t.compareToggle}
            data-testid="preview-compare-toggle"
            onClick={toggleCompareMode}
          >
            <GitCompareArrows size={17} />
          </button>
          <button
            className={`inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/10 text-white hover:bg-white/20 ${
              scopesOpen ? 'bg-emerald-500/25' : 'bg-white/10'
            }`}
            title={t.colorScopes}
            aria-label={t.colorScopes}
            data-testid="toggle-color-scopes"
            onClick={() => setScopesOpen((value) => !value)}
          >
            <BarChart3 size={17} />
          </button>
          <button
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/10 bg-white/10 text-white hover:bg-white/20"
            title={isPlaying ? zhCN.toolbar.pause : zhCN.toolbar.play}
            aria-label={isPlaying ? zhCN.toolbar.pause : zhCN.toolbar.play}
            data-testid="preview-playback-button"
            data-playback-state={isPlaying ? 'playing' : 'paused'}
            onClick={() => setIsPlaying(!isPlaying)}
          >
            {isPlaying ? <Pause size={17} /> : <Play size={17} />}
          </button>
        </div>
      </div>
      <div className={scopesOpen ? 'grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_180px]' : 'flex min-h-0 flex-1 items-center justify-center p-5'}>
        <div className={scopesOpen ? 'flex min-h-0 items-center justify-center p-4' : 'contents'}>
          <div ref={compareFrameRef} className="relative aspect-video w-full max-w-[960px] overflow-hidden rounded-md bg-black shadow-soft">
            <canvas
              ref={canvasRef}
              width={1280}
              height={720}
              className={`absolute inset-0 h-full w-full ${compareShowsDifference ? 'opacity-0' : 'opacity-100'}`}
              data-testid="preview-canvas"
            />
            {compareEnabled ? (
              <canvas
                ref={originalCanvasRef}
                width={1280}
                height={720}
                className={`absolute inset-0 h-full w-full ${compareShowsDifference ? 'opacity-0' : 'opacity-100'}`}
                style={buildPreviewCompareOverlayStyle(activeCompareMode, compareSplitRatio)}
                data-testid="preview-compare-original-canvas"
              />
            ) : null}
            {compareShowsDifference ? (
              <canvas ref={differenceCanvasRef} width={1280} height={720} className="absolute inset-0 h-full w-full" data-testid="preview-compare-difference-canvas" />
            ) : null}
            {compareEnabled && !compareShowsDifference ? (
              <div
                role="separator"
                aria-label={t.compareDivider}
                data-testid="preview-compare-divider"
                data-orientation={activeCompareMode === 'top-bottom' ? 'horizontal' : 'vertical'}
                className={`absolute z-10 bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.55)] ${activeCompareMode === 'top-bottom' ? 'cursor-row-resize' : 'cursor-col-resize'} ${
                  compareDividerDragging ? 'opacity-100' : 'opacity-80'
                }`}
                style={buildPreviewCompareDividerStyle(activeCompareMode, compareSplitRatio)}
                onPointerDown={(event) => {
                  event.currentTarget.setPointerCapture(event.pointerId);
                  setCompareDividerDragging(true);
                  updateCompareSplitFromPointer(event);
                }}
                onPointerMove={(event) => {
                  if (compareDividerDragging) {
                    updateCompareSplitFromPointer(event);
                  }
                }}
                onPointerUp={(event) => {
                  event.currentTarget.releasePointerCapture(event.pointerId);
                  setCompareDividerDragging(false);
                  updateCompareSplitFromPointer(event);
                }}
                onPointerCancel={() => setCompareDividerDragging(false)}
              />
            ) : null}
            {selectedMulticamClip && selectedMulticamSequence ? (
              <MulticamPreviewGrid
                clip={selectedMulticamClip}
                sequence={selectedMulticamSequence}
                media={project.media}
                sequences={project.sequences}
                playheadTime={playheadTime}
                onSelectAngle={(angleId) => {
                  try {
                    commandManager.execute(new CutMulticamClipCommand(projectAccessor, selectedMulticamClip.id, playheadTime, angleId));
                  } catch (error) {
                    showToast({
                      kind: 'warning',
                      title: t.multicamCutFailedTitle,
                      message: error instanceof Error ? error.message : t.multicamCutFailedMessage
                    });
                  }
                }}
              />
            ) : null}
          </div>
        </div>
        {scopesOpen ? <ColorScopesPanel frame={scopeFrame} active={scopesOpen} /> : null}
      </div>
      <div className="border-t border-black/30 px-3 py-2 text-xs tabular-nums text-slate-300">{formatTime(playheadTime)}</div>
    </section>
  );
}

interface MulticamPreviewGridProps {
  clip: Extract<Clip, { type: 'nested-sequence' }>;
  sequence: Sequence;
  media: Project['media'];
  sequences: Sequence[];
  playheadTime: number;
  onSelectAngle(angleId: string): void;
}

function MulticamPreviewGrid({ clip, sequence, media, sequences, playheadTime, onSelectAngle }: MulticamPreviewGridProps) {
  const t = zhCN.preview;
  const canvasRefs = useRef(new Map<string, HTMLCanvasElement>());
  const renderersRef = useRef(new Map<string, PreviewRenderer>());
  const localTime = Math.min(clip.duration, Math.max(0, playheadTime - clip.start + clip.trimStart));
  const activeAngleId = useMemo(() => {
    try {
      return clip.multicam ? getActiveMulticamAngle(clip.multicam, localTime).id : undefined;
    } catch {
      return undefined;
    }
  }, [clip.multicam, localTime]);
  const columns = (clip.multicam?.angles.length ?? 0) <= 4 ? 2 : 3;

  useEffect(() => {
    let canceled = false;
    void (async () => {
      for (const angle of clip.multicam?.angles ?? []) {
        const canvas = canvasRefs.current.get(angle.id);
        const track = sequence.timeline.tracks.find((item) => item.id === angle.trackId);
        if (!canvas || !track) {
          continue;
        }
        const renderer = getAngleRenderer(renderersRef.current, angle.id);
        const angleTimeline: Timeline = {
          tracks: [{ ...track, solo: false, muted: false }],
          transitions: [],
          markers: []
        };
        try {
          await renderer.render(canvas, angleTimeline, media, localTime, { sequences });
        } catch {
          if (!canceled) {
            const context = canvas.getContext('2d');
            context?.clearRect(0, 0, canvas.width, canvas.height);
          }
        }
        if (canceled) {
          break;
        }
      }
    })();
    return () => {
      canceled = true;
    };
  }, [clip.multicam, localTime, media, sequence.timeline.tracks, sequences]);

  if (!clip.multicam) {
    return null;
  }

  return (
    <div
      className="absolute inset-2 z-20 grid gap-2 rounded-md border border-white/15 bg-black/70 p-2 shadow-soft"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      data-testid="multicam-preview-grid"
      aria-label={t.multicamGrid}
    >
      {clip.multicam.angles.map((angle, index) => (
        <button
          key={angle.id}
          type="button"
          className={`group relative min-h-0 overflow-hidden rounded-md border bg-black text-left ${
            activeAngleId === angle.id ? 'border-emerald-400 ring-2 ring-emerald-400/45' : 'border-white/15 hover:border-white/40'
          }`}
          title={t.multicamAngle(angle.name)}
          aria-label={t.multicamAngle(angle.name)}
          data-testid={`multicam-angle-button-${angle.id}`}
          data-active={activeAngleId === angle.id ? 'true' : 'false'}
          onClick={() => onSelectAngle(angle.id)}
        >
          <canvas
            ref={(node) => {
              if (node) {
                canvasRefs.current.set(angle.id, node);
              } else {
                canvasRefs.current.delete(angle.id);
              }
            }}
            width={480}
            height={270}
            className="h-full w-full object-cover"
            data-testid={`multicam-angle-canvas-${angle.id}`}
          />
          <span className="absolute left-2 top-2 rounded bg-black/75 px-2 py-1 text-[11px] font-medium text-white">
            {index + 1}. {angle.name}
          </span>
        </button>
      ))}
    </div>
  );
}

function getAngleRenderer(renderers: Map<string, PreviewRenderer>, angleId: string): PreviewRenderer {
  const existing = renderers.get(angleId);
  if (existing) {
    return existing;
  }
  const renderer = new PreviewRenderer();
  renderers.set(angleId, renderer);
  return renderer;
}

function formatTime(time: number): string {
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  const frames = Math.floor((time % 1) * 30);
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}:${frames.toString().padStart(2, '0')}`;
}

function waitForIdleFrame(): Promise<void> {
  return new Promise((resolve) => {
    const idle = (window as Window & { requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number }).requestIdleCallback;
    if (idle) {
      idle(() => resolve(), { timeout: 50 });
      return;
    }
    window.requestAnimationFrame(() => resolve());
  });
}
