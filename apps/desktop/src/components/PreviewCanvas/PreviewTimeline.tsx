import {
  secondsToTimecode,
  parseFrameJumpQuery,
  getTimelinePlaybackDuration,
  type FrameJumpParseError,
  type FrameSearchHistoryEntry,
  type Project,
} from '@open-factory/editor-core';
import { zhCN } from '../../i18n/strings';
import { appendFrameSearchHistory } from '../../lib/frameSearchHistory';
import type { FrameSearchCandidate } from './types';

export interface PreviewTimelineProps {
  playheadTime: number;
  fps: number;
  project: Project;
  frameSearchQuery: string;
  frameSearchError: string | undefined;
  frameSearchFocused: boolean;
  frameSearchHistory: FrameSearchHistoryEntry[];
  frameSearchCandidates: FrameSearchCandidate[];
  showFrameSearchCandidates: boolean;
  showFrameSearchHistory: boolean;
  onFrameSearchQueryChange: (query: string) => void;
  onFrameSearchErrorChange: (error: string | undefined) => void;
  onFrameSearchFocusedChange: (focused: boolean) => void;
  onFrameSearchHistoryChange: (history: FrameSearchHistoryEntry[]) => void;
  onJumpToFrame: (time: number) => void;
  onSelectClip: (ids: string[]) => void;
  onStopPlayback: () => void;
  frameSearchInputRef: React.RefObject<HTMLInputElement | null>;
}

export function PreviewTimeline(props: PreviewTimelineProps) {
  const {
    playheadTime,
    fps,
    project,
    frameSearchQuery,
    frameSearchError,
    frameSearchFocused,
    frameSearchHistory,
    frameSearchCandidates,
    showFrameSearchCandidates,
    showFrameSearchHistory,
    onFrameSearchQueryChange,
    onFrameSearchErrorChange,
    onFrameSearchFocusedChange,
    onFrameSearchHistoryChange,
    onJumpToFrame,
    onSelectClip,
    onStopPlayback,
    frameSearchInputRef,
  } = props;
  const t = zhCN.preview;

  function recordFrameSearchHistory(entry: FrameSearchHistoryEntry): void {
    onFrameSearchHistoryChange(appendFrameSearchHistory({ ...entry, createdAt: new Date().toISOString() }));
  }

  function jumpToFrameSearchCandidate(candidate: FrameSearchCandidate): void {
    onStopPlayback();
    onJumpToFrame(candidate.time);
    if (candidate.type === 'clip') onSelectClip([candidate.id]);
    recordFrameSearchHistory({
      type: candidate.type,
      query: candidate.label,
      label: candidate.label,
      time: candidate.time,
      ...(candidate.type === 'clip' ? { selectedClipIds: [candidate.id] } : {}),
    });
    onFrameSearchErrorChange(undefined);
    onFrameSearchQueryChange(candidate.label);
    onFrameSearchFocusedChange(false);
    frameSearchInputRef.current?.blur();
  }

  function jumpToFrameSearchHistoryEntry(entry: FrameSearchHistoryEntry): void {
    onStopPlayback();
    onJumpToFrame(entry.time);
    if (entry.selectedClipIds) onSelectClip(entry.selectedClipIds);
    recordFrameSearchHistory(entry);
    onFrameSearchErrorChange(undefined);
    onFrameSearchQueryChange(entry.query);
    onFrameSearchFocusedChange(false);
    frameSearchInputRef.current?.blur();
  }

  function executeFrameSearch(): void {
    const query = frameSearchQuery.trim();
    if (!query) {
      onFrameSearchErrorChange(undefined);
      return;
    }
    if (isFrameJumpLikeQuery(query)) {
      const parsed = parseFrameJumpQuery(query, {
        fps,
        duration: getTimelinePlaybackDuration(project.timeline),
        timecodeFormat: project.settings.timecodeFormat ?? 'ndf',
      });
      if (!parsed.ok) {
        onFrameSearchErrorChange(frameSearchErrorMessage(parsed.error, fps));
        return;
      }
      onStopPlayback();
      onJumpToFrame(parsed.value.seconds);
      recordFrameSearchHistory({
        type: parsed.value.kind,
        query,
        label:
          parsed.value.kind === 'frame'
            ? t.frameSearchFrameLabel(parsed.value.frameNumber ?? parsed.value.totalFrames)
            : parsed.value.timecode,
        time: parsed.value.seconds,
      });
      onFrameSearchErrorChange(undefined);
      frameSearchInputRef.current?.blur();
      return;
    }
    const [candidate] = frameSearchCandidates;
    if (candidate) {
      jumpToFrameSearchCandidate(candidate);
      return;
    }
    onFrameSearchErrorChange(t.frameSearchNoMatch);
  }

  return (
    <div className="flex items-center gap-3 border-t border-black/30 px-3 py-2 text-xs text-slate-300">
      <div className="min-w-24 tabular-nums" data-testid="preview-timecode">
        {secondsToTimecode(playheadTime, fps, project.settings.timecodeFormat ?? 'ndf')}
      </div>
      <div className="relative min-w-0 flex-1">
        <input
          ref={frameSearchInputRef}
          type="search"
          value={frameSearchQuery}
          placeholder={t.frameSearchPlaceholder}
          className={`h-7 w-full rounded border bg-black/35 px-2 font-mono text-xs text-white outline-none placeholder:text-slate-500 ${frameSearchError ? 'border-red-400 focus:border-red-300' : 'border-white/15 focus:border-brand'}`}
          data-testid="frame-search-input"
          aria-invalid={frameSearchError ? 'true' : 'false'}
          onFocus={() => onFrameSearchFocusedChange(true)}
          onBlur={() => onFrameSearchFocusedChange(false)}
          onChange={(e) => {
            onFrameSearchQueryChange(e.target.value);
            onFrameSearchErrorChange(undefined);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              executeFrameSearch();
            }
            if (e.key === 'Escape') {
              onFrameSearchErrorChange(undefined);
              onFrameSearchFocusedChange(false);
              e.currentTarget.blur();
            }
          }}
        />
        {frameSearchError ? (
          <div
            className="absolute left-0 top-8 z-50 rounded border border-red-400/50 bg-red-950 px-2 py-1 text-[11px] text-red-100 shadow-soft"
            data-testid="frame-search-error"
          >
            {frameSearchError}
          </div>
        ) : null}
        {showFrameSearchCandidates && frameSearchCandidates.length > 0 ? (
          <div
            className="absolute bottom-8 left-0 z-50 max-h-44 w-full overflow-auto rounded-md border border-white/15 bg-[#0b1120] py-1 shadow-soft"
            data-testid="frame-search-candidates"
          >
            {frameSearchCandidates.map((c) => (
              <button
                key={`${c.type}-${c.id}`}
                type="button"
                className="flex w-full items-center justify-between gap-3 px-2 py-1.5 text-left text-xs text-slate-100 hover:bg-white/10"
                data-testid={`frame-search-candidate-${c.type}-${c.id}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => jumpToFrameSearchCandidate(c)}
              >
                <span className="min-w-0 truncate">
                  <span className="mr-2 rounded bg-white/10 px-1.5 py-0.5 text-[10px] uppercase text-slate-300">
                    {c.type === 'marker' ? t.frameSearchMarkerType : t.frameSearchClipType}
                  </span>
                  {c.label}
                </span>
                <span className="shrink-0 font-mono tabular-nums text-slate-400">
                  {secondsToTimecode(c.time, fps, project.settings.timecodeFormat ?? 'ndf')}
                </span>
              </button>
            ))}
          </div>
        ) : null}
        {showFrameSearchHistory ? (
          <div
            className="absolute bottom-8 left-0 z-50 max-h-44 w-full overflow-auto rounded-md border border-white/15 bg-[#0b1120] py-1 shadow-soft"
            data-testid="frame-search-history"
          >
            {frameSearchHistory.map((entry, index) => (
              <button
                key={`${entry.type}-${entry.query}-${entry.time}`}
                type="button"
                className="flex w-full items-center justify-between gap-3 px-2 py-1.5 text-left text-xs text-slate-100 hover:bg-white/10"
                data-testid={`frame-search-history-${entry.type}-${index}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => jumpToFrameSearchHistoryEntry(entry)}
              >
                <span className="min-w-0 truncate">
                  <span className="mr-2 rounded bg-white/10 px-1.5 py-0.5 text-[10px] uppercase text-slate-300">
                    {frameSearchHistoryTypeLabel(entry.type)}
                  </span>
                  {entry.label}
                </span>
                <span className="shrink-0 font-mono tabular-nums text-slate-400">
                  {secondsToTimecode(entry.time, fps, project.settings.timecodeFormat ?? 'ndf')}
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function isFrameJumpLikeQuery(query: string): boolean {
  const trimmed = query.trim();
  return (trimmed.includes(':') && /^[\d:]+$/.test(trimmed)) || /^f/i.test(trimmed);
}

function frameSearchErrorMessage(error: FrameJumpParseError, fps: number): string {
  const t = zhCN.preview;
  if (error === 'minutes') return t.frameSearchMinuteError;
  if (error === 'seconds') return t.frameSearchSecondError;
  if (error === 'frames') return t.frameSearchFrameError(Math.round(fps) - 1);
  if (error === 'duration') return t.frameSearchDurationError;
  if (error === 'frame-number') return t.frameSearchFrameNumberFormatError;
  return t.frameSearchFormatError;
}

function frameSearchHistoryTypeLabel(type: FrameSearchHistoryEntry['type']): string {
  const t = zhCN.preview;
  if (type === 'timecode') return t.frameSearchTimecodeType;
  if (type === 'frame') return t.frameSearchFrameType;
  if (type === 'marker') return t.frameSearchMarkerType;
  return t.frameSearchClipType;
}
