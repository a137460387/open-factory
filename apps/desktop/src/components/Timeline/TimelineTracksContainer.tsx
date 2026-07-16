import React from 'react';
import {
  BatchUpdateTrackHeightCommand,
  UpdateSequenceSettingsCommand,
  type TimelineColorHeatmapPoint,
  type SceneColorDifference,
  type TimelineGridSettings,
} from '@open-factory/editor-core';
import { zhCN } from '../../i18n/strings';
import { commandManager, projectAccessor } from '../../store/commandManager';
import {
  LABEL_WIDTH,
  Ruler,
  ThumbnailTrack,
  TrackRow,
  TRACK_HEIGHT,
} from './TimelineParts';
import {
  TrackBatchMenu,
  TransitionMenu,
  GapActionMenu,
  VolumeEnvelopeMenu,
  RulerContextMenu,
  ClipActionMenu,
} from './TimelineMenus';
import {
  TimelineNoteLayer,
  AnnotationBubble,
  TimelineBookmarkOverlay,
  TimelineMarkerOverlay,
  SceneCutOverlay,
  BeatMarkerOverlay,
  SelectionMarquee,
  TimelineMinimap,
  TimelineColorHeatmapLayer,
  TimelineHeatmapCanvas,
} from './TimelineOverlays';
import {
  SequenceSettingsDialog,
  GapStatsPanel,
} from './TimelineDialogs';
import type { TimelineHeatmapViewSettings } from '../../settings/appSettings';

interface TimelineTracksContainerProps {
  // Scroll container
  scrollRef: React.MutableRefObject<HTMLDivElement | null>;
  onWheel: (e: React.WheelEvent<HTMLDivElement>) => void;
  syncScrollViewport: () => void;
  onTimelineDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  onTimelineDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  onTimelinePointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onTimelineDoubleClick: (e: React.MouseEvent<HTMLDivElement>) => void;

  // Dimensions
  width: number;
  zoom: number;

  // Ruler
  ticks: any[];
  playheadTimecode: string;
  renderCacheRanges: any[];
  staleRanges: any[];
  timelineCompareRanges: any[];
  exportRangeHighlights: any[];
  protectedRanges: any[];
  dialogueMarkers: any[];
  audioScrubEnabled: boolean;
  setPlayheadTime: (time: number) => void;
  openRulerMenu: (...args: any[]) => void;

  // Note layer
  timelineNoteLayouts: any[];
  timelineNoteDraft: any;
  setTimelineNoteDraft: (draft: any) => void;
  onTimelineNoteRangeDraft: (...args: any[]) => void;
  openTimelineNoteEditor: (start: number, end: number, note?: any) => void;

  // Thumbnail track
  thumbnailTrackVisible: boolean;
  thumbnailTrackSamples: any[];
  project: any;

  // Color heatmap
  colorHeatmap: TimelineColorHeatmapPoint[];
  colorJumps: SceneColorDifference[];

  // Grid
  gridLines: { time: number; major: boolean }[];
  snapHighlight: { time: number } | undefined;
  reduceMotion: boolean;

  // Heatmap
  heatmap?: TimelineHeatmapViewSettings;
  deferredHeatmapSegments: any[];

  // Virtual tracks
  virtualTrackWindow: { beforeHeight: number; afterHeight: number; totalHeight: number };
  virtualTracks: any[];
  virtualWindow: any;
  scrollViewport: { scrollLeft: number; viewportWidth: number };

  // Track row / selection
  selectedClipId: string | undefined;
  selectedClipIds: string[];
  selectedKeyframe: any;
  selectedKeyframes: any;
  selectedTrackIds: string[];
  drag: any;
  selectClip: (...args: any[]) => void;
  selectKeyframe: (...args: any[]) => void;
  onDragStart: (...args: any[]) => void;
  onTrackPointerDown: (...args: any[]) => void;
  updateTrack: (...args: any[]) => void;
  selectTrackHeader: (...args: any[]) => void;
  openTrackBatchMenu: (...args: any[]) => void;
  reorderTracks: (...args: any[]) => void;

  // Track row menus
  setGapMenu: (v: any) => void;
  setClipMenu: (v: any) => void;
  setVolumeEnvelopeMenu: (v: any) => void;
  setRulerMenu: (v: any) => void;
  setTransitionMenu: (v: any) => void;
  openGapMenu: (...args: any[]) => void;
  openClipMenu: (...args: any[]) => void;
  addVolumeEnvelopePoint: (...args: any[]) => void;
  updateVolumeEnvelopePoint: (...args: any[]) => void;
  removeVolumeEnvelopePoint: (...args: any[]) => void;
  openVolumeEnvelopeMenu: (...args: any[]) => void;
  openNestedSequence: (...args: any[]) => void;

  // Track row state
  largeProjectMode: any;
  rollingTrimActive: boolean;
  slipEditActive: boolean;
  slideEditActive: boolean;
  clipGroupByClipId: Map<string, any>;
  timelineColorFilter: any;
  envelopeEditMode: boolean;
  collaborationLocksByClipId: Map<string, any>;
  removeAnomaly: (...args: any[]) => void;

  // Overlays
  annotationMode: boolean;
  onAnnotationLayerPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  openAnnotationEditorAt: (time: number, annotation?: any) => void;
  removeTimelineMarker: (id: string) => void;
  sceneCutOverlays: any[];
  removeProjectBookmark: (id: string) => void;
  activeBeatMarkerId: string | undefined;
  removeBeatMarker: (id: string) => void;

  // Transition menu
  transitionMenu: any;
  addTransition: (...args: any[]) => void;
  removeTransition: (...args: any[]) => void;

  // Ruler menu
  rulerMenu: any;
  runRulerMenuAction: (...args: any[]) => void;
  jumpToRulerTimecode: (...args: any[]) => void;

  // Gap menu
  gapMenu: any;
  closeGap: (...args: any[]) => void;
  fillGap: (...args: any[]) => void;

  // Gap stats
  gapStatsOpen: boolean;
  setGapStatsOpen: (v: boolean) => void;

  // Sequence settings
  sequenceSettingsDialogOpen: boolean;
  activeSequence: any;
  setSequenceSettingsDialogOpen: (v: boolean) => void;

  // Volume envelope menu
  volumeEnvelopeMenu: any;
  applyVolumeEnvelopeFade: (...args: any[]) => void;
  resetVolumeEnvelope: (...args: any[]) => void;

  // Clip menu
  clipMenu: any;
  allClips: any[];
  getClipMediaAsset: (clip: any) => any;
  getClipMediaVersionEntries: (clip: any) => any;
  whisperAvailability: { ready: boolean; error?: string };
  openSilenceDetection: (clipId: string) => void;
  openSceneDetection: (clipId: string) => void;
  openCoverFrameGeneration: (clipId: string) => void;
  generateSubtitles: (clipId: string) => void;
  alignSubtitlesToWaveform: (clipId: string) => void;
  ttsVoiceover: (clipId: string) => void;
  openReplaceMedia: (clipId: string) => void;
  switchClipMediaVersion: (clipId: string, mediaId: string) => void;
  convertClipFrameRate: (clipId: string) => void;
  packClipMenuSelection: (clipId: string) => void;
  handleAiReframe: (clipId: string) => void;
  handleAiTransitionRecommend: (clipId: string) => void;
  handleAnomalyDetect: (clipId: string) => void;
  createGroupFromSelection: () => void;
  ungroupSelected: (group?: any) => void;
  deleteGroup: (...args: any[]) => void;
  updateGroupColor: (...args: any[]) => void;
  updateClipColor: (...args: any[]) => void;
  deleteSelected: () => void;
  rippleDeleteSelected: () => void;

  // Track batch menu
  trackBatchMenu: any;
  selectedTracksForBatch: () => any[];
  applyBatchTrackPatch: (...args: any[]) => void;
  deleteSelectedEmptyTracks: () => void;
  setEqualHeightPrompt: (v: boolean) => void;
  setTrackBatchMenu: (v: any) => void;

  // Equal height prompt
  equalHeightPrompt: boolean;
  equalHeightValue: string;
  setEqualHeightValue: (v: string) => void;

  // Selection
  selectionRect: any;
  inPoint: number | undefined;
  outPoint: number | undefined;

  // Remote collaboration
  remoteCollaborationUsers: any[];
  playheadTime: number;
  setDrag: (v: any) => void;

  // Minimap
  minimapVisible: boolean;
  deferredMinimapLayout: any;
  minimapViewport: any;
  minimapHeight: number;
  scrollTimelineFromMinimap: (y: number, mode: 'top' | 'center') => void;
}

export const TimelineTracksContainer = React.memo(function TimelineTracksContainer({
  scrollRef,
  onWheel,
  syncScrollViewport,
  onTimelineDragOver,
  onTimelineDrop,
  onTimelinePointerDown,
  onTimelineDoubleClick,
  width,
  zoom,
  ticks,
  playheadTimecode,
  renderCacheRanges,
  staleRanges,
  timelineCompareRanges,
  exportRangeHighlights,
  protectedRanges,
  dialogueMarkers,
  audioScrubEnabled,
  setPlayheadTime,
  openRulerMenu,
  timelineNoteLayouts,
  timelineNoteDraft,
  setTimelineNoteDraft,
  onTimelineNoteRangeDraft,
  openTimelineNoteEditor,
  thumbnailTrackVisible,
  thumbnailTrackSamples,
  project,
  colorHeatmap,
  colorJumps,
  gridLines,
  snapHighlight,
  reduceMotion,
  heatmap,
  deferredHeatmapSegments,
  virtualTrackWindow,
  virtualTracks,
  virtualWindow,
  scrollViewport,
  selectedClipId,
  selectedClipIds,
  selectedKeyframe,
  selectedKeyframes,
  selectedTrackIds,
  drag,
  selectClip,
  selectKeyframe,
  onDragStart,
  onTrackPointerDown,
  updateTrack,
  selectTrackHeader,
  openTrackBatchMenu,
  reorderTracks,
  setGapMenu,
  setClipMenu,
  setVolumeEnvelopeMenu,
  setRulerMenu,
  setTransitionMenu,
  openGapMenu,
  openClipMenu,
  addVolumeEnvelopePoint,
  updateVolumeEnvelopePoint,
  removeVolumeEnvelopePoint,
  openVolumeEnvelopeMenu,
  openNestedSequence,
  largeProjectMode,
  rollingTrimActive,
  slipEditActive,
  slideEditActive,
  clipGroupByClipId,
  timelineColorFilter,
  envelopeEditMode,
  collaborationLocksByClipId,
  removeAnomaly,
  annotationMode,
  onAnnotationLayerPointerDown,
  openAnnotationEditorAt,
  removeTimelineMarker,
  sceneCutOverlays,
  removeProjectBookmark,
  activeBeatMarkerId,
  removeBeatMarker,
  transitionMenu,
  addTransition,
  removeTransition,
  rulerMenu,
  runRulerMenuAction,
  jumpToRulerTimecode,
  gapMenu,
  closeGap,
  fillGap,
  gapStatsOpen,
  setGapStatsOpen,
  sequenceSettingsDialogOpen,
  activeSequence,
  setSequenceSettingsDialogOpen,
  volumeEnvelopeMenu,
  applyVolumeEnvelopeFade,
  resetVolumeEnvelope,
  clipMenu,
  allClips,
  getClipMediaAsset,
  getClipMediaVersionEntries,
  whisperAvailability,
  openSilenceDetection,
  openSceneDetection,
  openCoverFrameGeneration,
  generateSubtitles,
  alignSubtitlesToWaveform,
  ttsVoiceover,
  openReplaceMedia,
  switchClipMediaVersion,
  convertClipFrameRate,
  packClipMenuSelection,
  handleAiReframe,
  handleAiTransitionRecommend,
  handleAnomalyDetect,
  createGroupFromSelection,
  ungroupSelected,
  deleteGroup,
  updateGroupColor,
  updateClipColor,
  deleteSelected,
  rippleDeleteSelected,
  trackBatchMenu,
  selectedTracksForBatch,
  applyBatchTrackPatch,
  deleteSelectedEmptyTracks,
  setEqualHeightPrompt,
  setTrackBatchMenu,
  equalHeightPrompt,
  equalHeightValue,
  setEqualHeightValue,
  selectionRect,
  inPoint,
  outPoint,
  remoteCollaborationUsers,
  playheadTime,
  setDrag,
  minimapVisible,
  deferredMinimapLayout,
  minimapViewport,
  minimapHeight,
  scrollTimelineFromMinimap,
}: TimelineTracksContainerProps) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1">
      <div
        ref={scrollRef}
        className="timeline-scrollbar min-h-0 min-w-0 max-w-full flex-1 overflow-auto"
        onWheel={onWheel}
        onScroll={syncScrollViewport}
        onDragOver={onTimelineDragOver}
        onDrop={onTimelineDrop}
        onPointerDown={onTimelinePointerDown}
        onDoubleClick={onTimelineDoubleClick}
        data-testid="timeline-scroll-container"
      >
        <div className="relative" style={{ width: LABEL_WIDTH + width }}>
          <Ruler
            ticks={ticks}
            zoom={zoom}
            width={width}
            currentTimecode={playheadTimecode}
            cachedRanges={renderCacheRanges}
            staleRanges={staleRanges}
            diffRanges={timelineCompareRanges}
            exportRanges={exportRangeHighlights}
            protectedRanges={protectedRanges}
            dialogueMarkers={dialogueMarkers}
            onSeek={setPlayheadTime}
            onContextMenu={openRulerMenu}
            audioScrubEnabled={audioScrubEnabled}
          />
          <TimelineNoteLayer
            width={width}
            zoom={zoom}
            notes={timelineNoteLayouts}
            draft={timelineNoteDraft}
            onDraftChange={setTimelineNoteDraft}
            onCreateRange={onTimelineNoteRangeDraft}
            onSeek={setPlayheadTime}
            onEdit={(note) => openTimelineNoteEditor(note.start, note.end, note)}
          />
          {thumbnailTrackVisible ? (
            <ThumbnailTrack samples={thumbnailTrackSamples} media={project.media} zoom={zoom} width={width} />
          ) : null}
          <div className="relative">
            {colorHeatmap.length > 0 || colorJumps.length > 0 ? (
              <TimelineColorHeatmapLayer points={colorHeatmap} jumps={colorJumps} zoom={zoom} width={width} />
            ) : null}
            {gridLines.map((line) => (
              <div
                key={`${line.time}-${line.major ? 'major' : 'minor'}`}
                className={
                  line.major
                    ? 'pointer-events-none absolute bottom-0 top-0 z-[1] border-l border-line/80'
                    : 'pointer-events-none absolute bottom-0 top-0 z-[1] border-l border-line/70'
                }
                style={{ left: LABEL_WIDTH + line.time * zoom }}
                data-testid="timeline-grid-line"
                data-grid-major={line.major ? 'true' : 'false'}
              />
            ))}
            {snapHighlight && !reduceMotion ? (
              <div
                className="pointer-events-none absolute bottom-0 top-0 z-[24] border-l-2 border-yellow-400 bg-yellow-400/10 shadow-[0_0_12px_rgba(250,204,21,0.5)]"
                style={{ left: LABEL_WIDTH + snapHighlight.time * zoom }}
                data-testid="timeline-snap-highlight"
                data-time={snapHighlight.time}
              />
            ) : null}
            {heatmap?.enabled ? (
              <TimelineHeatmapCanvas
                segments={deferredHeatmapSegments}
                zoom={zoom}
                width={width}
                height={Math.max(TRACK_HEIGHT, virtualTrackWindow.totalHeight)}
                opacity={heatmap.opacity}
                colorScheme={heatmap.colorScheme}
              />
            ) : null}
            {virtualTrackWindow.beforeHeight > 0 ? (
              <div
                style={{ height: virtualTrackWindow.beforeHeight }}
                data-testid="timeline-track-virtual-spacer-before"
              />
            ) : null}
            {virtualTracks.map((track) => (
              <TrackRow
                key={track.id}
                track={track}
                zoom={zoom}
                selectedClipId={selectedClipId}
                selectedClipIds={selectedClipIds}
                selectedKeyframe={selectedKeyframe}
                selectedKeyframes={selectedKeyframes}
                selectedTrackIds={selectedTrackIds}
                drag={drag}
                media={project.media}
                onSelect={selectClip}
                onKeyframeSelect={selectKeyframe}
                onDragStart={onDragStart}
                onTrackPointerDown={onTrackPointerDown}
                onTrackUpdate={updateTrack}
                onTrackHeaderClick={selectTrackHeader}
                onTrackBatchMenu={openTrackBatchMenu}
                onTrackReorder={reorderTracks}
                transitions={project.timeline.transitions ?? []}
                onTransitionMenu={(request) => {
                  setGapMenu(undefined);
                  setClipMenu(undefined);
                  setVolumeEnvelopeMenu(undefined);
                  setRulerMenu(undefined);
                  setTransitionMenu({
                    ...request,
                    x: Math.min(request.x, Math.max(0, window.innerWidth - 380)),
                    y: Math.min(request.y, Math.max(0, window.innerHeight - 520)),
                    type: request.existingType ?? 'dissolve',
                    duration: request.existingDuration ?? 0.5,
                  });
                }}
                onGapMenu={openGapMenu}
                onClipMenu={openClipMenu}
                onVolumeEnvelopeAdd={addVolumeEnvelopePoint}
                onVolumeEnvelopeUpdate={updateVolumeEnvelopePoint}
                onVolumeEnvelopeRemove={removeVolumeEnvelopePoint}
                onVolumeEnvelopeMenu={openVolumeEnvelopeMenu}
                onClipDoubleClick={openNestedSequence}
                virtualWindow={virtualWindow}
                assetLoadWindow={{
                  scrollLeft: scrollViewport.scrollLeft,
                  viewportWidth: scrollViewport.viewportWidth,
                  labelWidth: LABEL_WIDTH,
                }}
                largeProjectMode={largeProjectMode}
                rollingTrimActive={rollingTrimActive}
                slipEditActive={slipEditActive}
                slideEditActive={slideEditActive}
                clipGroupByClipId={clipGroupByClipId}
                colorFilter={timelineColorFilter}
                projectFrameRate={project.settings.fps}
                envelopeEditMode={envelopeEditMode}
                reduceMotion={reduceMotion}
                collaborationLocksByClipId={collaborationLocksByClipId}
                onRemoveAnomaly={removeAnomaly}
                continuityWarnings={project.timeline.continuityWarnings ?? []}
                colorConsistencyWarnings={project.timeline.colorConsistencyWarnings ?? []}
                sfxSuggestions={project.timeline.sfxSuggestions ?? []}
              />
            ))}
            {virtualTrackWindow.afterHeight > 0 ? (
              <div
                style={{ height: virtualTrackWindow.afterHeight }}
                data-testid="timeline-track-virtual-spacer-after"
              />
            ) : null}
            {project.pacingAnalysis
              ? (() => {
                  const pa = project.pacingAnalysis;
                  const maxCpm = pa.cpmCurve.length > 0 ? Math.max(...pa.cpmCurve.map((p: any) => p.cpm), 1) : 1;
                  return (
                    <div
                      className="relative h-10 border-t border-line bg-panel"
                      style={{ marginLeft: LABEL_WIDTH }}
                      data-testid="pacing-analysis-chart"
                    >
                      {pa.slowSegments.map((seg: any, si: number) => (
                        <div
                          key={si}
                          className="absolute top-0 bottom-0 bg-[var(--color-accent)]/15 cursor-pointer"
                          style={{ left: seg.start * zoom, width: Math.max(2, (seg.end - seg.start) * zoom) }}
                          title={
                            zhCN.pacingAnalysis.slowSegment +
                            ' ' +
                            seg.start.toFixed(1) +
                            's-' +
                            seg.end.toFixed(1) +
                            's: ' +
                            zhCN.pacingAnalysis.suggestion
                          }
                          data-testid={`pacing-slow-segment-${si}`}
                        />
                      ))}
                      {pa.fastSegments.map((seg: any, fi: number) => (
                        <div
                          key={fi}
                          className="absolute top-0 bottom-0 bg-[var(--color-danger)]/15"
                          style={{ left: seg.start * zoom, width: Math.max(2, (seg.end - seg.start) * zoom) }}
                          title={
                            zhCN.pacingAnalysis.fastSegment +
                            ' ' +
                            seg.start.toFixed(1) +
                            's-' +
                            seg.end.toFixed(1) +
                            's'
                          }
                          data-testid={`pacing-fast-segment-${fi}`}
                        />
                      ))}
                      <svg
                        className="absolute inset-0 w-full h-full"
                        preserveAspectRatio="none"
                        viewBox={`0 0 ${Math.max(1, pa.cpmCurve.length)} ${maxCpm}`}
                      >
                        {pa.cpmCurve.map((pt: any, i: number) => {
                          if (i === 0) return null;
                          const prev = pa.cpmCurve[i - 1];
                          return (
                            <line
                              key={i}
                              x1={i - 1}
                              y1={maxCpm - prev.cpm}
                              x2={i}
                              y2={maxCpm - pt.cpm}
                              stroke="#6366f1"
                              strokeWidth={maxCpm * 0.03}
                            />
                          );
                        })}
                      </svg>
                      <div className="absolute right-1 top-0.5 text-[9px] text-muted" data-testid="pacing-avg-cpm">
                        {zhCN.pacingAnalysis.avgCpm}: {pa.overallAvgCPM.toFixed(1)}
                      </div>
                    </div>
                  );
                })()
              : null}
            {protectedRanges.map((range) => (
              <div
                key={range.id}
                className="pointer-events-none absolute bottom-0 top-0 z-[8] bg-rose-500/20 outline outline-1 outline-rose-500/50"
                style={{
                  left: LABEL_WIDTH + range.start * zoom,
                  width: Math.max(2, (range.end - range.start) * zoom),
                }}
                title={range.label}
                data-testid="timeline-protected-range"
                data-range-id={range.id}
              />
            ))}
            {annotationMode ? (
              <div
                className="absolute bottom-0 top-0 z-30 cursor-crosshair bg-transparent"
                style={{ left: LABEL_WIDTH, width }}
                data-testid="timeline-annotation-click-layer"
                onPointerDown={onAnnotationLayerPointerDown}
              />
            ) : null}
            {(project.annotations ?? []).map((annotation: any, index: number) => (
              <AnnotationBubble
                key={annotation.id}
                annotation={annotation}
                index={index}
                left={LABEL_WIDTH + annotation.time * zoom}
                onSeek={setPlayheadTime}
                onEdit={openAnnotationEditorAt}
              />
            ))}
            {(project.timeline.markers ?? []).map((marker: any) => (
              <TimelineMarkerOverlay
                key={marker.id}
                marker={marker}
                left={LABEL_WIDTH + marker.time * zoom}
                onSeek={setPlayheadTime}
                onRemove={removeTimelineMarker}
              />
            ))}
            {sceneCutOverlays.map((cut) => (
              <SceneCutOverlay key={cut.id} cut={cut} left={LABEL_WIDTH + cut.time * zoom} onSeek={setPlayheadTime} />
            ))}
            {(project.bookmarks ?? []).map((bookmark: any) => (
              <TimelineBookmarkOverlay
                key={bookmark.id}
                bookmark={bookmark}
                left={LABEL_WIDTH + bookmark.time * zoom}
                onSeek={setPlayheadTime}
                onRemove={removeProjectBookmark}
              />
            ))}
            {(project.beatMarkers ?? []).map((marker: any) => (
              <BeatMarkerOverlay
                key={marker.id}
                marker={marker}
                left={LABEL_WIDTH + marker.time * zoom}
                active={activeBeatMarkerId === marker.id}
                onSeek={setPlayheadTime}
                onRemove={removeBeatMarker}
              />
            ))}
            {transitionMenu ? (
              <TransitionMenu
                menu={transitionMenu}
                onChange={setTransitionMenu}
                onAdd={addTransition}
                onRemove={transitionMenu.existingTransitionId ? removeTransition : undefined}
                onClose={() => setTransitionMenu(undefined)}
              />
            ) : null}
            {rulerMenu ? (
              <RulerContextMenu
                menu={rulerMenu}
                onChange={setRulerMenu}
                onAction={runRulerMenuAction}
                onJump={jumpToRulerTimecode}
                onClose={() => setRulerMenu(undefined)}
              />
            ) : null}
            {gapMenu ? (
              <GapActionMenu
                menu={gapMenu}
                onClose={() => setGapMenu(undefined)}
                onCloseGap={closeGap}
                onFillGap={(strategy) => void fillGap(strategy)}
              />
            ) : null}
            {gapStatsOpen ? (
              <GapStatsPanel
                timeline={project.timeline}
                tracks={project.timeline.tracks}
                onClose={() => setGapStatsOpen(false)}
              />
            ) : null}
            {sequenceSettingsDialogOpen && activeSequence ? (
              <SequenceSettingsDialog
                sequence={activeSequence}
                projectSettings={{
                  fps: project.settings.fps,
                  width: project.settings.width ?? 1280,
                  height: project.settings.height ?? 720,
                }}
                onSave={(settings) => {
                  commandManager.execute(
                    new UpdateSequenceSettingsCommand(projectAccessor, activeSequence.id, settings),
                  );
                }}
                onClose={() => setSequenceSettingsDialogOpen(false)}
              />
            ) : null}
            {volumeEnvelopeMenu ? (
              <VolumeEnvelopeMenu
                menu={volumeEnvelopeMenu}
                onFade={applyVolumeEnvelopeFade}
                onReset={resetVolumeEnvelope}
                onClose={() => setVolumeEnvelopeMenu(undefined)}
              />
            ) : null}
            {clipMenu ? (
              <ClipActionMenu
                menu={clipMenu}
                clip={allClips.find((clip) => clip.id === clipMenu.clipId)}
                asset={
                  allClips.find((clip) => clip.id === clipMenu.clipId)
                    ? getClipMediaAsset(allClips.find((clip) => clip.id === clipMenu.clipId)!)
                    : undefined
                }
                versionEntries={getClipMediaVersionEntries(allClips.find((clip) => clip.id === clipMenu.clipId))}
                group={clipGroupByClipId.get(clipMenu.clipId)}
                projectFrameRate={project.settings.fps}
                canCreateGroup={selectedClipIds.length >= 2}
                whisperReady={whisperAvailability.ready}
                whisperUnavailableMessage={whisperAvailability.error}
                onSilence={() => openSilenceDetection(clipMenu.clipId)}
                onScene={() => void openSceneDetection(clipMenu.clipId)}
                onGenerateCover={() => void openCoverFrameGeneration(clipMenu.clipId)}
                onGenerateSubtitles={() => void generateSubtitles(clipMenu.clipId)}
                onAlignSubtitles={() => void alignSubtitlesToWaveform(clipMenu.clipId)}
                onTtsVoiceover={() => void ttsVoiceover(clipMenu.clipId)}
                onReplaceMedia={() => void openReplaceMedia(clipMenu.clipId)}
                onSwitchVersion={(mediaId) => switchClipMediaVersion(clipMenu.clipId, mediaId)}
                onConvertFrameRate={() => convertClipFrameRate(clipMenu.clipId)}
                onPack={() => packClipMenuSelection(clipMenu.clipId)}
                onAiReframe={() => handleAiReframe(clipMenu.clipId)}
                onAiTransitionRecommend={() => handleAiTransitionRecommend(clipMenu.clipId)}
                onAnomalyDetect={() => handleAnomalyDetect(clipMenu.clipId)}
                onCreateGroup={createGroupFromSelection}
                onUngroup={(group) => ungroupSelected(group)}
                onDeleteGroup={deleteGroup}
                onGroupColor={updateGroupColor}
                onClipColor={updateClipColor}
                onDelete={() => {
                  deleteSelected();
                  setClipMenu(undefined);
                }}
                onRippleDelete={() => {
                  rippleDeleteSelected();
                  setClipMenu(undefined);
                }}
                onClose={() => setClipMenu(undefined)}
              />
            ) : null}
            {trackBatchMenu ? (
              <TrackBatchMenu
                menu={trackBatchMenu}
                selectedTracks={selectedTracksForBatch()}
                onPatch={applyBatchTrackPatch}
                onDeleteEmpty={deleteSelectedEmptyTracks}
                onSetEqualHeight={() => {
                  setEqualHeightPrompt(true);
                  setTrackBatchMenu(undefined);
                }}
                onClose={() => setTrackBatchMenu(undefined)}
              />
            ) : null}

            {equalHeightPrompt ? (
              <div
                className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30"
                data-testid="equal-height-dialog"
                onClick={() => setEqualHeightPrompt(false)}
              >
                <div
                  className="w-72 rounded-lg bg-[var(--color-bg-elevated)] p-4 shadow-lg"
                  onClick={(e) => e.stopPropagation()}
                >
                  <h3 className="mb-3 text-sm font-semibold">{zhCN.timeline.trackBatchSetEqualHeight}</h3>
                  <label className="mb-3 block text-xs text-[var(--color-text-secondary)]">
                    <span>px</span>
                    <input
                      className="mt-1 w-full rounded border border-line px-2 py-1 text-sm"
                      type="number"
                      min={24}
                      max={200}
                      value={equalHeightValue}
                      onChange={(e) => setEqualHeightValue(e.target.value)}
                      data-testid="equal-height-input"
                    />
                  </label>
                  <div className="flex justify-end gap-2">
                    <button
                      className="rounded px-3 py-1 text-xs hover:bg-panel"
                      type="button"
                      onClick={() => setEqualHeightPrompt(false)}
                    >
                      {zhCN.timeline.close}
                    </button>
                    <button
                      className="rounded bg-brand px-3 py-1 text-xs text-white hover:bg-brand/90"
                      type="button"
                      data-testid="equal-height-confirm"
                      onClick={() => {
                        const h = Number(equalHeightValue);
                        if (Number.isFinite(h)) {
                          try {
                            commandManager.execute(new BatchUpdateTrackHeightCommand(projectAccessor, h));
                          } catch {}
                        }
                        setEqualHeightPrompt(false);
                      }}
                    >
                      {zhCN.timeline.close}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
            {selectionRect ? <SelectionMarquee rect={selectionRect} /> : null}
            {typeof inPoint === 'number' ? (
              <div
                className="absolute bottom-0 top-0 z-10 w-0.5 bg-emerald-500"
                style={{ left: LABEL_WIDTH + inPoint * zoom }}
                title={zhCN.timeline.inPoint}
                data-testid="timeline-in-point-marker"
              />
            ) : null}
            {typeof outPoint === 'number' ? (
              <div
                className="absolute bottom-0 top-0 z-10 w-0.5 bg-amber-500"
                style={{ left: LABEL_WIDTH + outPoint * zoom }}
                title={zhCN.timeline.outPoint}
                data-testid="timeline-out-point-marker"
              />
            ) : null}
            {remoteCollaborationUsers.map((user) => (
              <div
                key={user.userId}
                className="pointer-events-none absolute bottom-0 top-0 z-[18] w-0.5"
                style={{
                  left: LABEL_WIDTH + Math.max(0, user.playheadTime) * zoom,
                  backgroundColor: user.color ?? '#38bdf8',
                }}
                title={zhCN.timeline.remotePlayhead(user.name)}
                data-testid={`timeline-remote-playhead-${user.userId}`}
                data-user-id={user.userId}
                data-playhead-time={user.playheadTime}
              >
                <span
                  className="absolute left-1 top-1 max-w-[120px] truncate rounded-sm px-1.5 py-0.5 text-[10px] font-semibold text-white shadow-sm"
                  style={{ backgroundColor: user.color ?? '#38bdf8' }}
                  data-testid={`timeline-remote-playhead-label-${user.userId}`}
                >
                  {user.name}
                </span>
              </div>
            ))}
            <div
              className="absolute bottom-0 top-0 z-20 w-0.5 bg-coral shadow-[0_0_8px_rgba(249,115,22,0.5)]"
              style={{ left: LABEL_WIDTH + playheadTime * zoom }}
              data-testid="timeline-playhead"
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                setDrag({
                  mode: 'playhead',
                  startX: event.clientX,
                  previewStart: playheadTime,
                  previewDuration: 0,
                  previewTrimStart: 0,
                  previewTrimEnd: 0,
                });
              }}
            />
          </div>
        </div>
      </div>
      {minimapVisible ? (
        <TimelineMinimap
          layout={deferredMinimapLayout}
          viewport={minimapViewport}
          height={minimapHeight}
          onNavigate={scrollTimelineFromMinimap}
        />
      ) : null}
    </div>
  );
});
