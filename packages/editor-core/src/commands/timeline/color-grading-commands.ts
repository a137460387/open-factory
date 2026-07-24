import type { TimelineAccessor, ProjectAccessor } from "./index";
import { ColorGradingConnection, ColorGradingNode } from '../../color-grading/types';
import { Project } from '../../model';
import { Command } from '../command';
import { ProjectAccessor, touchProject } from './utils';
import { updateClipColorGradingGraph } from './utils-nested';

export class AddColorNodeCommand implements Command {
  readonly description = 'Add color grading node';
  private before?: Project;
  private after?: Project;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly clipId: string,
    private readonly node: ColorGradingNode,
  ) {}

  execute(): void {
    if (this.after) {
      this.accessor.setProject(this.after);
      return;
    }
    this.before ??= this.accessor.getProject();
    this.after = touchProject(
      updateClipColorGradingGraph(this.before, this.clipId, (graph) => ({
        ...graph,
        nodes: [...graph.nodes, this.node],
      })),
    );
    this.accessor.setProject(this.after);
  }

  undo(): void {
    if (this.before) {
      this.accessor.setProject(this.before);
    }
  }
}

/** 移除调色节点 */

export class RemoveColorNodeCommand implements Command {
  readonly description = 'Remove color grading node';
  private before?: Project;
  private after?: Project;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly clipId: string,
    private readonly nodeId: string,
  ) {}

  execute(): void {
    if (this.after) {
      this.accessor.setProject(this.after);
      return;
    }
    this.before ??= this.accessor.getProject();
    this.after = touchProject(
      updateClipColorGradingGraph(this.before, this.clipId, (graph) => ({
        ...graph,
        nodes: graph.nodes.filter((n) => n.id !== this.nodeId),
        connections: graph.connections.filter((c) => c.fromNodeId !== this.nodeId && c.toNodeId !== this.nodeId),
        activeNodeId: graph.activeNodeId === this.nodeId ? null : graph.activeNodeId,
      })),
    );
    this.accessor.setProject(this.after);
  }

  undo(): void {
    if (this.before) {
      this.accessor.setProject(this.before);
    }
  }
}

export type ColorGradingNodePatch = Partial<
  Pick<ColorGradingNode, 'enabled' | 'params' | 'position' | 'inputs' | 'output'>
>;

/** 更新调色节点参数 */

export class UpdateColorNodeCommand implements Command {
  readonly description = 'Update color grading node';
  private before?: Project;
  private after?: Project;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly clipId: string,
    private readonly nodeId: string,
    private readonly patch: ColorGradingNodePatch,
  ) {}

  execute(): void {
    if (this.after) {
      this.accessor.setProject(this.after);
      return;
    }
    this.before ??= this.accessor.getProject();
    this.after = touchProject(
      updateClipColorGradingGraph(this.before, this.clipId, (graph) => ({
        ...graph,
        nodes: graph.nodes.map((node) => {
          if (node.id !== this.nodeId) return node;
          return { ...node, ...this.patch };
        }),
      })),
    );
    this.accessor.setProject(this.after);
  }

  undo(): void {
    if (this.before) {
      this.accessor.setProject(this.before);
    }
  }
}

/** 连接/断开调色节点 */

export class ConnectColorNodesCommand implements Command {
  readonly description: string;
  private before?: Project;
  private after?: Project;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly clipId: string,
    private readonly connection: ColorGradingConnection,
    private readonly isConnect: boolean,
  ) {
    this.description = isConnect ? 'Connect color grading nodes' : 'Disconnect color grading nodes';
  }

  execute(): void {
    if (this.after) {
      this.accessor.setProject(this.after);
      return;
    }
    this.before ??= this.accessor.getProject();
    this.after = touchProject(
      updateClipColorGradingGraph(this.before, this.clipId, (graph) => {
        if (this.isConnect) {
          return { ...graph, connections: [...graph.connections, this.connection] };
        }
        return { ...graph, connections: graph.connections.filter((c) => c.id !== this.connection.id) };
      }),
    );
    this.accessor.setProject(this.after);
  }

  undo(): void {
    if (this.before) {
      this.accessor.setProject(this.before);
    }
  }
}
