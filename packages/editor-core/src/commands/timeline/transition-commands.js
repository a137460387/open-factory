import { createTransition } from '../../model';
import { clampTransitionDuration, findAdjacentTransitionClips } from '../../timeline';
export class AddTransitionCommand {
    accessor;
    input;
    description = 'Add transition';
    transition;
    constructor(accessor, input) {
        this.accessor = accessor;
        this.input = input;
    }
    execute() {
        const timeline = this.accessor.getTimeline();
        const pair = findAdjacentTransitionClips(timeline, this.input.fromClipId, this.input.toClipId);
        if (!pair) {
            throw new Error('Transition clips must be adjacent on the same track');
        }
        if ((timeline.transitions ?? []).some((transition) => transition.fromClipId === this.input.fromClipId && transition.toClipId === this.input.toClipId)) {
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
    undo() {
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
export class RemoveTransitionCommand {
    accessor;
    transitionId;
    description = 'Remove transition';
    removed;
    index = -1;
    constructor(accessor, transitionId) {
        this.accessor = accessor;
        this.transitionId = transitionId;
    }
    execute() {
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
    undo() {
        if (!this.removed) {
            return;
        }
        const timeline = this.accessor.getTimeline();
        const transitions = [...(timeline.transitions ?? [])];
        transitions.splice(Math.max(0, this.index), 0, this.removed);
        this.accessor.setTimeline({ ...timeline, transitions });
    }
}
//# sourceMappingURL=transition-commands.js.map