import {type Clip, type MediaAsset} from '@open-factory/editor-core';
import {useEffect, useState} from 'react';
import {getTimelineThumbnailPlaceholders, getTimelineThumbnails, type TimelineThumbnailFrame} from '../../media/timeline-thumbnails';

export interface VideoThumbnailStripProps {
  clip: Extract<Clip, { type: 'video' }>;
  asset: MediaAsset;
  pixelWidth: number;
  frameStep?: number;
}

export function VideoThumbnailStrip({
  clip,
  asset,
  pixelWidth,
  frameStep = 1,
}: VideoThumbnailStripProps) {
  const requestPixelWidth = Math.max(1, pixelWidth / Math.max(1, frameStep));
  const [frames, setFrames] = useState<TimelineThumbnailFrame[]>(() =>
    getTimelineThumbnailPlaceholders(asset, clip, requestPixelWidth),
  );

  useEffect(() => {
    let canceled = false;
    const placeholders = getTimelineThumbnailPlaceholders(asset, clip, requestPixelWidth);
    setFrames(placeholders);
    void getTimelineThumbnails(asset, clip, requestPixelWidth)
      .then((nextFrames) => {
        if (!canceled) {
          setFrames(nextFrames);
        }
      })
      .catch(() => {
        if (!canceled) {
          setFrames(placeholders);
        }
      });
    return () => {
      canceled = true;
    };
  }, [asset, clip.duration, clip.keyframes, clip.speed, clip.trimStart, requestPixelWidth]);

  if (frames.length === 0) {
    return null;
  }

  return (
    <span
      className="absolute inset-0 z-0 flex overflow-hidden opacity-70"
      data-testid={`timeline-thumbnails-${clip.id}`}
    >
      {frames.map((frame) => (
        <span key={frame.key} className="h-full w-20 flex-none border-r border-white/20 bg-sky-200">
          {frame.dataUrl ? (
            <img className="h-full w-full object-cover" src={frame.dataUrl} alt="" draggable={false} />
          ) : null}
        </span>
      ))}
    </span>
  );
}
