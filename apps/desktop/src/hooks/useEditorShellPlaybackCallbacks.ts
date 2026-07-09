import { useCallback } from 'react';
import {
  AddProjectAnnotationCommand,
  AddReviewAnnotationCommand,
  AddProjectBookmarkCommand,
  UpdateProjectBookmarksCommand,
  UpdateProjectExportRangesCommand,
  buildTimelineNavigationPoints,
  createExportRange,
  createId,
  findTimelineNavigationPoint,
  getTimelineDuration,
  normalizeExportRanges,
  mergeImportedTimelineBookmarks,
  parseTimelineBookmarksJson,
  serializeTimelineBookmarks,
  DEFAULT_PROJECT_ANNOTATION_COLOR,
  DEFAULT_REVIEW_ANNOTATION_COLOR,
  type ReviewAnnotation,
} from '@open-factory/editor-core';
import {
  openFileDialog as bridgeOpenFileDialog,
  readFile as bridgeReadFile,
  saveFileDialog as bridgeSaveFileDialog,
  writeFile as bridgeWriteFile,
} from '../lib/tauri-bridge';
import { showToast } from '../lib/toast';
import { zhCN } from '../i18n/strings';
import { commandManager, projectAccessor } from '../store/commandManager';
import { useEditorStore } from '../store/editorStore';
import { saveReviewReport } from '../review/reviewReport';

/**
 * 从 EditorShell 中提取的回放控制、标注、书签、导出范围相关回调。
 * 涵盖约 250 行 useCallback。
 */
export function useEditorShellPlaybackCallbacks() {
  // --- 回放控制 ---
  const undo = useCallback(() => commandManager.undo(), []);
  const switchToPreviousHistoryBranch = useCallback(() => commandManager.switchToPreviousBranch(), []);
  const redo = useCallback(() => commandManager.redo(), []);

  const togglePlayback = useCallback(() => {
    const state = useEditorStore.getState();
    if (getTimelineDuration(state.project.timeline) === 0) {
      return;
    }
    if (!state.isPlaying) {
      state.setPlaybackRate(1);
    }
    state.setIsPlaying(!state.isPlaying);
  }, []);

  const reversePlayback = useCallback(() => {
    if (getTimelineDuration(useEditorStore.getState().project.timeline) === 0) {
      return;
    }
    const state = useEditorStore.getState();
    state.setPlaybackRate(-1);
    state.setIsPlaying(true);
  }, []);

  const pausePlayback = useCallback(() => useEditorStore.getState().setIsPlaying(false), []);

  const forwardPlayback = useCallback(() => {
    if (getTimelineDuration(useEditorStore.getState().project.timeline) === 0) {
      return;
    }
    const state = useEditorStore.getState();
    state.setPlaybackRate(1);
    state.setIsPlaying(true);
  }, []);

  const stepFrame = useCallback(
    (direction: -1 | 1) => {
      const state = useEditorStore.getState();
      const fps = state.project.settings.fps || 30;
      state.setIsPlaying(false);
      state.setPlaybackRate(1);
      state.setPlayheadTime(state.playheadTime + direction / fps);
    },
    []
  );

  // --- 标注与书签 ---
  const addAnnotationAtPlayhead = useCallback(() => {
    const state = useEditorStore.getState();
    try {
      commandManager.execute(
        new AddProjectAnnotationCommand(projectAccessor, {
          time: state.playheadTime,
          text: zhCN.timeline.annotationLabel((state.project.annotations?.length ?? 0) + 1),
          color: DEFAULT_PROJECT_ANNOTATION_COLOR
        })
      );
    } catch (error) {
      showToast({ kind: 'warning', title: zhCN.timeline.annotationRejectedTitle, message: error instanceof Error ? error.message : zhCN.timeline.addAnnotationFailed });
    }
  }, []);

  const addReviewAnnotationAtPlayhead = useCallback((annotation: Omit<ReviewAnnotation, 'id'> & Partial<Pick<ReviewAnnotation, 'id'>>) => {
    try {
      commandManager.execute(
        new AddReviewAnnotationCommand(projectAccessor, {
          ...annotation,
          color: annotation.color ?? DEFAULT_REVIEW_ANNOTATION_COLOR
        })
      );
      showToast({ kind: 'success', title: zhCN.preview.reviewAnnotationAdded, message: annotation.text });
    } catch (error) {
      showToast({ kind: 'warning', title: zhCN.preview.reviewAnnotationFailedTitle, message: error instanceof Error ? error.message : zhCN.preview.reviewAnnotationFailedMessage });
    }
  }, []);

  const createReviewReport = useCallback(async () => {
    try {
      const outputPath = await saveReviewReport(useEditorStore.getState().project);
      if (outputPath) {
        showToast({ kind: 'success', title: zhCN.preview.reviewReportSaved, message: outputPath });
      }
    } catch (error) {
      showToast({ kind: 'error', title: zhCN.preview.reviewReportFailedTitle, message: error instanceof Error ? error.message : zhCN.preview.reviewReportFailedMessage });
    }
  }, []);

  const addBookmarkAtPlayhead = useCallback(() => {
    const state = useEditorStore.getState();
    try {
      commandManager.execute(
        new AddProjectBookmarkCommand(projectAccessor, {
          id: createId('bookmark'),
          time: state.playheadTime,
          note: zhCN.timeline.bookmarkLabel((state.project.bookmarks?.length ?? 0) + 1)
        })
      );
    } catch (error) {
      showToast({ kind: 'warning', title: zhCN.timeline.bookmarkRejectedTitle, message: error instanceof Error ? error.message : zhCN.timeline.addBookmarkFailed });
    }
  }, []);

  const jumpTimelineNavigationPoint = useCallback(
    (direction: 'previous' | 'next') => {
      const state = useEditorStore.getState();
      const points = buildTimelineNavigationPoints(state.project.bookmarks, state.project.timeline.markers, getTimelineDuration(state.project.timeline));
      const point = findTimelineNavigationPoint(points, state.playheadTime, direction);
      if (point) {
        state.setPlayheadTime(point.time);
      }
    },
    []
  );

  const exportBookmarks = useCallback(async () => {
    try {
      const state = useEditorStore.getState();
      const outputPath = await bridgeSaveFileDialog(`${state.project.name}-bookmarks.json`, [{ name: zhCN.fileDialogs.bookmarks, extensions: ['json'] }]);
      if (!outputPath) {
        return;
      }
      await bridgeWriteFile(outputPath, serializeTimelineBookmarks(state.project.bookmarks ?? [], getTimelineDuration(state.project.timeline)));
      showToast({ kind: 'success', title: zhCN.timeline.bookmarksExported, message: outputPath });
    } catch (error) {
      showToast({ kind: 'warning', title: zhCN.timeline.bookmarksExportFailed, message: error instanceof Error ? error.message : zhCN.timeline.bookmarksExportFailedMessage });
    }
  }, []);

  const importBookmarks = useCallback(async () => {
    try {
      const paths = await bridgeOpenFileDialog(false, [{ name: zhCN.fileDialogs.bookmarks, extensions: ['json'] }]);
      const inputPath = paths[0];
      if (!inputPath) {
        return;
      }
      const state = useEditorStore.getState();
      const imported = parseTimelineBookmarksJson(await bridgeReadFile(inputPath), getTimelineDuration(state.project.timeline));
      const nextBookmarks = mergeImportedTimelineBookmarks(state.project.bookmarks ?? [], imported, getTimelineDuration(state.project.timeline));
      commandManager.execute(new UpdateProjectBookmarksCommand(projectAccessor, nextBookmarks));
      showToast({ kind: 'success', title: zhCN.timeline.bookmarksImported, message: zhCN.timeline.bookmarksImportedMessage(imported.length) });
    } catch (error) {
      showToast({ kind: 'warning', title: zhCN.timeline.bookmarksImportFailed, message: error instanceof Error ? error.message : zhCN.timeline.bookmarksImportFailedMessage });
    }
  }, []);

  // --- 导出范围 ---
  const setSingleExportRange = useCallback((start: number, end: number) => {
    const state = useEditorStore.getState();
    const duration = getTimelineDuration(state.project.timeline);
    const range = createExportRange(
      {
        id: state.project.exportRanges[0]?.id,
        label: zhCN.timeline.exportRangeLabel(1),
        start,
        end
      },
      duration
    );
    if (range.end <= range.start) {
      return;
    }
    commandManager.execute(new UpdateProjectExportRangesCommand(projectAccessor, [range]));
  }, []);

  const appendExportRange = useCallback((start: number, end: number) => {
    const state = useEditorStore.getState();
    const duration = getTimelineDuration(state.project.timeline);
    const existing = normalizeExportRanges(state.project.exportRanges, duration);
    const range = createExportRange(
      {
        label: zhCN.timeline.exportRangeLabel(existing.length + 1),
        start,
        end
      },
      duration
    );
    if (range.end <= range.start) {
      return;
    }
    commandManager.execute(new UpdateProjectExportRangesCommand(projectAccessor, [...existing, range]));
  }, []);

  const markInPoint = useCallback(() => {
    const state = useEditorStore.getState();
    const time = state.playheadTime;
    state.setInPoint(time);
    if (typeof state.outPoint === 'number') {
      setSingleExportRange(time, state.outPoint);
    }
  }, [setSingleExportRange]);

  const markOutPoint = useCallback(() => {
    const state = useEditorStore.getState();
    const time = state.playheadTime;
    state.setOutPoint(time);
    if (typeof state.inPoint === 'number') {
      setSingleExportRange(state.inPoint, time);
    }
  }, [setSingleExportRange]);

  const markMultiRangeInPoint = useCallback(() => {
    useEditorStore.getState().setInPoint(useEditorStore.getState().playheadTime);
  }, []);

  const markMultiRangeOutPoint = useCallback(() => {
    const state = useEditorStore.getState();
    const time = state.playheadTime;
    state.setOutPoint(time);
    if (typeof state.inPoint === 'number') {
      appendExportRange(state.inPoint, time);
    }
  }, [appendExportRange]);

  return {
    undo,
    switchToPreviousHistoryBranch,
    redo,
    togglePlayback,
    reversePlayback,
    pausePlayback,
    forwardPlayback,
    stepFrame,
    addAnnotationAtPlayhead,
    addReviewAnnotationAtPlayhead,
    createReviewReport,
    addBookmarkAtPlayhead,
    jumpTimelineNavigationPoint,
    exportBookmarks,
    importBookmarks,
    setSingleExportRange,
    appendExportRange,
    markInPoint,
    markOutPoint,
    markMultiRangeInPoint,
    markMultiRangeOutPoint,
  };
}
