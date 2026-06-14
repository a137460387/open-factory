import { Blend, Pause, Play, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import {
  createTrack,
  resolveSyncComparePlaybackState,
  secondsToTimecode,
  type Clip,
  type Project,
  type SyncCompareAlignMode,
  type SyncCompareClipRef,
  type Timeline,
  type Track
} from '@open-factory/editor-core';
import { zhCN } from '../i18n/strings';
import { drawPreviewDifferenceFrame } from '../lib/preview/compare';
import { PreviewRenderer } from '../lib/preview/renderer';
import { showToast } from '../lib/toast';
import { useEditorStore } from '../store/editorStore';

const CANVAS_WIDTH = 960;
const CANVAS_HEIGHT = 540;

interface SyncComparePanelProps {
  clips: [SyncCompareClipRef, SyncCompareClipRef];
  project: Project;
  onClose(): void;
}

export function SyncComparePanel({ clips, project, onClose }: SyncComparePanelProps) {
  const t = zhCN.syncCompare;
  const playheadTime = useEditorStore((state) => state.playheadTime);
  const isPlaying = useEditorStore((state) => state.isPlaying);
  const setIsPlaying = useEditorStore((state) => state.setIsPlaying);
  const [alignMode, setAlignMode] = useState<SyncCompareAlignMode>('start');
  const [manualOffsetSeconds, setManualOffsetSeconds] = useState(0);
  const [differenceVisible, setDifferenceVisible] = useState(false);
  const [pausedSides, setPausedSides] = useState({ left: false, right: false });
  const [heldTimes, setHeldTimes] = useState<{ left?: number; right?: number }>({});
  const leftCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const rightCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const differenceCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const leftRendererRef = useRef(new PreviewRenderer());
  const rightRendererRef = useRef(new PreviewRenderer());
  const [leftRef, rightRef] = clips;
  const playback = resolveSyncComparePlaybackState({
    left: leftRef.clip,
    right: rightRef.clip,
    playheadTime,
    mode: alignMode,
    manualOffsetSeconds,
    playing: isPlaying,
    leftPaused: pausedSides.left,
    rightPaused: pausedSides.right,
    heldLeftTime: heldTimes.left,
    heldRightTime: heldTimes.right
  });
  const leftTimeline = useMemo(() => buildSingleClipTimeline(leftRef.clip, leftRef.track.type), [leftRef.clip, leftRef.track.type]);
  const rightTimeline = useMemo(() => buildSingleClipTimeline(rightRef.clip, rightRef.track.type), [rightRef.clip, rightRef.track.type]);
  const projectFps = project.settings.fps || 30;

  useEffect(() => {
    let canceled = false;
    const leftCanvas = leftCanvasRef.current;
    const rightCanvas = rightCanvasRef.current;
    if (!leftCanvas || !rightCanvas) {
      return undefined;
    }

    void (async () => {
      try {
        const leftResult = await leftRendererRef.current.render(leftCanvas, leftTimeline, project.media, playback.leftTime, {
          captureFrame: differenceVisible,
          sequences: project.sequences
        });
        const rightResult = await rightRendererRef.current.render(rightCanvas, rightTimeline, project.media, playback.rightTime, {
          captureFrame: differenceVisible,
          sequences: project.sequences
        });
        if (canceled || !differenceVisible || !leftResult.frame || !rightResult.frame || !differenceCanvasRef.current) {
          return;
        }
        drawPreviewDifferenceFrame(differenceCanvasRef.current, leftResult.frame, rightResult.frame);
      } catch (error) {
        if (!canceled) {
          showToast({ kind: 'error', title: t.renderFailedTitle, message: error instanceof Error ? error.message : t.renderFailedMessage });
        }
      }
    })();

    return () => {
      canceled = true;
    };
  }, [differenceVisible, leftTimeline, playback.leftTime, playback.rightTime, project.media, project.sequences, rightTimeline, t]);

  function toggleSidePaused(side: 'left' | 'right'): void {
    setPausedSides((current) => {
      const paused = current[side];
      if (!paused) {
        setHeldTimes((times) => ({ ...times, [side]: side === 'left' ? playback.leftTime : playback.rightTime }));
      }
      return { ...current, [side]: !paused };
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-6" data-testid="sync-compare-panel">
      <section className="flex max-h-full w-full max-w-6xl flex-col overflow-hidden rounded-lg border border-white/10 bg-slate-950 text-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold">{t.title}</h2>
            <p className="text-xs text-slate-400">{t.subtitle}</p>
          </div>
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/10 text-slate-200 hover:bg-white/10"
            title={zhCN.common.close}
            aria-label={zhCN.common.close}
            data-testid="sync-compare-close-button"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </header>
        <div className="flex flex-wrap items-center gap-3 border-b border-white/10 px-4 py-3 text-xs text-slate-200">
          <label className="flex items-center gap-2">
            <span>{t.alignMode}</span>
            <select
              className="h-8 rounded-md border border-white/10 bg-slate-900 px-2 text-xs text-white"
              value={alignMode}
              data-testid="sync-compare-align-mode"
              onChange={(event) => setAlignMode(event.target.value as SyncCompareAlignMode)}
            >
              <option value="start">{t.alignModes.start}</option>
              <option value="in">{t.alignModes.in}</option>
              <option value="manual">{t.alignModes.manual}</option>
            </select>
          </label>
          <label className="flex min-w-[260px] items-center gap-2">
            <span>{t.manualOffset}</span>
            <input
              className="min-w-0 flex-1 accent-emerald-400"
              type="range"
              min="-10"
              max="10"
              step="0.05"
              value={manualOffsetSeconds}
              disabled={alignMode !== 'manual'}
              data-testid="sync-compare-manual-offset"
              onChange={(event) => setManualOffsetSeconds(Number(event.target.value))}
            />
            <span className="w-14 text-right tabular-nums" data-testid="sync-compare-offset-value">{t.offsetValue(playback.offsetSeconds)}</span>
          </label>
          <button
            type="button"
            className={`inline-flex h-8 items-center gap-2 rounded-md border border-white/10 px-3 text-xs font-medium hover:bg-white/10 ${differenceVisible ? 'bg-emerald-500/25 text-emerald-100' : 'text-slate-200'}`}
            aria-pressed={differenceVisible}
            data-testid="sync-compare-difference-toggle"
            onClick={() => setDifferenceVisible((visible) => !visible)}
          >
            <Blend size={14} />
            {t.differenceOverlay}
          </button>
          <button
            type="button"
            className="ml-auto inline-flex h-8 items-center gap-2 rounded-md border border-white/10 px-3 text-xs font-medium text-slate-200 hover:bg-white/10"
            data-testid="sync-compare-playback-toggle"
            data-playback-state={isPlaying ? 'playing' : 'paused'}
            onClick={() => setIsPlaying(!isPlaying)}
          >
            {isPlaying ? <Pause size={14} /> : <Play size={14} />}
            {isPlaying ? zhCN.toolbar.pause : zhCN.toolbar.play}
          </button>
        </div>
        <div className="relative grid min-h-0 flex-1 grid-cols-2 gap-px bg-white/10" data-testid="sync-compare-canvas-grid">
          <SyncCompareSideView
            side="left"
            clip={leftRef.clip}
            canvasRef={leftCanvasRef}
            time={playback.leftTime}
            playing={playback.leftPlaying}
            fps={projectFps}
            paused={pausedSides.left}
            onTogglePaused={() => toggleSidePaused('left')}
          />
          <SyncCompareSideView
            side="right"
            clip={rightRef.clip}
            canvasRef={rightCanvasRef}
            time={playback.rightTime}
            playing={playback.rightPlaying}
            fps={projectFps}
            paused={pausedSides.right}
            onTogglePaused={() => toggleSidePaused('right')}
          />
          <canvas
            ref={differenceCanvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            className={`pointer-events-none absolute inset-0 h-full w-full bg-black object-contain transition-opacity ${differenceVisible ? 'opacity-90' : 'opacity-0'}`}
            data-testid="sync-compare-difference-canvas"
            aria-hidden={differenceVisible ? 'false' : 'true'}
          />
        </div>
      </section>
    </div>
  );
}

function SyncCompareSideView({
  side,
  clip,
  canvasRef,
  time,
  playing,
  fps,
  paused,
  onTogglePaused
}: {
  side: 'left' | 'right';
  clip: Clip;
  canvasRef: RefObject<HTMLCanvasElement>;
  time: number;
  playing: boolean;
  fps: number;
  paused: boolean;
  onTogglePaused(): void;
}) {
  const t = zhCN.syncCompare;
  return (
    <section className="relative min-h-[360px] bg-black" data-testid={`sync-compare-${side}-pane`} data-playback-state={playing ? 'playing' : 'paused'}>
      <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} className="h-full w-full object-contain" data-testid={`sync-compare-${side}-canvas`} />
      <div className="absolute left-3 top-3 max-w-[calc(100%-96px)] rounded-md bg-black/70 px-3 py-2 text-xs text-white">
        <div className="truncate font-semibold" data-testid={`sync-compare-${side}-clip-name`}>{clip.name}</div>
        <div className="mt-0.5 text-slate-300" data-testid={`sync-compare-${side}-timecode`}>{secondsToTimecode(time, fps, 'ndf')}</div>
      </div>
      <button
        type="button"
        className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/20 bg-black/70 text-white hover:bg-white/15"
        title={paused ? t.resumeSide : t.pauseSide}
        aria-label={paused ? t.resumeSide : t.pauseSide}
        data-testid={`sync-compare-${side}-pause-button`}
        onClick={onTogglePaused}
      >
        {paused ? <Play size={14} /> : <Pause size={14} />}
      </button>
    </section>
  );
}

function buildSingleClipTimeline(clip: Clip, sourceTrackType: Track['type']): Timeline {
  const trackId = `sync-compare-${clip.id}`;
  return {
    transitions: [],
    markers: [],
    tracks: [
      createTrack({
        id: trackId,
        type: sourceTrackType,
        name: clip.name,
        clips: [{ ...clip, trackId, start: 0 }]
      })
    ]
  };
}
