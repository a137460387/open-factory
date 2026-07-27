import type { ProjectAccessor } from './index';
import { MulticamClip, MulticamClipAngle, MulticamSyncMode, SwitchTransition } from '../../model-types';
import { Command } from '../command';
export declare class CreateMulticamSequenceCommand implements Command {
    private readonly accessor;
    private readonly clipIds;
    private readonly sequenceName;
    readonly description = "Create multicam sequence";
    private before?;
    private after?;
    private resultClipId?;
    private resultSequenceId?;
    constructor(accessor: ProjectAccessor, clipIds: string[], sequenceName?: string);
    get multicamClipId(): string | undefined;
    get sequenceId(): string | undefined;
    execute(): void;
    undo(): void;
}
export declare class CutMulticamClipCommand implements Command {
    private readonly accessor;
    private readonly clipId;
    private readonly sceneTime;
    private readonly angleId;
    readonly description = "Cut multicam clip";
    private before?;
    private after?;
    constructor(accessor: ProjectAccessor, clipId: string, sceneTime: number, angleId: string);
    execute(): void;
    undo(): void;
}
export interface MulticamAngleCut {
    sceneTime: number;
    angleId: string;
}
export declare class RecordAngleCutCommand implements Command {
    private readonly accessor;
    private readonly clipId;
    readonly description = "Record multicam angle cuts";
    private before?;
    private after?;
    private readonly cuts;
    constructor(accessor: ProjectAccessor, clipId: string, cuts?: MulticamAngleCut[]);
    get cutCount(): number;
    record(sceneTime: number, angleId: string): void;
    execute(): void;
    undo(): void;
    private applyCuts;
}
export declare class TrimMulticamSwitchCommand implements Command {
    private readonly accessor;
    private readonly clipId;
    private readonly switchId;
    private readonly frameDelta;
    private readonly fps;
    readonly description = "Trim multicam switch";
    private before?;
    private after?;
    constructor(accessor: ProjectAccessor, clipId: string, switchId: string, frameDelta: number, fps: number);
    execute(): void;
    undo(): void;
}
export declare class ApplyMulticamAiCutSuggestionsCommand implements Command {
    private readonly accessor;
    private readonly clipId;
    private readonly suggestions;
    readonly description = "Apply AI multicam cut suggestions";
    private before?;
    private after?;
    constructor(accessor: ProjectAccessor, clipId: string, suggestions: Array<{
        time: number;
        angleId: string;
        confidence: number;
        reason: string;
    }>);
    execute(): void;
    undo(): void;
}
export declare class CreateMulticamClipCommand implements Command {
    private readonly accessor;
    private readonly trackId;
    private readonly angles;
    private readonly syncMode;
    private readonly syncReferenceAngle;
    private readonly start;
    private readonly duration;
    readonly description = "Create multicam clip";
    private before?;
    private _result?;
    constructor(accessor: ProjectAccessor, trackId: string, angles: MulticamClipAngle[], syncMode: MulticamSyncMode, syncReferenceAngle: number, start?: number, duration?: number);
    get result(): MulticamClip;
    execute(): void;
    undo(): void;
}
/**
 * 切换多机位角度命令（添加切换点）
 */
export declare class SwitchMulticamAngleCommand implements Command {
    private readonly accessor;
    private readonly clipId;
    private readonly time;
    private readonly targetAngle;
    private readonly transition;
    readonly description = "Switch multicam angle";
    private before?;
    private after?;
    constructor(accessor: ProjectAccessor, clipId: string, time: number, targetAngle: number, transition?: SwitchTransition);
    execute(): void;
    undo(): void;
}
/**
 * 删除切换点命令
 */
//# sourceMappingURL=multicam-commands.d.ts.map