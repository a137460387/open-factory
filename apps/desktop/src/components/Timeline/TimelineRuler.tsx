import {memo} from 'react';
import {
  snapTime,
  type DialogueInterval,
  type TimelineDiffRange,
  type TimelineRulerTick,
  type TimelineRenderRange,
} from '@open-factory/editor-core';
import {zhCN} from '../../i18n/strings';

function Ruler({
  ticks,
  zoom,
  width,
  currentTimecode,
  cachedRanges,
  diffRanges,
  exportRanges,
  protectedRanges,
  dialogueMarkers,
  onSeek,
  onContextMenu,
  audioScrubEnabled,
}: {
  ticks: TimelineRulerTick[];
  zoom: number;
  width: number;
  currentTimecode: string;
  cachedRanges: TimelineRenderRange[];
  staleRanges: TimelineRenderRange[];
  diffRanges: TimelineDiffRange[];
  exportRanges: Array<{id: string; start: number; end: number}>;
  protectedRanges: Array<{id: string; start: number; end: number}>;
  dialogueMarkers: DialogueInterval[];
  onSeek(time: number): void;
  onContextMenu(request: {time: number; x: number; y: number}): void;
  audioScrubEnabled?: boolean;
}) {
  function timeFromEvent(event: React.PointerEvent<HTMLDivElement> | React.MouseEvent<HTMLDivElement>): number {
    const rect = event.currentTarget.getBoundingClientRect();
    return snapTime((event.clientX - rect.left) / zoom);
  }

  return (
    <div className="sticky top-0 z-30 grid h-11 grid-cols-[160px_1fr] border-b border-line bg-panel">
      <div className="grid grid-rows-[10px_1fr] border-r border-line">
        <div className="px-3 text-[9px] font-medium leading-[10px] text-emerald-700">{zhCN.timeline.renderCache}</div>
        <div
          className="px-3 py-1 font-mono text-xs font-semibold tabular-nums text-[var(--color-text-secondary)]"
          data-testid="timeline-ruler-timecode"
        >
          {currentTimecode}
        </div>
      </div>
      <div className="min-w-0" style={{width}}>
        <div className="relative h-2 bg-emerald-50" data-testid="timeline-render-cache-bar">
          {cachedRanges.map((range) => (
            <span
              key={`${range.start}-${range.end}`}
              className="absolute top-0 h-full bg-emerald-500"
              style={{left: range.start * zoom, width: Math.max(1, (range.end - range.start) * zoom)}}
              data-testid="timeline-render-cache-segment"
            />
          ))}
        </div>
        <div
          className="relative h-8"
          role="slider"
          aria-label="时间线位置"
          aria-valuemin={0}
          aria-valuemax={Math.round(width / zoom)}
          data-testid="timeline-ruler"
          onPointerDown={(event) => {
            if (event.button !== 0) {
              return;
            }
            const startTime = timeFromEvent(event);
            const startX = event.clientX;
            let scrubbing = false;
            let lastScrubTime = 0;
            let scrubCtx = audioScrubEnabled
              ? (() => {
                  try {
                    const Ctor =
                      window.AudioContext ||
                      ((window as unknown as Record<string, unknown>).webkitAudioContext as AudioContext | undefined);
                    return Ctor ? new Ctor() : null;
                  } catch {
                    return null;
                  }
                })()
              : null;
            onSeek(startTime);
            const onMove = (moveEvent: PointerEvent) => {
              if (!scrubbing && Math.abs(moveEvent.clientX - startX) > 3) {
                scrubbing = true;
              }
              if (scrubbing) {
                const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
                const t = Math.max(0, (moveEvent.clientX - rect.left) / zoom);
                onSeek(t);
                const now = Date.now();
                if (scrubCtx && now - lastScrubTime >= 30) {
                  try {
                    const speedPxPerSec =
                      Math.abs(moveEvent.clientX - startX) / Math.max(0.001, (now - event.timeStamp) / 1000);
                    const intervalMul = speedPxPerSec > 500 ? 0.25 : speedPxPerSec > 100 ? 0.5 : 1.0;
                    const dur = 0.05 * intervalMul;
                    const osc = scrubCtx.createOscillator();
                    const gain = scrubCtx.createGain();
                    osc.frequency.value = 200 + ((t * 100) % 800);
                    gain.gain.setValueAtTime(0.15, scrubCtx.currentTime);
                    gain.gain.exponentialRampToValueAtTime(0.001, scrubCtx.currentTime + dur);
                    osc.connect(gain).connect(scrubCtx.destination);
                    osc.start(scrubCtx.currentTime);
                    osc.stop(scrubCtx.currentTime + dur);
                    lastScrubTime = now;
                  } catch {
                    /* silent degradation */
                  }
                }
              }
            };
            const onUp = () => {
              window.removeEventListener('pointermove', onMove);
              window.removeEventListener('pointerup', onUp);
              if (scrubCtx) {
                try {
                  scrubCtx.close();
                } catch {
                  // AudioContext close can fail if already closed
                }
                scrubCtx = null;
              }
            };
            window.addEventListener('pointermove', onMove);
            window.addEventListener('pointerup', onUp);
          }}
          onDoubleClick={(event) => {
            if (event.button !== 0) {
              return;
            }
            onSeek(timeFromEvent(event));
          }}
          onContextMenu={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onContextMenu({time: timeFromEvent(event), x: event.clientX, y: event.clientY});
          }}
        >
          {diffRanges.map((range) => (
            <span
              key={`${range.start}-${range.end}`}
              className="absolute bottom-0 top-0 z-0 bg-orange-300/55"
              style={{left: range.start * zoom, width: Math.max(2, (range.end - range.start) * zoom)}}
              title={zhCN.timeline.snapshotDiffRange}
              data-testid="timeline-snapshot-diff-segment"
            />
          ))}
          {exportRanges.map((range) => (
            <span
              key={range.id}
              className="absolute bottom-0 top-0 z-[1] bg-sky-400/35"
              style={{left: range.start * zoom, width: Math.max(2, (range.end - range.start) * zoom)}}
              title={zhCN.timeline.exportRange}
              data-testid="timeline-export-range-highlight"
            />
          ))}
          {protectedRanges.map((range) => (
            <span
              key={range.id}
              className="absolute bottom-0 top-0 z-[2] bg-rose-500/30"
              style={{left: range.start * zoom, width: Math.max(2, (range.end - range.start) * zoom)}}
              title={zhCN.timeline.protectedRange}
              data-testid="timeline-ruler-protected-range"
            />
          ))}
          {dialogueMarkers.map((marker) => (
            <span
              key={marker.id}
              className="absolute bottom-0 top-0 z-[3] rounded-sm bg-emerald-500/45 outline outline-1 outline-emerald-600/70"
              style={{left: marker.start * zoom, width: Math.max(2, (marker.end - marker.start) * zoom)}}
              title={zhCN.timeline.dialogueMarkerTitle(marker.confidence)}
              data-testid="timeline-dialogue-marker"
              data-confidence={marker.confidence}
            />
          ))}
          {ticks.map((tick) => (
            <div
              key={`${tick.unit}-${tick.time}`}
              className="absolute top-0 z-10 h-full border-l border-line pl-1 text-[11px] text-[var(--color-text-muted)]"
              style={{left: tick.time * zoom}}
              data-testid="timeline-ruler-tick"
              data-ruler-unit={tick.unit}
            >
              {tick.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const MemoizedRuler = memo(Ruler);

export {MemoizedRuler as Ruler};
