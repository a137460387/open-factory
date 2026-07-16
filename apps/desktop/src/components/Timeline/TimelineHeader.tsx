import React from 'react';
import {
  ArrowLeftRight,
  AudioWaveform,
  Bookmark,
  Captions,
  CircleDot,
  Eraser,
  Flag,
  Group,
  Magnet,
  MessageSquarePlus,
  MessageSquareText,
  Mic2,
  Music2,
  MoveHorizontal,
  Plus,
  Scissors,
  Settings2,
  Trash2,
  Type,
  Ungroup,
  Wand2,
} from 'lucide-react';
import { zhCN } from '../../i18n/strings';
import { TIMELINE_LABEL_COLORS, getTimelineLabelColorHex, type TimelineLabelColor } from '@open-factory/editor-core';

export interface TimelineHeaderProps {
  // Sequence navigation
  isMainSequence: boolean;
  activeSequence: { name?: string } | undefined;
  onSetActiveSequenceId: (id: string) => void;
  onOpenSequenceSettings: () => void;

  // Track creation
  onAddVideoTrack: () => void;
  onAddAudioTrack: () => void;
  onAddSubtitleTrack: () => void;

  // Clip creation
  onAddTextClip: () => void;
  onAddCreditsClip: () => void;

  // Markers, bookmarks, beats
  onAddMarker: () => void;
  onAddBookmark: () => void;
  onAddBeatMarker: () => void;

  // Beat snap
  beatSnapEnabled: boolean;
  onToggleBeatSnap: () => void;
  beatSnapSuggestionCount: number;
  onToggleBeatSnapPanel: () => void;

  // Dialogue detection
  dialoguePanelOpen: boolean;
  onToggleDialoguePanel: () => void;

  // Bookmark panel
  bookmarkPanelOpen: boolean;
  onToggleBookmarkPanel: () => void;

  // Annotation
  annotationMode: boolean;
  onToggleAnnotationMode: () => void;
  annotationPanelOpen: boolean;
  onToggleAnnotationPanel: () => void;

  // Timeline notes
  onQuickAddTimelineNote: () => void;
  timelineNotePanelOpen: boolean;
  onToggleTimelineNotePanel: () => void;

  // Envelope edit mode
  envelopeEditMode: boolean;
  onToggleEnvelopeEditMode: () => void;

  // Gap stats
  gapStatsOpen: boolean;
  onToggleGapStats: () => void;

  // Clip operations
  onSplitSelected: () => void;
  selectedClipIds: string[];
  onCreateGroupFromSelection: () => void;
  selectedGroup: unknown;
  onUngroupSelected: () => void;
  onDeleteSelected: () => void;
  onRippleDeleteSelected: () => void;

  // Editing mode indicators
  slipEditActive: boolean;
  slideEditActive: boolean;
  rollingTrimActive: boolean;

  // Zoom
  zoom: number;
  onSetZoom: (zoom: number) => void;

  // Color filter
  timelineColorFilter: TimelineLabelColor | null;
  onSetTimelineColorFilter: (filter: TimelineLabelColor | null) => void;
}

export const TimelineHeader = React.memo<TimelineHeaderProps>(function TimelineHeader({
  isMainSequence,
  activeSequence,
  onSetActiveSequenceId,
  onOpenSequenceSettings,
  onAddVideoTrack,
  onAddAudioTrack,
  onAddSubtitleTrack,
  onAddTextClip,
  onAddCreditsClip,
  onAddMarker,
  onAddBookmark,
  onAddBeatMarker,
  beatSnapEnabled,
  onToggleBeatSnap,
  beatSnapSuggestionCount,
  onToggleBeatSnapPanel,
  dialoguePanelOpen,
  onToggleDialoguePanel,
  bookmarkPanelOpen,
  onToggleBookmarkPanel,
  annotationMode,
  onToggleAnnotationMode,
  annotationPanelOpen,
  onToggleAnnotationPanel,
  onQuickAddTimelineNote,
  timelineNotePanelOpen,
  onToggleTimelineNotePanel,
  envelopeEditMode,
  onToggleEnvelopeEditMode,
  gapStatsOpen,
  onToggleGapStats,
  onSplitSelected,
  selectedClipIds,
  onCreateGroupFromSelection,
  selectedGroup,
  onUngroupSelected,
  onDeleteSelected,
  onRippleDeleteSelected,
  slipEditActive,
  slideEditActive,
  rollingTrimActive,
  zoom,
  onSetZoom,
  timelineColorFilter,
  onSetTimelineColorFilter,
}) {
  return (
    <div className="flex shrink-0 items-center gap-2 overflow-x-auto border-b border-line px-3 py-2">
      <div className="mr-auto min-w-[170px] shrink-0">
        <div className="text-sm font-semibold">{zhCN.timeline.title}</div>
        <div className="whitespace-nowrap text-xs text-[var(--color-text-muted)]">{zhCN.timeline.subtitle}</div>
        <div
          className="mt-1 flex items-center gap-1 text-[11px] text-[var(--color-text-muted)]"
          data-testid="sequence-breadcrumb"
        >
          {isMainSequence ? (
            <span>{zhCN.timeline.mainSequence}</span>
          ) : (
            <>
              <button
                className="text-brand hover:underline"
                type="button"
                data-testid="sequence-back-main"
                onClick={() => onSetActiveSequenceId('sequence-main')}
              >
                {zhCN.timeline.backToMainSequence}
              </button>
              <span>/</span>
              <span className="font-medium text-[var(--color-text-secondary)]">
                {activeSequence?.name ?? zhCN.timeline.mainSequence}
              </span>
            </>
          )}
          <button
            className="ml-2 rounded p-0.5 hover:bg-panel"
            type="button"
            title={zhCN.timeline.sequenceSettingsButton}
            data-testid="sequence-settings-button"
            onClick={onOpenSequenceSettings}
          >
            <Settings2 size={12} />
          </button>
        </div>
      </div>
      <button
        className="rounded-md border border-line p-2 hover:bg-panel"
        title={zhCN.timeline.addVideoTrack}
        data-testid="add-video-track-button"
        onClick={onAddVideoTrack}
      >
        <Plus size={16} />
      </button>
      <button
        className="rounded-md border border-line p-2 hover:bg-panel"
        title={zhCN.timeline.addAudioTrack}
        data-testid="add-audio-track-button"
        onClick={onAddAudioTrack}
      >
        <Plus size={16} />
      </button>
      <button
        className="rounded-md border border-line p-2 hover:bg-panel"
        title={zhCN.timeline.addSubtitleTrack}
        data-testid="add-subtitle-track-button"
        onClick={onAddSubtitleTrack}
      >
        <Captions size={16} />
      </button>
      <button
        className="rounded-md border border-line p-2 hover:bg-panel"
        title={zhCN.timeline.addTextClip}
        data-testid="add-text-clip-button"
        onClick={onAddTextClip}
      >
        <Type size={16} />
      </button>
      <button
        className="rounded-md border border-line p-2 hover:bg-panel"
        title={zhCN.timeline.addCreditsClip}
        data-testid="add-credits-clip-button"
        onClick={onAddCreditsClip}
      >
        <Captions size={16} />
      </button>
      <button
        className="rounded-md border border-line p-2 hover:bg-panel"
        title={zhCN.timeline.addMarker}
        data-testid="add-timeline-marker-button"
        onClick={onAddMarker}
      >
        <Flag size={16} />
      </button>
      <button
        className="rounded-md border border-line p-2 hover:bg-panel"
        title={zhCN.timeline.addBookmark}
        data-testid="add-timeline-bookmark-button"
        onClick={onAddBookmark}
      >
        <Bookmark size={16} />
      </button>
      <button
        className="rounded-md border border-line p-2 hover:bg-panel"
        title={zhCN.timeline.addBeatMarker}
        data-testid="add-beat-marker-button"
        onClick={onAddBeatMarker}
      >
        <Music2 size={16} />
      </button>
      <button
        className={`rounded-md border p-2 hover:bg-panel ${beatSnapEnabled ? 'border-brand text-brand' : 'border-line'}`}
        title={beatSnapEnabled ? zhCN.timeline.beatSnapEnabled : zhCN.timeline.beatSnapDisabled}
        aria-pressed={beatSnapEnabled}
        data-testid="timeline-beat-snap-toggle"
        onClick={onToggleBeatSnap}
      >
        <Magnet size={16} />
      </button>
      {beatSnapSuggestionCount > 0 && (
        <button
          className="rounded-md border border-brand p-2 text-brand hover:bg-panel"
          title={zhCN.editorToasts.beatSnapAISmartSnap}
          data-testid="beat-snap-ai-button"
          onClick={onToggleBeatSnapPanel}
        >
          <Wand2 size={16} />
        </button>
      )}
      <button
        className={`rounded-md border p-2 hover:bg-panel ${dialoguePanelOpen ? 'border-brand text-brand' : 'border-line'}`}
        title={zhCN.timeline.dialogueDetectionAction}
        aria-pressed={dialoguePanelOpen}
        data-testid="dialogue-detection-toggle"
        onClick={onToggleDialoguePanel}
      >
        <Mic2 size={16} />
      </button>
      <button
        className={`rounded-md border p-2 hover:bg-panel ${bookmarkPanelOpen ? 'border-brand text-brand' : 'border-line'}`}
        title={zhCN.timeline.bookmarkList}
        aria-pressed={bookmarkPanelOpen}
        data-testid="toggle-bookmark-panel-button"
        onClick={onToggleBookmarkPanel}
      >
        <Bookmark size={16} />
      </button>
      <button
        className={`rounded-md border p-2 hover:bg-panel ${annotationMode ? 'border-brand bg-brand text-white' : 'border-line'}`}
        title={zhCN.timeline.annotationMode}
        aria-pressed={annotationMode}
        data-testid="toggle-annotation-mode-button"
        onClick={onToggleAnnotationMode}
      >
        <MessageSquarePlus size={16} />
      </button>
      <button
        className={`rounded-md border p-2 hover:bg-panel ${annotationPanelOpen ? 'border-brand text-brand' : 'border-line'}`}
        title={zhCN.timeline.annotationList}
        aria-pressed={annotationPanelOpen}
        data-testid="toggle-annotation-panel-button"
        onClick={onToggleAnnotationPanel}
      >
        <MessageSquareText size={16} />
      </button>
      <button
        className="rounded-md border border-line p-2 hover:bg-panel"
        title={zhCN.timeline.timelineNoteQuickAdd}
        data-testid="add-timeline-note-button"
        onClick={onQuickAddTimelineNote}
      >
        <MessageSquarePlus size={16} />
      </button>
      <button
        className={`rounded-md border p-2 hover:bg-panel ${timelineNotePanelOpen ? 'border-brand text-brand' : 'border-line'}`}
        title={zhCN.timeline.timelineNoteList}
        aria-pressed={timelineNotePanelOpen}
        data-testid="toggle-timeline-note-panel-button"
        onClick={onToggleTimelineNotePanel}
      >
        <MessageSquareText size={16} />
      </button>
      <button
        className={`rounded-md border p-2 hover:bg-panel ${envelopeEditMode ? 'border-brand bg-brand text-white' : 'border-line'}`}
        title={envelopeEditMode ? zhCN.timeline.envelopeEditModeActive : zhCN.timeline.envelopeEditMode}
        aria-pressed={envelopeEditMode}
        data-testid="toggle-envelope-edit-mode-button"
        onClick={onToggleEnvelopeEditMode}
      >
        <AudioWaveform size={16} />
      </button>
      <button
        className={`rounded-md border p-2 hover:bg-panel ${gapStatsOpen ? 'border-brand text-brand' : 'border-line'}`}
        title={zhCN.timeline.gapPanel.title}
        aria-pressed={gapStatsOpen}
        data-testid="gap-stats-toggle"
        onClick={onToggleGapStats}
      >
        <CircleDot size={16} />
      </button>
      <button
        className="rounded-md border border-line p-2 hover:bg-panel"
        title={zhCN.timeline.splitSelectedClip}
        onClick={onSplitSelected}
      >
        <Scissors size={16} />
      </button>
      <button
        className="rounded-md border border-line p-2 hover:bg-panel disabled:cursor-not-allowed disabled:opacity-40"
        title={zhCN.timeline.clipGroupCreate}
        disabled={selectedClipIds.length < 2}
        data-testid="timeline-create-group-button"
        onClick={onCreateGroupFromSelection}
      >
        <Group size={16} />
      </button>
      <button
        className="rounded-md border border-line p-2 hover:bg-panel disabled:cursor-not-allowed disabled:opacity-40"
        title={zhCN.timeline.clipGroupUngroup}
        disabled={!selectedGroup}
        data-testid="timeline-ungroup-button"
        onClick={onUngroupSelected}
      >
        <Ungroup size={16} />
      </button>
      <button
        className="rounded-md border border-line p-2 hover:bg-panel"
        title={zhCN.timeline.deleteSelectedClip}
        onClick={onDeleteSelected}
      >
        <Trash2 size={16} />
      </button>
      <button
        className="rounded-md border border-line p-2 hover:bg-panel"
        title={`${zhCN.timeline.rippleDeleteClip} (Shift+Delete)`}
        data-testid="ripple-delete-button"
        onClick={onRippleDeleteSelected}
      >
        <Eraser size={16} />
      </button>
      {(slipEditActive || slideEditActive || rollingTrimActive) && (
        <div
          className="flex items-center gap-1.5 rounded-md border border-brand/30 bg-brand/10 px-2.5 py-1.5 text-xs font-medium text-brand"
          data-testid="editing-mode-indicator"
        >
          {rollingTrimActive ? (
            <>
              <Scissors size={14} />
              <span>{zhCN.timeline.rollingTrimMode}</span>
            </>
          ) : slipEditActive ? (
            <>
              <ArrowLeftRight size={14} />
              <span>{zhCN.timeline.slipMode}</span>
            </>
          ) : (
            <>
              <MoveHorizontal size={14} />
              <span>{zhCN.timeline.slideMode}</span>
            </>
          )}
        </div>
      )}
      <input
        className="w-28 accent-brand"
        title={zhCN.timeline.zoom}
        type="range"
        min={8}
        max={1600}
        value={zoom}
        onChange={(event) => onSetZoom(Number(event.target.value))}
        data-testid="timeline-zoom-slider"
      />
      <div className="ml-1 flex items-center gap-1 border-l border-line pl-2" data-testid="timeline-color-filter-bar">
        <span className="text-[11px] font-medium text-[var(--color-text-muted)]">
          {zhCN.timeline.timelineColorFilter}
        </span>
        <button
          className={`rounded border px-2 py-1 text-[11px] font-medium ${timelineColorFilter === null ? 'border-brand text-brand' : 'border-line text-[var(--color-text-secondary)] hover:bg-panel'}`}
          type="button"
          data-testid="timeline-color-filter-all"
          onClick={() => onSetTimelineColorFilter(null)}
        >
          {zhCN.timeline.timelineColorFilterAll}
        </button>
        {TIMELINE_LABEL_COLORS.map((color) => (
          <button
            key={color}
            className={`h-5 w-5 rounded-full border ${timelineColorFilter === color ? 'border-line ring-2 ring-[var(--color-border)]' : 'border-white'}`}
            style={{ backgroundColor: getTimelineLabelColorHex(color) }}
            type="button"
            title={zhCN.timeline.timelineLabelColorNames[color]}
            aria-label={zhCN.timeline.timelineLabelColorNames[color]}
            data-testid={`timeline-color-filter-${color}`}
            onClick={() => onSetTimelineColorFilter(timelineColorFilter === color ? null : color)}
          />
        ))}
      </div>
    </div>
  );
});

export default TimelineHeader;
