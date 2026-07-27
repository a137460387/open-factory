import type { ProjectAccessor } from './index';
import { MulticamClipAngle, MulticamSyncMode, SwitchPoint } from '../../model-types';
import { Command } from '../command';
export declare class DeleteSwitchPointCommand implements Command {
    private readonly accessor;
    private readonly clipId;
    private readonly switchPointIndex;
    readonly description = "Delete switch point";
    private before?;
    private after?;
    constructor(accessor: ProjectAccessor, clipId: string, switchPointIndex: number);
    execute(): void;
    undo(): void;
}
/**
 * 更新切换点命令
 */
export declare class UpdateSwitchPointCommand implements Command {
    private readonly accessor;
    private readonly clipId;
    private readonly switchPointIndex;
    private readonly updates;
    readonly description = "Update switch point";
    private before?;
    private after?;
    constructor(accessor: ProjectAccessor, clipId: string, switchPointIndex: number, updates: Partial<SwitchPoint>);
    execute(): void;
    undo(): void;
}
/**
 * 同步多机位片段命令（更新同步模式和机位偏移量）
 */
export declare class SyncMulticamClipCommand implements Command {
    private readonly accessor;
    private readonly clipId;
    private readonly syncMode;
    private readonly offsets;
    readonly description = "Sync multicam clip";
    private before?;
    private after?;
    constructor(accessor: ProjectAccessor, clipId: string, syncMode: MulticamSyncMode, offsets: Map<string, number>);
    execute(): void;
    undo(): void;
}
/**
 * 更新多机位角度属性命令
 */
export declare class UpdateMulticamAngleCommand implements Command {
    private readonly accessor;
    private readonly clipId;
    private readonly angleIndex;
    private readonly updates;
    readonly description = "Update multicam angle";
    private before?;
    private after?;
    constructor(accessor: ProjectAccessor, clipId: string, angleIndex: number, updates: Partial<MulticamClipAngle>);
    execute(): void;
    undo(): void;
}
//# sourceMappingURL=multicam-edit-commands.d.ts.map