import type { TimelineAccessor, ProjectAccessor } from "./index";
import { Transition, TransitionType, createTransition } from '../../model';
import { clampTransitionDuration, findAdjacentTransitionClips } from '../../timeline';
import { Command } from '../command';
import { TimelineAccessor } from './utils';

export interface TransitionInput {
  id?: string;
  type: TransitionType;
  duration: number;
  fromClipId: string;
  toClipId: string;
}

export class AddTransitionCommand implements Command {
  readonly description = 'Add transition';
  private transition?: Transition;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly input: TransitionInput,
  ) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
    const pair = findAdjacentTransitionClips(timeline, this.input.fromClipId, this.input.toClipId);
    if (!pair) {
      throw new Error('Transition clips must be adjacent on the same track');
    }
    if (
      (timeline.transitions ?? []).some(
        (transition) => transition.fromClipId === this.input.fromClipId && transition.toClipId === this.input.toClipId,
      )
    ) {
      throw new Error('Transition already exists for these clips');
    }
    const duration = clampTransitionDuration(this.input.duration, pair.fromClip, pair.toClip);
    if (duration <= 0) {
      throw new Error('Transition duration must be greater than zero');
    }
    this.transition ??= createTransition({ ...this.input, duration });
    this.transition = { ...this.transition, duration };
    this.accessor.setTimeline({
      ...timeline,
      transitions: [...(timeline.transitions ?? []), this.transition],
    });
  }

  undo(): void {
    if (!this.transition) {
      return;
    }
    const timeline = this.accessor.getTimeline();
    this.accessor.setTimeline({
      ...timeline,
      transitions: (timeline.transitions ?? []).filter((transition) => transition.id !== this.transition?.id),
    });
  }
}

export class RemoveTransitionCommand implements Command {
  readonly description = 'Remove transition';
  private removed?: Transition;
  private index = -1;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly transitionId: string,
  ) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
    this.index = (timeline.transitions ?? []).findIndex((transition) => transition.id === this.transitionId);
    if (this.index === -1) {
      throw new Error(`Transition ${this.transitionId} not found`);
    }
    this.removed ??= (timeline.transitions ?? [])[this.index];
    this.accessor.setTimeline({
      ...timeline,
      transitions: (timeline.transitions ?? []).filter((transition) => transition.id !== this.transitionId),
    });
  }

  undo(): void {
    if (!this.removed) {
      return;
    }
    const timeline = this.accessor.getTimeline();
    const transitions = [...(timeline.transitions ?? [])];
    transitions.splice(Math.max(0, this.index), 0, this.removed);
    this.accessor.setTimeline({ ...timeline, transitions });
  }
}
