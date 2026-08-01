import { useSubtitleEditor } from './SubtitleEditorPanel/useSubtitleEditor';
import { SubtitleListView } from './SubtitleEditorPanel/SubtitleListView';
import { SubtitleFindReplaceView } from './SubtitleEditorPanel/SubtitleFindReplaceView';
import { SubtitleStyleEditorView } from './SubtitleEditorPanel/SubtitleStyleEditorView';
import { SubtitleBatchOperationsView } from './SubtitleEditorPanel/SubtitleBatchOperationsView';
import type { SubtitleEditorPanelProps, EditorTab } from './SubtitleEditorPanel/types';

// Re-export types for backward compatibility
export type { SubtitleEditorPanelProps, EditorTab };

// ---------------------------------------------------------------------------
// Tab label helper
// ---------------------------------------------------------------------------

function getTabLabel(tab: EditorTab): string {
  switch (tab) {
    case 'list':
      return '字幕列表';
    case 'search':
      return '查找替换';
    case 'style':
      return '样式编辑';
    case 'batch':
      return '批量操作';
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SubtitleEditorPanel({
  timeline,
  onTimelineChange,
  selectedClipIds = [],
  onSelectionChange,
  onClose,
}: SubtitleEditorPanelProps) {
  const {
    activeTab,
    setActiveTab,
    searchResults,
    currentResultIndex,
    selectedIds,
    editingClipId,
    editText,
    setEditText,
    textAreaRef,
    subtitleTracks,
    selectedClips,
    commonStyle,
    handleSelectionChange,
    handleSearch,
    handleReplace,
    handleNavigateResult,
    handleSelectAll,
    handleInvertSelection,
    handleDelete,
    handleDuplicate,
    handleMerge,
    handleTimeShift,
    handleStyleUpdate,
    handleApplyTemplate,
    handleStartEdit,
    handleSaveEdit,
    handleCancelEdit,
  } = useSubtitleEditor({ timeline, onTimelineChange, selectedClipIds, onSelectionChange });

  return (
    <div className="flex h-full flex-col bg-[var(--color-bg-primary)]" data-testid="subtitle-editor-panel">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <h2 className="text-sm font-semibold text-ink">字幕编辑器</h2>
        <button
          className="rounded p-1 text-[var(--color-text-muted)] hover:bg-panel"
          type="button"
          onClick={onClose}
          data-testid="subtitle-editor-close"
        >
          ✕
        </button>
      </div>

      {/* Tab Bar */}
      <div className="flex border-b border-line">
        {(['list', 'search', 'style', 'batch'] as EditorTab[]).map((tab) => (
          <button
            key={tab}
            className={`flex-1 px-2 py-1.5 text-xs font-medium transition-colors ${
              activeTab === tab
                ? 'border-b-2 border-[var(--color-accent)] text-[var(--color-accent)]'
                : 'text-[var(--color-text-secondary)] hover:text-ink'
            }`}
            type="button"
            onClick={() => setActiveTab(tab)}
            data-testid={`subtitle-tab-${tab}`}
          >
            {getTabLabel(tab)}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'list' && (
          <SubtitleListView
            tracks={subtitleTracks}
            selectedIds={selectedIds}
            editingClipId={editingClipId}
            editText={editText}
            onSelectionChange={handleSelectionChange}
            onStartEdit={handleStartEdit}
            onSaveEdit={handleSaveEdit}
            onCancelEdit={handleCancelEdit}
            onEditTextChange={setEditText}
            textAreaRef={textAreaRef}
          />
        )}

        {activeTab === 'search' && (
          <SubtitleFindReplaceView
            searchResults={searchResults}
            currentResultIndex={currentResultIndex}
            onSearch={handleSearch}
            onReplace={handleReplace}
            onNavigate={handleNavigateResult}
          />
        )}

        {activeTab === 'style' && (
          <SubtitleStyleEditorView
            selectedCount={selectedClips.count}
            commonStyle={commonStyle}
            onStyleUpdate={handleStyleUpdate}
            onApplyTemplate={handleApplyTemplate}
          />
        )}

        {activeTab === 'batch' && (
          <SubtitleBatchOperationsView
            selectedCount={selectedClips.count}
            onSelectAll={handleSelectAll}
            onInvertSelection={handleInvertSelection}
            onDelete={handleDelete}
            onDuplicate={handleDuplicate}
            onMerge={handleMerge}
            onTimeShift={handleTimeShift}
            tracks={subtitleTracks}
          />
        )}
      </div>

      {/* Status Bar */}
      <div className="flex items-center justify-between border-t border-line px-3 py-1.5 text-xs text-[var(--color-text-muted)]">
        <span>
          {subtitleTracks.length} 个字幕轨道，共{' '}
          {subtitleTracks.reduce((sum, track) => sum + track.clips.filter((c) => c.type === 'subtitle').length, 0)}{' '}
          条字幕
        </span>
        <span>已选中 {selectedIds.length} 条</span>
      </div>
    </div>
  );
}
