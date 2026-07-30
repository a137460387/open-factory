import type { SubtitleClip, SubtitleStyle, Timeline, Track } from '@open-factory/editor-core';
import type { SubtitleSearchResult, SubtitleSearchOptions } from '@open-factory/editor-core';

// ---------------------------------------------------------------------------
// Main Panel
// ---------------------------------------------------------------------------

export interface SubtitleEditorPanelProps {
  timeline: Timeline;
  onTimelineChange: (timeline: Timeline) => void;
  selectedClipIds?: string[];
  onSelectionChange?: (clipIds: string[]) => void;
  onClose?: () => void;
}

export type EditorTab = 'list' | 'search' | 'style' | 'batch';

// ---------------------------------------------------------------------------
// SubtitleListView
// ---------------------------------------------------------------------------

export interface SubtitleListViewProps {
  tracks: Track[];
  selectedIds: string[];
  editingClipId: string | null;
  editText: string;
  onSelectionChange: (ids: string[]) => void;
  onStartEdit: (clipId: string, text: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onEditTextChange: (text: string) => void;
  textAreaRef: React.RefObject<HTMLTextAreaElement | null>;
}

// ---------------------------------------------------------------------------
// SubtitleFindReplaceView
// ---------------------------------------------------------------------------

export interface SubtitleFindReplaceViewProps {
  searchResults: SubtitleSearchResult[];
  currentResultIndex: number;
  onSearch: (options: SubtitleSearchOptions) => void;
  onReplace: (options: SubtitleSearchOptions & { replaceText: string }, replaceAll: boolean) => void;
  onNavigate: (direction: 'next' | 'prev') => void;
}

// ---------------------------------------------------------------------------
// SubtitleStyleEditorView
// ---------------------------------------------------------------------------

export interface SubtitleStyleEditorViewProps {
  selectedCount: number;
  commonStyle: Partial<SubtitleStyle> | null;
  onStyleUpdate: (style: Partial<SubtitleStyle>) => void;
  onApplyTemplate: (templateId: string) => void;
}

// ---------------------------------------------------------------------------
// SubtitleBatchOperationsView
// ---------------------------------------------------------------------------

export interface SubtitleBatchOperationsViewProps {
  selectedCount: number;
  onSelectAll: (trackId?: string) => void;
  onInvertSelection: (trackId?: string) => void;
  onDelete: () => void;
  onDuplicate: (timeOffset: number) => void;
  onMerge: (separator: string) => void;
  onTimeShift: (shift: number) => void;
  tracks: Track[];
}
