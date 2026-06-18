import {
  calculateTimelineCompareScrollSync,
  diffTimelineVersions,
  getTimelineDuration,
  getTimelineVersionDiffNavigationIndex,
  type Clip,
  type Project,
  type Timeline,
  type TimelineVersionDiffItem,
  type TimelineVersionDiffType,
  type Track
} from '@open-factory/editor-core';
import { ChevronDown, ChevronUp, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { zhCN } from '../i18n/strings';
import { listProjectSnapshots, readProjectSnapshot, type ProjectSnapshotEntry } from '../lib/projectSnapshots';
import { showToast } from '../lib/toast';

interface TimelineCompareDialogProps {
  project: Project;
  projectPath?: string;
  onApply(source: Project, itemIds: string[]): void;
  onClose(): void;
}

interface LoadedVersion {
  id: string;
  label: string;
  project: Project;
  entry?: ProjectSnapshotEntry;
}

const MIN_TIMELINE_WIDTH = 720;
const TRACK_HEIGHT = 56;

export function TimelineCompareDialog({ project, projectPath, onApply, onClose }: TimelineCompareDialogProps) {
  const t = zhCN.timelineCompare;
  const [versions, setVersions] = useState<LoadedVersion[]>([{ id: 'current', label: zhCN.projectSnapshots.currentVersion, project }]);
  const [baseId, setBaseId] = useState('current');
  const [targetId, setTargetId] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [zoom, setZoom] = useState(80);
  const [loading, setLoading] = useState(false);
  const [syncOffset, setSyncOffset] = useState(0);
  const leftScrollRef = useRef<HTMLDivElement | null>(null);
  const rightScrollRef = useRef<HTMLDivElement | null>(null);
  const syncingRef = useRef(false);

  useEffect(() => {
    let disposed = false;
    const load = async () => {
      setLoading(true);
      try {
        const entries = await listProjectSnapshots(project.id);
        const loaded = await Promise.all(
          entries.map(async (entry) => ({
            id: entry.path,
            label: entry.name,
            entry,
            project: await readProjectSnapshot(entry, projectPath)
          }))
        );
        if (disposed) {
          return;
        }
        setVersions([{ id: 'current', label: zhCN.projectSnapshots.currentVersion, project }, ...loaded]);
        if (loaded.length >= 2) {
          setBaseId(loaded[1].id);
          setTargetId(loaded[0].id);
        } else {
          setBaseId('current');
          setTargetId(loaded[0]?.id ?? '');
        }
      } catch (error) {
        showToast({ kind: 'warning', title: t.title, message: error instanceof Error ? error.message : zhCN.projectSnapshots.compareFailed });
      } finally {
        if (!disposed) {
          setLoading(false);
        }
      }
    };
    void load();
    return () => {
      disposed = true;
    };
  }, [project, project.id, projectPath, t.title]);

  const base = versions.find((version) => version.id === baseId);
  const target = versions.find((version) => version.id === targetId);
  const diff = useMemo(() => (base && target ? diffTimelineVersions(base.project.timeline, target.project.timeline) : undefined), [base, target]);
  const items = diff?.items ?? [];
  const activeItem = activeIndex >= 0 ? items[activeIndex] : undefined;

  useEffect(() => {
    setSelected([]);
    setActiveIndex(items.length > 0 ? 0 : -1);
  }, [baseId, items.length, targetId]);

  const toggle = (id: string) => {
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  };

  const jumpDiff = (direction: 'previous' | 'next') => {
    setActiveIndex((current) => getTimelineVersionDiffNavigationIndex(items, current, direction));
  };

  const syncScroll = (sourceSide: 'a' | 'b') => {
    if (syncingRef.current) {
      return;
    }
    const source = sourceSide === 'a' ? leftScrollRef.current : rightScrollRef.current;
    const targetElement = sourceSide === 'a' ? rightScrollRef.current : leftScrollRef.current;
    if (!source || !targetElement) {
      return;
    }
    const nextOffset = calculateTimelineCompareScrollSync(source.scrollLeft, source.scrollWidth, source.clientWidth, targetElement.scrollWidth, targetElement.clientWidth);
    syncingRef.current = true;
    targetElement.scrollLeft = nextOffset;
    setSyncOffset(nextOffset);
    window.requestAnimationFrame(() => {
      syncingRef.current = false;
    });
  };

  const applySelected = () => {
    if (!target || selected.length === 0) {
      showToast({ kind: 'warning', title: t.title, message: t.selectDiffs });
      return;
    }
    onApply(target.project, selected);
    showToast({ kind: 'success', title: t.title, message: zhCN.projectSnapshots.appliedDiffs });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4" role="dialog" aria-modal="true" data-testid="timeline-compare-dialog">
      <div className="grid max-h-[90vh] w-full max-w-7xl grid-rows-[auto_auto_minmax(0,1fr)_auto] overflow-hidden rounded-md border border-line bg-white shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-ink">{t.title}</h2>
            <p className="mt-0.5 text-xs text-slate-500">{t.subtitle}</p>
          </div>
          <button className="rounded-md p-2 text-slate-500 hover:bg-panel" type="button" aria-label={zhCN.common.close} onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="space-y-3 border-b border-line bg-panel p-4">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_180px]">
            <VersionSelect label={t.versionA} value={baseId} versions={versions.filter((version) => version.id !== targetId)} onChange={setBaseId} testId="timeline-compare-base-select" />
            <VersionSelect label={t.versionB} value={targetId} versions={versions.filter((version) => version.id !== baseId && version.id !== 'current')} onChange={setTargetId} testId="timeline-compare-target-select" />
            <label className="block text-xs font-medium text-slate-600">
              {t.zoom}
              <input
                className="mt-2 w-full accent-brand"
                type="range"
                min={40}
                max={180}
                step={10}
                value={zoom}
                data-testid="timeline-compare-zoom-slider"
                onChange={(event) => setZoom(Number(event.target.value))}
              />
            </label>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-slate-600">
            <span data-testid="timeline-compare-summary">
              {diff ? t.summary(diff.summary.added, diff.summary.deleted, diff.summary.modified, diff.summary.trackChanges) : loading ? t.loading : t.noSnapshots}
            </span>
            <span data-testid="timeline-compare-sync-offset">{t.syncOffset(syncOffset)}</span>
          </div>
        </div>
        <div className="min-h-0 overflow-hidden">
          {items.length === 0 ? (
            <div className="grid h-full place-items-center p-6 text-sm text-slate-500" data-testid="timeline-compare-empty">
              {loading ? t.loading : targetId ? t.noDiffs : t.noSnapshots}
            </div>
          ) : (
            <div className="grid h-full min-h-0 grid-rows-[minmax(0,1fr)_180px]">
              <div className="grid min-h-0 grid-cols-2 divide-x divide-line">
                <ReadonlyTimelinePane
                  scrollRef={leftScrollRef}
                  side="a"
                  label={base?.label ?? t.versionA}
                  timeline={base?.project.timeline}
                  diffItems={items}
                  activeItemId={activeItem?.id}
                  zoom={zoom}
                  onScroll={() => syncScroll('a')}
                />
                <ReadonlyTimelinePane
                  scrollRef={rightScrollRef}
                  side="b"
                  label={target?.label ?? t.versionB}
                  timeline={target?.project.timeline}
                  diffItems={items}
                  activeItemId={activeItem?.id}
                  zoom={zoom}
                  onScroll={() => syncScroll('b')}
                />
              </div>
              <div className="min-h-0 overflow-y-auto border-t border-line bg-white" data-testid="timeline-compare-diff-list" data-active-index={activeIndex}>
                {items.map((item, index) => (
                  <label
                    key={item.id}
                    className={`grid grid-cols-[28px_120px_minmax(160px,1fr)_minmax(220px,2fr)] items-start gap-3 border-b border-line px-4 py-2 text-sm ${index === activeIndex ? 'bg-brand/10' : 'bg-white'}`}
                    data-testid="timeline-compare-diff-row"
                    data-active={index === activeIndex ? 'true' : 'false'}
                  >
                    <input className="mt-1 h-4 w-4 accent-brand" type="checkbox" checked={selected.includes(item.id)} onChange={() => toggle(item.id)} data-testid={`timeline-compare-diff-check-${item.id}`} />
                    <span className="rounded bg-panel px-2 py-1 text-xs font-semibold text-slate-700">{t.diffTypes[item.type]}</span>
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-ink">{item.label}</span>
                      <span className="block truncate text-xs text-slate-500">{item.clipId ?? item.trackId}</span>
                    </span>
                    <span className="space-y-1 text-xs text-slate-600">
                      {item.fields.map((field) => (
                        <span key={field.field} className="block truncate" title={`${field.field}: ${formatValue(field.before)} -> ${formatValue(field.after)}`}>
                          <span className="font-semibold">{field.field}</span>: {formatValue(field.before)}
                          {' -> '}
                          {formatValue(field.after)}
                        </span>
                      ))}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line p-4">
          <div className="flex items-center gap-2">
            <button className="inline-flex items-center gap-1 rounded-md border border-line px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-panel" type="button" data-testid="timeline-compare-prev-diff" onClick={() => jumpDiff('previous')}>
              <ChevronUp size={16} />
              {t.previousDiff}
            </button>
            <button className="inline-flex items-center gap-1 rounded-md border border-line px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-panel" type="button" data-testid="timeline-compare-next-diff" onClick={() => jumpDiff('next')}>
              <ChevronDown size={16} />
              {t.nextDiff}
            </button>
            <span className="text-xs font-semibold text-slate-500" data-testid="timeline-compare-active-diff">
              {t.activeDiff(activeIndex >= 0 ? activeIndex + 1 : 0, items.length)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button className="rounded-md border border-line px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-panel" type="button" onClick={onClose}>
              {zhCN.common.close}
            </button>
            <button className="rounded-md bg-brand px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" type="button" disabled={selected.length === 0} data-testid="timeline-compare-apply-selected" onClick={applySelected}>
              {t.applySelected}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function VersionSelect({
  label,
  value,
  versions,
  testId,
  onChange
}: {
  label: string;
  value: string;
  versions: LoadedVersion[];
  testId: string;
  onChange(value: string): void;
}) {
  return (
    <label className="block text-xs font-medium text-slate-600">
      {label}
      <select className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink" value={value} data-testid={testId} onChange={(event) => onChange(event.target.value)}>
        <option value="">{zhCN.projectSnapshots.noSnapshots}</option>
        {versions.map((version) => (
          <option key={version.id} value={version.id}>
            {version.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ReadonlyTimelinePane({
  scrollRef,
  side,
  label,
  timeline,
  diffItems,
  activeItemId,
  zoom,
  onScroll
}: {
  scrollRef: MutableRefObject<HTMLDivElement | null>;
  side: 'a' | 'b';
  label: string;
  timeline?: Timeline;
  diffItems: TimelineVersionDiffItem[];
  activeItemId?: string;
  zoom: number;
  onScroll(): void;
}) {
  const tracks = useMemo(() => buildReadonlyTracks(timeline, diffItems, side), [diffItems, side, timeline]);
  const duration = useMemo(() => Math.max(1, getTimelineDuration(timeline ?? { tracks: [] }), ...getDeletedPlaceholders(diffItems).map((clip) => clip.start + clip.duration)), [diffItems, timeline]);
  const width = Math.max(MIN_TIMELINE_WIDTH, duration * zoom + 120);
  const typeByClipId = useMemo(() => buildDiffTypeByClipId(diffItems), [diffItems]);
  const movedItems = diffItems.filter((item) => item.type === 'clip-moved');

  return (
    <section className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] bg-slate-50" data-testid={`timeline-compare-pane-${side}`}>
      <div className="flex items-center justify-between border-b border-line bg-white px-3 py-2 text-xs font-semibold text-slate-600">
        <span className="truncate">{label}</span>
        <span>{zhCN.timelineCompare.readonly}</span>
      </div>
      <div
        ref={(node) => {
          scrollRef.current = node;
        }}
        className="timeline-scrollbar min-h-0 overflow-auto"
        onScroll={onScroll}
        data-testid={`timeline-compare-scroll-${side}`}
      >
        <div className="space-y-2 p-3" style={{ width }}>
          {tracks.map((track) => (
            <div key={track.id} className="grid grid-cols-[120px_minmax(0,1fr)] overflow-hidden rounded border border-line bg-white" data-testid={`timeline-compare-track-${side}`}>
              <div className="flex items-center border-r border-line px-2 text-xs font-semibold text-slate-600">{track.name}</div>
              <div className="relative bg-slate-100" style={{ height: TRACK_HEIGHT }}>
                {track.clips.length === 0 ? <div className="flex h-full items-center px-3 text-xs text-slate-400">{zhCN.timelineCompare.emptyTrack}</div> : null}
                {track.clips.map((clip) => (
                  <ReadonlyClipBlock
                    key={`${side}-${clip.id}`}
                    clip={clip}
                    diffType={typeByClipId.get(clip.id)}
                    active={activeItemId?.endsWith(`:${clip.id}`) ?? false}
                    side={side}
                    zoom={zoom}
                  />
                ))}
                {side === 'b'
                  ? getDeletedPlaceholders(diffItems)
                      .filter((clip) => clip.trackId === track.id)
                      .map((clip) => <DeletedClipBlock key={`deleted-${clip.id}`} clip={clip} zoom={zoom} />)
                  : null}
                {movedItems
                  .filter((item) => item.trackId === track.id)
                  .map((item) => <MoveArrow key={`move-${item.id}`} item={item} zoom={zoom} />)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ReadonlyClipBlock({ clip, diffType, active, side, zoom }: { clip: Clip; diffType?: TimelineVersionDiffType; active: boolean; side: 'a' | 'b'; zoom: number }) {
  const className = clipClassName(diffType, active);
  return (
    <div
      className={`absolute top-3 h-8 truncate rounded border px-2 py-1 text-xs font-semibold shadow-sm ${className}`}
      style={{ left: clip.start * zoom, width: Math.max(40, clip.duration * zoom) }}
      title={clip.name}
      data-testid={highlightTestId(diffType)}
      data-clip-id={clip.id}
      data-pane={side}
      data-diff-type={diffType ?? 'none'}
    >
      {clip.name}
    </div>
  );
}

function DeletedClipBlock({ clip, zoom }: { clip: DeletedClipPlaceholder; zoom: number }) {
  return (
    <div
      className="absolute top-3 h-8 truncate rounded border border-rose-500 bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-900 shadow-sm"
      style={{ left: clip.start * zoom, width: Math.max(40, clip.duration * zoom) }}
      title={clip.name}
      data-testid="timeline-compare-highlight-deleted"
      data-clip-id={clip.id}
      data-diff-type="clip-deleted"
    >
      {clip.name}
    </div>
  );
}

function MoveArrow({ item, zoom }: { item: TimelineVersionDiffItem; zoom: number }) {
  const before = Number(item.fields.find((field) => field.field === 'start')?.before);
  const after = Number(item.fields.find((field) => field.field === 'start')?.after);
  if (!Number.isFinite(before) || !Number.isFinite(after) || Math.abs(before - after) < 0.000001) {
    return null;
  }
  const left = Math.min(before, after) * zoom;
  const width = Math.max(12, Math.abs(after - before) * zoom);
  return (
    <div className="absolute top-11 h-0.5 bg-sky-500" style={{ left, width }} data-testid="timeline-compare-move-arrow">
      <span className={`absolute -top-1 h-2 w-2 rotate-45 bg-sky-500 ${after > before ? 'right-0' : 'left-0'}`} />
    </div>
  );
}

interface DeletedClipPlaceholder {
  id: string;
  name: string;
  trackId?: string;
  start: number;
  duration: number;
}

function buildReadonlyTracks(timeline: Timeline | undefined, diffItems: TimelineVersionDiffItem[], side: 'a' | 'b'): Track[] {
  const tracks = timeline?.tracks.map((track) => ({ ...track, clips: [...track.clips] })) ?? [];
  if (side !== 'b') {
    return tracks;
  }
  const trackIds = new Set(tracks.map((track) => track.id));
  for (const placeholder of getDeletedPlaceholders(diffItems)) {
    if (placeholder.trackId && !trackIds.has(placeholder.trackId)) {
      tracks.push({ id: placeholder.trackId, type: 'video', name: placeholder.trackId, clips: [] } as Track);
      trackIds.add(placeholder.trackId);
    }
  }
  return tracks;
}

function buildDiffTypeByClipId(items: TimelineVersionDiffItem[]): Map<string, TimelineVersionDiffType> {
  const map = new Map<string, TimelineVersionDiffType>();
  for (const item of items) {
    if (item.clipId) {
      map.set(item.clipId, item.type);
    }
  }
  return map;
}

function getDeletedPlaceholders(items: TimelineVersionDiffItem[]): DeletedClipPlaceholder[] {
  return items
    .filter((item) => item.type === 'clip-deleted')
    .map((item) => {
      const before = item.fields.find((field) => field.field === 'clip')?.before as Record<string, unknown> | undefined;
      return {
        id: item.clipId ?? item.id,
        name: item.label,
        trackId: item.trackId,
        start: Number(before?.start ?? 0),
        duration: Math.max(0.1, Number(before?.duration ?? 1))
      };
    });
}

function clipClassName(type: TimelineVersionDiffType | undefined, active: boolean): string {
  const activeRing = active ? 'ring-2 ring-brand/60' : '';
  if (type === 'clip-added') {
    return `border-emerald-500 bg-emerald-100 text-emerald-900 ${activeRing}`;
  }
  if (type === 'clip-deleted') {
    return `border-rose-500 bg-rose-100 text-rose-900 ${activeRing}`;
  }
  if (type === 'clip-modified') {
    return `border-amber-500 bg-amber-100 text-amber-900 ${activeRing}`;
  }
  if (type === 'clip-moved') {
    return `border-sky-500 bg-sky-100 text-sky-900 ${activeRing}`;
  }
  return `border-slate-300 bg-white text-slate-700 ${activeRing}`;
}

function highlightTestId(type: TimelineVersionDiffType | undefined): string {
  if (type === 'clip-added') {
    return 'timeline-compare-highlight-added';
  }
  if (type === 'clip-deleted') {
    return 'timeline-compare-highlight-deleted';
  }
  if (type === 'clip-modified') {
    return 'timeline-compare-highlight-modified';
  }
  if (type === 'clip-moved') {
    return 'timeline-compare-highlight-moved';
  }
  return 'timeline-compare-clip';
}

function formatValue(value: unknown): string {
  if (value === null) {
    return 'null';
  }
  if (value === undefined) {
    return '-';
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return JSON.stringify(value);
}
