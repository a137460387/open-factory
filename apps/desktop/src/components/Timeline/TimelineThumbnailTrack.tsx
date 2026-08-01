import {memo, useEffect, useMemo, useState} from 'react';
import {
  getTimelineLabelColorHex,
  DEFAULT_TIMELINE_LABEL_COLOR_HEX,
  TIMELINE_THUMBNAIL_TRACK_HEIGHT,
  type TimelineThumbnailTrackSample,
  type MediaAsset,
} from '@open-factory/editor-core';
import {zhCN} from '../../i18n/strings';
import {getTimelineThumbnailFrame, getTimelineThumbnailPlaceholder, type TimelineThumbnailFrame} from '../../media/timeline-thumbnails';
import {LABEL_WIDTH} from './timeline-parts-types';

function ThumbnailTrack({
  samples,
  media,
  zoom,
  width,
}: {
  samples: TimelineThumbnailTrackSample[];
  media: MediaAsset[];
  zoom: number;
  width: number;
}) {
  const mediaMap = useMemo(() => new Map(media.map((m) => [m.id, m])), [media]);
  return (
    <div
      className="grid border-b border-line"
      style={{gridTemplateColumns: `${LABEL_WIDTH}px 1fr`, height: TIMELINE_THUMBNAIL_TRACK_HEIGHT}}
      data-testid="timeline-thumbnail-track"
    >
      <div className="flex items-center border-r border-line bg-panel px-3">
        <div className="min-w-0">
          <div className="truncate text-xs font-semibold">{zhCN.timeline.thumbnailTrack}</div>
          <div className="text-[11px] text-[var(--color-text-muted)]">{zhCN.timeline.thumbnailTrackSubtitle}</div>
        </div>
      </div>
      <div className="relative overflow-hidden bg-[var(--color-bg-elevated)]" style={{width}}>
        {samples.map((sample) => {
          const asset = sample.mediaId ? mediaMap.get(sample.mediaId) : undefined;
          const left = sample.time * zoom;
          const sampleWidth = Math.max(48, sample.intervalSeconds * zoom);
          return <ThumbnailTrackCell key={sample.id} sample={sample} asset={asset} left={left} width={sampleWidth} />;
        })}
      </div>
    </div>
  );
}

function ThumbnailTrackCell({
  sample,
  asset,
  left,
  width,
}: {
  sample: TimelineThumbnailTrackSample;
  asset?: MediaAsset;
  left: number;
  width: number;
}) {
  const placeholderColor = sample.trackColor
    ? getTimelineLabelColorHex(sample.trackColor)
    : DEFAULT_TIMELINE_LABEL_COLOR_HEX;
  const [frame, setFrame] = useState<TimelineThumbnailFrame | undefined>(() =>
    asset && sample.sourceTimestamp !== undefined
      ? getTimelineThumbnailPlaceholder(asset, sample.sourceTimestamp)
      : undefined,
  );

  useEffect(() => {
    let canceled = false;
    if (!asset || sample.sourceTimestamp === undefined) {
      setFrame(undefined);
      return;
    }
    const placeholder = getTimelineThumbnailPlaceholder(asset, sample.sourceTimestamp);
    setFrame(placeholder);
    void getTimelineThumbnailFrame(asset, sample.sourceTimestamp)
      .then((nextFrame) => {
        if (!canceled) {
          setFrame(nextFrame);
        }
      })
      .catch(() => {
        if (!canceled) {
          setFrame(placeholder);
        }
      });
    return () => {
      canceled = true;
    };
  }, [asset, sample.sourceTimestamp]);

  return (
    <span
      className="absolute bottom-1 top-1 overflow-hidden rounded-sm border border-white/40 shadow-sm"
      style={{left, width, backgroundColor: placeholderColor}}
      data-testid="timeline-thumbnail-frame"
      data-source-time={sample.sourceTimestamp ?? ''}
    >
      {frame?.dataUrl ? (
        <img
          className="h-full w-full object-cover opacity-95 transition-opacity duration-200"
          src={frame.dataUrl}
          alt=""
          draggable={false}
        />
      ) : null}
    </span>
  );
}

const MemoizedThumbnailTrack = memo(ThumbnailTrack);

export {MemoizedThumbnailTrack as ThumbnailTrack};
