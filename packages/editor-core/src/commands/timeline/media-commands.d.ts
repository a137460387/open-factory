import type { ProjectAccessor } from './index';
import { BatchEditableMediaMetadata } from '../../media-batch';
import { ProjectHealthAutoRepairInput, ProjectHealthRepairReport } from '../../project/project-health-repair';
import { ProxyMigrationUpdate } from '../../proxy/proxy-management';
import { Command } from '../command';
export declare class RemoveMediaCommand implements Command {
    private readonly accessor;
    private readonly assetIds;
    readonly description = "Remove media";
    private before?;
    private after?;
    constructor(accessor: ProjectAccessor, assetIds: string | string[]);
    execute(): void;
    undo(): void;
}
export declare class MergeMediaCommand implements Command {
    private readonly accessor;
    private readonly keepAssetId;
    private readonly mergedAssetIds;
    readonly description = "Merge media references";
    private before?;
    private after?;
    constructor(accessor: ProjectAccessor, keepAssetId: string, mergedAssetIds: string[]);
    execute(): void;
    undo(): void;
}
export interface BatchUpdateMetadataCommandItem {
    assetId: string;
    metadata: BatchEditableMediaMetadata;
}
export declare class BatchUpdateMetadataCommand implements Command {
    private readonly accessor;
    private readonly updates;
    readonly description = "Batch update media metadata";
    private before?;
    private after?;
    constructor(accessor: ProjectAccessor, updates: BatchUpdateMetadataCommandItem[]);
    execute(): void;
    undo(): void;
}
export interface BatchRenameMediaCommandItem {
    assetId: string;
    name: string;
    path?: string;
}
export declare class BatchRenameMediaCommand implements Command {
    private readonly accessor;
    private readonly renames;
    readonly description = "Batch rename media";
    private before?;
    private after?;
    constructor(accessor: ProjectAccessor, renames: BatchRenameMediaCommandItem[]);
    execute(): void;
    undo(): void;
}
export declare class MigrateProxiesCommand implements Command {
    private readonly accessor;
    private readonly updates;
    readonly description = "Migrate proxy paths";
    private before?;
    private after?;
    constructor(accessor: ProjectAccessor, updates: ProxyMigrationUpdate[]);
    execute(): void;
    undo(): void;
}
export declare class AutoRepairProjectHealthCommand implements Command {
    private readonly accessor;
    private readonly input;
    readonly description = "Auto repair project health";
    private before?;
    private after?;
    private repairReport?;
    constructor(accessor: ProjectAccessor, input: ProjectHealthAutoRepairInput);
    get report(): ProjectHealthRepairReport | undefined;
    execute(): void;
    undo(): void;
}
//# sourceMappingURL=media-commands.d.ts.map