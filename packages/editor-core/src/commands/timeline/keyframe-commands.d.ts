import type { TimelineAccessor } from './index';
import { ClipboardKeyframeGroup, PasteMode } from '../../keyframes';
import { KeyframeEasing, KeyframeHandle, KeyframeHandleMode, KeyframeProperty } from '../../model';
import { Command } from '../command';
export interface PasteKeyframesInput {
    groups: ClipboardKeyframeGroup[];
    targetClipId: string;
    mode: PasteMode;
    targetProperty?: KeyframeProperty;
}
export declare class PasteKeyframesCommand implements Command {
    private readonly accessor;
    private readonly input;
    readonly description = "Paste keyframes";
    private before?;
    private after?;
    constructor(accessor: TimelineAccessor, input: PasteKeyframesInput);
    execute(): void;
    undo(): void;
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
export declare class AddKeyframeCommand implements Command {
    private readonly accessor;
    private readonly clipId;
    private readonly property;
    private readonly input;
    readonly description = "Add keyframe";
    private before?;
    private after?;
    private keyframe?;
    constructor(accessor: TimelineAccessor, clipId: string, property: KeyframeProperty, input: AddKeyframeInput);
    execute(): void;
    undo(): void;
}
export interface BatchUpdateKeyframeItem {
    clipId: string;
    property: KeyframeProperty;
    keyframes: AddKeyframeInput[];
    replace?: boolean;
}
export declare class BatchUpdateKeyframeCommand implements Command {
    private readonly accessor;
    private readonly updates;
    readonly description: string;
    private before?;
    constructor(accessor: TimelineAccessor, updates: BatchUpdateKeyframeItem[], description?: string);
    execute(): void;
    undo(): void;
}
//# sourceMappingURL=keyframe-commands.d.ts.map