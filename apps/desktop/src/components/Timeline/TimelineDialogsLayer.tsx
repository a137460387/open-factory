import React from 'react';
import {
  UpdateClipCommand,
  UpdateProjectBeatSnapSuggestionsCommand,
  applyBeatSnapToClip,
} from '@open-factory/editor-core';
import { X } from 'lucide-react';
import { zhCN } from '../../i18n/strings';
import { commandManager, projectAccessor, timelineAccessor } from '../../store/commandManager';
import { useEditorStore } from '../../store/editorStore';
import { AnnotationListPanel, BookmarkListPanel, TimelineNoteListPanel } from './TimelineOverlays';
import {
  AnnotationEditorDialog,
  TimelineNoteEditorDialog,
  ReplaceMediaDialog,
  SilenceDetectionDialog,
  SceneDetectionDialog,
  CoverFramePickerDialog,
  WhisperGenerationDialog,
  DialogueDetectionPanel,
} from './TimelineDialogs';

interface TimelineDialogsLayerProps {
  // Silence detection
  silenceDialog: { clip: any; asset: any } | undefined;
  setSilenceDialog: (v: undefined) => void;
  applySilenceRemoval: (clipId: string, ranges: any[]) => void;

  // Scene detection
  sceneDialog: any;
  setSceneDialog: (v: any) => void;
  startSceneDetection: () => void;
  cancelCurrentSceneDetection: () => void;
  applySceneDetectionResult: () => void;

  // Cover frame
  coverFrameDialog: any;
  setCoverFrameDialog: (v: undefined) => void;
  applyProjectCoverFrame: (v: any) => void;

  // Whisper
  whisperDialog: { progress: any; clip: { name: string } } | undefined;

  // Subtitle align report
  subtitleAlignReport: { correctedCount: number; averageOffsetMs: number } | undefined;

  // Dialogue detection
  dialoguePanelOpen: boolean;
  setDialoguePanelOpen: (v: boolean) => void;
  dialogueMarkers: any[];
  dialogueMisses: any[];
  runDialogueDetection: (sensitivity: any) => void | Promise<void>;
  generateDialogueSubtitles: () => void;

  // Beat snap
  beatSnapPanelOpen: boolean;
  setBeatSnapPanelOpen: (v: boolean) => void;
  project: any;

  // Replace media
  replaceMediaDialog: any;
  setReplaceMediaDialog: (v: any) => void;
  confirmReplaceMedia: () => void;

  // Reframe
  reframeDialog: { clipId: string } | undefined;
  setReframeDialog: (v: undefined) => void;
  applyAiReframe: (clipId: string, aspect: 'source' | '16:9' | '9:16' | '1:1' | '4:5' | '21:9') => void;

  // Transition
  transitionDialog: { clipId: string; adjacentClipId: string; recommendations: any[] } | undefined;
  setTransitionDialog: (v: undefined) => void;
  applyAiTransition: (clipId: string, adjacentClipId: string, rec: any) => void;

  // Annotations
  annotationPanelOpen: boolean;
  annotationMode: boolean;
  openAnnotationEditorAt: (time: number, annotation?: any) => void;
  removeProjectAnnotation: (id: string) => void;
  setPlayheadTime: (time: number) => void;

  // Bookmarks
  bookmarkPanelOpen: boolean;
  bookmarkRename: { id: string; note: string } | undefined;
  setBookmarkRename: (v: any) => void;
  renameProjectBookmark: (bookmarkId: string, note: string) => void;
  removeProjectBookmark: (id: string) => void;

  // Timeline notes
  timelineNotePanelOpen: boolean;
  filteredTimelineNotes: any[];
  timelineNoteSearch: string;
  setTimelineNoteSearch: (v: string) => void;
  openTimelineNoteEditor: (start: number, end: number, note?: any) => void;
  removeTimelineNote: (id: string) => void;
  exportTimelineNotesCsv: () => void;

  // Annotation editor
  annotationEditor: any;
  setAnnotationEditor: (v: any) => void;
  saveAnnotationEditor: (next: any) => void;

  // Timeline note editor
  timelineNoteEditor: any;
  setTimelineNoteEditor: (v: any) => void;
  saveTimelineNoteEditor: (next: any) => void;
}

export const TimelineDialogsLayer = React.memo(function TimelineDialogsLayer({
  silenceDialog,
  setSilenceDialog,
  applySilenceRemoval,
  sceneDialog,
  setSceneDialog,
  startSceneDetection,
  cancelCurrentSceneDetection,
  applySceneDetectionResult,
  coverFrameDialog,
  setCoverFrameDialog,
  applyProjectCoverFrame,
  whisperDialog,
  subtitleAlignReport,
  dialoguePanelOpen,
  setDialoguePanelOpen,
  dialogueMarkers,
  dialogueMisses,
  runDialogueDetection,
  generateDialogueSubtitles,
  beatSnapPanelOpen,
  setBeatSnapPanelOpen,
  project,
  replaceMediaDialog,
  setReplaceMediaDialog,
  confirmReplaceMedia,
  reframeDialog,
  setReframeDialog,
  applyAiReframe,
  transitionDialog,
  setTransitionDialog,
  applyAiTransition,
  annotationPanelOpen,
  annotationMode,
  openAnnotationEditorAt,
  removeProjectAnnotation,
  setPlayheadTime,
  bookmarkPanelOpen,
  bookmarkRename,
  setBookmarkRename,
  renameProjectBookmark,
  removeProjectBookmark,
  timelineNotePanelOpen,
  filteredTimelineNotes,
  timelineNoteSearch,
  setTimelineNoteSearch,
  openTimelineNoteEditor,
  removeTimelineNote,
  exportTimelineNotesCsv,
  annotationEditor,
  setAnnotationEditor,
  saveAnnotationEditor,
  timelineNoteEditor,
  setTimelineNoteEditor,
  saveTimelineNoteEditor,
}: TimelineDialogsLayerProps) {
  return (
    <>
      {silenceDialog ? (
        <SilenceDetectionDialog
          clip={silenceDialog.clip}
          asset={silenceDialog.asset}
          onClose={() => setSilenceDialog(undefined)}
          onApply={(ranges) => applySilenceRemoval(silenceDialog.clip.id, ranges)}
        />
      ) : null}
      {sceneDialog ? (
        <SceneDetectionDialog
          state={sceneDialog}
          onChange={setSceneDialog}
          onDetect={() => void startSceneDetection()}
          onCancelDetect={() => void cancelCurrentSceneDetection()}
          onApply={applySceneDetectionResult}
          onClose={() => setSceneDialog(undefined)}
        />
      ) : null}
      {coverFrameDialog ? (
        <CoverFramePickerDialog
          state={coverFrameDialog}
          onSelect={applyProjectCoverFrame}
          onClose={() => setCoverFrameDialog(undefined)}
        />
      ) : null}
      {whisperDialog ? (
        <WhisperGenerationDialog progress={whisperDialog.progress} clipName={whisperDialog.clip.name} />
      ) : null}
      {subtitleAlignReport ? (
        <div
          className="fixed bottom-4 right-4 z-40 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 shadow-soft"
          data-testid="subtitle-align-report"
        >
          {zhCN.timeline.subtitleAlignmentReport(
            subtitleAlignReport.correctedCount,
            subtitleAlignReport.averageOffsetMs,
          )}
        </div>
      ) : null}
      {dialoguePanelOpen ? (
        <DialogueDetectionPanel
          markers={dialogueMarkers}
          misses={dialogueMisses}
          onRun={(sensitivity) => void runDialogueDetection(sensitivity)}
          onGenerateSubtitles={generateDialogueSubtitles}
          onClose={() => setDialoguePanelOpen(false)}
        />
      ) : null}
      {beatSnapPanelOpen && (project.beatSnapSuggestions ?? []).length > 0 ? (
        <div
          className="absolute right-2 top-16 z-40 w-72 rounded-lg border border-line bg-surface p-3 shadow-soft"
          data-testid="beat-snap-suggestions-panel"
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold" data-testid="beat-snap-suggestions-count">
              {zhCN.editorToasts.beatSnapApplyAll} ({(project.beatSnapSuggestions ?? []).length})
            </span>
            <button
              className="text-xs text-muted hover:text-foreground"
              onClick={() => setBeatSnapPanelOpen(false)}
              data-testid="beat-snap-panel-close"
            >
              <X size={14} />
            </button>
          </div>
          <div className="max-h-40 space-y-1 overflow-y-auto">
            {(project.beatSnapSuggestions ?? []).map((suggestion: any) => (
              <div
                key={`${suggestion.clipId}-${suggestion.edge}`}
                className="flex items-center justify-between rounded border border-line px-2 py-1 text-xs"
                data-testid={`beat-snap-suggestion-${suggestion.clipId}-${suggestion.edge}`}
              >
                <span>
                  {zhCN.editorToasts.beatSnapSuggestHint(
                    suggestion.edge === 'in' ? '入' : '出',
                    suggestion.suggestedTime.toFixed(2) + 's',
                  )}
                </span>
                <div className="flex gap-1">
                  <button
                    className="rounded bg-brand px-1.5 py-0.5 text-[10px] text-white hover:opacity-80"
                    data-testid={`beat-snap-apply-suggestion-${suggestion.clipId}-${suggestion.edge}`}
                    onClick={() => {
                      const currentProject = useEditorStore.getState().project;
                      const clips = currentProject.timeline.tracks.flatMap((t) => t.clips);
                      const clip = clips.find((c) => c.id === suggestion.clipId);
                      if (!clip) return;
                      const updated = applyBeatSnapToClip(clip, suggestion.edge, suggestion.suggestedTime);
                      const remaining = (currentProject.beatSnapSuggestions ?? []).filter(
                        (s) => !(s.clipId === suggestion.clipId && s.edge === suggestion.edge),
                      );
                      commandManager.execute(new UpdateClipCommand(timelineAccessor, clip.id, updated));
                      commandManager.execute(new UpdateProjectBeatSnapSuggestionsCommand(projectAccessor, remaining));
                    }}
                  >
                    {zhCN.editorToasts.beatSnapApplySuggestion}
                  </button>
                  <button
                    className="rounded border border-line px-1.5 py-0.5 text-[10px] hover:bg-panel"
                    data-testid={`beat-snap-dismiss-${suggestion.clipId}-${suggestion.edge}`}
                    onClick={() => {
                      const currentProject = useEditorStore.getState().project;
                      const remaining = (currentProject.beatSnapSuggestions ?? []).filter(
                        (s) => !(s.clipId === suggestion.clipId && s.edge === suggestion.edge),
                      );
                      commandManager.execute(new UpdateProjectBeatSnapSuggestionsCommand(projectAccessor, remaining));
                    }}
                  >
                    {zhCN.editorToasts.beatSnapDismiss}
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button
            className="mt-2 w-full rounded bg-brand px-2 py-1 text-xs text-white hover:opacity-80"
            data-testid="beat-snap-apply-all"
            onClick={() => {
              const currentProject = useEditorStore.getState().project;
              const clips = currentProject.timeline.tracks.flatMap((t) => t.clips);
              for (const suggestion of currentProject.beatSnapSuggestions ?? []) {
                const clip = clips.find((c) => c.id === suggestion.clipId);
                if (clip) {
                  const updated = applyBeatSnapToClip(clip, suggestion.edge, suggestion.suggestedTime);
                  commandManager.execute(new UpdateClipCommand(timelineAccessor, clip.id, updated));
                }
              }
              commandManager.execute(new UpdateProjectBeatSnapSuggestionsCommand(projectAccessor, []));
            }}
          >
            {zhCN.editorToasts.beatSnapApplyAll}
          </button>
        </div>
      ) : null}
      {replaceMediaDialog ? (
        <ReplaceMediaDialog
          value={replaceMediaDialog}
          onChange={setReplaceMediaDialog}
          onCancel={() => setReplaceMediaDialog(undefined)}
          onConfirm={confirmReplaceMedia}
        />
      ) : null}
      {reframeDialog ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" data-testid="reframe-dialog">
          <div className="w-[320px] rounded-lg border border-line bg-[var(--color-bg-elevated)] p-4 shadow-soft">
            <h3 className="mb-3 text-sm font-semibold">{zhCN.aiReframe.title}</h3>
            <p className="mb-3 text-xs text-[var(--color-text-muted)]">{zhCN.aiReframe.chooseAspect}</p>
            <div className="grid grid-cols-2 gap-2">
              {(['16:9', '9:16', '1:1', '4:5'] as const).map((aspect) => (
                <button
                  key={aspect}
                  className="rounded border border-line px-3 py-2 text-xs font-medium hover:bg-panel"
                  data-testid={`reframe-aspect-${aspect}`}
                  onClick={() => applyAiReframe(reframeDialog.clipId, aspect)}
                >
                  {aspect}
                </button>
              ))}
            </div>
            <button
              className="mt-3 w-full rounded border border-line px-3 py-1.5 text-xs hover:bg-panel"
              onClick={() => setReframeDialog(undefined)}
              data-testid="reframe-cancel"
            >
              {zhCN.aiReframe.cancel}
            </button>
          </div>
        </div>
      ) : null}
      {transitionDialog ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          data-testid="transition-dialog"
        >
          <div className="w-[360px] rounded-lg border border-line bg-[var(--color-bg-elevated)] p-4 shadow-soft">
            <h3 className="mb-3 text-sm font-semibold">{zhCN.aiTransitionRecommend.title}</h3>
            <div className="space-y-2">
              {transitionDialog.recommendations.map((rec, index) => (
                <button
                  key={`${rec.transitionType}-${index}`}
                  className="flex w-full items-center justify-between rounded border border-line px-3 py-2 text-left text-xs hover:bg-panel"
                  data-testid={`transition-candidate-${index}`}
                  onClick={() => applyAiTransition(transitionDialog.clipId, transitionDialog.adjacentClipId, rec)}
                >
                  <span className="font-medium">{rec.transitionType}</span>
                  <span className="text-[var(--color-text-muted)]">
                    {rec.duration}s · {rec.reason}
                  </span>
                </button>
              ))}
            </div>
            <button
              className="mt-3 w-full rounded border border-line px-3 py-1.5 text-xs hover:bg-panel"
              onClick={() => setTransitionDialog(undefined)}
              data-testid="transition-cancel"
            >
              {zhCN.common.cancel}
            </button>
          </div>
        </div>
      ) : null}
      {annotationPanelOpen && (annotationMode || (project.annotations?.length ?? 0) > 0) ? (
        <AnnotationListPanel
          annotations={project.annotations ?? []}
          onSeek={setPlayheadTime}
          onEdit={(annotation) => openAnnotationEditorAt(annotation.time, annotation)}
          onRemove={removeProjectAnnotation}
        />
      ) : null}
      {bookmarkPanelOpen && (project.bookmarks?.length ?? 0) > 0 ? (
        <BookmarkListPanel
          bookmarks={project.bookmarks ?? []}
          editing={bookmarkRename}
          onSeek={setPlayheadTime}
          onBeginRename={(bookmark) => setBookmarkRename({ id: bookmark.id, note: bookmark.note })}
          onChangeRename={setBookmarkRename}
          onSaveRename={renameProjectBookmark}
          onCancelRename={() => setBookmarkRename(undefined)}
          onRemove={removeProjectBookmark}
        />
      ) : null}
      {timelineNotePanelOpen ? (
        <TimelineNoteListPanel
          notes={filteredTimelineNotes}
          search={timelineNoteSearch}
          fps={project.settings.fps || 30}
          timecodeFormat={project.settings.timecodeFormat ?? 'ndf'}
          onSearch={setTimelineNoteSearch}
          onSeek={setPlayheadTime}
          onEdit={(note) => openTimelineNoteEditor(note.start, note.end, note)}
          onRemove={removeTimelineNote}
          onExportCsv={() => void exportTimelineNotesCsv()}
        />
      ) : null}
      {annotationEditor ? (
        <AnnotationEditorDialog
          value={annotationEditor}
          onChange={setAnnotationEditor}
          onCancel={() => setAnnotationEditor(undefined)}
          onSave={saveAnnotationEditor}
        />
      ) : null}
      {timelineNoteEditor ? (
        <TimelineNoteEditorDialog
          value={timelineNoteEditor}
          onChange={setTimelineNoteEditor}
          onCancel={() => setTimelineNoteEditor(undefined)}
          onSave={saveTimelineNoteEditor}
        />
      ) : null}
    </>
  );
});
