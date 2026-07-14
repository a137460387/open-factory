import {
  DEFAULT_AUDIO_FADE_CURVE,
  DEFAULT_AUDIO_FADE_DURATION,
  DEFAULT_AUDIO_PITCH_SEMITONES,
  DEFAULT_AUDIO_REVERSE,
  DEFAULT_CHROMA_KEY,
  DEFAULT_CLIP_SPEED,
  DEFAULT_COLOR_CORRECTION,
  DEFAULT_TRANSFORM,
  DEFAULT_TRANSITION_DURATION,
  createId,
  createTransition,
  normalizeChromaKey,
  normalizeTransitionDuration,
  type Transition,
  type TransitionType,
  type VideoClip,
} from './model';
import { round } from './time';

export interface VideoStitchSegmentInput {
  mediaId: string;
  name: string;
  duration: number;
}

export interface VideoStitchSequenceOptions {
  trackId: string;
  startTime?: number;
  transitionEnabled?: boolean;
  transitionDuration?: number;
  transitionType?: TransitionType;
}

export interface VideoStitchSequence {
  clips: VideoClip[];
  transitions: Transition[];
  duration: number;
}

export function buildVideoStitchSequence(
  segments: VideoStitchSegmentInput[],
  options: VideoStitchSequenceOptions,
): VideoStitchSequence {
  const transitionEnabled = options.transitionEnabled === true;
  const requestedTransitionDuration = normalizeTransitionDuration(
    options.transitionDuration ?? DEFAULT_TRANSITION_DURATION,
  );
  const transitionType = options.transitionType ?? 'dissolve';
  let cursor = round(Math.max(0, options.startTime ?? 0));
  const clips: VideoClip[] = [];
  const transitions: Transition[] = [];

  for (const segment of segments.filter((item) => item.mediaId && item.name)) {
    const duration = round(Math.max(0.001, Number.isFinite(segment.duration) ? segment.duration : 5));
    const clip: VideoClip = {
      id: createId('clip'),
      type: 'video',
      name: segment.name,
      mediaId: segment.mediaId,
      trackId: options.trackId,
      start: cursor,
      duration,
      trimStart: 0,
      trimEnd: 0,
      speed: DEFAULT_CLIP_SPEED,
      colorCorrection: { ...DEFAULT_COLOR_CORRECTION },
      transform: { ...DEFAULT_TRANSFORM },
      chromaKey: normalizeChromaKey(DEFAULT_CHROMA_KEY),
      masks: [],
      volume: 1,
      pitchSemitones: DEFAULT_AUDIO_PITCH_SEMITONES,
      reverseAudio: DEFAULT_AUDIO_REVERSE,
      fadeInDuration: DEFAULT_AUDIO_FADE_DURATION,
      fadeOutDuration: DEFAULT_AUDIO_FADE_DURATION,
      fadeInCurve: DEFAULT_AUDIO_FADE_CURVE,
      fadeOutCurve: DEFAULT_AUDIO_FADE_CURVE,
    };
    const previous = clips.at(-1);
    clips.push(clip);
    if (transitionEnabled && previous) {
      const durationLimit = Math.max(0, Math.min(previous.duration, clip.duration) * 0.5);
      const duration = round(Math.min(requestedTransitionDuration, durationLimit));
      if (duration > 0) {
        transitions.push(
          createTransition({ type: transitionType, duration, fromClipId: previous.id, toClipId: clip.id }),
        );
      }
    }
    cursor = round(cursor + duration);
  }

  const transitionOffset = transitions.reduce((total, transition) => round(total + transition.duration), 0);
  return {
    clips,
    transitions,
    duration: round(Math.max(0, cursor - (options.startTime ?? 0) - transitionOffset)),
  };
}
