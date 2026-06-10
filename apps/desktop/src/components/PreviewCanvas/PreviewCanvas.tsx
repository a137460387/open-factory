import { BarChart3, Pause, Play } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { getTimelinePlaybackDuration } from '@open-factory/editor-core';
import { ColorScopesPanel } from '../ColorScopes/ColorScopesPanel';
import { PreviewRenderer, type PreviewFrameReadback } from '../../lib/preview/renderer';
import { showToast } from '../../lib/toast';
import { useAudioMeterStore } from '../../store/audioMeterStore';
import { useEditorStore } from '../../store/editorStore';

export function PreviewCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef(new PreviewRenderer());
  const scopeFrameCounterRef = useRef(0);
  const project = useEditorStore((state) => state.project);
  const previewTimeline = useEditorStore((state) => state.previewTimeline);
  const playheadTime = useEditorStore((state) => state.playheadTime);
  const isPlaying = useEditorStore((state) => state.isPlaying);
  const playbackRate = useEditorStore((state) => state.playbackRate);
  const setPlayheadTime = useEditorStore((state) => state.setPlayheadTime);
  const setIsPlaying = useEditorStore((state) => state.setIsPlaying);
  const setAudioLevels = useAudioMeterStore((state) => state.setLevels);
  const resetAudioLevels = useAudioMeterStore((state) => state.resetLevels);
  const [scopesOpen, setScopesOpen] = useState(false);
  const [scopeFrame, setScopeFrame] = useState<PreviewFrameReadback>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const timeline = previewTimeline ?? project.timeline;
    const shouldCaptureScopes = scopesOpen && (!isPlaying || scopeFrameCounterRef.current % 4 === 0);
    scopeFrameCounterRef.current += 1;
    rendererRef.current
      .render(canvas, timeline, project.media, playheadTime, { captureFrame: shouldCaptureScopes })
      .then((result) => {
        if (result.frame) {
          setScopeFrame(result.frame);
        }
      })
      .catch((error) => {
        showToast({ kind: 'error', title: 'Preview render failed', message: error instanceof Error ? error.message : 'Unable to draw preview.' });
      });
    rendererRef.current.syncAudio(timeline, project.media, playheadTime, isPlaying && playbackRate > 0, project.masterVolume);
    const levels = rendererRef.current.getAudioLevels();
    setAudioLevels(levels.trackLevels, levels.masterLevel);
  }, [isPlaying, playbackRate, playheadTime, previewTimeline, project.masterVolume, project.media, project.timeline, scopesOpen, setAudioLevels]);

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
          <div className="text-sm font-semibold">Preview</div>
          <div className="text-xs text-slate-300">1280 x 720 canvas</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            className={`inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/10 text-white hover:bg-white/20 ${
              scopesOpen ? 'bg-emerald-500/25' : 'bg-white/10'
            }`}
            title="Color scopes"
            aria-label="Color scopes"
            data-testid="toggle-color-scopes"
            onClick={() => setScopesOpen((value) => !value)}
          >
            <BarChart3 size={17} />
          </button>
          <button
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/10 bg-white/10 text-white hover:bg-white/20"
            title={isPlaying ? 'Pause' : 'Play'}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            onClick={() => setIsPlaying(!isPlaying)}
          >
            {isPlaying ? <Pause size={17} /> : <Play size={17} />}
          </button>
        </div>
      </div>
      <div className={scopesOpen ? 'grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_180px]' : 'flex min-h-0 flex-1 items-center justify-center p-5'}>
        <div className={scopesOpen ? 'flex min-h-0 items-center justify-center p-4' : 'contents'}>
          <div className="aspect-video w-full max-w-[960px] overflow-hidden rounded-md bg-black shadow-soft">
            <canvas ref={canvasRef} width={1280} height={720} className="h-full w-full" data-testid="preview-canvas" />
          </div>
        </div>
        {scopesOpen ? <ColorScopesPanel frame={scopeFrame} active={scopesOpen} /> : null}
      </div>
      <div className="border-t border-black/30 px-3 py-2 text-xs tabular-nums text-slate-300">{formatTime(playheadTime)}</div>
    </section>
  );
}

function formatTime(time: number): string {
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  const frames = Math.floor((time % 1) * 30);
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}:${frames.toString().padStart(2, '0')}`;
}
