import {createDefaultColorNodeGraph, createId, normalizeColorNodeGraph, type Clip, type ColorNode, type ColorNodeGraph, type ColorNodeType} from '@open-factory/editor-core';
import {openFileDialog} from '../lib/tauri-bridge';
import {showToast} from '../lib/toast';
import {zhCN} from '../i18n/strings';
import {BOARD_HEIGHT, NODE_HEIGHT, NODE_SPACING_X, NODE_SPACING_Y} from './types';
import {clampNumber, dedupeConnections, defaultNodeName, findPredecessorNodeId} from './utils';

export function buildInitialGraph(clip: Clip): ColorNodeGraph {
  return clip.colorNodeGraph
    ? normalizeColorNodeGraph(clip.colorNodeGraph, clip.colorCorrection)
    : createDefaultColorNodeGraph(clip.colorCorrection);
}

export function createNode(
  type: ColorNodeType,
  x: number,
  y: number,
  index: number,
  id = createId(`color-node-${type}`),
): ColorNode {
  const correction =
    type === 'input' || type === 'output'
      ? createDefaultColorNodeGraph().nodes[0].correction
      : createDefaultColorNodeGraph().nodes[0].correction;
  return normalizeNode(
    {
      id,
      type,
      name: defaultNodeName(type, index),
      position: { x, y },
      correction,
      enabled: true,
    },
    undefined,
    index,
  );
}

export function normalizeNode(node: ColorNode, fallback: ColorNode | undefined, _index: number): ColorNode {
  return (
    normalizeColorNodeGraph({
      version: 1,
      outputNodeId: node.id,
      nodes: [node],
      connections: [],
    }).nodes[0] ??
    fallback ??
    node
  );
}

export function resolveInsertAnchor(graph: ColorNodeGraph, selectedNodeId: string): ColorNode {
  const selected =
    graph.nodes.find((node) => node.id === selectedNodeId) ??
    graph.nodes.find((node) => node.type !== 'output') ??
    graph.nodes[0];
  if (!selected) {
    return createDefaultColorNodeGraph().nodes[0];
  }
  if (selected.type !== 'output') {
    return selected;
  }
  const predecessorId = findPredecessorNodeId(graph, selected.id);
  return (
    graph.nodes.find((node) => node.id === predecessorId) ??
    graph.nodes.find((node) => node.type !== 'output' && node.id !== selected.id) ??
    selected
  );
}

export async function chooseLutFile(applyPath: (path: string) => void): Promise<void> {
  try {
    const [path] = await openFileDialog(false, [{ name: zhCN.colorNodeEditor.lutFileFilter, extensions: ['cube'] }]);
    if (!path) {
      return;
    }
    applyPath(path);
  } catch (error) {
    showToast({
      kind: 'warning',
      title: zhCN.colorNodeEditor.chooseLut,
      message: error instanceof Error ? error.message : zhCN.common.unavailable,
    });
  }
}

export function buildAddNodeGraph(
  current: ColorNodeGraph,
  type: ColorNodeType,
  selectedNodeId: string,
): { graph: ColorNodeGraph; newNodeId: string } {
  const newNodeId = createId(`color-node-${type}`);
  const anchor = resolveInsertAnchor(current, selectedNodeId);
  const anchorIndex = current.nodes.findIndex((node) => node.id === anchor.id);
  const outgoing = current.connections.filter((connection) => connection.from === anchor.id);
  const downstreamTargets =
    outgoing.length > 0
      ? outgoing.map((connection) => connection.to)
      : anchor.type === 'output'
        ? [findPredecessorNodeId(current, anchor.id) ?? current.nodes[0]?.id ?? anchor.id]
        : [current.outputNodeId];
  const newNode = createNode(
    type,
    anchor.position.x + NODE_SPACING_X,
    clampNumber(anchor.position.y + (type === 'parallel' ? -NODE_SPACING_Y : 0), 16, BOARD_HEIGHT - NODE_HEIGHT - 16),
    current.nodes.length,
    newNodeId,
  );
  const nextNodes = [...current.nodes];
  nextNodes.splice(Math.max(0, anchorIndex + 1), 0, newNode);
  const nextConnections = current.connections.filter((connection) => connection.from !== anchor.id);
  nextConnections.push({
    id: createId(`color-connection-${newNode.id}-in`),
    from: anchor.id,
    to: newNode.id,
  });
  for (const targetId of downstreamTargets) {
    if (!targetId || targetId === anchor.id) {
      continue;
    }
    nextConnections.push({
      id: createId(`color-connection-${newNode.id}-${targetId}`),
      from: newNode.id,
      to: targetId,
    });
  }
  const nextOutputNodeId =
    current.outputNodeId === anchor.id && outgoing.length === 0 ? newNode.id : current.outputNodeId;
  return {
    graph: {
      ...current,
      nodes: nextNodes,
      connections: dedupeConnections(nextConnections),
      outputNodeId: nextOutputNodeId,
    },
    newNodeId,
  };
}
