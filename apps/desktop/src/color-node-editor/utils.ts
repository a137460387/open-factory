import {clamp, type ColorNode, type ColorNodeGraph, type ColorNodeType} from '@open-factory/editor-core';
import {NODE_HEIGHT, NODE_WIDTH} from './types';

export function clampNumber(value: number, min: number, max: number): number {
  return clamp(Number.isFinite(value) ? value : min, min, max);
}

export function formatNumber(value: number): string {
  const rounded = Math.round((Number.isFinite(value) ? value : 0) * 1000) / 1000;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(/0+$/g, '').replace(/\.$/g, '');
}

export function formatSvgNumber(value: number): string {
  return formatNumber(value);
}

export function sanitizeFileBaseName(name: string): string {
  return (
    name
      .trim()
      .replace(/[<>:"/\\|?*\u0000-\u001F]+/g, '_')
      .replace(/\s+/g, ' ')
      .trim() || 'open-factory-node-graph'
  );
}

export function buildConnectionPath(from: { x: number; y: number }, to: { x: number; y: number }): string {
  const dx = Math.max(48, Math.abs(to.x - from.x) * 0.5);
  const c1x = from.x + dx;
  const c2x = to.x - dx;
  return `M ${formatSvgNumber(from.x)} ${formatSvgNumber(from.y)} C ${formatSvgNumber(c1x)} ${formatSvgNumber(from.y)} ${formatSvgNumber(c2x)} ${formatSvgNumber(to.y)} ${formatSvgNumber(to.x)} ${formatSvgNumber(to.y)}`;
}

export function resolveNodeLabel(graph: ColorNodeGraph, nodeId: string): string {
  return graph.nodes.find((node) => node.id === nodeId)?.name ?? nodeId;
}

export function buildBoardPorts(
  graph: ColorNodeGraph,
): Map<string, { input: { x: number; y: number }; output: { x: number; y: number } }> {
  const ports = new Map<string, { input: { x: number; y: number }; output: { x: number; y: number } }>();
  for (const node of graph.nodes) {
    ports.set(node.id, {
      input: {
        x: node.position.x,
        y: node.position.y + NODE_HEIGHT / 2,
      },
      output: {
        x: node.position.x + NODE_WIDTH,
        y: node.position.y + NODE_HEIGHT / 2,
      },
    });
  }
  return ports;
}

export function dedupeConnections(connections: ColorNodeGraph['connections']): ColorNodeGraph['connections'] {
  const seen = new Set<string>();
  return connections.filter((connection) => {
    const key = `${connection.from}\0${connection.to}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export function findOutputNodeId(nodes: ColorNode[]): string | undefined {
  return nodes.find((node) => node.type === 'output')?.id;
}

export function findPredecessorNodeId(graph: ColorNodeGraph, nodeId: string): string | undefined {
  return graph.connections.find((connection) => connection.to === nodeId)?.from;
}

export function defaultNodeName(type: ColorNodeType, index: number): string {
  const map: Record<ColorNodeType, string> = {
    input: 'Input',
    sequential: 'Sequential',
    parallel: 'Parallel',
    layer: 'Layer',
    output: 'Output',
    lut: 'LUT',
  };
  return `${map[type]} ${index + 1}`;
}
