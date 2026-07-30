import {memo, useMemo} from 'react';
import {
  areClipsAdjacent,
  filterTimelineVirtualClips,
  getEffectiveClipColorLabel,
  detectTrackGaps,
  getEffectiveTrackHeight,
  shouldLoadTimelineClipAssets,
  snapTime,
  type Clip,
  type CollaborationClipLock,
  type AnomalyInterval,
  type ClipGroup,
  type MediaAsset,
  type TimelineLabelColor,
  type TimelineLargeProjectMode,
  type TimelineVirtualRenderWindow,
  type VolumeEnvelopePoint,
  type Track,
  type Transition,
} from '@open-factory/editor-core';
import {useAudioMeterStore, getSilentFrequencyBands} from '../../store/audioMeterStore';
import type {SelectedKeyframeRef} from '../../store/editorStore';
import type {
  DragState,
  VolumeEnvelopePointRequest,
  VolumeEnvelopeMenuRequest,
  TransitionMenuRequest,
  ClipMenuRequest,
  GapMenuRequest,
} from './timeline-parts-types';
import {LABEL_WIDTH} from './timeline-parts-types';
import {zhCN} from '../../i18n/strings';
import {MemoizedClipBlock} from './TimelineClipComponents';
import {TrackHeader} from './TimelineTrackHeader';
import {MusicStructureMarkers, ContinuityWarnings, ColorConsistencyWarnings, SfxSuggestions} from './TimelineTrackOverlays';

function TrackRow({
  track,
  zoom,
  selectedClipId,
  selectedClipIds,
  selectedKeyframe,
  selectedKeyframes,
  selectedTrackIds,
  drag,
  media,
  onSelect,
  onKeyframeSelect,
  onDragStart,
  onTrackPointerDown,
  onTrackUpdate,
  onTrackHeaderClick,
  onTrackBatchMenu,
  onTrackReorder,
  transitions,
  onTransitionMenu,
  onGapMenu,
  onClipMenu,
  onVolumeEnvelopeAdd,
  onVolumeEnvelopeUpdate,
  onVolumeEnvelopeRemove,
  onVolumeEnvelopeMenu,
  onClipDoubleClick,
  virtualWindow,
  assetLoadWindow,
  largeProjectMode,
  rollingTrimActive,
  slipEditActive,
  slideEditActive,
  clipGroupByClipId,
  colorFilter,
  projectFrameRate,
  envelopeEditMode,
  reduceMotion,
  collaborationLocksByClipId,
  onRemoveAnomaly,
  continuityWarnings,
  colorConsistencyWarnings,
  sfxSuggestions,
}: {
  track: Track;
  zoom: number;
  selectedClipId?: string;
  selectedClipIds: string[];
  selectedKeyframe?: SelectedKeyframeRef;
  selectedKeyframes: SelectedKeyframeRef[];
  selectedTrackIds: string[];
  drag?: DragState;
  media: MediaAsset[];
  onSelect(clipId: string, additive: boolean, forceSingle?: boolean): void;
  onKeyframeSelect(keyframe: SelectedKeyframeRef, additive: boolean): void;
  onDragStart(drag: DragState): void;
  onTrackPointerDown(event: React.PointerEvent<HTMLDivElement>): void;
  onTrackUpdate(
    trackId: string,
    patch: Partial<Pick<Track, 'color' | 'muted' | 'solo' | 'locked' | 'volume' | 'displayHeight'>>,
  ): void;
  onTrackHeaderClick(trackId: string, event: React.MouseEvent<HTMLDivElement>): void;
  onTrackBatchMenu(trackId: string, x: number, y: number): void;
  onTrackReorder(draggedTrackId: string, targetTrackId: string): void;
  transitions: Transition[];
  onTransitionMenu(request: TransitionMenuRequest): void;
  onGapMenu(request: GapMenuRequest): void;
  onClipMenu(request: ClipMenuRequest): void;
  onVolumeEnvelopeAdd(request: VolumeEnvelopePointRequest): void;
  onVolumeEnvelopeUpdate(request: Required<VolumeEnvelopePointRequest>): void;
  onVolumeEnvelopeRemove(request: Required<Pick<VolumeEnvelopePointRequest, 'clipId' | 'keyframeId'>>): void;
  onVolumeEnvelopeMenu(request: VolumeEnvelopeMenuRequest): void;
  onClipDoubleClick(clip: Clip): void;
  virtualWindow: TimelineVirtualRenderWindow;
  assetLoadWindow: {scrollLeft: number; viewportWidth: number; labelWidth: number};
  largeProjectMode: TimelineLargeProjectMode;
  rollingTrimActive: boolean;
  slipEditActive: boolean;
  slideEditActive: boolean;
  clipGroupByClipId: Map<string, ClipGroup>;
  colorFilter: TimelineLabelColor | null;
  projectFrameRate: number;
  envelopeEditMode: boolean;
  reduceMotion: boolean;
  collaborationLocksByClipId: Map<string, CollaborationClipLock>;
  onRemoveAnomaly(clipId: string, anomaly: AnomalyInterval): void;
  continuityWarnings?: Array<{clipAId: string; clipBId: string; type: string; confidence: number; reason: string}>;
  colorConsistencyWarnings?: Array<{
    clipAId: string;
    clipBId: string;
    type: string;
    deltaRGB: number | null;
    reason: string;
  }>;
  sfxSuggestions?: Array<{
    time: number;
    category: string;
    confidence: number;
    matchedAssetId: string | null;
    status: string;
  }>;
}) {
  const frequencyBands = useAudioMeterStore(
    (state) => state.trackFrequencyBands[track.id] ?? getSilentFrequencyBands(),
  );
  const mediaById = new Map(media.map((asset) => [asset.id, asset]));
  const locked = Boolean(track.locked);
  const selectedTrack = selectedTrackIds.includes(track.id);
  const sortedClips = useMemo(
    () => [...track.clips].sort((left, right) => left.start - right.start || left.id.localeCompare(right.id)),
    [track.clips],
  );
  const nextAdjacentByClipId = useMemo(() => {
    const adjacent = new Map<string, Clip>();
    for (let index = 0; index < sortedClips.length - 1; index += 1) {
      const current = sortedClips[index];
      const next = sortedClips[index + 1];
      if (areClipsAdjacent(current, next)) {
        adjacent.set(current.id, next);
      }
    }
    return adjacent;
  }, [sortedClips]);
  const virtualClips = useMemo(
    () =>
      filterTimelineVirtualClips(track.clips, virtualWindow).filter(
        (clip) => !colorFilter || getEffectiveClipColorLabel(clip, track) === colorFilter,
      ),
    [track.clips, virtualWindow, colorFilter, track],
  );
  return (
    <div
      className="grid border-b border-line"
      role="row"
      aria-label={track.name}
      style={{gridTemplateColumns: `${LABEL_WIDTH}px 1fr`, height: getEffectiveTrackHeight(track.displayHeight)}}
    >
      <TrackHeader
        track={track}
        selectedTrack={selectedTrack}
        frequencyBands={frequencyBands}
        locked={locked}
        onTrackHeaderClick={onTrackHeaderClick}
        onTrackReorder={onTrackReorder}
        onTrackUpdate={onTrackUpdate}
        onTrackBatchMenu={onTrackBatchMenu}
      />
      <div
        className="relative bg-panel"
        data-testid={`timeline-track-body-${track.id}`}
        onPointerDown={onTrackPointerDown}
        onContextMenu={(event) => {
          if (locked || event.target !== event.currentTarget) {
            return;
          }
          event.preventDefault();
          event.stopPropagation();
          const rect = event.currentTarget.getBoundingClientRect();
          onGapMenu({
            x: event.clientX,
            y: event.clientY,
            trackId: track.id,
            time: snapTime((event.clientX - rect.left) / zoom),
          });
        }}
      >
        {drag?.mode === 'move'
          ? track.clips.flatMap((clip) => {
              const previewStart = drag.previewStartsByClipId?.[clip.id];
              if (previewStart === undefined) {
                return [];
              }
              return [
                <div
                  key={`drop-preview-${clip.id}`}
                  className="pointer-events-none absolute top-2 z-[9] h-10 rounded-md border-2 border-dashed border-brand bg-brand/10"
                  style={{left: previewStart * zoom, width: Math.max(16, clip.duration * zoom)}}
                  data-testid={`timeline-drop-preview-${clip.id}`}
                  data-preview-clip-id={clip.id}
                />,
              ];
            })
          : null}
        {useMemo(() => {
          const minDuration = projectFrameRate > 0 ? 1 / projectFrameRate : 0;
          return detectTrackGaps(track, {minDuration}).map((gap) => (
            <div
              key={`gap-${gap.trackId}-${gap.start}`}
              className="absolute top-0 z-[1] h-full opacity-40"
              style={{
                left: gap.start * zoom,
                width: Math.max(2, gap.duration * zoom),
                backgroundImage:
                  'repeating-linear-gradient(135deg, transparent, transparent 3px, rgba(148,163,184,0.35) 3px, rgba(148,163,184,0.35) 5px)',
                backgroundSize: '8px 8px',
              }}
              title={`${zhCN.timeline.gapPrefix}${gap.duration.toFixed(1)}s`}
              data-testid={`timeline-gap-${gap.trackId}-${gap.start}`}
            />
          ));
        }, [track.clips, zoom, projectFrameRate])}
        {Array.isArray(track.musicStructure) && track.musicStructure.length > 0 ? (
          <MusicStructureMarkers trackId={track.id} musicStructure={track.musicStructure} zoom={zoom} />
        ) : null}
        {Array.isArray(continuityWarnings) && continuityWarnings.length > 0 ? (
          <ContinuityWarnings trackId={track.id} warnings={continuityWarnings} sortedClips={sortedClips} zoom={zoom} />
        ) : null}
        {Array.isArray(colorConsistencyWarnings) && colorConsistencyWarnings.length > 0 ? (
          <ColorConsistencyWarnings trackId={track.id} warnings={colorConsistencyWarnings} sortedClips={sortedClips} zoom={zoom} />
        ) : null}
        {Array.isArray(sfxSuggestions) && sfxSuggestions.length > 0 ? (
          <SfxSuggestions trackId={track.id} suggestions={sfxSuggestions} zoom={zoom} />
        ) : null}
        {virtualClips.map((clip) => {
          const isSelected = selectedClipIds.includes(clip.id) || selectedClipId === clip.id;
          const trimPreview =
            drag?.clip?.id === clip.id && (drag.mode === 'trim-left' || drag.mode === 'trim-right') ? drag : undefined;
          const previewClip = drag?.previewClipsById?.[clip.id];
          const movedStart = drag?.mode === 'move' ? drag.previewStartsByClipId?.[clip.id] : undefined;
          const displayClip = previewClip ?? clip;
          const left = (previewClip?.start ?? movedStart ?? trimPreview?.previewStart ?? clip.start) * zoom;
          const width = Math.max(16, (previewClip?.duration ?? trimPreview?.previewDuration ?? clip.duration) * zoom);
          const loadAssets = shouldLoadTimelineClipAssets({
            clipStart: clip.start,
            clipDuration: clip.duration,
            zoom,
            scrollLeft: assetLoadWindow.scrollLeft,
            viewportWidth: assetLoadWindow.viewportWidth,
            labelWidth: assetLoadWindow.labelWidth,
            preloadPx: 100,
          });
          return (
            <MemoizedClipBlock
              key={clip.id}
              clip={displayClip}
              asset={'mediaId' in clip ? mediaById.get(clip.mediaId) : undefined}
              left={left}
              width={width}
              selected={isSelected}
              selectedKeyframe={selectedKeyframe}
              selectedKeyframes={selectedKeyframes}
              drag={drag}
              onSelect={onSelect}
              onKeyframeSelect={onKeyframeSelect}
              onDragStart={onDragStart}
              selectedClipIds={selectedClipIds}
              locked={locked}
              clipPixelWidth={width}
              trackMuted={Boolean(track.muted)}
              trackType={track.type}
              trackHeight={getEffectiveTrackHeight(track.displayHeight)}
              nextAdjacentClip={nextAdjacentByClipId.get(clip.id)}
              transition={transitions.find(
                (transition) =>
                  transition.fromClipId === clip.id && transition.toClipId === nextAdjacentByClipId.get(clip.id)?.id,
              )}
              onTransitionMenu={onTransitionMenu}
              onClipMenu={onClipMenu}
              onVolumeEnvelopeAdd={onVolumeEnvelopeAdd}
              onVolumeEnvelopeUpdate={onVolumeEnvelopeUpdate}
              onVolumeEnvelopeRemove={onVolumeEnvelopeRemove}
              onVolumeEnvelopeMenu={onVolumeEnvelopeMenu}
              onClipDoubleClick={onClipDoubleClick}
              rollingTrimActive={rollingTrimActive}
              slipEditActive={slipEditActive}
              slideEditActive={slideEditActive}
              clipGroup={clipGroupByClipId.get(clip.id)}
              trackColor={track.color ?? null}
              projectFrameRate={projectFrameRate}
              envelopeEditMode={envelopeEditMode}
              reduceMotion={reduceMotion}
              loadAssets={loadAssets}
              largeProjectMode={largeProjectMode}
              collaborationLock={collaborationLocksByClipId.get(clip.id)}
              onRemoveAnomaly={onRemoveAnomaly}
            />
          );
        })}
      </div>
    </div>
  );
}

function areTrackRowPropsEqual(
  previous: Parameters<typeof TrackRow>[0],
  next: Parameters<typeof TrackRow>[0],
): boolean {
  return (
    previous.track === next.track &&
    previous.zoom === next.zoom &&
    previous.selectedClipId === next.selectedClipId &&
    previous.selectedClipIds === next.selectedClipIds &&
    previous.selectedKeyframe === next.selectedKeyframe &&
    previous.selectedKeyframes === next.selectedKeyframes &&
    previous.selectedTrackIds === next.selectedTrackIds &&
    previous.drag === next.drag &&
    previous.media === next.media &&
    previous.virtualWindow === next.virtualWindow &&
    previous.largeProjectMode === next.largeProjectMode &&
    previous.rollingTrimActive === next.rollingTrimActive &&
    previous.slipEditActive === next.slipEditActive &&
    previous.slideEditActive === next.slideEditActive &&
    previous.clipGroupByClipId === next.clipGroupByClipId &&
    previous.colorFilter === next.colorFilter &&
    previous.projectFrameRate === next.projectFrameRate &&
    previous.envelopeEditMode === next.envelopeEditMode &&
    previous.reduceMotion === next.reduceMotion &&
    previous.collaborationLocksByClipId === next.collaborationLocksByClipId &&
    previous.transitions === next.transitions &&
    previous.continuityWarnings === next.continuityWarnings &&
    previous.colorConsistencyWarnings === next.colorConsistencyWarnings &&
    previous.sfxSuggestions === next.sfxSuggestions
  );
}

const MemoizedTrackRow = memo(TrackRow, areTrackRowPropsEqual);

export {MemoizedTrackRow as TrackRow};
