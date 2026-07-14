import { create } from 'zustand';
import {
  DEFAULT_TIMELINE_GRID_SETTINGS,
  type TimelineGridSettings,
  type PiPLayoutPosition,
  type BeatSensitivity,
} from '@open-factory/editor-core';
import {
  DEFAULT_COLLABORATION_IDENTITY_SETTINGS,
  DEFAULT_TIMELINE_INTERACTION_SETTINGS,
  normalizeTimelineHeatmapViewSettings,
  type CollaborationIdentitySettings,
  type TimelineInteractionSettings,
  type TimelineHeatmapViewSettings,
  type PreviewWindowSettings,
} from '../settings/appSettings';
import {
  DEFAULT_TUTORIAL_SIGNALS,
  type TutorialProgressSettings,
  type TutorialSignals,
} from '../tutorial/tutorialState';
import {
  DEFAULT_PREVIEW_PERFORMANCE_SETTINGS,
  type PreviewPerformanceSettings,
} from '../lib/preview/preview-performance';
import type { TimelineShortcutBindings } from '../shortcuts/timeline-shortcuts';
import type { ClipMacro, MacroHistoryEntry } from '../macros/clip-macros';
import type { SharedLibraryResource } from '../shared-library/sharedLibrary';
import type { SplitLayoutDefinition } from '@open-factory/editor-core';

type Updater<T> = T | ((current: T) => T);

function applyUpdater<T>(current: T, updater: Updater<T>): T {
  return typeof updater === 'function' ? (updater as (current: T) => T)(current) : updater;
}

export interface EditorSettingsState {
  timelineGridSettings: TimelineGridSettings;
  timelineInteractionSettings: TimelineInteractionSettings;
  safeFrameGuides: boolean;
  thumbnailTrackVisible: boolean;
  timelineMinimapVisible: boolean;
  timelineHeatmap: TimelineHeatmapViewSettings;
  previewPerformance: PreviewPerformanceSettings;
  previewWindowResolutionScale: PreviewWindowSettings['resolutionScale'];
  shortcutBindings: TimelineShortcutBindings;
  macros: ClipMacro[];
  macroHistory: MacroHistoryEntry[];
  sharedLibraryResources: SharedLibraryResource[];
  collaborationIdentity: CollaborationIdentitySettings;
  autosaveIntervalSeconds: number;
  tutorialProgress: TutorialProgressSettings | undefined;
  tutorialCelebrationVisible: boolean;
  tutorialSignals: TutorialSignals;
  pipLayoutPosition: PiPLayoutPosition;
  customSplitLayouts: SplitLayoutDefinition[];
  lastBackupAt: string | undefined;
  beatSensitivity: BeatSensitivity;
  beatSyncSpeedEnabled: boolean;
  beatSyncManualBpm: string;
  sceneDetectionRequestId: number;

  setTimelineGridSettings: (updater: Updater<TimelineGridSettings>) => void;
  setTimelineInteractionSettings: (updater: Updater<TimelineInteractionSettings>) => void;
  setSafeFrameGuides: (updater: Updater<boolean>) => void;
  setThumbnailTrackVisible: (updater: Updater<boolean>) => void;
  setTimelineMinimapVisible: (updater: Updater<boolean>) => void;
  setTimelineHeatmap: (updater: Updater<TimelineHeatmapViewSettings>) => void;
  setPreviewPerformance: (updater: Updater<PreviewPerformanceSettings>) => void;
  setPreviewWindowResolutionScale: (updater: Updater<PreviewWindowSettings['resolutionScale']>) => void;
  setShortcutBindings: (updater: Updater<TimelineShortcutBindings>) => void;
  setMacros: (updater: Updater<ClipMacro[]>) => void;
  setMacroHistory: (updater: Updater<MacroHistoryEntry[]>) => void;
  setSharedLibraryResources: (updater: Updater<SharedLibraryResource[]>) => void;
  setCollaborationIdentity: (updater: Updater<CollaborationIdentitySettings>) => void;
  setAutosaveIntervalSeconds: (updater: Updater<number>) => void;
  setTutorialProgress: (updater: Updater<TutorialProgressSettings | undefined>) => void;
  setTutorialCelebrationVisible: (updater: Updater<boolean>) => void;
  setTutorialSignals: (updater: Updater<TutorialSignals>) => void;
  setPiPLayoutPosition: (updater: Updater<PiPLayoutPosition>) => void;
  setCustomSplitLayouts: (updater: Updater<SplitLayoutDefinition[]>) => void;
  setLastBackupAt: (updater: Updater<string | undefined>) => void;
  setBeatSensitivity: (updater: Updater<BeatSensitivity>) => void;
  setBeatSyncSpeedEnabled: (updater: Updater<boolean>) => void;
  setBeatSyncManualBpm: (updater: Updater<string>) => void;
  setSceneDetectionRequestId: (updater: Updater<number>) => void;
}

export const useEditorSettingsStore = create<EditorSettingsState>((set) => ({
  timelineGridSettings: DEFAULT_TIMELINE_GRID_SETTINGS,
  timelineInteractionSettings: DEFAULT_TIMELINE_INTERACTION_SETTINGS,
  safeFrameGuides: false,
  thumbnailTrackVisible: true,
  timelineMinimapVisible: true,
  timelineHeatmap: normalizeTimelineHeatmapViewSettings(undefined),
  previewPerformance: DEFAULT_PREVIEW_PERFORMANCE_SETTINGS,
  previewWindowResolutionScale: 1,
  shortcutBindings: {},
  macros: [],
  macroHistory: [],
  sharedLibraryResources: [],
  collaborationIdentity: { ...DEFAULT_COLLABORATION_IDENTITY_SETTINGS },
  autosaveIntervalSeconds: 60,
  tutorialProgress: undefined,
  tutorialCelebrationVisible: false,
  tutorialSignals: DEFAULT_TUTORIAL_SIGNALS,
  pipLayoutPosition: 'bottom-right',
  customSplitLayouts: [],
  lastBackupAt: undefined,
  beatSensitivity: 'medium',
  beatSyncSpeedEnabled: false,
  beatSyncManualBpm: '',
  sceneDetectionRequestId: 0,

  setTimelineGridSettings(updater) {
    set((s) => ({ timelineGridSettings: applyUpdater(s.timelineGridSettings, updater) }));
  },
  setTimelineInteractionSettings(updater) {
    set((s) => ({ timelineInteractionSettings: applyUpdater(s.timelineInteractionSettings, updater) }));
  },
  setSafeFrameGuides(updater) {
    set((s) => ({ safeFrameGuides: applyUpdater(s.safeFrameGuides, updater) }));
  },
  setThumbnailTrackVisible(updater) {
    set((s) => ({ thumbnailTrackVisible: applyUpdater(s.thumbnailTrackVisible, updater) }));
  },
  setTimelineMinimapVisible(updater) {
    set((s) => ({ timelineMinimapVisible: applyUpdater(s.timelineMinimapVisible, updater) }));
  },
  setTimelineHeatmap(updater) {
    set((s) => ({ timelineHeatmap: applyUpdater(s.timelineHeatmap, updater) }));
  },
  setPreviewPerformance(updater) {
    set((s) => ({ previewPerformance: applyUpdater(s.previewPerformance, updater) }));
  },
  setPreviewWindowResolutionScale(updater) {
    set((s) => ({ previewWindowResolutionScale: applyUpdater(s.previewWindowResolutionScale, updater) }));
  },
  setShortcutBindings(updater) {
    set((s) => ({ shortcutBindings: applyUpdater(s.shortcutBindings, updater) }));
  },
  setMacros(updater) {
    set((s) => ({ macros: applyUpdater(s.macros, updater) }));
  },
  setMacroHistory(updater) {
    set((s) => ({ macroHistory: applyUpdater(s.macroHistory, updater) }));
  },
  setSharedLibraryResources(updater) {
    set((s) => ({ sharedLibraryResources: applyUpdater(s.sharedLibraryResources, updater) }));
  },
  setCollaborationIdentity(updater) {
    set((s) => ({ collaborationIdentity: applyUpdater(s.collaborationIdentity, updater) }));
  },
  setAutosaveIntervalSeconds(updater) {
    set((s) => ({ autosaveIntervalSeconds: applyUpdater(s.autosaveIntervalSeconds, updater) }));
  },
  setTutorialProgress(updater) {
    set((s) => ({ tutorialProgress: applyUpdater(s.tutorialProgress, updater) }));
  },
  setTutorialCelebrationVisible(updater) {
    set((s) => ({ tutorialCelebrationVisible: applyUpdater(s.tutorialCelebrationVisible, updater) }));
  },
  setTutorialSignals(updater) {
    set((s) => ({ tutorialSignals: applyUpdater(s.tutorialSignals, updater) }));
  },
  setPiPLayoutPosition(updater) {
    set((s) => ({ pipLayoutPosition: applyUpdater(s.pipLayoutPosition, updater) }));
  },
  setCustomSplitLayouts(updater) {
    set((s) => ({ customSplitLayouts: applyUpdater(s.customSplitLayouts, updater) }));
  },
  setLastBackupAt(updater) {
    set((s) => ({ lastBackupAt: applyUpdater(s.lastBackupAt, updater) }));
  },
  setBeatSensitivity(updater) {
    set((s) => ({ beatSensitivity: applyUpdater(s.beatSensitivity, updater) }));
  },
  setBeatSyncSpeedEnabled(updater) {
    set((s) => ({ beatSyncSpeedEnabled: applyUpdater(s.beatSyncSpeedEnabled, updater) }));
  },
  setBeatSyncManualBpm(updater) {
    set((s) => ({ beatSyncManualBpm: applyUpdater(s.beatSyncManualBpm, updater) }));
  },
  setSceneDetectionRequestId(updater) {
    set((s) => ({ sceneDetectionRequestId: applyUpdater(s.sceneDetectionRequestId, updater) }));
  },
}));
