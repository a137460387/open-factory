import type { ProjectAccessor } from './index';
import { ColorGradingConnection, ColorGradingNode } from '../../color-grading/types';
import { Command } from '../command';
export declare class AddColorNodeCommand implements Command {
    private readonly accessor;
    private readonly clipId;
    private readonly node;
    readonly description = "Add color grading node";
    private before?;
    private after?;
    constructor(accessor: ProjectAccessor, clipId: string, node: ColorGradingNode);
    execute(): void;
    undo(): void;
}
/** 移除调色节点 */
export declare class RemoveColorNodeCommand implements Command {
    private readonly accessor;
    private readonly clipId;
    private readonly nodeId;
    readonly description = "Remove color grading node";
    private before?;
    private after?;
    constructor(accessor: ProjectAccessor, clipId: string, nodeId: string);
    execute(): void;
    undo(): void;
}
export type ColorGradingNodePatch = Partial<Pick<ColorGradingNode, 'enabled' | 'params' | 'position' | 'inputs' | 'output'>>;
/** 更新调色节点参数 */
export declare class UpdateColorNodeCommand implements Command {
    private readonly accessor;
    private readonly clipId;
    private readonly nodeId;
    private readonly patch;
    readonly description = "Update color grading node";
    private before?;
    private after?;
    constructor(accessor: ProjectAccessor, clipId: string, nodeId: string, patch: ColorGradingNodePatch);
    execute(): void;
    undo(): void;
}
/** 连接/断开调色节点 */
export declare class ConnectColorNodesCommand implements Command {
    private readonly accessor;
    private readonly clipId;
    private readonly connection;
    private readonly isConnect;
    readonly description: string;
    private before?;
    private after?;
    constructor(accessor: ProjectAccessor, clipId: string, connection: ColorGradingConnection, isConnect: boolean);
    execute(): void;
    undo(): void;
}
//# sourceMappingURL=color-grading-commands.d.ts.map