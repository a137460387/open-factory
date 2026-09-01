import { GitCompareArrows } from 'lucide-react';
import { zhCN } from '../../i18n/strings';
import type { TimelineHeatmapViewSettings } from '../../settings/appSettings';
import { MenuDropdown, MenuItem, MenuSeparator } from './MenuDropdown';

export function ViewMenu({
  open,
  onToggle,
  safeFrameGuides,
  thumbnailTrackVisible,
  timelineMinimapVisible,
  timelineHeatmap,
  reviewMode: _reviewMode,
  onToggleSafeFrameGuides,
  onToggleThumbnailTrack,
  onToggleTimelineMinimap,
  onOpenTimelineCompare,
  onOpenSequenceCompare,
  onTimelineHeatmapChange,
  onToggleReviewMode,
  onCreateReviewReport: _onCreateReviewReport,
}: {
  open: boolean;
  onToggle(): void;
  safeFrameGuides: boolean;
  thumbnailTrackVisible: boolean;
  timelineMinimapVisible: boolean;
  timelineHeatmap: TimelineHeatmapViewSettings;
  reviewMode: boolean;
  onToggleSafeFrameGuides(): void;
  onToggleThumbnailTrack(): void;
  onToggleTimelineMinimap(): void;
  onOpenTimelineCompare(): void;
  onOpenSequenceCompare(): void;
  onTimelineHeatmapChange(patch: Partial<TimelineHeatmapViewSettings>): void;
  onToggleReviewMode(): void;
  onCreateReviewReport(): void;
}) {
  const t = zhCN.toolbar;
  const close = () => onToggle();
  return (
    <MenuDropdown label={t.viewMenu} open={open} onToggle={onToggle} testId="toolbar-view-menu-button">
      <ViewToggleItem
        label={t.safeFrameGuides}
        active={safeFrameGuides}
        testId="toolbar-view-safe-frame-guides-menu-item"
        onClick={onToggleSafeFrameGuides}
      />
      <ViewToggleItem
        label={t.thumbnailTrack}
        active={thumbnailTrackVisible}
        testId="toolbar-view-thumbnail-track-menu-item"
        onClick={onToggleThumbnailTrack}
      />
      <ViewToggleItem
        label={t.timelineMinimap}
        active={timelineMinimapVisible}
        testId="toolbar-view-minimap-menu-item"
        onClick={onToggleTimelineMinimap}
      />
      <MenuSeparator />
      <MenuItem
        label={t.timelineCompare}
        testId="toolbar-view-timeline-compare-menu-item"
        icon={<GitCompareArrows size={14} />}
        onClick={() => {
          close();
          onOpenTimelineCompare();
        }}
      />
      <MenuItem
        label={zhCN.sequenceCompare.title}
        testId="toolbar-view-sequence-compare"
        onClick={() => {
          close();
          onOpenSequenceCompare();
        }}
      />
      <ViewToggleItem
        label={t.timelineHeatmap}
        active={timelineHeatmap.enabled}
        testId="toolbar-view-heatmap-menu-item"
        onClick={() => onTimelineHeatmapChange({ enabled: !timelineHeatmap.enabled })}
      />
      {timelineHeatmap.enabled ? (
        <HeatmapControls heatmap={timelineHeatmap} onChange={onTimelineHeatmapChange} />
      ) : null}
      <MenuItem
        label={t.reviewMode}
        testId="toolbar-view-review-mode-menu-item"
        icon={<span className="text-xs text-slate-500">#review</span>}
        onClick={() => {
          close();
          onToggleReviewMode();
        }}
      />
    </MenuDropdown>
  );
}

function ViewToggleItem({
  label,
  active,
  testId,
  onClick,
}: {
  label: string;
  active: boolean;
  testId: string;
  onClick(): void;
}) {
  const t = zhCN.toolbar;
  return (
    <button
      className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-slate-700 hover:bg-panel"
      type="button"
      data-testid={testId}
      aria-pressed={active}
      onClick={onClick}
    >
      <span>{label}</span>
      <span className="text-xs text-slate-500">{active ? t.safeFrameGuidesVisible : t.safeFrameGuidesHidden}</span>
    </button>
  );
}

function HeatmapControls({
  heatmap,
  onChange,
}: {
  heatmap: TimelineHeatmapViewSettings;
  onChange(patch: Partial<TimelineHeatmapViewSettings>): void;
}) {
  const t = zhCN.toolbar;
  return (
    <div className="space-y-2 px-3 pb-2 text-xs text-slate-600" data-testid="toolbar-view-heatmap-controls">
      <label className="block">
        <span className="sr-only">{t.timelineHeatmap}</span>
        <select
          className="mt-1 w-full rounded border border-line bg-white px-2 py-1 text-xs"
          value={heatmap.type}
          data-testid="toolbar-view-heatmap-type-select"
          onChange={(event) => onChange({ type: event.target.value as TimelineHeatmapViewSettings['type'] })}
        >
          {(['edit-density', 'volume', 'cut-frequency'] as const).map((type) => (
            <option key={type} value={type}>
              {t.heatmapTypes[type]}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="flex items-center justify-between">
          <span>{t.heatmapOpacity}</span>
          <span className="tabular-nums">{Math.round(heatmap.opacity * 100)}%</span>
        </span>
        <input
          className="mt-1 w-full accent-brand"
          type="range"
          min={0}
          max={80}
          step={5}
          value={Math.round(heatmap.opacity * 100)}
          data-testid="toolbar-view-heatmap-opacity-input"
          onChange={(event) => onChange({ opacity: Number(event.target.value) / 100 })}
        />
      </label>
      <label className="block">
        <span>{t.heatmapColorScheme}</span>
        <select
          className="mt-1 w-full rounded border border-line bg-white px-2 py-1 text-xs"
          value={heatmap.colorScheme}
          data-testid="toolbar-view-heatmap-color-select"
          onChange={(event) =>
            onChange({ colorScheme: event.target.value as TimelineHeatmapViewSettings['colorScheme'] })
          }
        >
          {(['warm', 'cool', 'mono'] as const).map((scheme) => (
            <option key={scheme} value={scheme}>
              {t.heatmapColorSchemes[scheme]}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
