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
import { getBuiltinSubtitleStyleTemplate } from '@open-factory/editor-core';
import type { SubtitleEditorPanelProps } from './types';

export function useSubtitleEditor({
  timeline,
  onTimelineChange,
  selectedClipIds = [],
  onSelectionChange,
}: SubtitleEditorPanelProps) {
  const [activeTab, setActiveTab] = useState<'list' | 'search' | 'style' | 'batch'>('list');
  const [searchResults, setSearchResults] = useState<SubtitleSearchResult[]>([]);
  const [currentResultIndex, setCurrentResultIndex] = useState(-1);
  const [selectedIds, setSelectedIds] = useState<string[]>(selectedClipIds);
  const [editingClipId, setEditingClipId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  // Get subtitle tracks
  const subtitleTracks = useMemo(() => {
    return timeline.tracks.filter((track) => track.type === 'subtitle');
  }, [timeline.tracks]);

  // Get selected subtitle clips
  const selectedClips = useMemo(() => {
    return getSelectedSubtitleClips(timeline, selectedIds);
  }, [timeline, selectedIds]);

  // Extract common style
  const commonStyle = useMemo(() => {
    return extractCommonStyle(selectedClips.selectedClips);
  }, [selectedClips.selectedClips]);

  // Sync external selection
  useEffect(() => {
    setSelectedIds(selectedClipIds);
  }, [selectedClipIds]);

  // Notify external selection change
  const handleSelectionChange = useCallback(
    (newSelectedIds: string[]) => {
      setSelectedIds(newSelectedIds);
      onSelectionChange?.(newSelectedIds);
    },
    [onSelectionChange],
  );

  // Search
  const handleSearch = useCallback(
    (options: SubtitleSearchOptions) => {
      const results = searchSubtitles(timeline, options);
      setSearchResults(results);
      setCurrentResultIndex(results.length > 0 ? 0 : -1);

      if (results.length > 0) {
        handleSelectionChange([results[0].clipId]);
      }
    },
    [timeline, handleSelectionChange],
  );

  // Replace
  const handleReplace = useCallback(
    (options: SubtitleSearchOptions & { replaceText: string }, replaceAll: boolean) => {
      if (replaceAll) {
        const { timeline: newTimeline, replacedCount } = replaceSubtitles(timeline, options);
        if (replacedCount > 0) {
          onTimelineChange(newTimeline);
          handleSearch(options);
        }
      } else if (currentResultIndex >= 0 && searchResults[currentResultIndex]) {
        const result = searchResults[currentResultIndex];
        const newTimeline = replaceSingleResult(timeline, result, options.replaceText);
        onTimelineChange(newTimeline);

        const newResults = searchResults.filter((_, i) => i !== currentResultIndex);
        setSearchResults(newResults);
        setCurrentResultIndex(Math.min(currentResultIndex, newResults.length - 1));
      }
    },
    [timeline, onTimelineChange, handleSearch, searchResults, currentResultIndex],
  );

  // Navigate search results
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

  // Select all
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

  // Invert selection
  const handleInvertSelection = useCallback(
    (trackId?: string) => {
      const newIds = invertSubtitleSelection(timeline, selectedIds, trackId);
      handleSelectionChange(newIds);
    },
    [timeline, selectedIds, handleSelectionChange],
  );

  // Delete
  const handleDelete = useCallback(() => {
    if (selectedIds.length === 0) return;

    const result = deleteSelectedSubtitles(timeline, selectedIds);
    if (result.affectedCount > 0) {
      onTimelineChange(result.timeline);
      handleSelectionChange([]);
    }
  }, [timeline, selectedIds, onTimelineChange, handleSelectionChange]);

  // Duplicate
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

  // Merge
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

  // Time shift
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

  // Style update
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

  // Apply template
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

  // Start editing
  const handleStartEdit = useCallback((clipId: string, text: string) => {
    setEditingClipId(clipId);
    setEditText(text);
    setTimeout(() => textAreaRef.current?.focus(), 0);
  }, []);

  // Save edit
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

  // Cancel edit
  const handleCancelEdit = useCallback(() => {
    setEditingClipId(null);
    setEditText('');
  }, []);

  return {
    // State
    activeTab,
    setActiveTab,
    searchResults,
    currentResultIndex,
    selectedIds,
    editingClipId,
    editText,
    setEditText,
    textAreaRef,
    // Derived
    subtitleTracks,
    selectedClips,
    commonStyle,
    // Handlers
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
  };
}
