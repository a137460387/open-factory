import type { TimelineAccessor, ProjectAccessor } from "./index";
import { ClipboardKeyframeGroup, PasteMode, cloneClipKeyframes, createKeyframe, normalizeClipKeyframes, normalizePastedKeyframes, setKeyframeForProperty } from '../../keyframes';
import { Keyframe, KeyframeEasing, KeyframeHandle, KeyframeHandleMode, KeyframeProperty, Timeline } from '../../model';
import type { Clip } from '../../model';
import { detectOverlap, replaceClip } from '../../timeline';
import { Command } from '../command';
import { TimelineAccessor, applySpeedKeyframeDuration, findClip, findTrack } from './utils';

export interface PasteKeyframesInput {
  groups: ClipboardKeyframeGroup[];
  targetClipId: string;
  mode: PasteMode;
  targetProperty?: KeyframeProperty;
}

export class PasteKeyframesCommand implements Command {
  readonly description = 'Paste keyframes';
  private before?: Clip;
  private after?: Clip;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly input: PasteKeyframesInput,
  ) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
    this.before ??= findClip(timeline, this.input.targetClipId);
    const result = normalizePastedKeyframes(
      this.input.groups,
      this.before.start,
      this.before.duration,
      this.input.mode,
      this.input.targetProperty,
    );
    let keyframes = cloneClipKeyframes(this.before.keyframes);
    for (const { property, keyframes: pasted } of result) {
      for (const kf of pasted) {
        keyframes = setKeyframeForProperty(keyframes, property, kf, this.before.duration);
      }
    }
    this.after = {
      ...this.before,
      keyframes: normalizeClipKeyframes(keyframes, this.before.duration),
    } as Clip;
    this.accessor.setTimeline(replaceClip(timeline, this.after));
  }

  undo(): void {
    if (this.before) {
      this.accessor.setTimeline(replaceClip(this.accessor.getTimeline(), this.before));
    }
  }
}

export interface AddKeyframeInput {
  id?: string;
  time: number;
  value: number;
  easing?: KeyframeEasing;
  inHandle?: KeyframeHandle;
  outHandle?: KeyframeHandle;
  handleMode?: KeyframeHandleMode;
}

export class AddKeyframeCommand implements Command {
  readonly description = 'Add keyframe';
  private before?: Clip;
  private after?: Clip;
  private keyframe?: Keyframe<number>;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly clipId: string,
    private readonly property: KeyframeProperty,
    private readonly input: AddKeyframeInput,
  ) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
    this.before ??= findClip(timeline, this.clipId);
    this.keyframe ??= createKeyframe(this.property, this.input, this.before.duration);
    this.after = {
      ...this.before,
      keyframes: setKeyframeForProperty(this.before.keyframes, this.property, this.keyframe, this.before.duration),
    } as Clip;
    this.after = applySpeedKeyframeDuration(this.before, this.after, this.property);
    if (
      this.property === 'speed' &&
      detectOverlap(findTrack(timeline, this.after.trackId), this.after, this.before.id)
    ) {
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

export interface BatchUpdateKeyframeItem {
  clipId: string;
  property: KeyframeProperty;
  keyframes: AddKeyframeInput[];
  replace?: boolean;
}

export class BatchUpdateKeyframeCommand implements Command {
  readonly description: string;
  private before?: Timeline;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly updates: BatchUpdateKeyframeItem[],
    description = 'Batch update keyframes',
  ) {
    this.description = description;
  }

  execute(): void {
    let timeline = this.accessor.getTimeline();
    this.before ??= timeline;
    for (const update of this.updates) {
      const beforeClip = findClip(timeline, update.clipId);
      let keyframes = update.replace
        ? { ...(beforeClip.keyframes ?? {}), [update.property]: [] }
        : beforeClip.keyframes;
      for (const input of update.keyframes) {
        keyframes = setKeyframeForProperty(
          keyframes,
          update.property,
          createKeyframe(update.property, input, beforeClip.duration),
          beforeClip.duration,
        );
      }
      let after = {
        ...beforeClip,
        keyframes: normalizeClipKeyframes(cloneClipKeyframes(keyframes), beforeClip.duration),
      } as Clip;
      after = applySpeedKeyframeDuration(beforeClip, after, update.property);
      if (update.property === 'speed' && detectOverlap(findTrack(timeline, after.trackId), after, beforeClip.id)) {
        throw new Error('Clip overlaps another clip on this track');
      }
      timeline = replaceClip(timeline, after);
    }
    this.accessor.setTimeline(timeline);
  }

  undo(): void {
    if (this.before) {
      this.accessor.setTimeline(this.before);
    }
  }
}
