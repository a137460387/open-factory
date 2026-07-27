import { touchProject } from './utils';
import { updateClipColorGradingGraph } from './utils-nested';
export class AddColorNodeCommand {
    accessor;
    clipId;
    node;
    description = 'Add color grading node';
    before;
    after;
    constructor(accessor, clipId, node) {
        this.accessor = accessor;
        this.clipId = clipId;
        this.node = node;
    }
    execute() {
        if (this.after) {
            this.accessor.setProject(this.after);
            return;
        }
        this.before ??= this.accessor.getProject();
        this.after = touchProject(updateClipColorGradingGraph(this.before, this.clipId, (graph) => ({
            ...graph,
            nodes: [...graph.nodes, this.node],
        })));
        this.accessor.setProject(this.after);
    }
    undo() {
        if (this.before) {
            this.accessor.setProject(this.before);
        }
    }
}
/** 移除调色节点 */
export class RemoveColorNodeCommand {
    accessor;
    clipId;
    nodeId;
    description = 'Remove color grading node';
    before;
    after;
    constructor(accessor, clipId, nodeId) {
        this.accessor = accessor;
        this.clipId = clipId;
        this.nodeId = nodeId;
    }
    execute() {
        if (this.after) {
            this.accessor.setProject(this.after);
            return;
        }
        this.before ??= this.accessor.getProject();
        this.after = touchProject(updateClipColorGradingGraph(this.before, this.clipId, (graph) => ({
            ...graph,
            nodes: graph.nodes.filter((n) => n.id !== this.nodeId),
            connections: graph.connections.filter((c) => c.fromNodeId !== this.nodeId && c.toNodeId !== this.nodeId),
            activeNodeId: graph.activeNodeId === this.nodeId ? null : graph.activeNodeId,
        })));
        this.accessor.setProject(this.after);
    }
    undo() {
        if (this.before) {
            this.accessor.setProject(this.before);
        }
    }
}
/** 更新调色节点参数 */
export class UpdateColorNodeCommand {
    accessor;
    clipId;
    nodeId;
    patch;
    description = 'Update color grading node';
    before;
    after;
    constructor(accessor, clipId, nodeId, patch) {
        this.accessor = accessor;
        this.clipId = clipId;
        this.nodeId = nodeId;
        this.patch = patch;
    }
    execute() {
        if (this.after) {
            this.accessor.setProject(this.after);
            return;
        }
        this.before ??= this.accessor.getProject();
        this.after = touchProject(updateClipColorGradingGraph(this.before, this.clipId, (graph) => ({
            ...graph,
            nodes: graph.nodes.map((node) => {
                if (node.id !== this.nodeId)
                    return node;
                return { ...node, ...this.patch };
            }),
        })));
        this.accessor.setProject(this.after);
    }
    undo() {
        if (this.before) {
            this.accessor.setProject(this.before);
        }
    }
}
/** 连接/断开调色节点 */
export class ConnectColorNodesCommand {
    accessor;
    clipId;
    connection;
    isConnect;
    description;
    before;
    after;
    constructor(accessor, clipId, connection, isConnect) {
        this.accessor = accessor;
        this.clipId = clipId;
        this.connection = connection;
        this.isConnect = isConnect;
        this.description = isConnect ? 'Connect color grading nodes' : 'Disconnect color grading nodes';
    }
    execute() {
        if (this.after) {
            this.accessor.setProject(this.after);
            return;
        }
        this.before ??= this.accessor.getProject();
        this.after = touchProject(updateClipColorGradingGraph(this.before, this.clipId, (graph) => {
            if (this.isConnect) {
                return { ...graph, connections: [...graph.connections, this.connection] };
            }
            return { ...graph, connections: graph.connections.filter((c) => c.id !== this.connection.id) };
        }));
        this.accessor.setProject(this.after);
    }
    undo() {
        if (this.before) {
            this.accessor.setProject(this.before);
        }
    }
}
//# sourceMappingURL=color-grading-commands.js.map