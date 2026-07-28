import type {Clip, ClipGroup, ClipGroupColor, KeyframeProperty, GapFillStrategy, MediaAsset, ProjectAnnotation, TimelineNote, ProtectedRange, SilentRange, SelectionRect, TimelineGridSettings, TimelineLabelColor, MediaVersionEntry, DialogueInterval, DialogueSensitivity, DialogueWhisperMiss, Track, TrackPatch, ClipAIReframe, ReframeAIFrame, AnomalyInterval, FrameAnalysisSample, TransitionClipFeatures, TransitionRecommendation, TransitionType, TargetAspectRatio, TimelineSnapHighlight, TimelineSnapCandidate, SnapEdge} from '@open-factory/editor-core';
import type {TransitionMenuState, ClipMenuState, VolumeEnvelopeMenuState, GapMenuState, RulerMenuState, TrackBatchMenuState} from './TimelineMenus';
import type {ReplaceMediaDialogState, SilenceDialogState, SceneDialogState, WhisperDialogState, CoverFrameDialogState, AnnotationEditorState, TimelineNoteEditorState} from './TimelineDialogs';
import type {TimelineNoteDraftState, BookmarkRenameState} from './TimelineOverlays';
import type {ClipMenuRequest, DragState, GapMenuRequest, VolumeEnvelopeMenuRequest, VolumeEnvelopePointRequest} from './TimelineParts';
import type {RulerContextMenuAction} from './timeline-ruler-menu';
import type {WhisperAvailability} from '../../lib/whisper';
import type {useEditorStore, SelectedKeyframeRef} from '../../store/editorStore';
import type {CoverFrameResult} from '../../lib/tauri-bridge';

import type {TimelineHandlerParams, TimelineHandlers} from './hooks/timeline/types';
import {createTrackManagementHandlers} from './hooks/timeline/track-management';
import {createClipOperationsHandlers} from './hooks/timeline/clip-operations';
import {createDragHandlers} from './hooks/timeline/drag-handlers';
import {createSelectionHandlers} from './hooks/timeline/selection';
import {createNestedMediaHandlers} from './hooks/timeline/nested-media';
import {createGapHandlers} from './hooks/timeline/gap-handlers';
import {createVolumeEnvelopeHandlers} from './hooks/timeline/volume-envelope';
import {createAiFeatureHandlers} from './hooks/timeline/ai-features';
import {createNavigationHandlers} from './hooks/timeline/navigation';
import {createDropHandlers} from './hooks/timeline/drop-handlers';
import {createKeyboardHandlers} from './hooks/timeline/keyboard';
import {createSnapUtils} from './hooks/timeline/snap-utils';

export type {TimelineHandlerParams, TimelineHandlers} from './hooks/timeline/types';

export function useTimelineHandlers(params: TimelineHandlerParams): TimelineHandlers {
  // Create snap utilities first (needed by other handlers)
  const snapUtils = createSnapUtils(params, {
    findClip: (clipId: string) => {
      const clip = params.allClips.find((item) => item.id === clipId);
      if (!clip) throw new Error(`Clip ${clipId} not found`);
      return clip;
    },
    snapClipEnd: (time, clip, disabled) => {
      // Will be overridden by navigation handlers
      return time;
    },
    minFrameDuration: () => 1 / Math.max(1, params.project.settings.fps || 30),
  });

  // Create selection handlers
  const selectionHandlers = createSelectionHandlers(params, {
    findClipById: snapUtils.findClipById,
  });

  // Create navigation handlers
  const navigationHandlers = createNavigationHandlers(params, {
    findClip: (clipId: string) => {
      const clip = params.allClips.find((item) => item.id === clipId);
      if (!clip) throw new Error(`Clip ${clipId} not found`);
      return clip;
    },
    minFrameDuration: snapUtils.minFrameDuration,
  });

  // Create track management handlers
  const trackHandlers = createTrackManagementHandlers(params);

  // Create clip operations handlers
  const clipOpsHandlers = createClipOperationsHandlers(params, {
    findClip: (clipId: string) => {
      const clip = params.allClips.find((item) => item.id === clipId);
      if (!clip) throw new Error(`Clip ${clipId} not found`);
      return clip;
    },
    getClipMediaAsset: snapUtils.getClipMediaAsset,
    minFrameDuration: snapUtils.minFrameDuration,
  });

  // Create drag handlers
  const dragHandlers = createDragHandlers(params, {
    findClipById: snapUtils.findClipById,
    findClip: (clipId: string) => {
      const clip = params.allClips.find((item) => item.id === clipId);
      if (!clip) throw new Error(`Clip ${clipId} not found`);
      return clip;
    },
    getKeyframeTime: selectionHandlers.getKeyframeTime,
    buildKeyframeStartTimes: selectionHandlers.buildKeyframeStartTimes,
    snapKeyframeTime: navigationHandlers.snapKeyframeTime,
    snapClipStart: navigationHandlers.snapClipStart,
    buildMovedPreviewTimeline: snapUtils.buildMovedPreviewTimeline,
    buildTrimPreview: snapUtils.buildTrimPreview,
    minFrameDuration: snapUtils.minFrameDuration,
    canApplyProtectedMove: selectionHandlers.canApplyProtectedMove,
    warnProtectedRangeBlocked: selectionHandlers.warnProtectedRangeBlocked,
  });

  // Create nested/media handlers
  const nestedMediaHandlers = createNestedMediaHandlers(params, {
    findClip: (clipId: string) => {
      const clip = params.allClips.find((item) => item.id === clipId);
      if (!clip) throw new Error(`Clip ${clipId} not found`);
      return clip;
    },
    getClipMediaAsset: snapUtils.getClipMediaAsset,
  });

  // Create gap handlers
  const gapHandlers = createGapHandlers(params, {
    findClip: (clipId: string) => {
      const clip = params.allClips.find((item) => item.id === clipId);
      if (!clip) throw new Error(`Clip ${clipId} not found`);
      return clip;
    },
    getClipMediaAsset: snapUtils.getClipMediaAsset,
  });

  // Create volume envelope handlers
  const volumeEnvelopeHandlers = createVolumeEnvelopeHandlers(params, {
    findClip: (clipId: string) => {
      const clip = params.allClips.find((item) => item.id === clipId);
      if (!clip) throw new Error(`Clip ${clipId} not found`);
      return clip;
    },
  });

  // Create AI feature handlers
  const aiFeatureHandlers = createAiFeatureHandlers(params, {
    findClip: (clipId: string) => {
      const clip = params.allClips.find((item) => item.id === clipId);
      if (!clip) throw new Error(`Clip ${clipId} not found`);
      return clip;
    },
    getClipMediaAsset: snapUtils.getClipMediaAsset,
  });

  // Create drop handlers
  const dropHandlers = createDropHandlers(params, {
    addCredits: clipOpsHandlers.addCredits,
    addTitleTemplate: clipOpsHandlers.addTitleTemplate,
  });

  // Create keyboard handlers
  const keyboardHandlers = createKeyboardHandlers(params, {
    findClipById: snapUtils.findClipById,
    canApplyProtectedMove: selectionHandlers.canApplyProtectedMove,
    warnProtectedRangeBlocked: selectionHandlers.warnProtectedRangeBlocked,
    applyZoom: navigationHandlers.applyZoom,
    splitSelected: clipOpsHandlers.splitSelected,
    createGroupFromSelection: clipOpsHandlers.createGroupFromSelection,
    ungroupSelected: clipOpsHandlers.ungroupSelected,
    minFrameDuration: snapUtils.minFrameDuration,
  });

  // Update handler refs for keyboard shortcuts
  if (params.handlerRefs) {
    params.handlerRefs.current.quickAddTimelineNote = clipOpsHandlers.quickAddTimelineNote;
    params.handlerRefs.current.toggleProtectedRangeAtPlayhead = clipOpsHandlers.toggleProtectedRangeAtPlayhead;
    params.handlerRefs.current.syncScrollViewport = navigationHandlers.syncScrollViewport;
    params.handlerRefs.current.openSceneDetection = aiFeatureHandlers.openSceneDetection;
  }

  // Combine all handlers
  const findClip = (clipId: string): Clip => {
    const clip = params.allClips.find((item) => item.id === clipId);
    if (!clip) throw new Error(`Clip ${clipId} not found`);
    return clip;
  };

  const openClipMenu = (request: ClipMenuRequest): void => {
    params.setTransitionMenu(undefined);
    params.setGapMenu(undefined);
    params.setVolumeEnvelopeMenu(undefined);
    params.setRulerMenu(undefined);
    params.setClipMenu({
      x: Math.min(request.x, Math.max(0, window.innerWidth - 230)),
      y: Math.min(request.y, Math.max(0, window.innerHeight - 260)),
      clipId: request.clipId,
      clipType: request.clipType,
    });
  };

  return {
    // Track management
    ...trackHandlers,

    // Clip operations
    ...clipOpsHandlers,

    // Drag handlers
    ...dragHandlers,

    // Selection
    ...selectionHandlers,

    // Nested/media
    ...nestedMediaHandlers,

    // Gap handlers
    ...gapHandlers,

    // Volume envelope
    ...volumeEnvelopeHandlers,

    // AI features
    ...aiFeatureHandlers,

    // Navigation
    ...navigationHandlers,

    // Drop handlers
    ...dropHandlers,

    // Keyboard
    ...keyboardHandlers,

    // Snap utils
    ...snapUtils,

    // Facade-level helpers
    findClip,
    openClipMenu,
  };
}
