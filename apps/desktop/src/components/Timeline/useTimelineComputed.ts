import {useDeferredValue, useMemo} from 'react';
import {
  buildTimelineMinimapLayout,
  buildTimelineRulerTicks,
  buildTimelineGridLines,
  buildTimelineThumbnailTrackSamples,
  buildTimelineNoteLayout,
  calculateTimelineMinimapViewportRect,
  filterTimelineVirtualTracks,
  getTimelineDuration,
  getTimelineLargeProjectMode,
  getTimelineVirtualRenderWindow,
  getTimelineVirtualTrackWindow,
  normalizeClipGroups,
  normalizeExportRanges,
  normalizeProtectedRanges,
  round,
  secondsToTimecode,
  sortTimelineThumbnailSamplesByPriority,
  findCompleteClipGroup,
  DEFAULT_TIMELINE_GRID_SETTINGS,
} from '@open-factory/editor-core';
import {LABEL_WIDTH, TRACK_HEIGHT} from './TimelineParts';
import type {TimelineStateParams, TimelineState} from './timelineStateTypes';

type StoreState = Pick<
  TimelineState,
  | 'project'
  | 'playheadTime'
  | 'isPlaying'
  | 'inPoint'
  | 'outPoint'
  | 'zoom'
  | 'collaborationEnabled'
  | 'collaborationUserId'
  | 'collaborationUsers'
  | 'collaborationLocks'
  | 'selectedClipIds'
>;

type UIState = Pick<
  TimelineState,
  'scrollViewport' | 'timelineViewportHeight' | 'heatmapSegments' | 'bookmarkPanelOpen' | 'timelineNoteSearch' | 'setAnnotationPanelOpen'
>;

export interface ComputedInput {
  store: StoreState;
  ui: UIState;
  params: TimelineStateParams;
  timelineDuration: number;
}

export interface ComputedOutput {
  allClips: TimelineState['allClips'];
  largeProjectMode: TimelineState['largeProjectMode'];
  timelineGridBeatTimes: TimelineState['timelineGridBeatTimes'];
  ticks: TimelineState['ticks'];
  playheadTimecode: TimelineState['playheadTimecode'];
  gridLines: TimelineState['gridLines'];
  remoteCollaborationUsers: TimelineState['remoteCollaborationUsers'];
  collaborationLocksByClipId: TimelineState['collaborationLocksByClipId'];
  activeBeatMarkerId: TimelineState['activeBeatMarkerId'];
  exportRangeHighlights: TimelineState['exportRangeHighlights'];
  minimapHeight: number;
  minimapLayout: TimelineState['minimapLayout'];
  minimapViewport: TimelineState['minimapViewport'];
  deferredMinimapLayout: TimelineState['deferredMinimapLayout'];
  protectedRanges: TimelineState['protectedRanges'];
  timelineNotes: TimelineState['timelineNotes'];
  timelineNoteLayouts: TimelineState['timelineNoteLayouts'];
  filteredTimelineNotes: TimelineState['filteredTimelineNotes'];
  sceneCutOverlays: TimelineState['sceneCutOverlays'];
  clipGroups: TimelineState['clipGroups'];
  clipGroupByClipId: TimelineState['clipGroupByClipId'];
  selectedGroup: TimelineState['selectedGroup'];
  orderedTrackIds: TimelineState['orderedTrackIds'];
  virtualWindow: TimelineState['virtualWindow'];
  virtualTrackWindow: TimelineState['virtualTrackWindow'];
  virtualTracks: TimelineState['virtualTracks'];
  thumbnailTrackSamples: TimelineState['thumbnailTrackSamples'];
  activeSequence: TimelineState['activeSequence'];
  isMainSequence: TimelineState['isMainSequence'];
  projectDuration: number;
  width: number;
  visibleStart: number;
  visibleEnd: number;
  deferredHeatmapSegments: TimelineState['deferredHeatmapSegments'];
}

export function useTimelineComputed(
  {store, ui, params, timelineDuration}: ComputedInput,
): ComputedOutput {
  const {
    timelineGridSettings = DEFAULT_TIMELINE_GRID_SETTINGS,
  } = params;

  const deferredHeatmapSegments = useDeferredValue(ui.heatmapSegments);

  // Non-memoized computed values

  const projectDuration = getTimelineDuration(store.project.timeline);
  const width = Math.max(960, timelineDuration * store.zoom);
  const visibleStart = Math.max(0, (ui.scrollViewport.scrollLeft - LABEL_WIDTH) / Math.max(1, store.zoom));
  const visibleEnd = visibleStart + ui.scrollViewport.viewportWidth / Math.max(1, store.zoom);

  // useMemo declarations

  const allClips = useMemo(() => store.project.timeline.tracks.flatMap((track) => track.clips), [store.project.timeline]);
  const largeProjectMode = useMemo(
    () => getTimelineLargeProjectMode({clipCount: allClips.length}),
    [allClips.length],
  );

  const timelineGridBeatTimes = useMemo(
    () => (store.project.beatMarkers ?? []).map((marker) => marker.time),
    [store.project.beatMarkers],
  );

  const ticks = useMemo(
    () =>
      buildTimelineRulerTicks({
        duration: timelineDuration,
        visibleStart,
        visibleEnd,
        zoom: store.zoom,
        viewportWidth: Math.max(1, ui.scrollViewport.viewportWidth - LABEL_WIDTH),
        fps: store.project.settings.fps || 30,
        timecodeFormat: store.project.settings.timecodeFormat ?? 'ndf',
      }),
    [
      store.project.settings.fps,
      store.project.settings.timecodeFormat,
      ui.scrollViewport.viewportWidth,
      timelineDuration,
      visibleEnd,
      visibleStart,
      store.zoom,
    ],
  );

  const playheadTimecode = useMemo(
    () => secondsToTimecode(store.playheadTime, store.project.settings.fps || 30, store.project.settings.timecodeFormat ?? 'ndf'),
    [store.playheadTime, store.project.settings.fps, store.project.settings.timecodeFormat],
  );

  const gridLines = useMemo(() => {
    if (!timelineGridSettings.enabled) {
      return [];
    }
    return buildTimelineGridLines({
      unit: timelineGridSettings.unit,
      fps: store.project.settings.fps || 30,
      duration: timelineDuration,
      visibleStart,
      visibleEnd,
      zoom: store.zoom,
      viewportWidth: Math.max(1, ui.scrollViewport.viewportWidth - LABEL_WIDTH),
      beatTimes: timelineGridBeatTimes,
    });
  }, [
    store.project.settings.fps,
    ui.scrollViewport.viewportWidth,
    timelineDuration,
    timelineGridBeatTimes,
    timelineGridSettings.enabled,
    timelineGridSettings.unit,
    visibleEnd,
    visibleStart,
    store.zoom,
  ]);

  const remoteCollaborationUsers = useMemo(
    () => (store.collaborationEnabled ? store.collaborationUsers.filter((user) => user.userId !== store.collaborationUserId) : []),
    [store.collaborationEnabled, store.collaborationUserId, store.collaborationUsers],
  );

  const collaborationLocksByClipId = useMemo(
    () =>
      new Map(
        store.collaborationLocks.filter((lock) => lock.userId !== store.collaborationUserId).map((lock) => [lock.clipId, lock]),
      ),
    [store.collaborationLocks, store.collaborationUserId],
  );

  const activeBeatMarkerId = useMemo(() => {
    if (!store.isPlaying) {
      return undefined;
    }
    const frameWindow = 1 / Math.max(1, store.project.settings.fps || 30);
    return (store.project.beatMarkers ?? []).find((marker) => Math.abs(marker.time - store.playheadTime) <= frameWindow * 2)?.id;
  }, [store.isPlaying, store.playheadTime, store.project.beatMarkers, store.project.settings.fps]);

  const exportRangeHighlights = useMemo(() => {
    const stored = normalizeExportRanges(store.project.exportRanges, projectDuration).map((range) => ({
      id: range.id,
      start: range.start,
      end: range.end,
    }));
    if (stored.length > 0) {
      return stored;
    }
    if (typeof store.inPoint !== 'number' || typeof store.outPoint !== 'number' || store.inPoint === store.outPoint) {
      return [];
    }
    return [{id: 'current-in-out', start: Math.min(store.inPoint, store.outPoint), end: Math.max(store.inPoint, store.outPoint)}];
  }, [store.inPoint, store.outPoint, store.project.exportRanges, projectDuration]);

  const minimapHeight = Math.max(160, ui.timelineViewportHeight);

  const minimapLayout = useMemo(
    () =>
      buildTimelineMinimapLayout(store.project.timeline, {
        duration: timelineDuration,
        width: 120,
        height: minimapHeight,
        maxClips: largeProjectMode.minimapClipLimit,
        markers: store.project.timeline.markers ?? [],
        bookmarks: store.project.bookmarks ?? [],
        exportRanges: exportRangeHighlights,
      }),
    [
      exportRangeHighlights,
      largeProjectMode.minimapClipLimit,
      minimapHeight,
      store.project.bookmarks,
      store.project.timeline,
      timelineDuration,
    ],
  );

  const deferredMinimapLayout = useDeferredValue(minimapLayout);

  const minimapViewport = useMemo(
    () =>
      calculateTimelineMinimapViewportRect({
        scrollLeft: ui.scrollViewport.scrollLeft,
        viewportWidth: ui.scrollViewport.viewportWidth,
        labelWidth: LABEL_WIDTH,
        zoom: store.zoom,
        duration: timelineDuration,
        minimapHeight,
      }),
    [minimapHeight, ui.scrollViewport.scrollLeft, ui.scrollViewport.viewportWidth, timelineDuration, store.zoom],
  );

  const protectedRanges = useMemo(
    () => normalizeProtectedRanges(store.project.protectedRanges, projectDuration),
    [store.project.protectedRanges, projectDuration],
  );

  const timelineNotes = useMemo(() => store.project.timelineNotes ?? [], [store.project.timelineNotes]);
  const timelineNoteLayouts = useMemo(() => buildTimelineNoteLayout(timelineNotes), [timelineNotes]);

  const filteredTimelineNotes = useMemo(() => {
    const query = ui.timelineNoteSearch.trim().toLowerCase();
    if (!query) {
      return timelineNotes;
    }
    return timelineNotes.filter(
      (note) => note.text.toLowerCase().includes(query) || note.color.toLowerCase().includes(query),
    );
  }, [ui.timelineNoteSearch, timelineNotes]);

  const sceneCutOverlays = useMemo(
    () =>
      allClips.flatMap((clip) =>
        (clip.scenecuts ?? []).map((time, index) => ({
          id: `${clip.id}-${index}-${time}`,
          clipId: clip.id,
          time: round(clip.start + time),
        })),
      ),
    [allClips],
  );

  const clipGroups = useMemo(
    () =>
      normalizeClipGroups(
        store.project.clipGroups,
        allClips.map((clip) => clip.id),
      ),
    [allClips, store.project.clipGroups],
  );

  const clipGroupByClipId = useMemo(() => {
    const map = new Map<string, import('@open-factory/editor-core').ClipGroup>();
    for (const group of clipGroups) {
      for (const clipId of group.clipIds) {
        map.set(clipId, group);
      }
    }
    return map;
  }, [clipGroups]);

  const selectedGroup = useMemo(
    () => findCompleteClipGroup(clipGroups, store.selectedClipIds),
    [clipGroups, store.selectedClipIds],
  );

  const orderedTrackIds = useMemo(() => store.project.timeline.tracks.map((track) => track.id), [store.project.timeline.tracks]);

  const virtualWindow = useMemo(
    () =>
      getTimelineVirtualRenderWindow({
        scrollLeft: ui.scrollViewport.scrollLeft,
        viewportWidth: ui.scrollViewport.viewportWidth,
        zoom: store.zoom,
        labelWidth: LABEL_WIDTH,
        overscanScreens: largeProjectMode.virtualOverscanScreens,
      }),
    [largeProjectMode.virtualOverscanScreens, ui.scrollViewport.scrollLeft, ui.scrollViewport.viewportWidth, store.zoom],
  );

  const virtualTrackWindow = useMemo(
    () =>
      getTimelineVirtualTrackWindow({
        scrollTop: ui.scrollViewport.scrollTop,
        viewportHeight: ui.timelineViewportHeight,
        rowHeight: TRACK_HEIGHT,
        trackCount: store.project.timeline.tracks.length,
        overscanRows: 2,
      }),
    [store.project.timeline.tracks.length, ui.scrollViewport.scrollTop, ui.timelineViewportHeight],
  );

  const virtualTracks = useMemo(
    () => filterTimelineVirtualTracks(store.project.timeline.tracks, virtualTrackWindow),
    [store.project.timeline.tracks, virtualTrackWindow],
  );

  const thumbnailTrackSamples = useMemo(() => {
    const samples = buildTimelineThumbnailTrackSamples(store.project.timeline, {
      zoom: store.zoom,
      trackWidth: width,
      duration: timelineDuration,
      visibleStart,
      visibleEnd,
    });
    return sortTimelineThumbnailSamplesByPriority(samples, store.playheadTime);
  }, [store.playheadTime, store.project.timeline, timelineDuration, visibleEnd, visibleStart, width, store.zoom]);

  const activeSequence = store.project.sequences.find((sequence) => sequence.id === store.project.activeSequenceId);
  const isMainSequence = store.project.activeSequenceId === 'sequence-main';

  return {
    allClips,
    largeProjectMode,
    timelineGridBeatTimes,
    ticks,
    playheadTimecode,
    gridLines,
    remoteCollaborationUsers,
    collaborationLocksByClipId,
    activeBeatMarkerId,
    exportRangeHighlights,
    minimapHeight,
    minimapLayout,
    minimapViewport,
    deferredMinimapLayout,
    protectedRanges,
    timelineNotes,
    timelineNoteLayouts,
    filteredTimelineNotes,
    sceneCutOverlays,
    clipGroups,
    clipGroupByClipId,
    selectedGroup,
    orderedTrackIds,
    virtualWindow,
    virtualTrackWindow,
    virtualTracks,
    thumbnailTrackSamples,
    activeSequence: activeSequence as import('@open-factory/editor-core').Sequence | undefined,
    isMainSequence,
    projectDuration,
    width,
    visibleStart,
    visibleEnd,
    deferredHeatmapSegments,
  };
}
