import type { Clip, ClipGroup, ClipGroupColor, TimelineLabelColor } from '@open-factory/editor-core';
import {
  AddClipCommand,
  AddCreditsClipCommand,
  AddProjectAnnotationCommand,
  AddProjectBookmarkCommand,
  AddTimelineMarkerCommand,
  AddTimelineNoteCommand,
  AddTransitionCommand,
  CLIP_GROUP_COLORS,
  DEFAULT_PROJECT_ANNOTATION_COLOR,
  DEFAULT_TIMELINE_NOTE_COLOR,
  CreateClipGroupCommand,
  DeleteClipsCommand,
  DeleteGroupCommand,
  RemoveProjectAnnotationCommand,
  RemoveProjectBookmarkCommand,
  RemoveTimelineMarkerCommand,
  RemoveTimelineNoteCommand,
  RemoveTransitionCommand,
  RippleDeleteCommand,
  SplitClipCommand,
  UngroupCommand,
  UpdateClipCommand,
  UpdateClipGroupCommand,
  UpdateProjectAnnotationCommand,
  UpdateProjectBeatMarkersCommand,
  UpdateProjectBookmarkCommand,
  UpdateProjectProtectedRangesCommand,
  UpdateTimelineNoteCommand,
  createBeatMarker,
  createId,
  createProtectedRange,
  instantiateTitleTemplate,
  isFrameRateMismatch,
  parseTimecodeToSeconds,
  secondsToTimecode,
  serializeTimelineNotesCsv,
  snapTime,
  type ProjectAnnotation,
  type TimelineNote,
} from '@open-factory/editor-core';
import type { AnnotationEditorState, TimelineNoteEditorState } from '../../TimelineDialogs';
import type { RulerContextMenuAction } from '../../timeline-ruler-menu';
import { commandManager, projectAccessor, timelineAccessor } from '../../../../store/commandManager';
import { useEditorStore } from '../../../../store/editorStore';
import { zhCN } from '../../../../i18n/strings';
import { createCreditsClip, createTextClip } from '../../../../lib/clipFactory';
import { showToast } from '../../../../lib/toast';
import { saveFileDialog, writeFile } from '../../../../lib/tauri-bridge';
import type { TimelineHandlerParams } from './types';

export function createClipOperationsHandlers(
  params: TimelineHandlerParams,
  helpers: {
    findClip: (clipId: string) => Clip;
    getClipMediaAsset: (clip: Clip) => import('@open-factory/editor-core').MediaAsset | undefined;
    minFrameDuration: () => number;
  },
) {
  const {
    project,
    selectedClipId,
    selectedClipIds,
    setSelectedClipId,
    setSelectedClipIds,
    clearSelectedClipIds,
    clipGroups,
    selectedGroup,
    protectedRanges,
    timelineNotes,
    playheadTime,
    projectDuration,
    transitionMenu,
    setTransitionMenu,
    setClipMenu,
    setRulerMenu,
    setBookmarkRename,
    setBookmarkPanelVisible,
    setAnnotationEditor,
    setAnnotationPanelOpen,
    setTimelineNoteEditor,
    setTimelineNotePanelOpen,
    onConvertMediaFrameRate,
    setGapMenu,
    setVolumeEnvelopeMenu,
  } = params;

  const { findClip, getClipMediaAsset, minFrameDuration } = helpers;

  function updateClipColor(clipId: string, colorLabel: TimelineLabelColor | null): void {
    commandManager.execute(new UpdateClipCommand(timelineAccessor, clipId, { colorLabel }));
  }

  function convertClipFrameRate(clipId: string): void {
    const clip = findClip(clipId);
    const asset = getClipMediaAsset(clip);
    setClipMenu(undefined);
    setSelectedClipId(clip.id);
    if (
      !asset ||
      asset.type !== 'video' ||
      (!asset.variableFrameRate && !isFrameRateMismatch(asset.frameRate, project.settings.fps)) ||
      !onConvertMediaFrameRate
    ) {
      showToast({
        kind: 'warning',
        title: zhCN.timeline.frameRateConvertUnavailableTitle,
        message: zhCN.timeline.frameRateConvertUnavailableMessage,
      });
      return;
    }
    onConvertMediaFrameRate(asset.id);
  }

  // 转场菜单的添加/移除：同样是 d17ffe76 拆分时遗留的空壳，按原实现恢复。
  function addTransition(): void {
    if (!transitionMenu) {
      return;
    }
    try {
      commandManager.execute(
        new AddTransitionCommand(timelineAccessor, {
          type: transitionMenu.type,
          duration: transitionMenu.duration,
          fromClipId: transitionMenu.fromClipId,
          toClipId: transitionMenu.toClipId,
        }),
      );
      setTransitionMenu(undefined);
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.timeline.transitionUnavailableTitle,
        message: error instanceof Error ? error.message : zhCN.timeline.transitionUnavailableMessage,
      });
    }
  }

  function removeTransition(): void {
    if (!transitionMenu?.existingTransitionId) {
      return;
    }
    commandManager.execute(new RemoveTransitionCommand(timelineAccessor, transitionMenu.existingTransitionId));
    setTransitionMenu(undefined);
  }

  function addText(): void {
    const track = project.timeline.tracks.find((item) => item.type === 'text');
    if (!track) {
      showToast({ kind: 'warning', title: zhCN.timeline.noTextTrackTitle, message: zhCN.timeline.noTextTrackMessage });
      return;
    }
    const clip = createTextClip(track, project.timeline);
    commandManager.execute(new AddClipCommand(timelineAccessor, clip));
    setSelectedClipId(clip.id);
  }

  function addCredits(text?: string, start?: number): void {
    const track = project.timeline.tracks.find((item) => item.type === 'text');
    if (!track) {
      showToast({ kind: 'warning', title: zhCN.timeline.noTextTrackTitle, message: zhCN.timeline.noTextTrackMessage });
      return;
    }
    try {
      const clip = createCreditsClip(track, project.timeline, text, start);
      commandManager.execute(new AddCreditsClipCommand(timelineAccessor, clip));
      setSelectedClipId(clip.id);
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.timeline.editRejectedTitle,
        message: error instanceof Error ? error.message : zhCN.timeline.editRejectedMessage,
      });
    }
  }

  function addTitleTemplate(templateId: string, start?: number): void {
    const track = project.timeline.tracks.find((item) => item.type === 'text');
    if (!track) {
      showToast({ kind: 'warning', title: zhCN.timeline.noTextTrackTitle, message: zhCN.timeline.noTextTrackMessage });
      return;
    }
    try {
      const label = zhCN.titleTemplates[templateId as keyof typeof zhCN.titleTemplates];
      const clip = instantiateTitleTemplate(
        templateId as Parameters<typeof instantiateTitleTemplate>[0],
        track,
        project.timeline,
        {
          name: label.name,
          text: label.defaultText,
          start,
        },
      );
      commandManager.execute(new AddClipCommand(timelineAccessor, clip));
      setSelectedClipId(clip.id);
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.timeline.editRejectedTitle,
        message: error instanceof Error ? error.message : zhCN.timeline.editRejectedMessage,
      });
    }
  }

  function addTimelineMarker(time = playheadTime): void {
    try {
      commandManager.execute(
        new AddTimelineMarkerCommand(timelineAccessor, {
          id: createId('marker'),
          time,
          label: zhCN.timeline.markerLabel((project.timeline.markers?.length ?? 0) + 1),
        }),
      );
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.timeline.markerRejectedTitle,
        message: error instanceof Error ? error.message : zhCN.timeline.addMarkerFailed,
      });
    }
  }

  function addProjectBookmark(time = playheadTime): void {
    try {
      commandManager.execute(
        new AddProjectBookmarkCommand(projectAccessor, {
          id: createId('bookmark'),
          time,
          note: zhCN.timeline.bookmarkLabel((project.bookmarks?.length ?? 0) + 1),
        }),
      );
      setBookmarkPanelVisible(true);
      setAnnotationPanelOpen(false);
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.timeline.bookmarkRejectedTitle,
        message: error instanceof Error ? error.message : zhCN.timeline.addBookmarkFailed,
      });
    }
  }

  function renameProjectBookmark(bookmarkId: string, note: string): void {
    try {
      commandManager.execute(new UpdateProjectBookmarkCommand(projectAccessor, bookmarkId, { note }));
      setBookmarkRename(undefined);
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.timeline.bookmarkRejectedTitle,
        message: error instanceof Error ? error.message : zhCN.timeline.updateBookmarkFailed,
      });
    }
  }

  function removeProjectBookmark(bookmarkId: string): void {
    try {
      commandManager.execute(new RemoveProjectBookmarkCommand(projectAccessor, bookmarkId));
      setBookmarkRename((current) => (current?.id === bookmarkId ? undefined : current));
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.timeline.bookmarkRejectedTitle,
        message: error instanceof Error ? error.message : zhCN.timeline.removeBookmarkFailed,
      });
    }
  }

  function addProtectedRangeAt(time = playheadTime): void {
    try {
      const start = Math.max(0, time);
      const duration = Math.max(1, Math.min(2, Math.max(projectDuration, start + 2) - start));
      const nextRange = createProtectedRange(
        {
          id: createId('protected-range'),
          start,
          end: start + duration,
          label: zhCN.timeline.protectedRangeLabel((project.protectedRanges?.length ?? 0) + 1),
        },
        Math.max(projectDuration, start + duration),
      );
      commandManager.execute(new UpdateProjectProtectedRangesCommand(projectAccessor, [...protectedRanges, nextRange]));
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.timeline.editRejectedTitle,
        message: error instanceof Error ? error.message : zhCN.timeline.editRejectedMessage,
      });
    }
  }

  function toggleProtectedRangeAtPlayhead(): void {
    const existing = protectedRanges.find(
      (range) => playheadTime >= range.start - 0.000001 && playheadTime <= range.end + 0.000001,
    );
    if (existing) {
      commandManager.execute(
        new UpdateProjectProtectedRangesCommand(
          projectAccessor,
          protectedRanges.filter((range) => range.id !== existing.id),
        ),
      );
      return;
    }
    addProtectedRangeAt(playheadTime);
  }

  function openRulerMenu(request: { time: number; x: number; y: number }): void {
    setGapMenu(undefined);
    setClipMenu(undefined);
    setVolumeEnvelopeMenu(undefined);
    setTransitionMenu(undefined);
    setRulerMenu({
      x: Math.min(request.x, Math.max(0, window.innerWidth - 230)),
      y: Math.min(request.y, Math.max(0, window.innerHeight - 190)),
      time: request.time,
      timecode: secondsToTimecode(request.time, project.settings.fps || 30, project.settings.timecodeFormat ?? 'ndf'),
    });
  }

  // 标尺右键菜单动作：恢复 2026-07-28 拆分（d17ffe76）时遗留的空壳实现，
  // 原实现位于 useTimelineHandlers.ts，拆分时丢失导致 add-marker /
  // add-protected-range / set-in / set-out 全部静默失效。
  function runRulerMenuAction(action: RulerContextMenuAction): void {
    const menu = params.rulerMenu;
    if (!menu) {
      return;
    }
    if (action === 'add-marker') {
      addTimelineMarker(menu.time);
      setRulerMenu(undefined);
      return;
    }
    if (action === 'add-protected-range') {
      addProtectedRangeAt(menu.time);
      setRulerMenu(undefined);
      return;
    }
    if (action === 'set-in') {
      useEditorStore.getState().setInPoint(menu.time);
      setRulerMenu(undefined);
      return;
    }
    if (action === 'set-out') {
      useEditorStore.getState().setOutPoint(menu.time);
      setRulerMenu(undefined);
    }
  }

  function jumpToRulerTimecode(): void {
    const menu = params.rulerMenu;
    if (!menu) {
      return;
    }
    const parsed = parseTimecodeToSeconds(menu.timecode, {
      fps: project.settings.fps || 30,
      duration: projectDuration,
    });
    if (!parsed.ok) {
      showToast({
        kind: 'warning',
        title: zhCN.timeline.invalidTimecodeTitle,
        message: zhCN.timeline.invalidTimecodeMessage,
      });
      return;
    }
    params.setPlayheadTime(parsed.value.seconds);
    setRulerMenu(undefined);
  }

  function addBeatMarker(): void {
    try {
      commandManager.execute(
        new UpdateProjectBeatMarkersCommand(projectAccessor, [
          ...(project.beatMarkers ?? []),
          createBeatMarker(playheadTime),
        ]),
      );
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.timeline.beatMarkerRejectedTitle,
        message: error instanceof Error ? error.message : zhCN.timeline.addBeatMarkerFailed,
      });
    }
  }

  function removeBeatMarker(markerId: string): void {
    try {
      commandManager.execute(
        new UpdateProjectBeatMarkersCommand(
          projectAccessor,
          (project.beatMarkers ?? []).filter((marker) => marker.id !== markerId),
        ),
      );
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.timeline.beatMarkerRejectedTitle,
        message: error instanceof Error ? error.message : zhCN.timeline.removeBeatMarkerFailed,
      });
    }
  }

  function openAnnotationEditorAt(time: number, annotation?: ProjectAnnotation): void {
    setAnnotationEditor({
      id: annotation?.id,
      time: annotation?.time ?? Math.max(0, snapTime(time)),
      text: annotation?.text ?? zhCN.timeline.annotationLabel((project.annotations?.length ?? 0) + 1),
      color: annotation?.color ?? DEFAULT_PROJECT_ANNOTATION_COLOR,
    });
  }

  function saveAnnotationEditor(next: AnnotationEditorState): void {
    try {
      if (next.id) {
        commandManager.execute(
          new UpdateProjectAnnotationCommand(projectAccessor, next.id, {
            time: next.time,
            text: next.text,
            color: next.color,
          }),
        );
      } else {
        commandManager.execute(
          new AddProjectAnnotationCommand(projectAccessor, {
            time: next.time,
            text: next.text,
            color: next.color,
          }),
        );
      }
      setAnnotationEditor(undefined);
      setAnnotationPanelOpen(true);
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.timeline.annotationRejectedTitle,
        message:
          error instanceof Error
            ? error.message
            : next.id
              ? zhCN.timeline.updateAnnotationFailed
              : zhCN.timeline.addAnnotationFailed,
      });
    }
  }

  function removeProjectAnnotation(annotationId: string): void {
    try {
      commandManager.execute(new RemoveProjectAnnotationCommand(projectAccessor, annotationId));
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.timeline.annotationRejectedTitle,
        message: error instanceof Error ? error.message : zhCN.timeline.removeAnnotationFailed,
      });
    }
  }

  function openTimelineNoteEditor(start: number, end?: number, note?: TimelineNote): void {
    const normalizedStart = Math.max(0, snapTime(Math.min(start, end ?? start)));
    const normalizedEnd = Math.max(normalizedStart + minFrameDuration(), snapTime(Math.max(end ?? start + 1, start)));
    setTimelineNoteEditor({
      id: note?.id,
      start: note?.start ?? normalizedStart,
      end: note?.end ?? normalizedEnd,
      text: note?.text ?? zhCN.timeline.timelineNoteLabel(timelineNotes.length + 1),
      color: note?.color ?? DEFAULT_TIMELINE_NOTE_COLOR,
    });
  }

  function quickAddTimelineNote(): void {
    openTimelineNoteEditor(playheadTime, playheadTime + Math.max(1, minFrameDuration()));
    setTimelineNotePanelOpen(true);
    setAnnotationPanelOpen(false);
    setBookmarkPanelVisible(false);
  }

  function saveTimelineNoteEditor(next: TimelineNoteEditorState): void {
    try {
      if (next.id) {
        commandManager.execute(
          new UpdateTimelineNoteCommand(projectAccessor, next.id, {
            start: next.start,
            end: next.end,
            text: next.text,
            color: next.color,
          }),
        );
      } else {
        commandManager.execute(
          new AddTimelineNoteCommand(projectAccessor, {
            id: createId('timeline-note'),
            start: next.start,
            end: next.end,
            text: next.text,
            color: next.color,
          }),
        );
      }
      setTimelineNoteEditor(undefined);
      setTimelineNotePanelOpen(true);
      setAnnotationPanelOpen(false);
      setBookmarkPanelVisible(false);
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.timeline.timelineNoteRejectedTitle,
        message:
          error instanceof Error
            ? error.message
            : next.id
              ? zhCN.timeline.updateTimelineNoteFailed
              : zhCN.timeline.addTimelineNoteFailed,
      });
    }
  }

  function removeTimelineNote(noteId: string): void {
    try {
      commandManager.execute(new RemoveTimelineNoteCommand(projectAccessor, noteId));
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.timeline.timelineNoteRejectedTitle,
        message: error instanceof Error ? error.message : zhCN.timeline.removeTimelineNoteFailed,
      });
    }
  }

  function onTimelineNoteRangeDraft(start: number, end: number): void {
    openTimelineNoteEditor(start, end);
    setTimelineNotePanelOpen(true);
    setAnnotationPanelOpen(false);
    setBookmarkPanelVisible(false);
  }

  async function exportTimelineNotesCsv(): Promise<void> {
    try {
      const path = await saveFileDialog('timeline-notes.csv', [{ name: zhCN.fileDialogs.csv, extensions: ['csv'] }]);
      if (!path) {
        return;
      }
      await writeFile(path, serializeTimelineNotesCsv(timelineNotes, project.settings.fps || 30));
      showToast({ kind: 'success', title: zhCN.timeline.timelineNoteExported, message: path });
    } catch (error) {
      showToast({
        kind: 'error',
        title: zhCN.timeline.timelineNoteExportFailed,
        message: error instanceof Error ? error.message : zhCN.timeline.timelineNoteExportFailedMessage,
      });
    }
  }

  function removeTimelineMarker(markerId: string): void {
    try {
      commandManager.execute(new RemoveTimelineMarkerCommand(timelineAccessor, markerId));
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.timeline.markerRejectedTitle,
        message: error instanceof Error ? error.message : zhCN.timeline.removeMarkerFailed,
      });
    }
  }

  function splitSelected(): void {
    if (!selectedClipId) {
      return;
    }
    try {
      commandManager.execute(new SplitClipCommand(timelineAccessor, selectedClipId, playheadTime));
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.timeline.splitUnavailableTitle,
        message: error instanceof Error ? error.message : zhCN.timeline.splitUnavailableMessage,
      });
    }
  }

  function createGroupFromSelection(): void {
    if (selectedClipIds.length < 2) {
      showToast({
        kind: 'warning',
        title: zhCN.timeline.clipGroupCreateUnavailableTitle,
        message: zhCN.timeline.clipGroupCreateUnavailableMessage,
      });
      return;
    }
    try {
      const command = new CreateClipGroupCommand(projectAccessor, selectedClipIds, {
        name: zhCN.timeline.clipGroupDefaultName(clipGroups.length + 1),
        color: CLIP_GROUP_COLORS[clipGroups.length % CLIP_GROUP_COLORS.length],
      });
      commandManager.execute(command);
      setSelectedClipIds(command.group?.clipIds ?? selectedClipIds);
      setClipMenu(undefined);
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.timeline.editRejectedTitle,
        message: error instanceof Error ? error.message : zhCN.timeline.timelineRejectedMessage,
      });
    }
  }

  function ungroupSelected(group = selectedGroup): void {
    if (!group) {
      showToast({
        kind: 'warning',
        title: zhCN.timeline.clipGroupUngroupUnavailableTitle,
        message: zhCN.timeline.clipGroupUngroupUnavailableMessage,
      });
      return;
    }
    try {
      commandManager.execute(new UngroupCommand(projectAccessor, group.id));
      setSelectedClipIds(group.clipIds);
      setClipMenu(undefined);
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.timeline.editRejectedTitle,
        message: error instanceof Error ? error.message : zhCN.timeline.timelineRejectedMessage,
      });
    }
  }

  /**
   * 键盘删除聚焦中的 clip/分组后，被聚焦的 DOM 节点随渲染移除，焦点会落回
   * body，导致时间线快捷键 scope 判定失效（例如紧接着的 Ctrl+Z 撤销无法
   * 触发）。删除成功后把焦点收回时间线容器，保持键盘工作流连续。
   */
  function refocusTimelineRoot(): void {
    params.rootRef.current?.focus();
  }

  function deleteGroup(group: ClipGroup): void {
    try {
      commandManager.execute(new DeleteGroupCommand(projectAccessor, group.id));
      clearSelectedClipIds();
      setClipMenu(undefined);
      refocusTimelineRoot();
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.timeline.editRejectedTitle,
        message: error instanceof Error ? error.message : zhCN.timeline.timelineRejectedMessage,
      });
    }
  }

  function updateGroupColor(group: ClipGroup, color: ClipGroupColor): void {
    try {
      commandManager.execute(new UpdateClipGroupCommand(projectAccessor, group.id, { color }));
      setClipMenu(undefined);
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.timeline.editRejectedTitle,
        message: error instanceof Error ? error.message : zhCN.timeline.timelineRejectedMessage,
      });
    }
  }

  function deleteSelected(): void {
    if (selectedClipIds.length === 0) {
      return;
    }
    if (selectedGroup) {
      deleteGroup(selectedGroup);
      return;
    }
    commandManager.execute(new DeleteClipsCommand(timelineAccessor, selectedClipIds));
    clearSelectedClipIds();
    refocusTimelineRoot();
  }

  function rippleDeleteSelected(): void {
    if (selectedClipIds.length === 0) {
      return;
    }
    if (selectedGroup) {
      deleteGroup(selectedGroup);
      return;
    }
    commandManager.execute(new RippleDeleteCommand(timelineAccessor, selectedClipIds, project.protectedRanges));
    clearSelectedClipIds();
    refocusTimelineRoot();
  }

  return {
    updateClipColor,
    convertClipFrameRate,
    addTransition,
    removeTransition,
    addText,
    addCredits,
    addTitleTemplate,
    addTimelineMarker,
    addProjectBookmark,
    renameProjectBookmark,
    removeProjectBookmark,
    addProtectedRangeAt,
    toggleProtectedRangeAtPlayhead,
    openRulerMenu,
    runRulerMenuAction,
    jumpToRulerTimecode,
    addBeatMarker,
    removeBeatMarker,
    openAnnotationEditorAt,
    saveAnnotationEditor,
    removeProjectAnnotation,
    openTimelineNoteEditor,
    quickAddTimelineNote,
    saveTimelineNoteEditor,
    removeTimelineNote,
    onTimelineNoteRangeDraft,
    exportTimelineNotesCsv,
    removeTimelineMarker,
    splitSelected,
    createGroupFromSelection,
    ungroupSelected,
    deleteGroup,
    updateGroupColor,
    deleteSelected,
    rippleDeleteSelected,
  };
}
