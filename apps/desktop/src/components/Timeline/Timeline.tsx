import { useRef } from 'react';
import {
  DEFAULT_TIMELINE_GRID_SETTINGS,
  type TimelineColorHeatmapPoint,
  type SceneColorDifference,
  type TimelineGridSettings,
} from '@open-factory/editor-core';
import { clsx } from 'clsx';
import { useEditorStore } from '../../store/editorStore';
import { TimelineHeader } from './TimelineHeader';
import { TimelineTracksContainer } from './TimelineTracksContainer';
import { TimelineDialogsLayer } from './TimelineDialogsLayer';
import type { TimelineHeatmapViewSettings } from '../../settings/appSettings';
import { useTimelineHandlers } from './useTimelineHandlers';
import { useTimelineState } from './useTimelineState';

export function Timeline({
  thumbnailTrackVisible = true,
  minimapVisible = true,
  heatmap,
  colorHeatmap = [],
  colorJumps = [],
  timelineGridSettings = DEFAULT_TIMELINE_GRID_SETTINGS,
  reduceMotion = false,
  bookmarkPanelOpen: controlledBookmarkPanelOpen,
  onBookmarkPanelOpenChange,
  onConvertMediaFrameRate,
  sceneDetectionRequestId = 0,
  onRoughCutCompare,
}: {
  thumbnailTrackVisible?: boolean;
  minimapVisible?: boolean;
  heatmap?: TimelineHeatmapViewSettings;
  colorHeatmap?: TimelineColorHeatmapPoint[];
  colorJumps?: SceneColorDifference[];
  timelineGridSettings?: TimelineGridSettings;
  reduceMotion?: boolean;
  bookmarkPanelOpen?: boolean;
  onBookmarkPanelOpenChange?(open: boolean): void;
  onConvertMediaFrameRate?(assetId: string): void;
  sceneDetectionRequestId?: number;
  onRoughCutCompare?(clipId: string): void;
}) {
  const handlerRefs = useRef({
    quickAddTimelineNote: undefined as (() => void) | undefined,
    toggleProtectedRangeAtPlayhead: undefined as (() => void) | undefined,
    syncScrollViewport: undefined as (() => void) | undefined,
    openSceneDetection: undefined as ((clipId: string) => void) | undefined,
  });

  const state = useTimelineState({
    thumbnailTrackVisible,
    minimapVisible,
    heatmap,
    colorHeatmap,
    colorJumps,
    timelineGridSettings,
    reduceMotion,
    bookmarkPanelOpen: controlledBookmarkPanelOpen,
    onBookmarkPanelOpenChange,
    onConvertMediaFrameRate,
    sceneDetectionRequestId,
    handlerRefs,
  });

  const {
    project,
    selectedClipId,
    selectedClipIds,
    playheadTime,
    isPlaying,
    inPoint,
    outPoint,
    projectPath,
    timelineCompareRanges,
    zoom,
    setSelectedClipId,
    setSelectedClipIds,
    addMedia,
    selectedKeyframe,
    selectedKeyframes,
    setSelectedKeyframe,
    setSelectedKeyframes,
    toggleSelectedKeyframe,
    toggleSelectedClipId,
    clearSelectedClipIds,
    setPlayheadTime,
    setInPoint,
    setOutPoint,
    setTimelineZoom,
    setPreviewTimeline,
    setActiveSequenceId,
    renderCacheRanges,
    staleRanges,
    collaborationEnabled,
    collaborationUserId,
    collaborationUsers,
    collaborationLocks,
    whisperExecutablePath,
    whisperModelPath,
    drag,
    setDrag,
    snapHighlight,
    setSnapHighlight,
    selectionRect,
    setSelectionRect,
    selectionStart,
    setSelectionStart,
    isPanning,
    setIsPanning,
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
    trackBatchMenu,
    setTrackBatchMenu,
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
    replaceMediaDialog,
    setReplaceMediaDialog,
    reframeDialog,
    setReframeDialog,
    transitionDialog,
    setTransitionDialog,
    sequenceSettingsDialogOpen,
    setSequenceSettingsDialogOpen,
    dialoguePanelOpen,
    setDialoguePanelOpen,
    dialogueMarkers,
    setDialogueMarkers,
    dialogueMisses,
    setDialogueMisses,
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
    bookmarkRename,
    setBookmarkRename,
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
    gapStatsOpen,
    setGapStatsOpen,
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
    isPending,
    startTransition,
    rootRef,
    scrollRef,
    heatmapWorkerRef,
    heatmapRequestIdRef,
    longPressTimerRef,
    longPressActiveRef,
    gestureScaleRef,
    scrollRafRef,
    deferredHeatmapSegments,
    deferredMinimapLayout,
    allClips,
    largeProjectMode,
    timelineDuration,
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
    activeSequence,
    isMainSequence,
    projectDuration,
    width,
    visibleStart,
    visibleEnd,
    setBookmarkPanelVisible,
  } = state;

  const {
    addTrack,
    updateTrack,
    selectTrackHeader,
    openTrackBatchMenu,
    selectedTracksForBatch,
    applyBatchTrackPatch,
    deleteSelectedEmptyTracks,
    reorderTracks,
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
    onPointerMove,
    onPointerUp,
    onDragStart,
    selectClip,
    findClipById,
    canApplyProtectedMove,
    warnProtectedRangeBlocked,
    getKeyframeTime,
    buildKeyframeStartTimes,
    selectKeyframe,
    openNestedSequence,
    packClipMenuSelection,
    openReplaceMedia,
    confirmReplaceMedia,
    removeBeatMarker,
    openGapMenu,
    closeGap,
    fillGap,
    createGapFillMediaAsset,
    buildGapFillAsset,
    onTrackPointerDown,
    onAnnotationLayerPointerDown,
    openClipMenu,
    addVolumeEnvelopePoint,
    updateVolumeEnvelopePoint,
    removeVolumeEnvelopePoint,
    openVolumeEnvelopeMenu,
    applyVolumeEnvelopeFade,
    resetVolumeEnvelope,
    openSilenceDetection,
    getDialogueDetectionTarget,
    runDialogueDetection,
    generateDialogueSubtitles,
    applySilenceRemoval,
    openSceneDetection,
    startSceneDetection,
    cancelCurrentSceneDetection,
    applySceneDetectionResult,
    openCoverFrameGeneration,
    applyProjectCoverFrame,
    generateSubtitles,
    findSubtitleAlignmentSource,
    alignSubtitlesToWaveform,
    ttsVoiceover,
    handleAiReframe,
    applyAiReframe,
    handleAiTransitionRecommend,
    applyAiTransition,
    handleAnomalyDetect,
    removeAnomaly,
    onWheel,
    syncScrollViewport,
    onTimelinePointerDown,
    onTimelineDoubleClick,
    scrollTimelineFromMinimap,
    onTimelineDragOver,
    onTimelineDrop,
    onKeyDown,
    moveSelectedClipsByKeyboardFrame,
    trimSelectedClipByKeyboardFrame,
    applyZoom,
    buildMovedPreviewTimeline,
    buildTrimPreview,
    findClip,
    getClipMediaAsset,
    getClipMediaVersionEntries,
    switchClipMediaVersion,
    minFrameDuration,
    findClipIdsIntersectingRect,
    flashSnapHighlight,
    snapClipStart,
    snapClipEnd,
    snapKeyframeTime,
    buildSnapCandidates,
  } = useTimelineHandlers({
    // useState – drag / UI interaction state
    drag,
    setDrag,
    snapHighlight,
    setSnapHighlight,
    selectionRect,
    setSelectionRect,
    selectionStart,
    setSelectionStart,

    // useState – menus
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

    // useState – dialogs
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
    replaceMediaDialog,
    setReplaceMediaDialog,
    reframeDialog,
    setReframeDialog,
    transitionDialog,
    setTransitionDialog,

    // useState – panels / modes
    dialoguePanelOpen,
    setDialoguePanelOpen,
    dialogueMarkers,
    setDialogueMarkers,
    dialogueMisses,
    setDialogueMisses,
    whisperAvailability,
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
    timelineNoteDraft,
    setTimelineNoteDraft,
    bookmarkRename,
    setBookmarkRename,
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
    audioScrubEnabled,
    equalHeightPrompt,
    setEqualHeightPrompt,
    equalHeightValue,
    setEqualHeightValue,
    scrollViewport,
    setScrollViewport,
    setTimelineViewportHeight,
    isPanning,
    setIsPanning,

    // useEditorStore
    project,
    selectedClipId,
    selectedClipIds,
    playheadTime,
    isPlaying,
    inPoint,
    outPoint,
    projectPath,
    zoom,
    setSelectedClipId,
    setSelectedClipIds: setSelectedClipIds as (ids: string[] | ((current: string[]) => string[])) => void,
    addMedia,
    selectedKeyframe,
    selectedKeyframes,
    setSelectedKeyframe,
    setSelectedKeyframes,
    toggleSelectedKeyframe,
    toggleSelectedClipId,
    clearSelectedClipIds,
    setPlayheadTime,
    setInPoint,
    setOutPoint,
    setTimelineZoom,
    setPreviewTimeline,
    setActiveSequenceId,

    // useMemo
    allClips,
    clipGroups,
    clipGroupByClipId,
    selectedGroup,
    orderedTrackIds,
    protectedRanges,
    timelineNotes,
    timelineDuration,

    // useRef
    rootRef,
    scrollRef,
    longPressTimerRef,
    longPressActiveRef,
    scrollRafRef,

    // Props
    onConvertMediaFrameRate,
    onBookmarkPanelOpenChange,
    reduceMotion,
    timelineGridSettings,

    // Collaboration
    collaborationEnabled,
    collaborationUserId,

    // Additional computed values
    bookmarkPanelOpen,
    setBookmarkPanelVisible,
    projectDuration,
    timelineGridBeatTimes,
    startTransition,
    minimapHeight,
    handlerRefs,

    // Misc
    useEditorStoreRef: useEditorStore,
  });

  return (
    <section
      ref={rootRef}
      className={clsx(
        'relative flex h-full min-h-0 min-w-0 max-w-full flex-col border-t border-line bg-panel focus:outline-none',
        reduceMotion && 'timeline-reduce-motion',
      )}
      tabIndex={0}
      data-testid="timeline-root"
      data-reduce-motion={reduceMotion ? 'true' : 'false'}
      data-editing-mode={
        slideEditActive ? 'slide' : slipEditActive ? 'slip' : rollingTrimActive ? 'rolling-trim' : 'none'
      }
      data-timeline-shortcuts-root="true"
      onPointerDown={(event) => {
        const target = event.target as HTMLElement | null;
        if (!target?.closest('button,input,textarea,select')) {
          rootRef.current?.focus();
        }
      }}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onKeyDown={onKeyDown}
    >
      <TimelineHeader
        isMainSequence={isMainSequence}
        activeSequence={activeSequence}
        onSetActiveSequenceId={(id) => setActiveSequenceId(id)}
        onOpenSequenceSettings={() => setSequenceSettingsDialogOpen(true)}
        onAddVideoTrack={() => addTrack('video')}
        onAddAudioTrack={() => addTrack('audio')}
        onAddSubtitleTrack={() => addTrack('subtitle')}
        onAddTextClip={addText}
        onAddCreditsClip={() => addCredits()}
        onAddMarker={() => addTimelineMarker()}
        onAddBookmark={() => addProjectBookmark()}
        onAddBeatMarker={addBeatMarker}
        beatSnapEnabled={beatSnapEnabled}
        onToggleBeatSnap={() => setBeatSnapEnabled((enabled) => !enabled)}
        beatSnapSuggestionCount={(project.beatSnapSuggestions ?? []).length}
        onToggleBeatSnapPanel={() => setBeatSnapPanelOpen((open) => !open)}
        dialoguePanelOpen={dialoguePanelOpen}
        onToggleDialoguePanel={() => setDialoguePanelOpen((open) => !open)}
        bookmarkPanelOpen={bookmarkPanelOpen}
        onToggleBookmarkPanel={() => {
          setBookmarkPanelVisible((open) => !open);
          setAnnotationPanelOpen(false);
        }}
        annotationMode={annotationMode}
        onToggleAnnotationMode={() => {
          setAnnotationMode((active) => !active);
          setAnnotationPanelOpen(true);
          setBookmarkPanelVisible(false);
        }}
        annotationPanelOpen={annotationPanelOpen}
        onToggleAnnotationPanel={() => {
          setAnnotationPanelOpen((open) => !open);
          setBookmarkPanelVisible(false);
        }}
        onQuickAddTimelineNote={quickAddTimelineNote}
        timelineNotePanelOpen={timelineNotePanelOpen}
        onToggleTimelineNotePanel={() => {
          setTimelineNotePanelOpen((open) => !open);
          setAnnotationPanelOpen(false);
          setBookmarkPanelVisible(false);
        }}
        envelopeEditMode={envelopeEditMode}
        onToggleEnvelopeEditMode={() => {
          setEnvelopeEditMode((active) => !active);
          setVolumeEnvelopeMenu(undefined);
        }}
        gapStatsOpen={gapStatsOpen}
        onToggleGapStats={() => setGapStatsOpen((open) => !open)}
        onSplitSelected={splitSelected}
        selectedClipIds={selectedClipIds}
        onCreateGroupFromSelection={createGroupFromSelection}
        selectedGroup={selectedGroup}
        onUngroupSelected={() => ungroupSelected()}
        onDeleteSelected={deleteSelected}
        onRippleDeleteSelected={rippleDeleteSelected}
        slipEditActive={slipEditActive}
        slideEditActive={slideEditActive}
        rollingTrimActive={rollingTrimActive}
        zoom={zoom}
        onSetZoom={(value) => setTimelineZoom(value)}
        timelineColorFilter={timelineColorFilter}
        onSetTimelineColorFilter={setTimelineColorFilter}
      />
      <TimelineTracksContainer
        scrollRef={scrollRef}
        onWheel={onWheel}
        syncScrollViewport={syncScrollViewport}
        onTimelineDragOver={onTimelineDragOver}
        onTimelineDrop={onTimelineDrop}
        onTimelinePointerDown={onTimelinePointerDown}
        onTimelineDoubleClick={onTimelineDoubleClick}
        width={width}
        zoom={zoom}
        ticks={ticks}
        playheadTimecode={playheadTimecode}
        renderCacheRanges={renderCacheRanges}
        staleRanges={staleRanges}
        timelineCompareRanges={timelineCompareRanges}
        exportRangeHighlights={exportRangeHighlights}
        protectedRanges={protectedRanges}
        dialogueMarkers={dialogueMarkers}
        audioScrubEnabled={audioScrubEnabled}
        setPlayheadTime={setPlayheadTime}
        openRulerMenu={openRulerMenu}
        timelineNoteLayouts={timelineNoteLayouts}
        timelineNoteDraft={timelineNoteDraft}
        setTimelineNoteDraft={setTimelineNoteDraft}
        onTimelineNoteRangeDraft={onTimelineNoteRangeDraft}
        openTimelineNoteEditor={openTimelineNoteEditor}
        thumbnailTrackVisible={thumbnailTrackVisible}
        thumbnailTrackSamples={thumbnailTrackSamples}
        project={project}
        colorHeatmap={colorHeatmap}
        colorJumps={colorJumps}
        gridLines={gridLines}
        snapHighlight={snapHighlight}
        reduceMotion={reduceMotion}
        heatmap={heatmap}
        deferredHeatmapSegments={deferredHeatmapSegments}
        virtualTrackWindow={virtualTrackWindow}
        virtualTracks={virtualTracks}
        virtualWindow={virtualWindow}
        scrollViewport={scrollViewport}
        selectedClipId={selectedClipId}
        selectedClipIds={selectedClipIds}
        selectedKeyframe={selectedKeyframe}
        selectedKeyframes={selectedKeyframes}
        selectedTrackIds={selectedTrackIds}
        drag={drag}
        selectClip={selectClip}
        selectKeyframe={selectKeyframe}
        onDragStart={onDragStart}
        onTrackPointerDown={onTrackPointerDown}
        updateTrack={updateTrack}
        selectTrackHeader={selectTrackHeader}
        openTrackBatchMenu={openTrackBatchMenu}
        reorderTracks={reorderTracks}
        setGapMenu={setGapMenu}
        setClipMenu={setClipMenu}
        setVolumeEnvelopeMenu={setVolumeEnvelopeMenu}
        setRulerMenu={setRulerMenu}
        setTransitionMenu={setTransitionMenu}
        openGapMenu={openGapMenu}
        openClipMenu={openClipMenu}
        addVolumeEnvelopePoint={addVolumeEnvelopePoint}
        updateVolumeEnvelopePoint={updateVolumeEnvelopePoint}
        removeVolumeEnvelopePoint={removeVolumeEnvelopePoint}
        openVolumeEnvelopeMenu={openVolumeEnvelopeMenu}
        openNestedSequence={openNestedSequence}
        largeProjectMode={largeProjectMode}
        rollingTrimActive={rollingTrimActive}
        slipEditActive={slipEditActive}
        slideEditActive={slideEditActive}
        clipGroupByClipId={clipGroupByClipId}
        timelineColorFilter={timelineColorFilter}
        envelopeEditMode={envelopeEditMode}
        collaborationLocksByClipId={collaborationLocksByClipId}
        removeAnomaly={removeAnomaly}
        annotationMode={annotationMode}
        onAnnotationLayerPointerDown={onAnnotationLayerPointerDown}
        openAnnotationEditorAt={openAnnotationEditorAt}
        removeTimelineMarker={removeTimelineMarker}
        sceneCutOverlays={sceneCutOverlays}
        removeProjectBookmark={removeProjectBookmark}
        activeBeatMarkerId={activeBeatMarkerId}
        removeBeatMarker={removeBeatMarker}
        transitionMenu={transitionMenu}
        addTransition={addTransition}
        removeTransition={removeTransition}
        rulerMenu={rulerMenu}
        runRulerMenuAction={runRulerMenuAction}
        jumpToRulerTimecode={jumpToRulerTimecode}
        gapMenu={gapMenu}
        closeGap={closeGap}
        fillGap={fillGap}
        gapStatsOpen={gapStatsOpen}
        setGapStatsOpen={setGapStatsOpen}
        sequenceSettingsDialogOpen={sequenceSettingsDialogOpen}
        activeSequence={activeSequence}
        setSequenceSettingsDialogOpen={setSequenceSettingsDialogOpen}
        volumeEnvelopeMenu={volumeEnvelopeMenu}
        applyVolumeEnvelopeFade={applyVolumeEnvelopeFade}
        resetVolumeEnvelope={resetVolumeEnvelope}
        clipMenu={clipMenu}
        allClips={allClips}
        getClipMediaAsset={getClipMediaAsset}
        getClipMediaVersionEntries={getClipMediaVersionEntries}
        whisperAvailability={whisperAvailability}
        openSilenceDetection={openSilenceDetection}
        openSceneDetection={openSceneDetection}
        openCoverFrameGeneration={openCoverFrameGeneration}
        generateSubtitles={generateSubtitles}
        alignSubtitlesToWaveform={alignSubtitlesToWaveform}
        ttsVoiceover={ttsVoiceover}
        openReplaceMedia={openReplaceMedia}
        switchClipMediaVersion={switchClipMediaVersion}
        convertClipFrameRate={convertClipFrameRate}
        packClipMenuSelection={packClipMenuSelection}
        handleAiReframe={handleAiReframe}
        handleAiTransitionRecommend={handleAiTransitionRecommend}
        handleAnomalyDetect={handleAnomalyDetect}
        onRoughCutCompare={onRoughCutCompare}
        createGroupFromSelection={createGroupFromSelection}
        ungroupSelected={ungroupSelected}
        deleteGroup={deleteGroup}
        updateGroupColor={updateGroupColor}
        updateClipColor={updateClipColor}
        deleteSelected={deleteSelected}
        rippleDeleteSelected={rippleDeleteSelected}
        trackBatchMenu={trackBatchMenu}
        selectedTracksForBatch={selectedTracksForBatch}
        applyBatchTrackPatch={applyBatchTrackPatch}
        deleteSelectedEmptyTracks={deleteSelectedEmptyTracks}
        setEqualHeightPrompt={setEqualHeightPrompt}
        setTrackBatchMenu={setTrackBatchMenu}
        equalHeightPrompt={equalHeightPrompt}
        equalHeightValue={equalHeightValue}
        setEqualHeightValue={setEqualHeightValue}
        selectionRect={selectionRect}
        inPoint={inPoint}
        outPoint={outPoint}
        remoteCollaborationUsers={remoteCollaborationUsers}
        playheadTime={playheadTime}
        setDrag={setDrag}
        minimapVisible={minimapVisible}
        deferredMinimapLayout={deferredMinimapLayout}
        minimapViewport={minimapViewport}
        minimapHeight={minimapHeight}
        scrollTimelineFromMinimap={scrollTimelineFromMinimap}
      />
      <TimelineDialogsLayer
        silenceDialog={silenceDialog}
        setSilenceDialog={setSilenceDialog}
        applySilenceRemoval={applySilenceRemoval}
        sceneDialog={sceneDialog}
        setSceneDialog={setSceneDialog}
        startSceneDetection={startSceneDetection}
        cancelCurrentSceneDetection={cancelCurrentSceneDetection}
        applySceneDetectionResult={applySceneDetectionResult}
        coverFrameDialog={coverFrameDialog}
        setCoverFrameDialog={setCoverFrameDialog}
        applyProjectCoverFrame={applyProjectCoverFrame}
        whisperDialog={whisperDialog}
        subtitleAlignReport={subtitleAlignReport}
        dialoguePanelOpen={dialoguePanelOpen}
        setDialoguePanelOpen={setDialoguePanelOpen}
        dialogueMarkers={dialogueMarkers}
        dialogueMisses={dialogueMisses}
        runDialogueDetection={runDialogueDetection}
        generateDialogueSubtitles={generateDialogueSubtitles}
        beatSnapPanelOpen={beatSnapPanelOpen}
        setBeatSnapPanelOpen={setBeatSnapPanelOpen}
        project={project}
        replaceMediaDialog={replaceMediaDialog}
        setReplaceMediaDialog={setReplaceMediaDialog}
        confirmReplaceMedia={confirmReplaceMedia}
        reframeDialog={reframeDialog}
        setReframeDialog={setReframeDialog}
        applyAiReframe={applyAiReframe}
        transitionDialog={transitionDialog}
        setTransitionDialog={setTransitionDialog}
        applyAiTransition={applyAiTransition}
        annotationPanelOpen={annotationPanelOpen}
        annotationMode={annotationMode}
        openAnnotationEditorAt={openAnnotationEditorAt}
        removeProjectAnnotation={removeProjectAnnotation}
        setPlayheadTime={setPlayheadTime}
        bookmarkPanelOpen={bookmarkPanelOpen}
        bookmarkRename={bookmarkRename}
        setBookmarkRename={setBookmarkRename}
        renameProjectBookmark={renameProjectBookmark}
        removeProjectBookmark={removeProjectBookmark}
        timelineNotePanelOpen={timelineNotePanelOpen}
        filteredTimelineNotes={filteredTimelineNotes}
        timelineNoteSearch={timelineNoteSearch}
        setTimelineNoteSearch={setTimelineNoteSearch}
        openTimelineNoteEditor={openTimelineNoteEditor}
        removeTimelineNote={removeTimelineNote}
        exportTimelineNotesCsv={exportTimelineNotesCsv}
        annotationEditor={annotationEditor}
        setAnnotationEditor={setAnnotationEditor}
        saveAnnotationEditor={saveAnnotationEditor}
        timelineNoteEditor={timelineNoteEditor}
        setTimelineNoteEditor={setTimelineNoteEditor}
        saveTimelineNoteEditor={saveTimelineNoteEditor}
      />
    </section>
  );
}
