import { normalizeSubtitleStyleTemplateStyle } from '../subtitles/style-templates';
import { buildTextAnimationKeyframes, mergeTextAnimationKeyframes, normalizeTextAnimationDirection, normalizeTextAnimationDuration, normalizeTextAnimationPreset, type TextAnimationDirection, type TextAnimationPreset } from '../text-animation';
import { DEFAULT_SUBTITLE_STYLE, type Clip, type ClipKeyframes, type Keyframe, type KeyframeEasing, type KeyframeHandle, type KeyframeHandleMode, type KeyframeProperty, type Timeline } from '../model';
import { detectOverlap, getClipDisplayDuration, getClipSourceVisibleDuration, replaceClip } from '../timeline';
import { alignKeyframeValues, applyBatchKeyframeEasing, createKeyframe, removeKeyframeForProperty, setKeyframeForProperty, cloneClipKeyframes, normalizeClipKeyframes, type ClipboardKeyframeGroup, type PasteMode, normalizePastedKeyframes } from '../keyframes';
import type { Command } from './command';
import { type TimelineAccessor, findClip, findTrack, applySpeedKeyframeDuration, cloneCommandValue, uniqueKeyframeRefs, groupKeyframeRefsByClip, calculateKeyframeSelectionCenter, keyframeRefKey, calculateDistributedKeyframeTimeMap, getBatchAlignValue, getBatchEditedKeyframeTime } from './helpers';

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

export type KeyframePatch = Partial<
  Pick<Keyframe<number>, 'time' | 'value' | 'easing' | 'inHandle' | 'outHandle' | 'handleMode'>
>;

export interface KeyframeSelectionRef {
  clipId: string;
  property: KeyframeProperty;
  keyframeId: string;
}

export type BatchKeyframeEditOperation =
  | { type: 'shift'; delta: number }
  | { type: 'scale-time'; factor: number; center?: number }
  | { type: 'delete' }
  | { type: 'easing'; easing: KeyframeEasing }
  | { type: 'distribute-time' }
  | { type: 'align-value'; value?: number };

export class UpdateKeyframeCommand implements Command {
  readonly description = 'Update keyframe';
  private before?: Clip;
  private after?: Clip;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly clipId: string,
    private readonly property: KeyframeProperty,
    private readonly keyframeId: string,
    private readonly patch: KeyframePatch,
  ) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
    this.before ??= findClip(timeline, this.clipId);
    const existing = this.before.keyframes?.[this.property]?.find((frame) => frame.id === this.keyframeId);
    if (!existing) {
      throw new Error(`Keyframe ${this.keyframeId} not found`);
    }
    const nextKeyframe = createKeyframe(
      this.property,
      {
        id: existing.id,
        time: this.patch.time ?? existing.time,
        value: this.patch.value ?? existing.value,
        easing: this.patch.easing ?? existing.easing,
        inHandle: this.patch.inHandle ?? existing.inHandle,
        outHandle: this.patch.outHandle ?? existing.outHandle,
        handleMode: this.patch.handleMode ?? existing.handleMode,
      },
      this.before.duration,
    );
    this.after = {
      ...this.before,
      keyframes: setKeyframeForProperty(this.before.keyframes, this.property, nextKeyframe, this.before.duration),
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

export class BatchKeyframeEditCommand implements Command {
  readonly description: string;
  private before?: Timeline;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly refs: KeyframeSelectionRef[],
    private readonly operation: BatchKeyframeEditOperation,
    description = 'Batch edit keyframes',
  ) {
    this.description = description;
  }

  execute(): void {
    let timeline = this.accessor.getTimeline();
    this.before ??= timeline;
    const refs = uniqueKeyframeRefs(this.refs);
    if (refs.length === 0) {
      return;
    }
    const center =
      this.operation.type === 'scale-time'
        ? (this.operation.center ?? calculateKeyframeSelectionCenter(timeline, refs))
        : 0;
    const distributedTimes =
      this.operation.type === 'distribute-time'
        ? calculateDistributedKeyframeTimeMap(timeline, refs)
        : new Map<string, number>();
    const alignValue =
      this.operation.type === 'align-value' ? getBatchAlignValue(timeline, refs, this.operation.value) : undefined;
    const refsByClipId = groupKeyframeRefsByClip(refs);
    for (const [clipId, clipRefs] of refsByClipId) {
      const beforeClip = findClip(timeline, clipId);
      let keyframes = cloneClipKeyframes(beforeClip.keyframes);
      const touchedProperties = new Set<KeyframeProperty>();
      for (const ref of clipRefs) {
        const existing = keyframes?.[ref.property]?.find((frame) => frame.id === ref.keyframeId);
        if (!existing) {
          throw new Error(`Keyframe ${ref.keyframeId} not found`);
        }
        touchedProperties.add(ref.property);
        if (this.operation.type === 'delete') {
          keyframes = removeKeyframeForProperty(keyframes, ref.property, ref.keyframeId);
          continue;
        }
        const nextTime =
          this.operation.type === 'distribute-time'
            ? (distributedTimes.get(keyframeRefKey(ref)) ?? existing.time)
            : getBatchEditedKeyframeTime(beforeClip, existing, this.operation, center);
        const nextValue =
          this.operation.type === 'align-value' ? alignKeyframeValues([existing], alignValue)[0].value : existing.value;
        const nextEasing =
          this.operation.type === 'easing'
            ? applyBatchKeyframeEasing([existing], this.operation.easing)[0].easing
            : existing.easing;
        keyframes = setKeyframeForProperty(
          keyframes,
          ref.property,
          createKeyframe(
            ref.property,
            {
              id: existing.id,
              time: nextTime,
              value: nextValue,
              easing: nextEasing,
              inHandle: existing.inHandle,
              outHandle: existing.outHandle,
              handleMode: existing.handleMode,
            },
            beforeClip.duration,
          ),
          beforeClip.duration,
        );
      }
      let after = {
        ...beforeClip,
        keyframes: normalizeClipKeyframes(cloneClipKeyframes(keyframes), beforeClip.duration),
      } as Clip;
      if (touchedProperties.has('speed')) {
        after = applySpeedKeyframeDuration(beforeClip, after, 'speed');
        if (detectOverlap(findTrack(timeline, after.trackId), after, beforeClip.id)) {
          throw new Error('Clip overlaps another clip on this track');
        }
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

export class RemoveKeyframeCommand implements Command {
  readonly description = 'Remove keyframe';
  private before?: Clip;
  private after?: Clip;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly clipId: string,
    private readonly property: KeyframeProperty,
    private readonly keyframeId: string,
  ) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
    this.before ??= findClip(timeline, this.clipId);
    if (!this.before.keyframes?.[this.property]?.some((frame) => frame.id === this.keyframeId)) {
      throw new Error(`Keyframe ${this.keyframeId} not found`);
    }
    this.after = {
      ...this.before,
      keyframes: removeKeyframeForProperty(this.before.keyframes, this.property, this.keyframeId),
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

export interface ApplyTextAnimationInput {
  preset: TextAnimationPreset;
  duration: number;
  direction: TextAnimationDirection;
}

export class ApplyTextAnimationCommand implements Command {
  readonly description = 'Apply text animation';
  private before?: Clip;
  private after?: Clip;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly clipId: string,
    private readonly input: ApplyTextAnimationInput,
  ) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
    this.before ??= findClip(timeline, this.clipId);
    if (this.before.type !== 'text') {
      throw new Error('Text animation can only be applied to text clips');
    }
    const preset = normalizeTextAnimationPreset(this.input.preset);
    const direction = normalizeTextAnimationDirection(this.input.direction);
    const duration = normalizeTextAnimationDuration(this.input.duration);
    const generated = buildTextAnimationKeyframes({
      preset,
      direction,
      duration,
      clipDuration: this.before.duration,
      transform: this.before.transform,
      text: this.before.text,
    });
    this.after = {
      ...this.before,
      keyframes: mergeTextAnimationKeyframes(this.before.keyframes, generated, this.before.duration),
    };
    this.accessor.setTimeline(replaceClip(timeline, this.after));
  }

  undo(): void {
    if (this.before) {
      this.accessor.setTimeline(replaceClip(this.accessor.getTimeline(), this.before));
    }
  }
}

export class UpdateSubtitleStyleCommand implements Command {
  readonly description = 'Update subtitle style';
  private before?: Extract<Clip, { type: 'subtitle' }>;
  private after?: Extract<Clip, { type: 'subtitle' }>;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly clipId: string,
    private readonly style: Partial<SubtitleStyle>,
  ) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
    const clip = findClip(timeline, this.clipId);
    if (clip.type !== 'subtitle') {
      throw new Error(`Clip ${this.clipId} is not a subtitle clip`);
    }
    this.before ??= cloneCommandValue(clip);
    const nextStyle = normalizeSubtitleStyleTemplateStyle({ ...DEFAULT_SUBTITLE_STYLE, ...clip.style, ...this.style });
    this.after = {
      ...clip,
      style: nextStyle,
    };
    this.accessor.setTimeline(replaceClip(timeline, this.after));
  }

  undo(): void {
    if (this.before) {
      this.accessor.setTimeline(replaceClip(this.accessor.getTimeline(), this.before));
    }
  }
}
