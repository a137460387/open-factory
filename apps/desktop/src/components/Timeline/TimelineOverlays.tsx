import { useState, useMemo, useRef, useEffect } from 'react';
import {
  type BeatMarker,
  type ProjectAnnotation,
  type SelectionRect,
  type TimelineBookmark,
  type TimelineColorHeatmapPoint,
  type TimelineHeatmapSegment,
  type TimelineMarker,
  type TimelineMinimapLayout,
  type TimelineMinimapViewportRect,
  type TimelineNote,
  type TimecodeFormat,
  buildTimelineNoteLayout,
  getSelectionMarqueeBox,
  secondsToTimecode,
  snapTime,
  type SceneColorDifference,
} from '@open-factory/editor-core';
import { zhCN } from '../../i18n/strings';
import { LABEL_WIDTH } from './TimelineParts';
import type { TimelineHeatmapViewSettings } from '../../settings/appSettings';
import type { SelectedKeyframeRef } from '../../store/editorStore';

export interface TimelineNoteDraftState {
  start: number;
  end: number;
  anchor: number;
}

export interface BookmarkRenameState {
  id: string;
  note: string;
}

export function TimelineNoteLayer({
  width,
  zoom,
  notes,
  draft,
  onDraftChange,
  onCreateRange,
  onSeek,
  onEdit,
}: {
  width: number;
  zoom: number;
  notes: ReturnType<typeof buildTimelineNoteLayout>;
  draft?: TimelineNoteDraftState;
  onDraftChange(draft?: TimelineNoteDraftState): void;
  onCreateRange(start: number, end: number): void;
  onSeek(time: number): void;
  onEdit(note: TimelineNote): void;
}) {
  const createdOrder = useMemo(
    () =>
      new Map(
        [...notes]
          .sort(
            (left, right) =>
              left.note.createdAt.localeCompare(right.note.createdAt) || left.note.id.localeCompare(right.note.id),
          )
          .map((layout, index) => [layout.note.id, index + 1]),
      ),
    [notes],
  );

  function timeFromPointer(event: React.PointerEvent<HTMLDivElement>): number {
    const rect = event.currentTarget.getBoundingClientRect();
    return Math.max(0, snapTime((event.clientX - rect.left) / zoom));
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>): void {
    if (event.button !== 0 || event.target !== event.currentTarget) {
      return;
    }
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const start = timeFromPointer(event);
    onDraftChange({ start, end: start, anchor: start });
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>): void {
    if (!draft) {
      return;
    }
    const time = timeFromPointer(event);
    onDraftChange({ ...draft, start: Math.min(draft.anchor, time), end: Math.max(draft.anchor, time) });
  }

  function onPointerUp(event: React.PointerEvent<HTMLDivElement>): void {
    if (!draft) {
      return;
    }
    event.currentTarget.releasePointerCapture(event.pointerId);
    const time = timeFromPointer(event);
    const start = Math.min(draft.anchor, time);
    const end = Math.max(draft.anchor, time);
    onDraftChange(undefined);
    if (end <= start) {
      return;
    }
    onCreateRange(start, end);
  }

  return (
    <div
      className="flex h-6 border-b border-line bg-[var(--color-bg-secondary)]/80"
      data-testid="timeline-note-row"
      style={{ width: LABEL_WIDTH + width }}
    >
      <div
        className="flex h-6 shrink-0 items-center border-r border-line px-2 text-[11px] font-semibold text-[var(--color-text-muted)]"
        style={{ width: LABEL_WIDTH }}
      >
        {zhCN.timeline.timelineNoteLayer}
      </div>
      <div
        className="relative h-6 cursor-crosshair overflow-hidden"
        style={{ width }}
        data-testid="timeline-note-layer"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        {notes.map((layout) => {
          const left = layout.note.start * zoom;
          const noteWidth = Math.max(8, (layout.note.end - layout.note.start) * zoom);
          return (
            <button
              key={layout.note.id}
              className={`absolute top-[3px] h-[18px] overflow-hidden rounded-[3px] border border-white/80 px-1 text-left text-[10px] font-semibold text-ink shadow-sm ${layout.overlaps ? 'ring-1 ring-[var(--color-border)]/20' : ''}`}
              style={{
                left,
                width: noteWidth,
                backgroundColor: layout.note.color,
                zIndex: createdOrder.get(layout.note.id) ?? 1,
              }}
              type="button"
              title={`${layout.note.text} (${layout.note.start.toFixed(2)}s - ${layout.note.end.toFixed(2)}s)`}
              data-testid={`timeline-note-block-${layout.note.id}`}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                onSeek(layout.note.start);
              }}
              onDoubleClick={(event) => {
                event.stopPropagation();
                onEdit(layout.note);
              }}
            >
              <span className="block truncate pointer-events-none">{layout.note.text}</span>
            </button>
          );
        })}
        {draft ? (
          <div
            className="pointer-events-none absolute top-[3px] h-[18px] rounded-[3px] border border-dashed border-line bg-[var(--color-bg-elevated)]/60"
            style={{ left: draft.start * zoom, width: Math.max(8, (draft.end - draft.start) * zoom) }}
            data-testid="timeline-note-draft"
          />
        ) : null}
      </div>
    </div>
  );
}

export function AnnotationBubble({
  annotation,
  index,
  left,
  onSeek,
  onEdit,
}: {
  annotation: ProjectAnnotation;
  index: number;
  left: number;
  onSeek(time: number): void;
  onEdit(time: number, annotation: ProjectAnnotation): void;
}) {
  return (
    <button
      className="absolute top-2 z-40 flex max-w-[180px] -translate-x-3 items-center gap-1 rounded-full border border-white bg-[var(--color-bg-elevated)] px-2 py-1 text-[11px] font-medium text-[var(--color-text-secondary)] shadow-soft hover:border-line"
      style={{ left }}
      type="button"
      title={`${annotation.text} (${annotation.time.toFixed(2)}s)`}
      data-testid={`timeline-annotation-${annotation.id}`}
      onClick={(event) => {
        event.stopPropagation();
        onSeek(annotation.time);
      }}
      onDoubleClick={(event) => {
        event.stopPropagation();
        onEdit(annotation.time, annotation);
      }}
    >
      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: annotation.color }} />
      <span className="truncate">{annotation.text || zhCN.timeline.annotationLabel(index + 1)}</span>
    </button>
  );
}

export function TimelineBookmarkOverlay({
  bookmark,
  left,
  onSeek,
  onRemove,
}: {
  bookmark: TimelineBookmark;
  left: number;
  onSeek(time: number): void;
  onRemove(bookmarkId: string): void;
}) {
  return (
    <button
      className="absolute bottom-0 top-0 z-[35] w-4 -translate-x-1/2 bg-transparent"
      style={{ left }}
      type="button"
      title={`${bookmark.note} (${bookmark.time.toFixed(2)}s)`}
      data-testid={`timeline-bookmark-${bookmark.id}`}
      onClick={(event) => {
        event.stopPropagation();
        onSeek(bookmark.time);
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onRemove(bookmark.id);
      }}
    >
      <span
        className="absolute left-1/2 top-0 z-10 h-4 w-4 -translate-x-1/2 border border-white bg-yellow-400 shadow-sm"
        style={{ clipPath: 'polygon(50% 0, 0 100%, 100% 100%)' }}
      />
      <span className="absolute bottom-0 left-1/2 top-4 w-px -translate-x-1/2 bg-yellow-400/70" />
      <span className="sr-only">{bookmark.note}</span>
    </button>
  );
}

export function TimelineMarkerOverlay({
  marker,
  left,
  onSeek,
  onRemove,
}: {
  marker: TimelineMarker;
  left: number;
  onSeek(time: number): void;
  onRemove(markerId: string): void;
}) {
  return (
    <button
      className="absolute bottom-0 top-0 z-30 w-0.5 -translate-x-1/2 bg-transparent"
      style={{ left }}
      type="button"
      title={`${marker.label} (${marker.time.toFixed(2)}s)`}
      data-testid={`timeline-marker-${marker.id}`}
      onClick={(event) => {
        event.stopPropagation();
        onSeek(marker.time);
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onRemove(marker.id);
      }}
    >
      <span
        className="absolute left-1/2 top-1 z-10 h-4 w-4 -translate-x-1/2 rounded-sm border border-white shadow-sm"
        style={{ backgroundColor: marker.color }}
      />
      <span
        className="absolute bottom-0 top-0 left-1/2 w-0.5 -translate-x-1/2"
        style={{ backgroundColor: marker.color }}
      />
      <span className="sr-only">{marker.label}</span>
    </button>
  );
}

export function SceneCutOverlay({
  cut,
  left,
  onSeek,
}: {
  cut: { id: string; clipId: string; time: number };
  left: number;
  onSeek(time: number): void;
}) {
  return (
    <button
      className="absolute bottom-0 top-0 z-30 w-2 -translate-x-1/2 bg-transparent"
      style={{ left }}
      type="button"
      title={zhCN.timeline.sceneCutMarkerTitle(cut.time)}
      data-testid={`timeline-scenecut-${cut.id}`}
      data-clip-id={cut.clipId}
      onClick={(event) => {
        event.stopPropagation();
        onSeek(cut.time);
      }}
    >
      <span className="absolute bottom-0 top-0 left-1/2 w-0.5 -translate-x-1/2 bg-orange-500/80" />
      <span className="absolute left-1/2 top-0 h-3 w-3 -translate-x-1/2 rounded-sm border border-white bg-orange-500 shadow-sm" />
      <span className="sr-only">{zhCN.timeline.sceneCutMarkerTitle(cut.time)}</span>
    </button>
  );
}

export function BeatMarkerOverlay({
  marker,
  left,
  active,
  onSeek,
  onRemove,
}: {
  marker: BeatMarker;
  left: number;
  active?: boolean;
  onSeek(time: number): void;
  onRemove(markerId: string): void;
}) {
  return (
    <button
      className={`absolute bottom-0 top-0 z-30 w-0.5 -translate-x-1/2 bg-transparent ${active ? 'animate-pulse' : ''}`}
      style={{ left }}
      type="button"
      title={zhCN.timeline.beatMarkerTitle(marker.time)}
      data-testid={`timeline-beat-marker-${marker.id}`}
      data-active={active ? 'true' : 'false'}
      onClick={(event) => {
        event.stopPropagation();
        onSeek(marker.time);
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onRemove(marker.id);
      }}
    >
      <span
        className={`absolute left-1/2 top-6 z-10 h-3.5 w-3.5 -translate-x-1/2 rotate-45 rounded-[2px] border border-white shadow-sm ${active ? 'bg-yellow-300 ring-4 ring-yellow-300/40' : 'bg-orange-500'}`}
      />
      <span
        className={`absolute bottom-0 top-0 left-1/2 w-0.5 -translate-x-1/2 ${active ? 'bg-yellow-300' : 'bg-orange-500/75'}`}
      />
      <span className="sr-only">{zhCN.timeline.beatMarker}</span>
    </button>
  );
}

export function SelectionMarquee({ rect }: { rect: SelectionRect }) {
  const { left, top, width, height } = getSelectionMarqueeBox(rect);
  return (
    <div
      className="pointer-events-none fixed z-50 border border-[var(--color-accent)] bg-[var(--color-accent)]/20"
      style={{ left, top, width, height }}
      data-testid="timeline-selection-marquee"
      data-left={left}
      data-top={top}
      data-width={width}
      data-height={height}
    />
  );
}

export function TimelineMinimap({
  layout,
  viewport,
  height,
  onNavigate,
}: {
  layout: TimelineMinimapLayout;
  viewport: TimelineMinimapViewportRect;
  height: number;
  onNavigate(y: number, mode: 'top' | 'center'): void;
}) {
  const [dragging, setDragging] = useState(false);

  function yFromEvent(event: React.PointerEvent<HTMLElement>): number {
    const rect = event.currentTarget.getBoundingClientRect();
    return Math.min(rect.height, Math.max(0, event.clientY - rect.top));
  }

  function beginDrag(event: React.PointerEvent<HTMLElement>): void {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
    onNavigate(yFromEvent(event), 'center');
  }

  function updateDrag(event: React.PointerEvent<HTMLElement>): void {
    if (!dragging) {
      return;
    }
    event.preventDefault();
    onNavigate(yFromEvent(event), 'center');
  }

  function endDrag(event: React.PointerEvent<HTMLElement>): void {
    if (!dragging) {
      return;
    }
    event.preventDefault();
    setDragging(false);
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  return (
    <aside
      className="relative shrink-0 overflow-hidden border-l border-line bg-[var(--color-bg-secondary)]"
      style={{ width: 120, height }}
      aria-label={zhCN.toolbar.timelineMinimap}
      data-testid="timeline-minimap"
      onPointerDown={beginDrag}
      onPointerMove={updateDrag}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      {layout.tracks.map((track) => (
        <span
          key={track.id}
          className="absolute bottom-1 top-1 rounded-sm opacity-20"
          style={{ left: track.x, width: track.width, backgroundColor: track.color }}
          data-testid="timeline-minimap-track"
          data-track-id={track.id}
        />
      ))}
      {layout.clips.map((clip) => (
        <span
          key={clip.id}
          className="absolute rounded-sm border border-white/60 shadow-sm"
          style={{ left: clip.x, top: clip.y, width: clip.width, height: clip.height, backgroundColor: clip.color }}
          data-testid="timeline-minimap-clip"
          data-clip-id={clip.id}
        />
      ))}
      {layout.markers.map((marker) => (
        <span
          key={marker.id}
          className="absolute left-1 right-1 h-0.5 rounded-full"
          style={{ top: marker.y, backgroundColor: marker.color }}
          data-testid="timeline-minimap-marker"
          data-marker-kind={marker.kind}
        />
      ))}
      <span
        className="absolute left-1 right-1 rounded-sm border-2 border-brand bg-brand/15 shadow-sm"
        style={{ top: viewport.y, height: viewport.height }}
        data-testid="timeline-minimap-viewport"
        data-visible-start={viewport.start}
        data-visible-end={viewport.end}
      />
    </aside>
  );
}

export function TimelineColorHeatmapLayer({
  points,
  jumps,
  zoom,
  width,
}: {
  points: TimelineColorHeatmapPoint[];
  jumps: SceneColorDifference[];
  zoom: number;
  width: number;
}) {
  return (
    <div
      className="pointer-events-none absolute top-0 z-[7] h-9"
      style={{ left: 0, width: LABEL_WIDTH + width }}
      data-testid="timeline-color-heatmap-layer"
    >
      {points.map((point) => {
        const barHeight = 8 + point.height * 22;
        return (
          <div
            key={point.clipId}
            className="absolute top-1 rounded-sm border border-white/70 shadow-sm"
            style={{
              left: LABEL_WIDTH + point.start * zoom,
              width: Math.max(3, (point.end - point.start) * zoom),
              height: barHeight,
              backgroundColor: point.color,
            }}
            title={`${Math.round(point.colorTemperatureKelvin)}K / ${point.brightness.toFixed(1)}`}
            data-testid="timeline-color-heatmap-point"
            data-clip-id={point.clipId}
          />
        );
      })}
      {jumps.map((jump) => (
        <div
          key={`${jump.fromClipId}-${jump.toClipId}-${jump.time}`}
          className="absolute top-0 h-9 border-l-2 border-amber-500"
          style={{ left: LABEL_WIDTH + jump.time * zoom }}
          title={`${jump.fromClipId} -> ${jump.toClipId}: ${jump.score.toFixed(2)}`}
          data-testid="timeline-color-jump-marker"
          data-from-clip-id={jump.fromClipId}
          data-to-clip-id={jump.toClipId}
        >
          <span className="absolute -left-1.5 top-0 h-3 w-3 rotate-45 bg-amber-500 shadow-sm" />
        </div>
      ))}
    </div>
  );
}

export function TimelineHeatmapCanvas({
  segments,
  zoom,
  width,
  height,
  opacity,
  colorScheme,
}: {
  segments: TimelineHeatmapSegment[];
  zoom: number;
  width: number;
  height: number;
  opacity: number;
  colorScheme: TimelineHeatmapViewSettings['colorScheme'];
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasWidth = Math.max(1, Math.round(width));
  const canvasHeight = Math.max(1, Math.round(height));

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) {
      return;
    }
    context.clearRect(0, 0, canvasWidth, canvasHeight);
    if (segments.length === 0) {
      return;
    }
    const gradient = context.createLinearGradient(0, 0, 0, canvasHeight);
    gradient.addColorStop(0, 'rgba(255,255,255,0.18)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    for (const segment of segments) {
      const left = Math.max(0, Math.round(segment.start * zoom));
      const segmentWidth = Math.max(1, Math.round((segment.end - segment.start) * zoom));
      context.fillStyle = heatmapColor(segment.normalized, colorScheme);
      context.fillRect(left, 0, segmentWidth, canvasHeight);
      context.fillStyle = gradient;
      context.fillRect(left, 0, segmentWidth, canvasHeight);
    }
  }, [canvasHeight, canvasWidth, colorScheme, segments, zoom]);

  return (
    <canvas
      ref={canvasRef}
      width={canvasWidth}
      height={canvasHeight}
      className="pointer-events-none absolute top-0 z-[6]"
      style={{ left: LABEL_WIDTH, width, height, opacity }}
      data-testid="timeline-heatmap-canvas"
    />
  );
}

export function heatmapColor(value: number, colorScheme: TimelineHeatmapViewSettings['colorScheme']): string {
  const normalized = Math.min(1, Math.max(0, value));
  if (colorScheme === 'cool') {
    const red = Math.round(37 + normalized * 20);
    const green = Math.round(99 + normalized * 140);
    const blue = Math.round(235 - normalized * 50);
    return `rgba(${red},${green},${blue},0.85)`;
  }
  if (colorScheme === 'mono') {
    const channel = Math.round(38 + normalized * 205);
    return `rgba(${channel},${channel},${channel},0.78)`;
  }
  const red = Math.round(251);
  const green = Math.round(191 - normalized * 110);
  const blue = Math.round(36 - normalized * 18);
  return `rgba(${red},${green},${blue},0.85)`;
}

export function keyframeRefKey(ref: SelectedKeyframeRef): string {
  return `${ref.clipId}\0${ref.property}\0${ref.keyframeId}`;
}

export function TimelineNoteListPanel({
  notes,
  search,
  fps,
  timecodeFormat,
  onSearch,
  onSeek,
  onEdit,
  onRemove,
  onExportCsv,
}: {
  notes: TimelineNote[];
  search: string;
  fps: number;
  timecodeFormat: TimecodeFormat;
  onSearch(value: string): void;
  onSeek(time: number): void;
  onEdit(note: TimelineNote): void;
  onRemove(noteId: string): void;
  onExportCsv(): void;
}) {
  return (
    <aside
      className="absolute bottom-3 right-3 top-16 z-50 flex w-80 flex-col overflow-hidden rounded-md border border-line bg-[var(--color-bg-elevated)] shadow-soft"
      data-testid="timeline-note-panel"
    >
      <div className="border-b border-line px-3 py-2">
        <div className="text-sm font-semibold text-ink">{zhCN.timeline.timelineNoteList}</div>
        <div className="mt-2 flex gap-2">
          <input
            className="h-8 min-w-0 flex-1 rounded border border-line bg-[var(--color-bg-elevated)] px-2 text-xs text-ink"
            value={search}
            placeholder={zhCN.timeline.timelineNoteSearchPlaceholder}
            data-testid="timeline-note-search"
            onChange={(event) => onSearch(event.target.value)}
          />
          <button
            className="rounded border border-line bg-[var(--color-bg-elevated)] px-2 text-xs font-medium hover:bg-panel"
            type="button"
            data-testid="timeline-note-export-csv"
            onClick={onExportCsv}
          >
            {zhCN.timeline.timelineNoteExportCsv}
          </button>
        </div>
      </div>
      {notes.length === 0 ? (
        <div
          className="flex flex-1 items-center justify-center px-3 py-6 text-sm text-[var(--color-text-muted)]"
          data-testid="timeline-note-list-empty"
        >
          {zhCN.timeline.timelineNoteListEmpty}
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto p-2">
          {notes.map((note) => (
            <div
              key={note.id}
              className="mb-2 rounded-md border border-line bg-panel p-2 text-xs"
              data-testid={`timeline-note-list-row-${note.id}`}
            >
              <button
                className="flex w-full items-start gap-2 rounded text-left hover:bg-[var(--color-bg-elevated)]"
                type="button"
                data-testid={`timeline-note-list-item-${note.id}`}
                onClick={() => onSeek(note.start)}
                onDoubleClick={() => onEdit(note)}
              >
                <span className="mt-1 h-3 w-3 shrink-0 rounded-[3px]" style={{ backgroundColor: note.color }} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-ink">{note.text}</span>
                  <span className="mt-0.5 block tabular-nums text-[var(--color-text-muted)]">
                    {secondsToTimecode(note.start, fps, timecodeFormat)} -{' '}
                    {secondsToTimecode(note.end, fps, timecodeFormat)}
                  </span>
                </span>
              </button>
              <div className="mt-2 flex justify-end gap-2">
                <button
                  className="rounded border border-line bg-[var(--color-bg-elevated)] px-2 py-1 hover:bg-panel"
                  type="button"
                  data-testid={`timeline-note-edit-${note.id}`}
                  onClick={() => onEdit(note)}
                >
                  {zhCN.timeline.timelineNoteEditTitle}
                </button>
                <button
                  className="rounded border border-rose-200 bg-[var(--color-bg-elevated)] px-2 py-1 text-rose-700 hover:bg-rose-50"
                  type="button"
                  data-testid={`timeline-note-delete-${note.id}`}
                  onClick={() => onRemove(note.id)}
                >
                  {zhCN.timeline.timelineNoteDelete}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}

export function AnnotationListPanel({
  annotations,
  onSeek,
  onEdit,
  onRemove,
}: {
  annotations: ProjectAnnotation[];
  onSeek(time: number): void;
  onEdit(annotation: ProjectAnnotation): void;
  onRemove(annotationId: string): void;
}) {
  return (
    <aside
      className="absolute bottom-3 right-3 top-16 z-50 flex w-72 flex-col overflow-hidden rounded-md border border-line bg-[var(--color-bg-elevated)] shadow-soft"
      data-testid="annotation-list-panel"
    >
      <div className="border-b border-line px-3 py-2 text-sm font-semibold text-ink">
        {zhCN.timeline.annotationList}
      </div>
      {annotations.length === 0 ? (
        <div
          className="flex flex-1 items-center justify-center px-3 py-6 text-sm text-[var(--color-text-muted)]"
          data-testid="annotation-list-empty"
        >
          {zhCN.timeline.annotationListEmpty}
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto p-2">
          {annotations.map((annotation) => (
            <div
              key={annotation.id}
              className="mb-2 rounded-md border border-line bg-panel p-2 text-xs"
              data-testid={`annotation-list-row-${annotation.id}`}
            >
              <button
                className="flex w-full items-start gap-2 rounded text-left hover:bg-[var(--color-bg-elevated)]"
                type="button"
                data-testid={`annotation-list-item-${annotation.id}`}
                onClick={() => onSeek(annotation.time)}
              >
                <span
                  className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: annotation.color }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-ink">{annotation.text}</span>
                  <span className="mt-0.5 block tabular-nums text-[var(--color-text-muted)]">
                    {annotation.time.toFixed(2)}s
                  </span>
                </span>
              </button>
              <div className="mt-2 flex justify-end gap-2">
                <button
                  className="rounded border border-line bg-[var(--color-bg-elevated)] px-2 py-1 hover:bg-panel"
                  type="button"
                  data-testid={`annotation-edit-${annotation.id}`}
                  onClick={() => onEdit(annotation)}
                >
                  {zhCN.timeline.annotationEditTitle}
                </button>
                <button
                  className="rounded border border-rose-200 bg-[var(--color-bg-elevated)] px-2 py-1 text-rose-700 hover:bg-rose-50"
                  type="button"
                  data-testid={`annotation-delete-${annotation.id}`}
                  onClick={() => onRemove(annotation.id)}
                >
                  {zhCN.timeline.annotationDelete}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}

export function BookmarkListPanel({
  bookmarks,
  editing,
  onSeek,
  onBeginRename,
  onChangeRename,
  onSaveRename,
  onCancelRename,
  onRemove,
}: {
  bookmarks: TimelineBookmark[];
  editing?: BookmarkRenameState;
  onSeek(time: number): void;
  onBeginRename(bookmark: TimelineBookmark): void;
  onChangeRename(value: BookmarkRenameState): void;
  onSaveRename(bookmarkId: string, note: string): void;
  onCancelRename(): void;
  onRemove(bookmarkId: string): void;
}) {
  return (
    <aside
      className="absolute bottom-3 right-3 top-16 z-50 flex w-72 flex-col overflow-hidden rounded-md border border-line bg-[var(--color-bg-elevated)] shadow-soft"
      data-testid="bookmark-panel"
    >
      <div className="border-b border-line px-3 py-2 text-sm font-semibold text-ink">{zhCN.timeline.bookmarkList}</div>
      {bookmarks.length === 0 ? (
        <div
          className="flex flex-1 items-center justify-center px-3 py-6 text-sm text-[var(--color-text-muted)]"
          data-testid="bookmark-list-empty"
        >
          {zhCN.timeline.bookmarkListEmpty}
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto p-2">
          {bookmarks.map((bookmark) => (
            <div
              key={bookmark.id}
              className="mb-2 rounded-md border border-line bg-panel p-2 text-xs"
              data-testid={`bookmark-list-row-${bookmark.id}`}
            >
              {editing?.id === bookmark.id ? (
                <div className="space-y-2">
                  <input
                    className="h-8 w-full rounded border border-line bg-[var(--color-bg-elevated)] px-2 text-xs text-ink"
                    value={editing.note}
                    maxLength={120}
                    autoFocus
                    data-testid={`bookmark-rename-input-${bookmark.id}`}
                    onChange={(event) => onChangeRename({ id: bookmark.id, note: event.target.value })}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        onSaveRename(bookmark.id, editing.note);
                      }
                      if (event.key === 'Escape') {
                        onCancelRename();
                      }
                    }}
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      className="rounded border border-line bg-[var(--color-bg-elevated)] px-2 py-1 hover:bg-panel"
                      type="button"
                      onClick={onCancelRename}
                    >
                      {zhCN.common.cancel}
                    </button>
                    <button
                      className="rounded bg-brand px-2 py-1 font-medium text-white hover:bg-[#176858]"
                      type="button"
                      data-testid={`bookmark-rename-save-${bookmark.id}`}
                      onClick={() => onSaveRename(bookmark.id, editing.note)}
                    >
                      {zhCN.timeline.bookmarkRename}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <button
                    className="flex w-full items-start gap-2 rounded text-left hover:bg-[var(--color-bg-elevated)]"
                    type="button"
                    data-testid={`bookmark-list-item-${bookmark.id}`}
                    onClick={() => onSeek(bookmark.time)}
                    onDoubleClick={() => onBeginRename(bookmark)}
                  >
                    <span
                      className="mt-1 h-3 w-3 shrink-0 bg-yellow-400"
                      style={{ clipPath: 'polygon(50% 0, 0 100%, 100% 100%)' }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-ink">{bookmark.note}</span>
                      <span className="mt-0.5 block tabular-nums text-[var(--color-text-muted)]">
                        {bookmark.time.toFixed(2)}s
                      </span>
                    </span>
                  </button>
                  <div className="mt-2 flex justify-end gap-2">
                    <button
                      className="rounded border border-line bg-[var(--color-bg-elevated)] px-2 py-1 hover:bg-panel"
                      type="button"
                      data-testid={`bookmark-rename-${bookmark.id}`}
                      onClick={() => onBeginRename(bookmark)}
                    >
                      {zhCN.timeline.bookmarkRename}
                    </button>
                    <button
                      className="rounded border border-rose-200 bg-[var(--color-bg-elevated)] px-2 py-1 text-rose-700 hover:bg-rose-50"
                      type="button"
                      data-testid={`bookmark-delete-${bookmark.id}`}
                      onClick={() => onRemove(bookmark.id)}
                    >
                      {zhCN.timeline.bookmarkDelete}
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}
