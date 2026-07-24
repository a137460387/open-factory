import type { TimelineAccessor, ProjectAccessor } from "./index";
import { CreditsRow, CreditsStyle } from '../../credits-roll';
import { AudioFadeCurve, ChromaKey, Clip, ClipAudioDenoise, ClipBorder, ClipFrameInterpolation, ClipKeyframes, ClipMask, ClipPanoramaView, ClipProjection, ClipQualityEnhancement, ClipStabilization, ClipVideoRestoration, ColorCorrection, DEFAULT_CLIP_SPEED, MediaAsset, MotionTrackPoint, SubtitleMode, SubtitleStyle, SubtitleTrackType, TextPathOptions, TextStyle, Transform, normalizeAudioFadeDuration } from '../../model';
import { ClipSpatialAudio } from '../../spatial-audio';
import { round } from '../../time';
import { detectOverlap, getClipSpeed, removeClip, replaceClip } from '../../timeline';
import { TimelineLabelColor } from '../../timeline-color-labels';
import { Command } from '../command';
import { TimelineAccessor, asReplaceableMediaClip, findClip, findTrack, insertClip, isReplaceableMediaClip } from './utils';

export class DeleteClipCommand implements Command {
  readonly description = 'Delete clip';
  private removed?: Clip;
  private removedIndex = -1;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly clipId: string,
  ) {}

  execute(): void {
    const result = removeClip(this.accessor.getTimeline(), this.clipId);
    this.removed = result.clip;
    this.removedIndex = result.index;
    this.accessor.setTimeline(result.timeline);
  }

  undo(): void {
    if (this.removed) {
      this.accessor.setTimeline(insertClip(this.accessor.getTimeline(), this.removed, this.removedIndex));
    }
  }
}

export type ClipPatch = Partial<
  Omit<
    Clip,
    'type' | 'id' | 'transform' | 'colorCorrection' | 'chromaKey' | 'stabilization' | 'frameInterpolation' | 'border'
  >
> & {
  keyframes?: ClipKeyframes;
  kenBurns?: boolean;
  volume?: number;
  text?: string;
  richText?: Extract<Clip, { type: 'text' }>['richText'];
  textLayout?: Extract<Clip, { type: 'text' }>['textLayout'];
  openTypeFeatures?: Extract<Clip, { type: 'text' }>['openTypeFeatures'];
  arcText?: Extract<Clip, { type: 'text' }>['arcText'];
  colorLabel?: TimelineLabelColor | null;
  mediaId?: string;
  subtitleType?: SubtitleTrackType;
  speaker?: string;
  speakerId?: number;
  soundDesc?: string;
  subtitleMode?: SubtitleMode;
  dataSubtitle?: Extract<Clip, { type: 'subtitle' }>['dataSubtitle'];
  speed?: number;
  pitchSemitones?: number;
  audioChannelRouting?: Clip['audioChannelRouting'];
  pitchData?: Clip['pitchData'];
  muted?: boolean;
  reverseAudio?: boolean;
  fadeInDuration?: number;
  fadeOutDuration?: number;
  fadeInCurve?: AudioFadeCurve;
  fadeOutCurve?: AudioFadeCurve;
  chromaKey?: Partial<ChromaKey>;
  stabilization?: Partial<ClipStabilization>;
  frameInterpolation?: Partial<ClipFrameInterpolation>;
  audioDenoise?: Partial<ClipAudioDenoise>;
  spatialAudio?: Partial<ClipSpatialAudio>;
  videoRestoration?: Partial<ClipVideoRestoration>;
  qualityEnhancement?: Partial<ClipQualityEnhancement>;
  projection?: ClipProjection;
  panorama?: Partial<ClipPanoramaView>;
  masks?: ClipMask[];
  motionTrack?: MotionTrackPoint[];
  border?: Partial<ClipBorder>;
  sequenceFrameRate?: number;
  colorCorrection?: Partial<ColorCorrection>;
  transform?: Partial<Transform>;
  rows?: CreditsRow[];
  rollSpeed?: number;
  style?: Partial<TextStyle> | Partial<SubtitleStyle> | Partial<CreditsStyle>;
  pathText?: Partial<TextPathOptions>;
  motionGraphic?: Partial<Extract<Clip, { type: 'motion-graphic' }>['motionGraphic']>;
};

export type ReplaceMediaDurationMode = 'trim-to-original' | 'stretch-to-fit' | 'use-new-duration';

export type ReplaceMediaCompatibilityWarning = 'media-type-mismatch' | 'missing-audio-for-audio-properties';

type ReplaceableMediaClip = Extract<Clip, { mediaId: string }>;

export function calculateReplaceMediaPatch(
  clip: ReplaceableMediaClip,
  media: Pick<MediaAsset, 'id' | 'duration'>,
  durationMode: ReplaceMediaDurationMode,
): Pick<ReplaceableMediaClip, 'mediaId' | 'duration' | 'trimStart' | 'trimEnd' | 'speed'> {
  const minDuration = 1 / 30;
  const originalDuration = Math.max(minDuration, clip.duration);
  const mediaDuration = Math.max(minDuration, Number.isFinite(media.duration) ? media.duration : originalDuration);
  if (durationMode === 'stretch-to-fit') {
    return {
      mediaId: media.id,
      duration: round(originalDuration),
      trimStart: 0,
      trimEnd: 0,
      speed: getClipSpeed({ speed: mediaDuration / originalDuration }),
    };
  }
  if (durationMode === 'use-new-duration') {
    return {
      mediaId: media.id,
      duration: round(mediaDuration),
      trimStart: 0,
      trimEnd: 0,
      speed: DEFAULT_CLIP_SPEED,
    };
  }
  const duration = Math.min(originalDuration, mediaDuration);
  return {
    mediaId: media.id,
    duration: round(duration),
    trimStart: 0,
    trimEnd: round(Math.max(0, mediaDuration - duration)),
    speed: DEFAULT_CLIP_SPEED,
  };
}

export function getReplaceMediaCompatibilityWarnings(
  clip: Clip,
  media: Pick<MediaAsset, 'type' | 'hasAudio'>,
): ReplaceMediaCompatibilityWarning[] {
  if (!isReplaceableMediaClip(clip)) {
    return ['media-type-mismatch'];
  }
  const warnings = new Set<ReplaceMediaCompatibilityWarning>();
  if (clip.type !== media.type) {
    warnings.add('media-type-mismatch');
  }
  const newMediaHasAudio = media.type === 'audio' || (media.type === 'video' && media.hasAudio !== false);
  const clipHasAudioProperties =
    clip.type === 'audio' ||
    ('volume' in clip && clip.volume !== undefined) ||
    Boolean(clip.keyframes?.volume?.length) ||
    ('fadeInDuration' in clip && ((clip.fadeInDuration ?? 0) > 0 || (clip.fadeOutDuration ?? 0) > 0));
  if (clipHasAudioProperties && !newMediaHasAudio) {
    warnings.add('missing-audio-for-audio-properties');
  }
  return Array.from(warnings);
}

export class ReplaceMediaCommand implements Command {
  readonly description = 'Replace media';
  private before?: ReplaceableMediaClip;
  private after?: ReplaceableMediaClip;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly clipId: string,
    private readonly media: Pick<MediaAsset, 'id' | 'duration'>,
    private readonly durationMode: ReplaceMediaDurationMode,
  ) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
    this.before ??= asReplaceableMediaClip(findClip(timeline, this.clipId));
    const patch = calculateReplaceMediaPatch(this.before, this.media, this.durationMode);
    this.after = {
      ...this.before,
      ...patch,
    } as ReplaceableMediaClip;
    if (this.after.type === 'video' || this.after.type === 'audio') {
      this.after = {
        ...this.after,
        fadeInDuration: normalizeAudioFadeDuration(this.after.fadeInDuration, this.after.duration),
        fadeOutDuration: normalizeAudioFadeDuration(this.after.fadeOutDuration, this.after.duration),
      } as ReplaceableMediaClip;
    }
    const track = findTrack(timeline, this.after.trackId);
    if (detectOverlap(track, this.after, this.before.id)) {
      throw new Error('Clip overlaps another clip on this track');
    }
    this.accessor.setTimeline(replaceClip(timeline, this.after));
  }

  undo(): void {
    if (this.before) {
      this.accessor.setTimeline(replaceClip(this.accessor.getTimeline(), this.before));
    }
  }
}

export class SwitchMediaVersionCommand implements Command {
  readonly description = 'Switch media version';
  private before?: ReplaceableMediaClip;
  private after?: ReplaceableMediaClip;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly clipId: string,
    private readonly media: Pick<MediaAsset, 'id' | 'duration'>,
  ) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
    this.before ??= asReplaceableMediaClip(findClip(timeline, this.clipId));
    const patch = calculateReplaceMediaPatch(this.before, this.media, 'trim-to-original');
    this.after = {
      ...this.before,
      ...patch,
    } as ReplaceableMediaClip;
    if (this.after.type === 'video' || this.after.type === 'audio') {
      this.after = {
        ...this.after,
        fadeInDuration: normalizeAudioFadeDuration(this.after.fadeInDuration, this.after.duration),
        fadeOutDuration: normalizeAudioFadeDuration(this.after.fadeOutDuration, this.after.duration),
      } as ReplaceableMediaClip;
    }
    const track = findTrack(timeline, this.after.trackId);
    if (detectOverlap(track, this.after, this.before.id)) {
      throw new Error('Clip overlaps another clip on this track');
    }
    this.accessor.setTimeline(replaceClip(timeline, this.after));
  }

  undo(): void {
    if (this.before) {
      this.accessor.setTimeline(replaceClip(this.accessor.getTimeline(), this.before));
    }
  }
}
