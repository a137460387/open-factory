import type { TimelineAccessor } from './index';
import { TransitionType } from '../../model';
import { Command } from '../command';
export interface TransitionInput {
    id?: string;
    type: TransitionType;
    duration: number;
    fromClipId: string;
    toClipId: string;
}
export declare class AddTransitionCommand implements Command {
    private readonly accessor;
    private readonly input;
    readonly description = "Add transition";
    private transition?;
    constructor(accessor: TimelineAccessor, input: TransitionInput);
    execute(): void;
    undo(): void;
}
export declare class RemoveTransitionCommand implements Command {
    private readonly accessor;
    private readonly transitionId;
    readonly description = "Remove transition";
    private removed?;
    private index;
    constructor(accessor: TimelineAccessor, transitionId: string);
    execute(): void;
    undo(): void;
}
//# sourceMappingURL=transition-commands.d.ts.map