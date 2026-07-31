import {useEffect, useState} from 'react';
import {zhCN} from '../../i18n/strings';
import {getWhisperAvailability, type WhisperAvailability} from '../../lib/whisper';
import {useWhisperSettingsStore} from '../../store/whisperSettingsStore';
import {readTimelineInteractionSettings} from '../../settings/appSettings';
import {type DragState} from './TimelineParts';
import type {TransitionMenuState, ClipMenuState, VolumeEnvelopeMenuState, GapMenuState, RulerMenuState, TrackBatchMenuState} from './TimelineMenus';
import type {ReplaceMediaDialogState, SilenceDialogState, SceneDialogState, WhisperDialogState, CoverFrameDialogState, AnnotationEditorState, TimelineNoteEditorState} from './TimelineDialogs';
import type {TimelineNoteDraftState, BookmarkRenameState} from './TimelineOverlays';
import type {TimelineStateParams} from './timelineStateTypes';
import {logger} from '@open-factory/editor-core/utils';

export interface UIStateOutput {
  drag: DragState | undefined;
  setDrag: React.Dispatch<React.SetStateAction<DragState | undefined>>;
  snapHighlight: import('@open-factory/editor-core').TimelineSnapHighlight | undefined;
  setSnapHighlight: React.Dispatch<React.SetStateAction<import('@open-factory/editor-core').TimelineSnapHighlight | undefined>>;
  selectionRect: import('@open-factory/editor-core').SelectionRect | undefined;
  setSelectionRect: React.Dispatch<React.SetStateAction<import('@open-factory/editor-core').SelectionRect | undefined>>;
  selectionStart: {x: number; y: number} | undefined;
  setSelectionStart: React.Dispatch<React.SetStateAction<{x: number; y: number} | undefined>>;
  transitionMenu: TransitionMenuState | undefined;
  setTransitionMenu: React.Dispatch<React.SetStateAction<TransitionMenuState | undefined>>;
  clipMenu: ClipMenuState | undefined;
  setClipMenu: React.Dispatch<React.SetStateAction<ClipMenuState | undefined>>;
  volumeEnvelopeMenu: VolumeEnvelopeMenuState | undefined;
  setVolumeEnvelopeMenu: React.Dispatch<React.SetStateAction<VolumeEnvelopeMenuState | undefined>>;
  gapMenu: GapMenuState | undefined;
  setGapMenu: React.Dispatch<React.SetStateAction<GapMenuState | undefined>>;
  rulerMenu: RulerMenuState | undefined;
  setRulerMenu: React.Dispatch<React.SetStateAction<RulerMenuState | undefined>>;
  silenceDialog: SilenceDialogState | undefined;
  setSilenceDialog: React.Dispatch<React.SetStateAction<SilenceDialogState | undefined>>;
  sceneDialog: SceneDialogState | undefined;
  setSceneDialog: React.Dispatch<React.SetStateAction<SceneDialogState | undefined>>;
  coverFrameDialog: CoverFrameDialogState | undefined;
  setCoverFrameDialog: React.Dispatch<React.SetStateAction<CoverFrameDialogState | undefined>>;
  whisperDialog: WhisperDialogState | undefined;
  setWhisperDialog: React.Dispatch<React.SetStateAction<WhisperDialogState | undefined>>;
  subtitleAlignReport: {correctedCount: number; averageOffsetMs: number} | undefined;
  setSubtitleAlignReport: React.Dispatch<React.SetStateAction<{correctedCount: number; averageOffsetMs: number} | undefined>>;
  dialoguePanelOpen: boolean;
  setDialoguePanelOpen: React.Dispatch<React.SetStateAction<boolean>>;
  dialogueMarkers: import('@open-factory/editor-core').DialogueInterval[];
  setDialogueMarkers: React.Dispatch<React.SetStateAction<import('@open-factory/editor-core').DialogueInterval[]>>;
  dialogueMisses: import('@open-factory/editor-core').DialogueWhisperMiss[];
  setDialogueMisses: React.Dispatch<React.SetStateAction<import('@open-factory/editor-core').DialogueWhisperMiss[]>>;
  replaceMediaDialog: ReplaceMediaDialogState | undefined;
  setReplaceMediaDialog: React.Dispatch<React.SetStateAction<ReplaceMediaDialogState | undefined>>;
  whisperAvailability: WhisperAvailability;
  setWhisperAvailability: React.Dispatch<React.SetStateAction<WhisperAvailability>>;
  rollingTrimActive: boolean;
  setRollingTrimActive: React.Dispatch<React.SetStateAction<boolean>>;
  slipEditActive: boolean;
  setSlipEditActive: React.Dispatch<React.SetStateAction<boolean>>;
  slideEditActive: boolean;
  setSlideEditActive: React.Dispatch<React.SetStateAction<boolean>>;
  annotationMode: boolean;
  setAnnotationMode: React.Dispatch<React.SetStateAction<boolean>>;
  annotationPanelOpen: boolean;
  setAnnotationPanelOpen: React.Dispatch<React.SetStateAction<boolean>>;
  annotationEditor: AnnotationEditorState | undefined;
  setAnnotationEditor: React.Dispatch<React.SetStateAction<AnnotationEditorState | undefined>>;
  timelineNotePanelOpen: boolean;
  setTimelineNotePanelOpen: React.Dispatch<React.SetStateAction<boolean>>;
  timelineNoteEditor: TimelineNoteEditorState | undefined;
  setTimelineNoteEditor: React.Dispatch<React.SetStateAction<TimelineNoteEditorState | undefined>>;
  timelineNoteSearch: string;
  setTimelineNoteSearch: React.Dispatch<React.SetStateAction<string>>;
  timelineNoteDraft: TimelineNoteDraftState | undefined;
  setTimelineNoteDraft: React.Dispatch<React.SetStateAction<TimelineNoteDraftState | undefined>>;
  localBookmarkPanelOpen: boolean;
  setLocalBookmarkPanelOpen: React.Dispatch<React.SetStateAction<boolean>>;
  bookmarkPanelOpen: boolean;
  setBookmarkPanelVisible: (next: boolean | ((open: boolean) => boolean)) => void;
  bookmarkRename: BookmarkRenameState | undefined;
  setBookmarkRename: React.Dispatch<React.SetStateAction<BookmarkRenameState | undefined>>;
  reframeDialog: {clipId: string} | undefined;
  setReframeDialog: React.Dispatch<React.SetStateAction<{clipId: string} | undefined>>;
  transitionDialog: {clipId: string; adjacentClipId: string; recommendations: import('@open-factory/editor-core').TransitionRecommendation[]} | undefined;
  setTransitionDialog: React.Dispatch<React.SetStateAction<{clipId: string; adjacentClipId: string; recommendations: import('@open-factory/editor-core').TransitionRecommendation[]} | undefined>>;
  timelineColorFilter: import('@open-factory/editor-core').TimelineLabelColor | null;
  setTimelineColorFilter: React.Dispatch<React.SetStateAction<import('@open-factory/editor-core').TimelineLabelColor | null>>;
  beatSnapEnabled: boolean;
  setBeatSnapEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  beatSnapPanelOpen: boolean;
  setBeatSnapPanelOpen: React.Dispatch<React.SetStateAction<boolean>>;
  envelopeEditMode: boolean;
  setEnvelopeEditMode: React.Dispatch<React.SetStateAction<boolean>>;
  selectedTrackIds: string[];
  setSelectedTrackIds: React.Dispatch<React.SetStateAction<string[]>>;
  trackSelectionAnchorId: string | undefined;
  setTrackSelectionAnchorId: React.Dispatch<React.SetStateAction<string | undefined>>;
  trackBatchMenu: TrackBatchMenuState | undefined;
  setTrackBatchMenu: React.Dispatch<React.SetStateAction<TrackBatchMenuState | undefined>>;
  gapStatsOpen: boolean;
  setGapStatsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  sequenceSettingsDialogOpen: boolean;
  setSequenceSettingsDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  audioScrubEnabled: boolean;
  setAudioScrubEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  equalHeightPrompt: boolean;
  setEqualHeightPrompt: React.Dispatch<React.SetStateAction<boolean>>;
  equalHeightValue: string;
  setEqualHeightValue: React.Dispatch<React.SetStateAction<string>>;
  scrollViewport: {scrollLeft: number; scrollTop: number; viewportWidth: number};
  setScrollViewport: React.Dispatch<React.SetStateAction<{scrollLeft: number; scrollTop: number; viewportWidth: number}>>;
  timelineViewportHeight: number;
  setTimelineViewportHeight: React.Dispatch<React.SetStateAction<number>>;
  heatmapSegments: import('@open-factory/editor-core').TimelineHeatmapSegment[];
  setHeatmapSegments: React.Dispatch<React.SetStateAction<import('@open-factory/editor-core').TimelineHeatmapSegment[]>>;
  isPanning: boolean;
  setIsPanning: React.Dispatch<React.SetStateAction<boolean>>;
  whisperExecutablePath: string;
  whisperModelPath: string;
}

export function useTimelineUIState(params: TimelineStateParams): UIStateOutput {
  const {
    bookmarkPanelOpen: controlledBookmarkPanelOpen,
    onBookmarkPanelOpenChange,
  } = params;

  const [drag, setDrag] = useState<DragState | undefined>();
  const [snapHighlight, setSnapHighlight] = useState<import('@open-factory/editor-core').TimelineSnapHighlight | undefined>();
  const [selectionRect, setSelectionRect] = useState<import('@open-factory/editor-core').SelectionRect | undefined>();
  const [selectionStart, setSelectionStart] = useState<{x: number; y: number} | undefined>();
  const [transitionMenu, setTransitionMenu] = useState<TransitionMenuState | undefined>();
  const [clipMenu, setClipMenu] = useState<ClipMenuState | undefined>();
  const [volumeEnvelopeMenu, setVolumeEnvelopeMenu] = useState<VolumeEnvelopeMenuState | undefined>();
  const [gapMenu, setGapMenu] = useState<GapMenuState | undefined>();
  const [rulerMenu, setRulerMenu] = useState<RulerMenuState | undefined>();
  const [silenceDialog, setSilenceDialog] = useState<SilenceDialogState | undefined>();
  const [sceneDialog, setSceneDialog] = useState<SceneDialogState | undefined>();
  const [coverFrameDialog, setCoverFrameDialog] = useState<CoverFrameDialogState | undefined>();
  const [whisperDialog, setWhisperDialog] = useState<WhisperDialogState | undefined>();
  const [subtitleAlignReport, setSubtitleAlignReport] = useState<{correctedCount: number; averageOffsetMs: number} | undefined>();
  const [dialoguePanelOpen, setDialoguePanelOpen] = useState(false);
  const [dialogueMarkers, setDialogueMarkers] = useState<import('@open-factory/editor-core').DialogueInterval[]>([]);
  const [dialogueMisses, setDialogueMisses] = useState<import('@open-factory/editor-core').DialogueWhisperMiss[]>([]);
  const [replaceMediaDialog, setReplaceMediaDialog] = useState<ReplaceMediaDialogState | undefined>();
  const [whisperAvailability, setWhisperAvailability] = useState<WhisperAvailability>({
    ready: false,
    error: zhCN.whisper.notConfigured,
  });
  const [rollingTrimActive, setRollingTrimActive] = useState(false);
  const [slipEditActive, setSlipEditActive] = useState(false);
  const [slideEditActive, setSlideEditActive] = useState(false);
  const [annotationMode, setAnnotationMode] = useState(false);
  const [annotationPanelOpen, setAnnotationPanelOpen] = useState(true);
  const [annotationEditor, setAnnotationEditor] = useState<AnnotationEditorState | undefined>();
  const [timelineNotePanelOpen, setTimelineNotePanelOpen] = useState(false);
  const [timelineNoteEditor, setTimelineNoteEditor] = useState<TimelineNoteEditorState | undefined>();
  const [timelineNoteSearch, setTimelineNoteSearch] = useState('');
  const [timelineNoteDraft, setTimelineNoteDraft] = useState<TimelineNoteDraftState | undefined>();
  const [localBookmarkPanelOpen, setLocalBookmarkPanelOpen] = useState(true);
  const bookmarkPanelOpen = controlledBookmarkPanelOpen ?? localBookmarkPanelOpen;
  const [bookmarkRename, setBookmarkRename] = useState<BookmarkRenameState | undefined>();
  const [reframeDialog, setReframeDialog] = useState<{clipId: string} | undefined>();
  const [transitionDialog, setTransitionDialog] = useState<
    {clipId: string; adjacentClipId: string; recommendations: import('@open-factory/editor-core').TransitionRecommendation[]} | undefined
  >();
  const [timelineColorFilter, setTimelineColorFilter] = useState<import('@open-factory/editor-core').TimelineLabelColor | null>(null);
  const [beatSnapEnabled, setBeatSnapEnabled] = useState(true);
  const [beatSnapPanelOpen, setBeatSnapPanelOpen] = useState(false);
  const [envelopeEditMode, setEnvelopeEditMode] = useState(false);
  const [selectedTrackIds, setSelectedTrackIds] = useState<string[]>([]);
  const [trackSelectionAnchorId, setTrackSelectionAnchorId] = useState<string | undefined>();
  const [trackBatchMenu, setTrackBatchMenu] = useState<TrackBatchMenuState | undefined>();
  const [gapStatsOpen, setGapStatsOpen] = useState(false);
  const [sequenceSettingsDialogOpen, setSequenceSettingsDialogOpen] = useState(false);
  const [audioScrubEnabled, setAudioScrubEnabled] = useState(true);
  const [equalHeightPrompt, setEqualHeightPrompt] = useState(false);
  const [equalHeightValue, setEqualHeightValue] = useState('48');
  const [scrollViewport, setScrollViewport] = useState({scrollLeft: 0, scrollTop: 0, viewportWidth: 960});
  const [timelineViewportHeight, setTimelineViewportHeight] = useState(240);
  const [heatmapSegments, setHeatmapSegments] = useState<import('@open-factory/editor-core').TimelineHeatmapSegment[]>([]);
  const [isPanning, setIsPanning] = useState(false);

  // useEffect - load audio scrub settings
  useEffect(() => {
    readTimelineInteractionSettings()
      .then((s: {audioScrubEnabled?: boolean}) => setAudioScrubEnabled(s.audioScrubEnabled !== false))
      .catch((error) => logger.warn('Unable to load timeline interaction settings', error));
  }, []);

  // useWhisperSettingsStore
  const whisperExecutablePath = useWhisperSettingsStore((state) => state.executablePath);
  const whisperModelPath = useWhisperSettingsStore((state) => state.modelPath);

  // Helper
  function setBookmarkPanelVisible(next: boolean | ((open: boolean) => boolean)): void {
    const resolved = typeof next === 'function' ? next(bookmarkPanelOpen) : next;
    setLocalBookmarkPanelOpen(resolved);
    onBookmarkPanelOpenChange?.(resolved);
  }

  return {
    drag,
    setDrag,
    snapHighlight,
    setSnapHighlight,
    selectionRect,
    setSelectionRect,
    selectionStart,
    setSelectionStart,
    transitionMenu,
    setTransitionMenu,
    clipMenu,
    setClipMenu,
    volumeEnvelopeMenu,
    setVolumeEnvelopeMenu,
    gapMenu,
    setGapMenu,
    rulerMenu,
    setRulerMenu,
    silenceDialog,
    setSilenceDialog,
    sceneDialog,
    setSceneDialog,
    coverFrameDialog,
    setCoverFrameDialog,
    whisperDialog,
    setWhisperDialog,
    subtitleAlignReport,
    setSubtitleAlignReport,
    dialoguePanelOpen,
    setDialoguePanelOpen,
    dialogueMarkers,
    setDialogueMarkers,
    dialogueMisses,
    setDialogueMisses,
    replaceMediaDialog,
    setReplaceMediaDialog,
    whisperAvailability,
    setWhisperAvailability,
    rollingTrimActive,
    setRollingTrimActive,
    slipEditActive,
    setSlipEditActive,
    slideEditActive,
    setSlideEditActive,
    annotationMode,
    setAnnotationMode,
    annotationPanelOpen,
    setAnnotationPanelOpen,
    annotationEditor,
    setAnnotationEditor,
    timelineNotePanelOpen,
    setTimelineNotePanelOpen,
    timelineNoteEditor,
    setTimelineNoteEditor,
    timelineNoteSearch,
    setTimelineNoteSearch,
    timelineNoteDraft,
    setTimelineNoteDraft,
    localBookmarkPanelOpen,
    setLocalBookmarkPanelOpen,
    bookmarkPanelOpen,
    setBookmarkPanelVisible,
    bookmarkRename,
    setBookmarkRename,
    reframeDialog,
    setReframeDialog,
    transitionDialog,
    setTransitionDialog,
    timelineColorFilter,
    setTimelineColorFilter,
    beatSnapEnabled,
    setBeatSnapEnabled,
    beatSnapPanelOpen,
    setBeatSnapPanelOpen,
    envelopeEditMode,
    setEnvelopeEditMode,
    selectedTrackIds,
    setSelectedTrackIds,
    trackSelectionAnchorId,
    setTrackSelectionAnchorId,
    trackBatchMenu,
    setTrackBatchMenu,
    gapStatsOpen,
    setGapStatsOpen,
    sequenceSettingsDialogOpen,
    setSequenceSettingsDialogOpen,
    audioScrubEnabled,
    setAudioScrubEnabled,
    equalHeightPrompt,
    setEqualHeightPrompt,
    equalHeightValue,
    setEqualHeightValue,
    scrollViewport,
    setScrollViewport,
    timelineViewportHeight,
    setTimelineViewportHeight,
    heatmapSegments,
    setHeatmapSegments,
    isPanning,
    setIsPanning,
    whisperExecutablePath,
    whisperModelPath,
  };
}
