import {memo} from 'react';
import {type Clip, type MediaAsset, type TimelineLargeProjectMode} from '@open-factory/editor-core';
import {useEffect, useState} from 'react';
import {VideoThumbnailStrip} from './VideoThumbnailStrip';
import {WaveformStrip, type WaveformStripProps} from './WaveformStrip';

export interface ClipAssetStripsProps {
  clip: Extract<Clip, { type: 'video' }>;
  asset: MediaAsset;
  clipPixelWidth: number;
  trackMuted: boolean;
  waveformColor: string;
  largeProjectMode: TimelineLargeProjectMode;
  trackHeight?: number;
}

export function DeferredClipAssetStrips(props: ClipAssetStripsProps) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(false);
    return scheduleLargeProjectAssetHydration(() => setReady(true));
  }, [props.asset.id, props.clip.id]);

  return ready ? <ClipAssetStrips {...props} /> : null;
}

export function DeferredWaveformStrip(props: WaveformStripProps) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(false);
    return scheduleLargeProjectAssetHydration(() => setReady(true));
  }, [props.asset.id, props.clipId]);

  return ready ? <WaveformStrip {...props} /> : null;
}

export function scheduleLargeProjectAssetHydration(onReady: () => void): () => void {
  let idleId: number | undefined;
  let completed = false;
  const run = () => {
    if (completed) {
      return;
    }
    completed = true;
    onReady();
  };
  const delayId = window.setTimeout(() => {
    if (typeof window.requestIdleCallback === 'function') {
      idleId = window.requestIdleCallback(run, { timeout: 2_500 });
    } else {
      run();
    }
  }, 1_200);
  return () => {
    completed = true;
    window.clearTimeout(delayId);
    if (idleId !== undefined && typeof window.cancelIdleCallback === 'function') {
      window.cancelIdleCallback(idleId);
    }
  };
}

export const ClipAssetStrips = memo(function ClipAssetStrips({
  clip,
  asset,
  clipPixelWidth,
  trackMuted,
  waveformColor,
  largeProjectMode,
  trackHeight,
}: ClipAssetStripsProps) {
  return (
    <>
      <VideoThumbnailStrip
        clip={clip}
        asset={asset}
        pixelWidth={clipPixelWidth}
        frameStep={largeProjectMode.previewFrameStep}
      />
      {asset.hasAudio ? (
        <WaveformStrip
          clipId={clip.id}
          asset={asset}
          pixelWidth={clipPixelWidth}
          clipDuration={clip.duration}
          muted={trackMuted || Boolean(clip.muted)}
          color={waveformColor}
          pitchData={clip.pitchData}
          compact
          resolutionScale={largeProjectMode.waveformResolutionScale}
        />
      ) : null}
    </>
  );
});
