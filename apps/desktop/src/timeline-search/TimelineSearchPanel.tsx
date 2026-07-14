import { Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  createTimelineSearchJump,
  searchTimeline,
  secondsToTimecode,
  type Project,
  type TimelineSearchEffectFilter,
  type TimelineSearchKeyframeFilter,
  type TimelineSearchMediaFilter,
  type TimelineSearchResult,
} from '@open-factory/editor-core';
import { zhCN } from '../i18n/strings';
import { useEditorStore } from '../store/editorStore';

interface TimelineSearchPanelProps {
  project: Project;
  onClose(): void;
}

export function TimelineSearchPanel({ project, onClose }: TimelineSearchPanelProps) {
  const t = zhCN.timelineSearch;
  const inputRef = useRef<HTMLInputElement | null>(null);
  const setIsPlaying = useEditorStore((state) => state.setIsPlaying);
  const setPlayheadTime = useEditorStore((state) => state.setPlayheadTime);
  const setSelectedClipIds = useEditorStore((state) => state.setSelectedClipIds);
  const [query, setQuery] = useState('');
  const [useRegex, setUseRegex] = useState(false);
  const [mediaFilter, setMediaFilter] = useState<TimelineSearchMediaFilter>('all');
  const [effectFilter, setEffectFilter] = useState<TimelineSearchEffectFilter>('all');
  const [keyframeFilter, setKeyframeFilter] = useState<TimelineSearchKeyframeFilter>('all');
  const [activeIndex, setActiveIndex] = useState(0);
  const response = useMemo(
    () => searchTimeline(project, { query, useRegex, mediaFilter, effectFilter, keyframeFilter }),
    [effectFilter, keyframeFilter, mediaFilter, project, query, useRegex],
  );
  const results = response.results;
  const mediaById = useMemo(() => new Map(project.media.map((asset) => [asset.id, asset])), [project.media]);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  useEffect(() => {
    setActiveIndex(0);
  }, [effectFilter, keyframeFilter, mediaFilter, query, useRegex]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        jumpNext();
      }
    }
    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
  });

  function jumpToResult(result: TimelineSearchResult, index: number): void {
    const jump = createTimelineSearchJump(result);
    setIsPlaying(false);
    setPlayheadTime(jump.playheadTime);
    setSelectedClipIds(jump.selectedClipIds);
    setActiveIndex(index);
  }

  function jumpNext(): void {
    if (results.length === 0) {
      return;
    }
    const nextIndex = results.length === 0 ? 0 : activeIndex % results.length;
    jumpToResult(results[nextIndex], nextIndex);
    setActiveIndex((nextIndex + 1) % results.length);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/55 px-4 pt-20"
      data-testid="timeline-search-panel"
    >
      <section className="w-full max-w-3xl overflow-hidden rounded-lg border border-line bg-white shadow-2xl">
        <header className="flex items-center gap-3 border-b border-line px-4 py-3">
          <Search size={18} className="shrink-0 text-slate-500" />
          <input
            ref={inputRef}
            className="min-w-0 flex-1 border-none bg-transparent text-sm font-medium text-ink outline-none placeholder:text-slate-400"
            value={query}
            placeholder={t.placeholder}
            data-testid="timeline-search-input"
            onChange={(event) => setQuery(event.target.value)}
          />
          <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-600">
            <input
              type="checkbox"
              className="h-4 w-4 accent-brand"
              checked={useRegex}
              data-testid="timeline-search-regex-toggle"
              onChange={(event) => setUseRegex(event.target.checked)}
            />
            {t.regex}
          </label>
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-line text-slate-500 hover:bg-panel"
            title={zhCN.common.close}
            aria-label={zhCN.common.close}
            data-testid="timeline-search-close-button"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </header>
        <div className="grid gap-2 border-b border-line bg-panel px-4 py-3 sm:grid-cols-3">
          <label className="text-xs font-medium text-slate-600">
            {t.mediaFilter}
            <select
              className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-xs text-ink"
              value={mediaFilter}
              data-testid="timeline-search-media-filter"
              onChange={(event) => setMediaFilter(event.target.value as TimelineSearchMediaFilter)}
            >
              <option value="all">{t.mediaFilters.all}</option>
              <option value="video">{t.mediaFilters.video}</option>
              <option value="audio">{t.mediaFilters.audio}</option>
              <option value="image">{t.mediaFilters.image}</option>
              <option value="subtitle">{t.mediaFilters.subtitle}</option>
            </select>
          </label>
          <label className="text-xs font-medium text-slate-600">
            {t.effectFilter}
            <select
              className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-xs text-ink"
              value={effectFilter}
              data-testid="timeline-search-effect-filter"
              onChange={(event) => setEffectFilter(event.target.value as TimelineSearchEffectFilter)}
            >
              <option value="all">{t.effectFilters.all}</option>
              <option value="has-effects">{t.effectFilters.hasEffects}</option>
              <option value="no-effects">{t.effectFilters.noEffects}</option>
            </select>
          </label>
          <label className="text-xs font-medium text-slate-600">
            {t.keyframeFilter}
            <select
              className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-xs text-ink"
              value={keyframeFilter}
              data-testid="timeline-search-keyframe-filter"
              onChange={(event) => setKeyframeFilter(event.target.value as TimelineSearchKeyframeFilter)}
            >
              <option value="all">{t.keyframeFilters.all}</option>
              <option value="has-keyframes">{t.keyframeFilters.hasKeyframes}</option>
              <option value="no-keyframes">{t.keyframeFilters.noKeyframes}</option>
            </select>
          </label>
        </div>
        <div className="max-h-[52vh] overflow-y-auto" data-testid="timeline-search-results">
          {response.error ? (
            <div
              className="px-4 py-8 text-center text-sm font-medium text-rose-600"
              data-testid="timeline-search-error"
            >
              {t.invalidRegex}
            </div>
          ) : null}
          {!response.error && results.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-500" data-testid="timeline-search-empty">
              {t.empty}
            </div>
          ) : null}
          {!response.error
            ? results.map((result, index) => {
                const media = result.mediaId ? mediaById.get(result.mediaId) : undefined;
                return (
                  <button
                    key={`${result.kind}-${result.id}`}
                    type="button"
                    className={`grid w-full grid-cols-[52px_minmax(0,1fr)_120px] items-center gap-3 border-b border-line px-4 py-3 text-left hover:bg-panel ${index === activeIndex ? 'bg-emerald-50' : 'bg-white'}`}
                    data-testid={`timeline-search-result-${result.kind}-${result.id}`}
                    data-result-kind={result.kind}
                    onClick={() => jumpToResult(result, index)}
                  >
                    <span className="flex h-9 w-[52px] items-center justify-center overflow-hidden rounded border border-line bg-slate-100 text-xs font-semibold text-slate-500">
                      {media?.thumbnail ? (
                        <img className="h-full w-full object-cover" src={media.thumbnail} alt="" loading="lazy" />
                      ) : result.kind === 'marker' ? (
                        t.markerThumb
                      ) : (
                        t.clipThumb
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-ink">{result.label}</span>
                      <span className="mt-0.5 block truncate text-xs text-slate-500">
                        {result.mediaName ?? result.trackName} ·{' '}
                        {result.matchReasons.map(formatTimelineSearchReason).join(', ')}
                      </span>
                    </span>
                    <span className="text-right text-xs text-slate-500">
                      <span className="block truncate">{result.trackName}</span>
                      <span className="tabular-nums">
                        {secondsToTimecode(
                          result.start,
                          project.settings.fps || 30,
                          project.settings.timecodeFormat ?? 'ndf',
                        )}
                      </span>
                    </span>
                  </button>
                );
              })
            : null}
        </div>
      </section>
    </div>
  );
}

function formatTimelineSearchReason(reason: string): string {
  const reasons = zhCN.timelineSearch.reasons as Record<string, string>;
  return reasons[reason] ?? reason;
}
