import type { Clip, HistoryMeta, KeyframeProperty, MediaAsset, MediaMetadata, Project, Timeline, TimelineDiffRange } from '@open-factory/editor-core';
import { clampTimelineZoom, createProject, getTimelineDuration, normalizeMediaMetadataEntry, replaceProjectActiveTimeline, switchProjectActiveSequence } from '@open-factory/editor-core';
import { create } from 'zustand';
import { zhCN } from '../i18n/strings';

export interface SelectedKeyframeRef {
  clipId: string;
  property: KeyframeProperty;
  keyframeId: string;
}

export interface EditorState {
  project: Project;
  selectedClipId?: string;
  selectedClipIds: string[];
  selectedKeyframe?: SelectedKeyframeRef;
  selectedKeyframes: SelectedKeyframeRef[];
  playheadTime: number;
  isPlaying: boolean;
  playbackRate: -1 | 1;
  inPoint?: number;
  outPoint?: number;
  timelineZoom: number;
  projectPath?: string;
  dirty: boolean;
  exportProgress?: number;
  isExporting: boolean;
  historyMeta: HistoryMeta;
  previewTimeline?: Timeline;
  timelineCompareRanges: TimelineDiffRange[];
  chromaKeyPickClipId?: string;
  replaceProject: (project: Project) => void;
  replaceTimeline: (timeline: Timeline) => void;
  setActiveSequenceId: (sequenceId: string) => void;
  setProject: (project: Project, projectPath?: string) => void;
  resetProject: () => void;
  setMedia: (media: MediaAsset[]) => void;
  addMedia: (media: MediaAsset[]) => void;
  setMediaMetadata: (assetId: string, metadata?: MediaMetadata) => void;
  setSelectedClipId: (clipId?: string) => void;
  setSelectedClipIds: (clipIds: string[]) => void;
  toggleSelectedClipId: (clipId: string) => void;
  clearSelectedClipIds: () => void;
  setSelectedKeyframe: (keyframe?: SelectedKeyframeRef) => void;
  setSelectedKeyframes: (keyframes: SelectedKeyframeRef[]) => void;
  toggleSelectedKeyframe: (keyframe: SelectedKeyframeRef) => void;
  setPlayheadTime: (time: number) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  setPlaybackRate: (playbackRate: -1 | 1) => void;
  setInPoint: (time?: number) => void;
  setOutPoint: (time?: number) => void;
  setTimelineZoom: (zoom: number) => void;
  setProjectPath: (projectPath?: string) => void;
  setDirty: (dirty: boolean) => void;
  setHistoryMeta: (meta: HistoryMeta) => void;
  setExportProgress: (progress?: number) => void;
  setIsExporting: (isExporting: boolean) => void;
  setPreviewTimeline: (timeline?: Timeline) => void;
  setTimelineCompareRanges: (ranges: TimelineDiffRange[]) => void;
  setChromaKeyPickClipId: (clipId?: string) => void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  project: createProject(zhCN.project.defaultName),
  selectedClipIds: [],
  selectedKeyframes: [],
  playheadTime: 0,
  isPlaying: false,
  playbackRate: 1,
  timelineZoom: 80,
  dirty: false,
  isExporting: false,
  historyMeta: { canUndo: false, canRedo: false, cursor: -1, entries: [], position: 0, total: 0 },
  timelineCompareRanges: [],
  replaceProject: (project) =>
    set({
      project: { ...project, updatedAt: new Date().toISOString() },
      dirty: true
    }),
  replaceTimeline: (timeline) =>
    set((state) => ({
      project: { ...replaceProjectActiveTimeline(state.project, timeline), updatedAt: new Date().toISOString() },
      dirty: true
    })),
  setActiveSequenceId: (sequenceId) =>
    set((state) => ({
      project: { ...switchProjectActiveSequence(state.project, sequenceId), updatedAt: new Date().toISOString() },
      selectedClipId: undefined,
      selectedClipIds: [],
      selectedKeyframe: undefined,
      selectedKeyframes: [],
      playheadTime: 0,
      isPlaying: false,
      previewTimeline: undefined,
      timelineCompareRanges: [],
      chromaKeyPickClipId: undefined,
      dirty: state.dirty
    })),
  setProject: (project, projectPath) =>
    set({
      project,
      projectPath,
      selectedClipId: undefined,
      selectedClipIds: [],
      selectedKeyframe: undefined,
      selectedKeyframes: [],
      playheadTime: 0,
      isPlaying: false,
      playbackRate: 1,
      inPoint: undefined,
      outPoint: undefined,
      previewTimeline: undefined,
      timelineCompareRanges: [],
      chromaKeyPickClipId: undefined,
      dirty: false
    }),
  resetProject: () =>
    set({
      project: createProject(zhCN.project.defaultName),
      projectPath: undefined,
      selectedClipId: undefined,
      selectedClipIds: [],
      selectedKeyframe: undefined,
      selectedKeyframes: [],
      playheadTime: 0,
      isPlaying: false,
      playbackRate: 1,
      inPoint: undefined,
      outPoint: undefined,
      previewTimeline: undefined,
      timelineCompareRanges: [],
      chromaKeyPickClipId: undefined,
      dirty: false
    }),
  setMedia: (media) =>
    set((state) => ({
      project: { ...state.project, media, updatedAt: new Date().toISOString() },
      dirty: true
    })),
  addMedia: (media) =>
    set((state) => {
      const existingPaths = new Set(state.project.media.map((asset) => asset.path));
      const nextMedia = [...state.project.media, ...media.filter((asset) => !existingPaths.has(asset.path))];
      return {
        project: { ...state.project, media: nextMedia, updatedAt: new Date().toISOString() },
        dirty: nextMedia.length !== state.project.media.length || state.dirty
      };
    }),
  setMediaMetadata: (assetId, metadata) =>
    set((state) => {
      const mediaMetadata = { ...state.project.mediaMetadata };
      const normalized = normalizeMediaMetadataEntry(metadata);
      if (normalized) {
        mediaMetadata[assetId] = normalized;
      } else {
        delete mediaMetadata[assetId];
      }
      return {
        project: { ...state.project, mediaMetadata, updatedAt: new Date().toISOString() },
        dirty: true
      };
    }),
  setSelectedClipId: (selectedClipId) => set({ selectedClipId, selectedClipIds: selectedClipId ? [selectedClipId] : [], selectedKeyframe: undefined, selectedKeyframes: [] }),
  setSelectedClipIds: (selectedClipIds) => {
    const unique = Array.from(new Set(selectedClipIds));
    set({ selectedClipIds: unique, selectedClipId: unique.length === 1 ? unique[0] : undefined, selectedKeyframe: undefined, selectedKeyframes: [] });
  },
  toggleSelectedClipId: (clipId) =>
    set((state) => {
      const selected = new Set(state.selectedClipIds);
      if (selected.has(clipId)) {
        selected.delete(clipId);
      } else {
        selected.add(clipId);
      }
      const selectedClipIds = Array.from(selected);
      return { selectedClipIds, selectedClipId: selectedClipIds.length === 1 ? selectedClipIds[0] : undefined, selectedKeyframe: undefined, selectedKeyframes: [] };
    }),
  clearSelectedClipIds: () => set({ selectedClipId: undefined, selectedClipIds: [], selectedKeyframe: undefined, selectedKeyframes: [] }),
  setSelectedKeyframe: (selectedKeyframe) =>
    set({
      selectedKeyframe,
      selectedKeyframes: selectedKeyframe ? [selectedKeyframe] : [],
      selectedClipIds: selectedKeyframe ? [selectedKeyframe.clipId] : [],
      selectedClipId: selectedKeyframe?.clipId
    }),
  setSelectedKeyframes: (selectedKeyframes) => {
    const unique = uniqueSelectedKeyframes(selectedKeyframes);
    const selectedKeyframe = unique.at(-1);
    const selectedClipIds = uniqueSelectedClipIdsForKeyframes(unique);
    set({ selectedKeyframes: unique, selectedKeyframe, selectedClipIds, selectedClipId: selectedKeyframe?.clipId });
  },
  toggleSelectedKeyframe: (selectedKeyframe) =>
    set((state) => {
      const exists = state.selectedKeyframes.some((item) => sameSelectedKeyframe(item, selectedKeyframe));
      const selectedKeyframes = exists
        ? state.selectedKeyframes.filter((item) => !sameSelectedKeyframe(item, selectedKeyframe))
        : [...state.selectedKeyframes, selectedKeyframe];
      const nextSelectedKeyframe = selectedKeyframes.at(-1);
      const selectedClipIds = uniqueSelectedClipIdsForKeyframes(selectedKeyframes);
      return { selectedKeyframes, selectedKeyframe: nextSelectedKeyframe, selectedClipIds, selectedClipId: nextSelectedKeyframe?.clipId };
    }),
  setPlayheadTime: (time) => {
    const duration = getTimelineDuration(get().project.timeline);
    set({ playheadTime: Math.min(Math.max(0, time), Math.max(duration, 0)) });
  },
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setPlaybackRate: (playbackRate) => set({ playbackRate }),
  setInPoint: (inPoint) => set({ inPoint }),
  setOutPoint: (outPoint) => set({ outPoint }),
  setTimelineZoom: (zoom) => set({ timelineZoom: clampTimelineZoom(zoom) }),
  setProjectPath: (projectPath) => set({ projectPath }),
  setDirty: (dirty) => set({ dirty }),
  setHistoryMeta: (historyMeta) => set({ historyMeta }),
  setExportProgress: (exportProgress) => set({ exportProgress }),
  setIsExporting: (isExporting) => set({ isExporting }),
  setPreviewTimeline: (previewTimeline) => set({ previewTimeline }),
  setTimelineCompareRanges: (timelineCompareRanges) => set({ timelineCompareRanges }),
  setChromaKeyPickClipId: (chromaKeyPickClipId) => set({ chromaKeyPickClipId })
}));

export function selectClipById(project: Project, clipId?: string): Clip | undefined {
  if (!clipId) {
    return undefined;
  }
  return project.timeline.tracks.flatMap((track) => track.clips).find((clip) => clip.id === clipId);
}

function uniqueSelectedKeyframes(keyframes: SelectedKeyframeRef[]): SelectedKeyframeRef[] {
  const seen = new Set<string>();
  const output: SelectedKeyframeRef[] = [];
  for (const keyframe of keyframes) {
    const key = selectedKeyframeKey(keyframe);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    output.push(keyframe);
  }
  return output;
}

function sameSelectedKeyframe(left: SelectedKeyframeRef, right: SelectedKeyframeRef): boolean {
  return left.clipId === right.clipId && left.property === right.property && left.keyframeId === right.keyframeId;
}

function selectedKeyframeKey(keyframe: SelectedKeyframeRef): string {
  return `${keyframe.clipId}\0${keyframe.property}\0${keyframe.keyframeId}`;
}

function uniqueSelectedClipIdsForKeyframes(keyframes: SelectedKeyframeRef[]): string[] {
  return Array.from(new Set(keyframes.map((keyframe) => keyframe.clipId)));
}
