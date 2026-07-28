import type { TimelineAccessor } from './index';
import { Keyframe, KeyframeEasing, KeyframeProperty } from '../../model';
import { TextAnimationDirection, TextAnimationPreset } from '../../text-animation';
import { Command } from '../command';
export type KeyframePatch = Partial<Pick<Keyframe<number>, 'time' | 'value' | 'easing' | 'inHandle' | 'outHandle' | 'handleMode'>>;
export interface KeyframeSelectionRef {
    clipId: string;
    property: KeyframeProperty;
    keyframeId: string;
}
export type BatchKeyframeEditOperation = {
    type: 'shift';
    delta: number;
} | {
    type: 'scale-time';
    factor: number;
    center?: number;
} | {
    type: 'delete';
} | {
    type: 'easing';
    easing: KeyframeEasing;
} | {
    type: 'distribute-time';
} | {
    type: 'align-value';
    value?: number;
};
export declare class UpdateKeyframeCommand implements Command {
    private readonly accessor;
    private readonly clipId;
    private readonly property;
    private readonly keyframeId;
    private readonly patch;
    readonly description = "Update keyframe";
    private before?;
    private after?;
    constructor(accessor: TimelineAccessor, clipId: string, property: KeyframeProperty, keyframeId: string, patch: KeyframePatch);
    execute(): void;
    undo(): void;
}
export declare class BatchKeyframeEditCommand implements Command {
    private readonly accessor;
    private readonly refs;
    private readonly operation;
    readonly description: string;
    private before?;
    constructor(accessor: TimelineAccessor, refs: KeyframeSelectionRef[], operation: BatchKeyframeEditOperation, description?: string);
    execute(): void;
    undo(): void;
}
export declare class RemoveKeyframeCommand implements Command {
    private readonly accessor;
    private readonly clipId;
    private readonly property;
    private readonly keyframeId;
    readonly description = "Remove keyframe";
    private before?;
    private after?;
    constructor(accessor: TimelineAccessor, clipId: string, property: KeyframeProperty, keyframeId: string);
    execute(): void;
    undo(): void;
}
export interface ApplyTextAnimationInput {
    preset: TextAnimationPreset;
    duration: number;
    direction: TextAnimationDirection;
}
export declare class ApplyTextAnimationCommand implements Command {
    private readonly accessor;
    private readonly clipId;
    private readonly input;
    readonly description = "Apply text animation";
    private before?;
    private after?;
    constructor(accessor: TimelineAccessor, clipId: string, input: ApplyTextAnimationInput);
    execute(): void;
    undo(): void;
}
//# sourceMappingURL=keyframe-edit-commands.d.ts.map