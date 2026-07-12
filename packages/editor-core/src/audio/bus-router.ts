import type { AudioBus, MixerChannel, BusAssignment, BusType } from './mixer-types';

/** 路由图节点 */
export interface RoutingNode {
  id: string;
  type: 'channel' | 'bus';
  name: string;
  outputs: string[];  // 输出到的节点ID列表
  inputs: string[];   // 输入来自的节点ID列表
}

/** 路由图 */
export interface RoutingGraph {
  nodes: RoutingNode[];
  connections: RoutingConnection[];
}

/** 路由连接 */
export interface RoutingConnection {
  fromId: string;
  toId: string;
  level: number;  // 0 ~ 1
}

/** 路由验证错误 */
export interface RoutingValidationError {
  type: 'cycle' | 'dangling-reference' | 'missing-master' | 'orphan';
  message: string;
  nodeId?: string;
}

export class BusRouter {
  /**
   * 构建路由图
   */
  static buildRoutingGraph(channels: MixerChannel[], buses: AudioBus[], masterBus: AudioBus): RoutingGraph {
    const nodes: RoutingNode[] = [];
    const connections: RoutingConnection[] = [];

    // 添加 master 总线节点
    nodes.push({
      id: masterBus.id,
      type: 'bus',
      name: masterBus.name,
      outputs: [],
      inputs: [],
    });

    // 添加普通总线节点
    for (const bus of buses) {
      nodes.push({
        id: bus.id,
        type: 'bus',
        name: bus.name,
        outputs: bus.outputBusId ? [bus.outputBusId] : [masterBus.id],
        inputs: [],
      });
    }

    // 添加通道节点
    for (const channel of channels) {
      const outputs: string[] = [];

      // 通道的总线分配
      for (const assignment of channel.busAssignments) {
        if (assignment.enabled) {
          outputs.push(assignment.busId);
          connections.push({
            fromId: channel.trackId,
            toId: assignment.busId,
            level: assignment.level,
          });
        }
      }

      // 如果没有总线分配，默认输出到 master
      if (outputs.length === 0) {
        outputs.push(masterBus.id);
        connections.push({
          fromId: channel.trackId,
          toId: masterBus.id,
          level: 1,
        });
      }

      nodes.push({
        id: channel.trackId,
        type: 'channel',
        name: channel.name,
        outputs,
        inputs: channel.inputBus ? [channel.inputBus] : [],
      });
    }

    // 添加总线间的连接
    for (const bus of buses) {
      const targetId = bus.outputBusId || masterBus.id;
      connections.push({
        fromId: bus.id,
        toId: targetId,
        level: bus.sendLevel || 1,
      });
    }

    // 建立反向引用
    for (const conn of connections) {
      const toNode = nodes.find(n => n.id === conn.toId);
      if (toNode && !toNode.inputs.includes(conn.fromId)) {
        toNode.inputs.push(conn.fromId);
      }
    }

    return { nodes, connections };
  }

  /**
   * 验证路由图
   */
  static validateRouting(graph: RoutingGraph): RoutingValidationError[] {
    const errors: RoutingValidationError[] = [];
    const nodeIds = new Set(graph.nodes.map(n => n.id));

    // 检查悬空引用
    for (const conn of graph.connections) {
      if (!nodeIds.has(conn.fromId)) {
        errors.push({ type: 'dangling-reference', message: `Source node ${conn.fromId} not found`, nodeId: conn.fromId });
      }
      if (!nodeIds.has(conn.toId)) {
        errors.push({ type: 'dangling-reference', message: `Target node ${conn.toId} not found`, nodeId: conn.toId });
      }
    }

    // 检查循环（DFS）
    const visited = new Set<string>();
    const inStack = new Set<string>();
    const adjacency = new Map<string, string[]>();

    for (const node of graph.nodes) {
      adjacency.set(node.id, node.outputs);
    }

    const hasCycle = (nodeId: string): boolean => {
      visited.add(nodeId);
      inStack.add(nodeId);

      for (const neighbor of adjacency.get(nodeId) || []) {
        if (inStack.has(neighbor)) return true;
        if (!visited.has(neighbor) && hasCycle(neighbor)) return true;
      }

      inStack.delete(nodeId);
      return false;
    };

    for (const node of graph.nodes) {
      if (!visited.has(node.id) && hasCycle(node.id)) {
        errors.push({ type: 'cycle', message: `Cycle detected involving node ${node.id}`, nodeId: node.id });
      }
    }

    // 检查孤立节点
    for (const node of graph.nodes) {
      if (node.outputs.length === 0 && node.inputs.length === 0) {
        errors.push({ type: 'orphan', message: `Orphan node: ${node.name}`, nodeId: node.id });
      }
    }

    return errors;
  }

  /**
   * 拓扑排序（信号流顺序）
   */
  static topologicalSort(graph: RoutingGraph): RoutingNode[] {
    const inDegree = new Map<string, number>();
    const adjacency = new Map<string, string[]>();

    for (const node of graph.nodes) {
      inDegree.set(node.id, 0);
      adjacency.set(node.id, []);
    }

    for (const conn of graph.connections) {
      adjacency.get(conn.fromId)?.push(conn.toId);
      inDegree.set(conn.toId, (inDegree.get(conn.toId) || 0) + 1);
    }

    const queue: string[] = [];
    for (const [id, degree] of inDegree) {
      if (degree === 0) queue.push(id);
    }

    const sorted: RoutingNode[] = [];
    const nodeMap = new Map(graph.nodes.map(n => [n.id, n]));

    while (queue.length > 0) {
      const id = queue.shift()!;
      sorted.push(nodeMap.get(id)!);
      for (const neighbor of adjacency.get(id) || []) {
        const newDegree = inDegree.get(neighbor)! - 1;
        inDegree.set(neighbor, newDegree);
        if (newDegree === 0) queue.push(neighbor);
      }
    }

    return sorted;
  }

  /**
   * 生成 FFmpeg 混音滤镜
   */
  static toFfmpegMixFilter(graph: RoutingGraph): string {
    const connections = graph.connections;
    if (connections.length === 0) return '';

    // 简化的 amerge/amix 滤镜
    const inputCount = new Set(connections.map(c => c.fromId)).size;
    if (inputCount <= 1) return '';

    return `amix=inputs=${inputCount}:duration=longest:dropout_transition=2`;
  }
}
