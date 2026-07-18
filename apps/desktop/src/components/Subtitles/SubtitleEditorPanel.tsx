import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import type { SubtitleClip, SubtitleStyle, Timeline, Track } from '@open-factory/editor-core';
import {
  searchSubtitles,
  replaceSubtitles,
  replaceSingleResult,
  batchUpdateSubtitleStyle,
  batchApplyStyleTemplate,
  deleteSelectedSubtitles,
  duplicateSelectedSubtitles,
  mergeSelectedSubtitles,
  batchShiftSubtitleTime,
  getSelectedSubtitleClips,
  selectAllSubtitlesInTrack,
  invertSubtitleSelection,
  extractCommonStyle,
  type SubtitleSearchResult,
  type SubtitleSearchOptions,
} from '@open-factory/editor-core';
import {
  BUILTIN_SUBTITLE_STYLE_TEMPLATES,
  getBuiltinSubtitleStyleTemplate,
} from '@open-factory/editor-core';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SubtitleEditorPanelProps {
  timeline: Timeline;
  onTimelineChange: (timeline: Timeline) => void;
  selectedClipIds?: string[];
  onSelectionChange?: (clipIds: string[]) => void;
  onClose?: () => void;
}

type EditorTab = 'list' | 'search' | 'style' | 'batch';

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
  const [activeTab, setActiveTab] = useState<EditorTab>('list');
  const [searchResults, setSearchResults] = useState<SubtitleSearchResult[]>([]);
  const [currentResultIndex, setCurrentResultIndex] = useState(-1);
  const [selectedIds, setSelectedIds] = useState<string[]>(selectedClipIds);
  const [editingClipId, setEditingClipId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  // 获取所有字幕轨道
  const subtitleTracks = useMemo(() => {
    return timeline.tracks.filter((track) => track.type === 'subtitle');
  }, [timeline.tracks]);

  // 获取选中的字幕片段
  const selectedClips = useMemo(() => {
    return getSelectedSubtitleClips(timeline, selectedIds);
  }, [timeline, selectedIds]);

  // 提取共同样式
  const commonStyle = useMemo(() => {
    return extractCommonStyle(selectedClips.selectedClips);
  }, [selectedClips.selectedClips]);

  // 同步外部选中状态
  useEffect(() => {
    setSelectedIds(selectedClipIds);
  }, [selectedClipIds]);

  // 通知外部选中变化
  const handleSelectionChange = useCallback(
    (newSelectedIds: string[]) => {
      setSelectedIds(newSelectedIds);
      onSelectionChange?.(newSelectedIds);
    },
    [onSelectionChange],
  );

  // 处理查找
  const handleSearch = useCallback(
    (options: SubtitleSearchOptions) => {
      const results = searchSubtitles(timeline, options);
      setSearchResults(results);
      setCurrentResultIndex(results.length > 0 ? 0 : -1);

      // 自动选中第一个结果
      if (results.length > 0) {
        handleSelectionChange([results[0].clipId]);
      }
    },
    [timeline, handleSelectionChange],
  );

  // 处理替换
  const handleReplace = useCallback(
    (options: SubtitleSearchOptions & { replaceText: string }, replaceAll: boolean) => {
      if (replaceAll) {
        const { timeline: newTimeline, replacedCount } = replaceSubtitles(timeline, options);
        if (replacedCount > 0) {
          onTimelineChange(newTimeline);
          // 重新搜索
          handleSearch(options);
        }
      } else if (currentResultIndex >= 0 && searchResults[currentResultIndex]) {
        const result = searchResults[currentResultIndex];
        const newTimeline = replaceSingleResult(timeline, result, options.replaceText);
        onTimelineChange(newTimeline);

        // 移动到下一个结果
        const newResults = searchResults.filter((_, i) => i !== currentResultIndex);
        setSearchResults(newResults);
        setCurrentResultIndex(Math.min(currentResultIndex, newResults.length - 1));
      }
    },
    [timeline, onTimelineChange, handleSearch, searchResults, currentResultIndex],
  );

  // 导航搜索结果
  const handleNavigateResult = useCallback(
    (direction: 'next' | 'prev') => {
      if (searchResults.length === 0) return;

      const newIndex =
        direction === 'next'
          ? (currentResultIndex + 1) % searchResults.length
          : (currentResultIndex - 1 + searchResults.length) % searchResults.length;

      setCurrentResultIndex(newIndex);
      handleSelectionChange([searchResults[newIndex].clipId]);
    },
    [searchResults, currentResultIndex, handleSelectionChange],
  );

  // 处理全选
  const handleSelectAll = useCallback(
    (trackId?: string) => {
      if (trackId) {
        const ids = selectAllSubtitlesInTrack(timeline, trackId);
        handleSelectionChange(ids);
      } else {
        const allIds: string[] = [];
        for (const track of subtitleTracks) {
          for (const clip of track.clips) {
            if (clip.type === 'subtitle') {
              allIds.push(clip.id);
            }
          }
        }
        handleSelectionChange(allIds);
      }
    },
    [timeline, subtitleTracks, handleSelectionChange],
  );

  // 处理反选
  const handleInvertSelection = useCallback(
    (trackId?: string) => {
      const newIds = invertSubtitleSelection(timeline, selectedIds, trackId);
      handleSelectionChange(newIds);
    },
    [timeline, selectedIds, handleSelectionChange],
  );

  // 处理删除
  const handleDelete = useCallback(() => {
    if (selectedIds.length === 0) return;

    const result = deleteSelectedSubtitles(timeline, selectedIds);
    if (result.affectedCount > 0) {
      onTimelineChange(result.timeline);
      handleSelectionChange([]);
    }
  }, [timeline, selectedIds, onTimelineChange, handleSelectionChange]);

  // 处理复制
  const handleDuplicate = useCallback(
    (timeOffset: number = 1) => {
      if (selectedIds.length === 0) return;

      const result = duplicateSelectedSubtitles(timeline, selectedIds, timeOffset);
      if (result.affectedCount > 0) {
        onTimelineChange(result.timeline);
      }
    },
    [timeline, selectedIds, onTimelineChange],
  );

  // 处理合并
  const handleMerge = useCallback(
    (separator: string = ' ') => {
      if (selectedIds.length < 2) return;

      const result = mergeSelectedSubtitles(timeline, selectedIds, separator);
      if (result.affectedCount > 0) {
        onTimelineChange(result.timeline);
        handleSelectionChange([]);
      }
    },
    [timeline, selectedIds, onTimelineChange, handleSelectionChange],
  );

  // 处理时间调整
  const handleTimeShift = useCallback(
    (shift: number) => {
      if (selectedIds.length === 0) return;

      const result = batchShiftSubtitleTime(timeline, selectedIds, shift);
      if (result.affectedCount > 0) {
        onTimelineChange(result.timeline);
      }
    },
    [timeline, selectedIds, onTimelineChange],
  );

  // 处理样式更新
  const handleStyleUpdate = useCallback(
    (style: Partial<SubtitleStyle>) => {
      if (selectedIds.length === 0) return;

      const newTimeline = batchUpdateSubtitleStyle(timeline, {
        clipIds: selectedIds,
        style,
      });
      onTimelineChange(newTimeline);
    },
    [timeline, selectedIds, onTimelineChange],
  );

  // 处理应用样式模板
  const handleApplyTemplate = useCallback(
    (templateId: string) => {
      if (selectedIds.length === 0) return;

      const template = getBuiltinSubtitleStyleTemplate(templateId);
      if (!template) return;

      const newTimeline = batchApplyStyleTemplate(timeline, selectedIds, template);
      onTimelineChange(newTimeline);
    },
    [timeline, selectedIds, onTimelineChange],
  );

  // 开始编辑字幕文本
  const handleStartEdit = useCallback((clipId: string, text: string) => {
    setEditingClipId(clipId);
    setEditText(text);
    setTimeout(() => textAreaRef.current?.focus(), 0);
  }, []);

  // 保存编辑
  const handleSaveEdit = useCallback(() => {
    if (!editingClipId) return;

    const newTimeline = {
      ...timeline,
      tracks: timeline.tracks.map((track) => ({
        ...track,
        clips: track.clips.map((clip) => {
          if (clip.id === editingClipId && clip.type === 'subtitle') {
            return { ...clip, text: editText };
          }
          return clip;
        }),
      })),
    };

    onTimelineChange(newTimeline);
    setEditingClipId(null);
    setEditText('');
  }, [timeline, editingClipId, editText, onTimelineChange]);

  // 取消编辑
  const handleCancelEdit = useCallback(() => {
    setEditingClipId(null);
    setEditText('');
  }, []);

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
          {subtitleTracks.reduce(
            (sum, track) => sum + track.clips.filter((c) => c.type === 'subtitle').length,
            0,
          )}{' '}
          条字幕
        </span>
        <span>已选中 {selectedIds.length} 条</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-Components
// ---------------------------------------------------------------------------

interface SubtitleListViewProps {
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

function SubtitleListView({
  tracks,
  selectedIds,
  editingClipId,
  editText,
  onSelectionChange,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onEditTextChange,
  textAreaRef,
}: SubtitleListViewProps) {
  const handleToggleSelect = useCallback(
    (clipId: string, multiSelect: boolean) => {
      if (multiSelect) {
        const selectedSet = new Set(selectedIds);
        onSelectionChange(
          selectedSet.has(clipId)
            ? selectedIds.filter((id) => id !== clipId)
            : [...selectedIds, clipId],
        );
      } else {
        onSelectionChange([clipId]);
      }
    },
    [selectedIds, onSelectionChange],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        onSaveEdit();
      } else if (e.key === 'Escape') {
        onCancelEdit();
      }
    },
    [onSaveEdit, onCancelEdit],
  );

  return (
    <div className="divide-y divide-line">
      {tracks.map((track) => (
        <div key={track.id} className="p-2">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-ink">
              {track.name || '未命名轨道'}
              {track.language && ` (${track.language})`}
            </span>
            <span className="text-xs text-[var(--color-text-muted)]">
              {track.clips.filter((c) => c.type === 'subtitle').length} 条
            </span>
          </div>

          <div className="space-y-1">
            {track.clips
              .filter((clip) => clip.type === 'subtitle')
              .sort((a, b) => a.start - b.start)
              .map((clip) => {
                const subtitleClip = clip as SubtitleClip;
                const isSelected = selectedIds.includes(clip.id);
                const isEditing = editingClipId === clip.id;

                return (
                  <div
                    key={clip.id}
                    className={`group flex items-start gap-2 rounded px-2 py-1.5 text-xs transition-colors ${
                      isSelected
                        ? 'bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/30'
                        : 'hover:bg-panel border border-transparent'
                    }`}
                    onClick={(e) => handleToggleSelect(clip.id, e.ctrlKey || e.metaKey)}
                    data-testid={`subtitle-item-${clip.id}`}
                  >
                    {/* Checkbox */}
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleSelect(clip.id, true)}
                      className="mt-0.5 rounded border-line"
                      onClick={(e) => e.stopPropagation()}
                    />

                    {/* Timecode */}
                    <div className="flex-shrink-0 font-mono text-[var(--color-text-muted)]">
                      <div>{formatTimecode(subtitleClip.start)}</div>
                      <div>{formatTimecode(subtitleClip.start + subtitleClip.duration)}</div>
                    </div>

                    {/* Text */}
                    <div className="flex-1 min-w-0">
                      {/* 说话人标签 */}
                      {subtitleClip.speaker && (
                        <div className="mb-1 flex items-center gap-1">
                          <span
                            className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium"
                            style={{
                              backgroundColor: `hsl(${(subtitleClip.speakerId ?? 0) * 60}, 70%, 90%)`,
                              color: `hsl(${(subtitleClip.speakerId ?? 0) * 60}, 70%, 30%)`,
                            }}
                          >
                            {subtitleClip.speaker}
                          </span>
                        </div>
                      )}
                      {isEditing ? (
                        <textarea
                          ref={textAreaRef}
                          value={editText}
                          onChange={(e) => onEditTextChange(e.target.value)}
                          onKeyDown={handleKeyDown}
                          onBlur={onSaveEdit}
                          className="w-full rounded border border-[var(--color-accent)] bg-[var(--color-bg-primary)] px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
                          rows={2}
                        />
                      ) : (
                        <div
                          className="cursor-text truncate"
                          onDoubleClick={() => onStartEdit(clip.id, subtitleClip.text)}
                          title={subtitleClip.text}
                        >
                          {subtitleClip.text || '(空字幕)'}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      ))}
    </div>
  );
}

interface SubtitleFindReplaceViewProps {
  searchResults: SubtitleSearchResult[];
  currentResultIndex: number;
  onSearch: (options: SubtitleSearchOptions) => void;
  onReplace: (options: SubtitleSearchOptions & { replaceText: string }, replaceAll: boolean) => void;
  onNavigate: (direction: 'next' | 'prev') => void;
}

function SubtitleFindReplaceView({
  searchResults,
  currentResultIndex,
  onSearch,
  onReplace,
  onNavigate,
}: SubtitleFindReplaceViewProps) {
  const [searchText, setSearchText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [showReplace, setShowReplace] = useState(false);

  const handleSearch = useCallback(() => {
    onSearch({
      searchText,
      caseSensitive,
      wholeWord,
      useRegex,
    });
  }, [searchText, caseSensitive, wholeWord, useRegex, onSearch]);

  const handleReplaceSingle = useCallback(() => {
    onReplace(
      {
        searchText,
        replaceText,
        caseSensitive,
        wholeWord,
        useRegex,
      },
      false,
    );
  }, [searchText, replaceText, caseSensitive, wholeWord, useRegex, onReplace]);

  const handleReplaceAll = useCallback(() => {
    onReplace(
      {
        searchText,
        replaceText,
        caseSensitive,
        wholeWord,
        useRegex,
      },
      true,
    );
  }, [searchText, replaceText, caseSensitive, wholeWord, useRegex, onReplace]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        if (e.shiftKey) {
          onNavigate('prev');
        } else {
          handleSearch();
        }
      }
    },
    [handleSearch, onNavigate],
  );

  return (
    <div className="space-y-3 p-3">
      {/* Search Input */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="搜索字幕文本..."
            className="flex-1 rounded border border-line bg-[var(--color-bg-primary)] px-2 py-1.5 text-xs focus:border-[var(--color-accent)] focus:outline-none"
            data-testid="subtitle-search-input"
          />
          <button
            onClick={handleSearch}
            className="rounded bg-[var(--color-accent)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--color-accent)]/90"
            data-testid="subtitle-search-button"
          >
            搜索
          </button>
        </div>

        {/* Options */}
        <div className="flex flex-wrap gap-3">
          <label className="flex items-center gap-1 text-xs">
            <input
              type="checkbox"
              checked={caseSensitive}
              onChange={(e) => setCaseSensitive(e.target.checked)}
              className="rounded border-line"
            />
            区分大小写
          </label>
          <label className="flex items-center gap-1 text-xs">
            <input
              type="checkbox"
              checked={wholeWord}
              onChange={(e) => setWholeWord(e.target.checked)}
              className="rounded border-line"
            />
            全词匹配
          </label>
          <label className="flex items-center gap-1 text-xs">
            <input
              type="checkbox"
              checked={useRegex}
              onChange={(e) => setUseRegex(e.target.checked)}
              className="rounded border-line"
            />
            正则表达式
          </label>
          <button
            onClick={() => setShowReplace(!showReplace)}
            className="text-xs text-[var(--color-accent)] hover:underline"
          >
            {showReplace ? '隐藏替换' : '显示替换'}
          </button>
        </div>
      </div>

      {/* Replace Input */}
      {showReplace && (
        <div className="space-y-2 rounded border border-line p-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={replaceText}
              onChange={(e) => setReplaceText(e.target.value)}
              placeholder="替换为..."
              className="flex-1 rounded border border-line bg-[var(--color-bg-primary)] px-2 py-1.5 text-xs focus:border-[var(--color-accent)] focus:outline-none"
              data-testid="subtitle-replace-input"
            />
            <button
              onClick={handleReplaceSingle}
              disabled={searchResults.length === 0}
              className="rounded border border-line px-3 py-1.5 text-xs hover:bg-panel disabled:opacity-50"
              data-testid="subtitle-replace-single"
            >
              替换
            </button>
            <button
              onClick={handleReplaceAll}
              disabled={searchResults.length === 0}
              className="rounded border border-line px-3 py-1.5 text-xs hover:bg-panel disabled:opacity-50"
              data-testid="subtitle-replace-all"
            >
              全部替换
            </button>
          </div>
        </div>
      )}

      {/* Results */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)]">
          <span>
            找到 {searchResults.length} 个结果
            {searchResults.length > 0 && ` (${currentResultIndex + 1}/${searchResults.length})`}
          </span>
          {searchResults.length > 0 && (
            <div className="flex gap-1">
              <button
                onClick={() => onNavigate('prev')}
                className="rounded border border-line px-2 py-0.5 hover:bg-panel"
                data-testid="subtitle-search-prev"
              >
                ↑
              </button>
              <button
                onClick={() => onNavigate('next')}
                className="rounded border border-line px-2 py-0.5 hover:bg-panel"
                data-testid="subtitle-search-next"
              >
                ↓
              </button>
            </div>
          )}
        </div>

        {searchResults.length > 0 && (
          <div className="max-h-60 space-y-1 overflow-y-auto">
            {searchResults.map((result, index) => (
              <div
                key={`${result.clipId}-${result.matchStart}`}
                className={`rounded px-2 py-1.5 text-xs ${
                  index === currentResultIndex
                    ? 'bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/30'
                    : 'hover:bg-panel'
                }`}
              >
                <div className="font-mono text-[var(--color-text-muted)]">
                  {formatTimecode(result.matchStart)} - {formatTimecode(result.matchEnd)}
                </div>
                <div className="mt-0.5">
                  <span>{result.fullText.substring(0, result.matchStart)}</span>
                  <span className="bg-yellow-200 text-yellow-900">
                    {result.matchedText}
                  </span>
                  <span>{result.fullText.substring(result.matchEnd)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface SubtitleStyleEditorViewProps {
  selectedCount: number;
  commonStyle: Partial<SubtitleStyle> | null;
  onStyleUpdate: (style: Partial<SubtitleStyle>) => void;
  onApplyTemplate: (templateId: string) => void;
}

function SubtitleStyleEditorView({
  selectedCount,
  commonStyle,
  onStyleUpdate,
  onApplyTemplate,
}: SubtitleStyleEditorViewProps) {
  const [localStyle, setLocalStyle] = useState<Partial<SubtitleStyle>>({});

  // 同步共同样式
  useEffect(() => {
    if (commonStyle) {
      setLocalStyle(commonStyle);
    }
  }, [commonStyle]);

  const handleStyleChange = useCallback(
    (key: keyof SubtitleStyle, value: unknown) => {
      const newStyle = { ...localStyle, [key]: value };
      setLocalStyle(newStyle);
      onStyleUpdate({ [key]: value });
    },
    [localStyle, onStyleUpdate],
  );

  if (selectedCount === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-xs text-[var(--color-text-muted)]">
        请先选择字幕片段
      </div>
    );
  }

  return (
    <div className="space-y-4 p-3">
      {/* Templates */}
      <div>
        <h3 className="mb-2 text-xs font-medium text-ink">样式模板</h3>
        <div className="grid grid-cols-2 gap-2">
          {BUILTIN_SUBTITLE_STYLE_TEMPLATES.map((template) => (
            <button
              key={template.id}
              onClick={() => onApplyTemplate(template.id)}
              className="rounded border border-line p-2 text-left text-xs hover:border-[var(--color-accent)] hover:bg-[var(--color-accent)]/5"
              data-testid={`style-template-${template.id}`}
            >
              <div className="font-medium">{template.name}</div>
              <div
                className="mt-1 h-6 rounded text-center text-white"
                style={{
                  backgroundColor: template.style.backgroundColor,
                  color: template.style.color,
                  fontSize: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                示例
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Custom Style */}
      <div>
        <h3 className="mb-2 text-xs font-medium text-ink">自定义样式</h3>
        <div className="space-y-2">
          {/* Font Family */}
          <div className="flex items-center gap-2">
            <label className="w-16 text-xs text-[var(--color-text-muted)]">字体</label>
            <select
              value={localStyle.fontFamily || 'Arial, sans-serif'}
              onChange={(e) => handleStyleChange('fontFamily', e.target.value)}
              className="flex-1 rounded border border-line bg-[var(--color-bg-primary)] px-2 py-1 text-xs"
            >
              <option value="Arial, sans-serif">Arial</option>
              <option value="Helvetica, Arial, sans-serif">Helvetica</option>
              <option value="Georgia, serif">Georgia</option>
              <option value="Times New Roman, serif">Times New Roman</option>
              <option value="Microsoft YaHei, sans-serif">微软雅黑</option>
              <option value="SimHei, sans-serif">黑体</option>
              <option value="SimSun, serif">宋体</option>
            </select>
          </div>

          {/* Font Size */}
          <div className="flex items-center gap-2">
            <label className="w-16 text-xs text-[var(--color-text-muted)]">大小</label>
            <input
              type="range"
              min="12"
              max="120"
              value={localStyle.fontSize || 42}
              onChange={(e) => handleStyleChange('fontSize', Number(e.target.value))}
              className="flex-1"
            />
            <span className="w-8 text-xs text-right">{localStyle.fontSize || 42}</span>
          </div>

          {/* Colors */}
          <div className="flex items-center gap-2">
            <label className="w-16 text-xs text-[var(--color-text-muted)]">文字色</label>
            <input
              type="color"
              value={localStyle.color || '#ffffff'}
              onChange={(e) => handleStyleChange('color', e.target.value)}
              className="h-6 w-8 rounded border border-line"
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="w-16 text-xs text-[var(--color-text-muted)]">背景色</label>
            <input
              type="color"
              value={localStyle.backgroundColor || '#000000'}
              onChange={(e) => handleStyleChange('backgroundColor', e.target.value)}
              className="h-6 w-8 rounded border border-line"
            />
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={localStyle.backgroundOpacity ?? 0.55}
              onChange={(e) => handleStyleChange('backgroundOpacity', Number(e.target.value))}
              className="flex-1"
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="w-16 text-xs text-[var(--color-text-muted)]">描边色</label>
            <input
              type="color"
              value={localStyle.outlineColor || '#000000'}
              onChange={(e) => handleStyleChange('outlineColor', e.target.value)}
              className="h-6 w-8 rounded border border-line"
            />
            <input
              type="range"
              min="0"
              max="12"
              value={localStyle.outlineWidth || 0}
              onChange={(e) => handleStyleChange('outlineWidth', Number(e.target.value))}
              className="flex-1"
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="w-16 text-xs text-[var(--color-text-muted)]">阴影</label>
            <input
              type="color"
              value={localStyle.shadowColor || '#000000'}
              onChange={(e) => handleStyleChange('shadowColor', e.target.value)}
              className="h-6 w-8 rounded border border-line"
            />
            <input
              type="range"
              min="0"
              max="24"
              value={localStyle.shadowOffset || 0}
              onChange={(e) => handleStyleChange('shadowOffset', Number(e.target.value))}
              className="flex-1"
            />
          </div>

          {/* Y Offset */}
          <div className="flex items-center gap-2">
            <label className="w-16 text-xs text-[var(--color-text-muted)]">垂直位置</label>
            <input
              type="range"
              min="0"
              max="200"
              value={localStyle.yOffset || 72}
              onChange={(e) => handleStyleChange('yOffset', Number(e.target.value))}
              className="flex-1"
            />
            <span className="w-8 text-xs text-right">{localStyle.yOffset || 72}</span>
          </div>

          {/* Bold & Italic */}
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-1 text-xs">
              <input
                type="checkbox"
                checked={localStyle.bold || false}
                onChange={(e) => handleStyleChange('bold', e.target.checked)}
                className="rounded border-line"
              />
              粗体
            </label>
            <label className="flex items-center gap-1 text-xs">
              <input
                type="checkbox"
                checked={localStyle.italic || false}
                onChange={(e) => handleStyleChange('italic', e.target.checked)}
                className="rounded border-line"
              />
              斜体
            </label>
          </div>
        </div>
      </div>

      {/* Preview */}
      <div>
        <h3 className="mb-2 text-xs font-medium text-ink">预览</h3>
        <div
          className="relative h-20 rounded border border-line bg-gray-900"
          style={{ overflow: 'hidden' }}
        >
          <div
            className="absolute inset-x-0 text-center"
            style={{
              bottom: `${Math.min(80, (localStyle.yOffset || 72) / 2)}px`,
              color: localStyle.color || '#ffffff',
              fontFamily: localStyle.fontFamily || 'Arial, sans-serif',
              fontSize: `${Math.min(24, (localStyle.fontSize || 42) / 2)}px`,
              fontWeight: localStyle.bold ? 'bold' : 'normal',
              fontStyle: localStyle.italic ? 'italic' : 'normal',
              textShadow: localStyle.shadowOffset
                ? `${localStyle.shadowOffset}px ${localStyle.shadowOffset}px ${localStyle.shadowColor || '#000000'}`
                : 'none',
              WebkitTextStroke: localStyle.outlineWidth
                ? `${localStyle.outlineWidth}px ${localStyle.outlineColor || '#000000'}`
                : 'none',
            }}
          >
            示例字幕文本
          </div>
        </div>
      </div>
    </div>
  );
}

interface SubtitleBatchOperationsViewProps {
  selectedCount: number;
  onSelectAll: (trackId?: string) => void;
  onInvertSelection: (trackId?: string) => void;
  onDelete: () => void;
  onDuplicate: (timeOffset: number) => void;
  onMerge: (separator: string) => void;
  onTimeShift: (shift: number) => void;
  tracks: Track[];
}

function SubtitleBatchOperationsView({
  selectedCount,
  onSelectAll,
  onInvertSelection,
  onDelete,
  onDuplicate,
  onMerge,
  onTimeShift,
  tracks,
}: SubtitleBatchOperationsViewProps) {
  const [timeShift, setTimeShift] = useState(0);
  const [mergeSeparator, setMergeSeparator] = useState(' ');

  return (
    <div className="space-y-4 p-3">
      {/* Selection */}
      <div>
        <h3 className="mb-2 text-xs font-medium text-ink">选择操作</h3>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => onSelectAll()}
            className="rounded border border-line px-3 py-1.5 text-xs hover:bg-panel"
            data-testid="batch-select-all"
          >
            全选
          </button>
          <button
            onClick={() => onInvertSelection()}
            className="rounded border border-line px-3 py-1.5 text-xs hover:bg-panel"
            data-testid="batch-invert-selection"
          >
            反选
          </button>
          {tracks.map((track) => (
            <button
              key={track.id}
              onClick={() => onSelectAll(track.id)}
              className="rounded border border-line px-3 py-1.5 text-xs hover:bg-panel"
              data-testid={`batch-select-track-${track.id}`}
            >
              选择: {track.name || '未命名轨道'}
            </button>
          ))}
        </div>
      </div>

      {/* Edit Operations */}
      <div>
        <h3 className="mb-2 text-xs font-medium text-ink">
          编辑操作
          {selectedCount > 0 && (
            <span className="ml-2 text-[var(--color-text-muted)]">({selectedCount} 条选中)</span>
          )}
        </h3>
        <div className="space-y-2">
          <div className="flex gap-2">
            <button
              onClick={onDelete}
              disabled={selectedCount === 0}
              className="rounded border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-600 hover:bg-red-100 disabled:opacity-50"
              data-testid="batch-delete"
            >
              删除选中
            </button>
            <button
              onClick={() => onDuplicate(1)}
              disabled={selectedCount === 0}
              className="rounded border border-line px-3 py-1.5 text-xs hover:bg-panel disabled:opacity-50"
              data-testid="batch-duplicate"
            >
              复制选中
            </button>
            <button
              onClick={() => onMerge(mergeSeparator)}
              disabled={selectedCount < 2}
              className="rounded border border-line px-3 py-1.5 text-xs hover:bg-panel disabled:opacity-50"
              data-testid="batch-merge"
            >
              合并选中
            </button>
          </div>

          {/* Merge Separator */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-[var(--color-text-muted)]">合并分隔符</label>
            <input
              type="text"
              value={mergeSeparator}
              onChange={(e) => setMergeSeparator(e.target.value)}
              className="w-20 rounded border border-line bg-[var(--color-bg-primary)] px-2 py-1 text-xs"
              placeholder="空格"
            />
          </div>
        </div>
      </div>

      {/* Time Operations */}
      <div>
        <h3 className="mb-2 text-xs font-medium text-ink">时间调整</h3>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <label className="text-xs text-[var(--color-text-muted)]">时间偏移（秒）</label>
            <input
              type="number"
              value={timeShift}
              onChange={(e) => setTimeShift(Number(e.target.value))}
              step="0.1"
              className="w-24 rounded border border-line bg-[var(--color-bg-primary)] px-2 py-1 text-xs"
            />
            <button
              onClick={() => onTimeShift(timeShift)}
              disabled={selectedCount === 0 || timeShift === 0}
              className="rounded border border-line px-3 py-1.5 text-xs hover:bg-panel disabled:opacity-50"
              data-testid="batch-time-shift"
            >
              应用偏移
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onTimeShift(-0.5)}
              disabled={selectedCount === 0}
              className="rounded border border-line px-3 py-1.5 text-xs hover:bg-panel disabled:opacity-50"
            >
              -0.5s
            </button>
            <button
              onClick={() => onTimeShift(-0.1)}
              disabled={selectedCount === 0}
              className="rounded border border-line px-3 py-1.5 text-xs hover:bg-panel disabled:opacity-50"
            >
              -0.1s
            </button>
            <button
              onClick={() => onTimeShift(0.1)}
              disabled={selectedCount === 0}
              className="rounded border border-line px-3 py-1.5 text-xs hover:bg-panel disabled:opacity-50"
            >
              +0.1s
            </button>
            <button
              onClick={() => onTimeShift(0.5)}
              disabled={selectedCount === 0}
              className="rounded border border-line px-3 py-1.5 text-xs hover:bg-panel disabled:opacity-50"
            >
              +0.5s
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
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

function formatTimecode(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);

  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
}
