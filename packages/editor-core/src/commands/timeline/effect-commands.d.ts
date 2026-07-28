import type { TimelineAccessor } from './index';
import { EffectPreset } from '../../effect-presets';
import { Effect, EffectParams, EffectType } from '../../effects';
import { Command } from '../command';
export declare class ApplyEffectPresetCommand implements Command {
    private readonly accessor;
    private readonly clipId;
    private readonly preset;
    readonly description = "Apply effect preset";
    private before?;
    private after?;
    constructor(accessor: TimelineAccessor, clipId: string, preset: EffectPreset);
    execute(): void;
    undo(): void;
}
export interface AddEffectInput {
    id?: string;
    type: EffectType;
    enabled?: boolean;
    params?: EffectParams;
}
export declare class AddEffectCommand implements Command {
    private readonly accessor;
    private readonly clipId;
    private readonly input;
    readonly description = "Add effect";
    private before?;
    private after?;
    private effect?;
    constructor(accessor: TimelineAccessor, clipId: string, input: AddEffectInput);
    execute(): void;
    undo(): void;
}
export declare class RemoveEffectCommand implements Command {
    private readonly accessor;
    private readonly clipId;
    private readonly effectId;
    readonly description = "Remove effect";
    private before?;
    private after?;
    constructor(accessor: TimelineAccessor, clipId: string, effectId: string);
    execute(): void;
    undo(): void;
}
export type EffectPatch = Partial<Pick<Effect, 'enabled' | 'params' | 'type'>>;
export declare class UpdateEffectCommand implements Command {
    private readonly accessor;
    private readonly clipId;
    private readonly effectId;
    private readonly patch;
    readonly description = "Update effect";
    private before?;
    private after?;
    constructor(accessor: TimelineAccessor, clipId: string, effectId: string, patch: EffectPatch);
    execute(): void;
    undo(): void;
}
export declare class ReorderEffectsCommand implements Command {
    private readonly accessor;
    private readonly clipId;
    private readonly orderedEffectIds;
    readonly description = "Reorder effects";
    private before?;
    private after?;
    constructor(accessor: TimelineAccessor, clipId: string, orderedEffectIds: string[]);
    execute(): void;
    undo(): void;
}
//# sourceMappingURL=effect-commands.d.ts.map