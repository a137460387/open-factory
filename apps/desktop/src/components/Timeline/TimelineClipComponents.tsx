// Re-export facade: preserves all public API signatures for existing consumers
export {
  formatTransitionBadge,
  envelopePointX,
  envelopePointY,
  getClipKeyframeMarkers,
  getKeyframeMarkerTime,
  sameSelectedKeyframe,
  selectedKeyframeKey,
  getClipToneClass,
  getTrackWaveformColor,
  formatFrameRateLabel,
  formatTimelineKeyframeProperty,
  drawWaveform,
} from './clip-helpers';

export {VolumeEnvelopeOverlay} from './VolumeEnvelopeOverlay';

export {VideoThumbnailStrip} from './VideoThumbnailStrip';

export {WaveformStrip} from './WaveformStrip';
export type {WaveformStripProps} from './WaveformStrip';

export {
  DeferredClipAssetStrips,
  DeferredWaveformStrip,
  scheduleLargeProjectAssetHydration,
} from './ClipAssetStrips';

export {ClipBlock, MemoizedClipBlock} from './ClipBlock';
