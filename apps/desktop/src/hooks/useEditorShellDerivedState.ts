import { useMemo } from 'react';
import {
  type Clip,
  type MediaAsset,
  type Project,
  findSyncCompareClipRefs,
  round,
  estimateBpmFromBeatMarkers,
} from '@open-factory/editor-core';
import { selectClipById } from '../store/editorStore';
import { isPiPVisualClip, isSceneReorderClip } from '../lib/timeline-clip-helpers';
import { canSeparateAudioForClip } from '../lib/demucs';
import {
  collectContentAnalysisTargets,
  findSpeakerDiarizationTarget,
  collectAutoAudioSyncTargets,
  summarizeContentAnalysisByMedia,
} from '../lib/content-analysis-helpers';
import type { DemucsAvailability } from '../lib/demucs';
import type { AutoAudioSyncTarget } from '../lib/autoAudioSync';
import {
  applyWorkspaceLayout,
  BUILT_IN_WORKSPACE_LAYOUT_IDS,
  clampTimelineHeight,
  getEffectivePanelState,
  getWorkspaceLayoutById,
  type WorkspaceLayoutDefinition,
  type WorkspaceLayoutId,
} from '../layout/layoutSettings';
import { getReviewModeShellVisibility } from '../review/reviewMode';
import type { TimelineInteractionSettings } from '../settings/appSettings';

interface DerivedStateDeps {
  project: any;
  selectedClipId: string | null;
  selectedClipIds: string[];
  demucsAvailability: DemucsAvailability;
  audioSeparationClipId: string | null;
  speakerDiarizationRunning: boolean;
  autoAudioSyncRunning: boolean;
  autoAudioSyncPrimaryClipId: string | null;
  layoutSettings: any;
  viewportSize: { width: number; height: number };
  reviewMode: boolean;
}

/**
 * 从 EditorShell 中提取的派生状态计算。
 * 将复杂的 useMemo 计算逻辑集中管理。
 */
export function useEditorShellDerivedState(deps: DerivedStateDeps) {
  const {
    project,
    selectedClipId,
    selectedClipIds,
    demucsAvailability,
    audioSeparationClipId,
    speakerDiarizationRunning,
    autoAudioSyncRunning,
    autoAudioSyncPrimaryClipId,
    layoutSettings,
    viewportSize,
    reviewMode,
  } = deps;

  const selectedClip = useMemo(
    () => selectClipById(project, selectedClipId ?? undefined),
    [project, selectedClipId],
  );

  const selectedClips = useMemo(
    () =>
      selectedClipIds
        .map((id) => selectClipById(project, id))
        .filter((clip): clip is Clip => Boolean(clip)),
    [project, selectedClipIds],
  );

  const selectedClipMedia = useMemo(
    () =>
      selectedClip && 'mediaId' in selectedClip
        ? project.media.find((asset: MediaAsset) => asset.id === selectedClip.mediaId)
        : undefined,
    [selectedClip, project.media],
  );

  const allTimelineClips = useMemo(
    () => project.timeline.tracks.flatMap((track: any) => track.clips),
    [project.timeline.tracks],
  );

  const visualTimelineClipRefs = useMemo(
    () =>
      project.timeline.tracks
        .flatMap((track: any) =>
          track.clips
            .filter((clip: any) => clip.type === 'video' || clip.type === 'image')
            .map((clip: any) => ({
              clip,
              trackId: track.id,
              media: project.media.find((asset: MediaAsset) => 'mediaId' in clip && asset.id === clip.mediaId),
            })),
        )
        .filter(
          (item: any): item is { clip: Extract<Clip, { type: 'video' | 'image' }>; trackId: string; media: MediaAsset } =>
            Boolean(item.media),
        )
        .sort((left: any, right: any) => left.clip.start - right.clip.start || left.clip.id.localeCompare(right.clip.id)),
    [project.media, project.timeline.tracks],
  );

  const selectedClipLocked = useMemo(
    () =>
      Boolean(
        selectedClip && project.timeline.tracks.find((track: any) => track.id === selectedClip.trackId)?.locked,
      ),
    [selectedClip, project.timeline.tracks],
  );

  const syncCompareClipRefs = useMemo(
    () => findSyncCompareClipRefs(project.timeline, selectedClipIds),
    [project.timeline, selectedClipIds],
  );

  const canOpenSyncCompare = syncCompareClipRefs.length === 2;

  const canOpenSceneDetection = useMemo(
    () => Boolean(selectedClip && selectedClipMedia && selectedClip.type === 'video'),
    [selectedClip, selectedClipMedia],
  );

  const canOpenSceneReorder = useMemo(
    () => selectedClips.filter(isSceneReorderClip).length >= 2,
    [selectedClips],
  );

  const contentAnalysisTargets = useMemo(
    () => collectContentAnalysisTargets(project),
    [project],
  );

  const mediaContentAnalysis = useMemo(
    () => summarizeContentAnalysisByMedia(contentAnalysisTargets),
    [contentAnalysisTargets],
  );

  const speakerDiarizationTarget = useMemo(
    () =>
      findSpeakerDiarizationTarget(
        project,
        selectedClipIds.length > 0 ? selectedClipIds : selectedClipId ? [selectedClipId] : [],
      ),
    [project, selectedClipId, selectedClipIds],
  );

  const autoAudioSyncTargets = useMemo(
    () =>
      collectAutoAudioSyncTargets(
        project,
        selectedClipIds.length > 0 ? selectedClipIds : selectedClipId ? [selectedClipId] : [],
      ),
    [project, selectedClipId, selectedClipIds],
  );

  const resolvedAutoAudioSyncPrimaryClipId = useMemo(
    () =>
      autoAudioSyncTargets.some((target) => target.clip.id === autoAudioSyncPrimaryClipId)
        ? autoAudioSyncPrimaryClipId!
        : (autoAudioSyncTargets[0]?.clip.id ?? ''),
    [autoAudioSyncTargets, autoAudioSyncPrimaryClipId],
  );

  const autoAudioSyncDialogTargets = useMemo(
    () =>
      autoAudioSyncTargets.map((target) => ({
        clipId: target.clip.id,
        clipName: target.clip.name,
        mediaName: target.asset.name,
        trackName: target.track.name,
        start: target.clip.start,
      })),
    [autoAudioSyncTargets],
  );

  const canSeparateSelectedAudio = useMemo(
    () =>
      canSeparateAudioForClip(selectedClip, selectedClipMedia, demucsAvailability.ready) && !audioSeparationClipId,
    [selectedClip, selectedClipMedia, demucsAvailability.ready, audioSeparationClipId],
  );

  const canRunSpeakerDiarization = useMemo(
    () => Boolean(speakerDiarizationTarget && !speakerDiarizationRunning),
    [speakerDiarizationTarget, speakerDiarizationRunning],
  );

  const canOpenAutoAudioSync = useMemo(
    () =>
      autoAudioSyncTargets.length >= 2 && autoAudioSyncTargets.length <= 5 && !autoAudioSyncRunning,
    [autoAudioSyncTargets, autoAudioSyncRunning],
  );

  const canDetectBeats = useMemo(
    () =>
      Boolean(
        selectedClip &&
          selectedClipMedia &&
          (selectedClip.type === 'audio' || selectedClip.type === 'video') &&
          (selectedClipMedia.type === 'audio' || selectedClipMedia.hasAudio),
      ),
    [selectedClip, selectedClipMedia],
  );

  const canCreateMulticamSequence = useMemo(() => {
    if (selectedClipIds.length < 2 || selectedClipIds.length > 8) return false;
    const selected = selectedClipIds
      .map((id) =>
        project.timeline.tracks
          .flatMap((track: any) => track.clips.map((clip: any) => ({ clip, track })))
          .find((item: any) => item.clip.id === id),
      )
      .filter(Boolean);
    return (
      selected.length === selectedClipIds.length &&
      selected.every(
        (item: any) => item?.track.type === 'video' && (item.clip.type === 'video' || item.clip.type === 'image'),
      )
    );
  }, [project.timeline.tracks, selectedClipIds]);

  const selectedPiPClips = useMemo(() => {
    if (selectedClipIds.length !== 2) return [];
    type ClipWithTrack = { clip: Clip; track: any; trackIndex: number; selectedIndex: number };
    const allClips = project.timeline.tracks.flatMap((track: any, trackIndex: number) =>
      track.clips.map((clip: any) => ({ clip, track, trackIndex })),
    );
    return selectedClipIds
      .map((id, selectedIndex) => {
        const item = allClips.find((candidate: any) => candidate.clip.id === id);
        return item ? { ...item, selectedIndex } : undefined;
      })
      .filter((item): item is ClipWithTrack => item !== undefined)
      .filter((item) => item.track.type === 'video' && isPiPVisualClip(item.clip))
      .sort((left, right) => left.trackIndex - right.trackIndex || left.selectedIndex - right.selectedIndex);
  }, [project.timeline.tracks, selectedClipIds]);

  const canApplyPiPLayout = selectedPiPClips.length === 2;

  const selectedSplitLayoutClips = useMemo(() => {
    if (selectedClipIds.length < 2 || selectedClipIds.length > 4) return [];
    type ClipWithTrack = { clip: Clip; track: any; trackIndex: number; selectedIndex: number };
    const allClips = project.timeline.tracks.flatMap((track: any, trackIndex: number) =>
      track.clips.map((clip: any) => ({ clip, track, trackIndex })),
    );
    return selectedClipIds
      .map((id, selectedIndex) => {
        const item = allClips.find((candidate: any) => candidate.clip.id === id);
        return item ? { ...item, selectedIndex } : undefined;
      })
      .filter((item): item is ClipWithTrack => item !== undefined)
      .filter((item) => item.track.type === 'video' && isPiPVisualClip(item.clip))
      .sort((left, right) => left.trackIndex - right.trackIndex || left.selectedIndex - right.selectedIndex);
  }, [project.timeline.tracks, selectedClipIds]);

  const canApplySplitLayout = selectedSplitLayoutClips.length >= 2 && selectedSplitLayoutClips.length <= 4;

  const selectedClipTimelineBeatTimes = useMemo(() => {
    const times = selectedClips.flatMap((clip) =>
      (clip.beatMarkers ?? []).map((marker: any) => round(clip.start + marker.time)),
    );
    return Array.from(new Set(times)).sort((left, right) => left - right);
  }, [selectedClips]);

  const beatSyncBeatTimes = useMemo(() => {
    return selectedClipTimelineBeatTimes.length > 0
      ? selectedClipTimelineBeatTimes
      : (project.beatMarkers ?? []).map((marker: any) => marker.time);
  }, [project.beatMarkers, selectedClipTimelineBeatTimes]);

  const detectedBeatBpm = selectedClip?.detectedBpm ?? estimateBpmFromBeatMarkers(selectedClip?.beatMarkers);

  const canSnapToBeats = selectedClipIds.length > 0 && beatSyncBeatTimes.length > 0;
  const canSplitToBeats = Boolean(selectedClip && beatSyncBeatTimes.length > 0);

  const timelineHeightPx = clampTimelineHeight(layoutSettings.timelineHeightPx, viewportSize.height);
  const effectivePanels = getEffectivePanelState(layoutSettings, viewportSize.width);
  const reviewVisibility = getReviewModeShellVisibility(reviewMode);

  const workspaceLayouts: WorkspaceLayoutDefinition[] = useMemo(
    () => [
      ...BUILT_IN_WORKSPACE_LAYOUT_IDS.map((id) => getWorkspaceLayoutById(layoutSettings, id)).filter(
        (layout): layout is WorkspaceLayoutDefinition => Boolean(layout),
      ),
      ...layoutSettings.customWorkspaceLayouts,
    ],
    [layoutSettings],
  );

  const editorGridRows = reviewMode ? 'auto minmax(0,1fr)' : `auto minmax(0,1fr) 6px ${timelineHeightPx}px`;
  const mainGridColumns = reviewMode
    ? 'minmax(0,1fr)'
    : `${effectivePanels.leftPanelCollapsed ? 48 : layoutSettings.leftPanelWidthPx}px minmax(0,1fr) ${effectivePanels.rightPanelCollapsed ? 48 : layoutSettings.rightPanelWidthPx}px`;
  const rightPanelRows =
    effectivePanels.rightPrimaryPanelVisible && effectivePanels.audioMixerVisible
      ? `minmax(0,1fr) ${layoutSettings.mixerHeightPx}px`
      : 'minmax(0,1fr)';

  return {
    selectedClip,
    selectedClips,
    selectedClipMedia,
    allTimelineClips,
    visualTimelineClipRefs,
    selectedClipLocked,
    syncCompareClipRefs,
    canOpenSyncCompare,
    canOpenSceneDetection,
    canOpenSceneReorder,
    contentAnalysisTargets,
    mediaContentAnalysis,
    speakerDiarizationTarget,
    autoAudioSyncTargets,
    resolvedAutoAudioSyncPrimaryClipId,
    autoAudioSyncDialogTargets,
    canSeparateSelectedAudio,
    canRunSpeakerDiarization,
    canOpenAutoAudioSync,
    canDetectBeats,
    canCreateMulticamSequence,
    selectedPiPClips,
    canApplyPiPLayout,
    selectedSplitLayoutClips,
    canApplySplitLayout,
    selectedClipTimelineBeatTimes,
    beatSyncBeatTimes,
    detectedBeatBpm,
    canSnapToBeats,
    canSplitToBeats,
    timelineHeightPx,
    effectivePanels,
    reviewVisibility,
    workspaceLayouts,
    editorGridRows,
    mainGridColumns,
    rightPanelRows,
  };
}
