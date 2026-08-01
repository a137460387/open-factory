import { X } from 'lucide-react';
import type { Track } from '@open-factory/editor-core';
import { computeTimelineGaps, getGapStats } from '@open-factory/editor-core';
import { zhCN } from '../../i18n/strings';

export function GapStatsPanel({
  timeline,
  tracks,
  onClose,
}: {
  timeline: { tracks: Track[] };
  tracks: Track[];
  onClose(): void;
}) {
  const gaps = computeTimelineGaps(timeline);
  const stats = getGapStats(gaps);
  return (
    <div
      className="fixed z-50 w-[260px] rounded-md border border-line bg-[var(--color-bg-elevated)] p-3 text-xs shadow-soft"
      style={{ right: 16, top: 120 }}
      data-testid="gap-stats-panel"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold">{zhCN.timeline.gapPanel.title}</span>
        <button className="rounded p-1 hover:bg-panel" type="button" data-testid="gap-stats-close" onClick={onClose}>
          <X size={14} />
        </button>
      </div>
      {stats.totalCount === 0 ? (
        <div className="py-4 text-center text-[var(--color-text-muted)]">{zhCN.timeline.gapPanel.noGaps}</div>
      ) : (
        <div className="space-y-2">
          <div className="flex justify-between">
            <span>{zhCN.timeline.gapPanel.totalCount}</span>
            <span className="font-medium">{stats.totalCount}</span>
          </div>
          <div className="flex justify-between">
            <span>{zhCN.timeline.gapPanel.totalDuration}</span>
            <span className="font-medium">{zhCN.timeline.gapPanel.seconds(stats.totalDuration)}</span>
          </div>
          <div className="flex justify-between">
            <span>{zhCN.timeline.gapPanel.maxGap}</span>
            <span className="font-medium">
              {stats.maxGap ? zhCN.timeline.gapPanel.seconds(stats.maxGap.duration) : '-'}
            </span>
          </div>
          <div className="flex justify-between">
            <span>{zhCN.timeline.gapPanel.minGap}</span>
            <span className="font-medium">
              {stats.minGap ? zhCN.timeline.gapPanel.seconds(stats.minGap.duration) : '-'}
            </span>
          </div>
          {Object.keys(stats.byTrack).length > 1 && (
            <div className="mt-2 border-t border-line pt-2">
              <div className="mb-1 font-semibold">{zhCN.timeline.gapPanel.track}</div>
              {Object.entries(stats.byTrack).map(([trackId, entry]) => {
                const track = tracks.find((t) => t.id === trackId);
                return (
                  <div key={trackId} className="flex justify-between py-0.5">
                    <span className="text-[var(--color-text-secondary)]">{track?.name ?? trackId}</span>
                    <span>
                      {entry.count}
                      {zhCN.timeline.gapPanel.count} / {zhCN.timeline.gapPanel.seconds(entry.totalDuration)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
