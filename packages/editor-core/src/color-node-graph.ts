import {
  DEFAULT_COLOR_CURVES,
  DEFAULT_THREE_WAY_COLOR,
  isDefaultColorCurves,
  isNeutralThreeWayColor,
  normalizeColorCurves,
  normalizeThreeWayColor,
  serializeColorCurvesToCube,
  type ColorCurves,
  type ColorWheelValue,
  type ThreeWayColor
} from './color-grading';
import { getLogToRec709Lut, isLogInputColorSpace, normalizeInputColorSpace, REC709_INPUT_COLOR_SPACE, serializeLogToRec709Cube, type InputColorSpace, type LogInputColorSpace } from './color-log-luts';
import { normalizeLutLayers, type LUTLayer } from './model';
import { round } from './time';

export type ColorNodeType = 'input' | 'sequential' | 'parallel' | 'layer' | 'output' | 'lut';

export type ColorNodeBlendMode = 'average' | 'normal' | 'multiply' | 'screen' | 'overlay' | 'addition';

export interface ColorNodeCorrection {
  inputColorSpace?: InputColorSpace;
  brightness: number;
  contrast: number;
  saturation: number;
  hue: number;
  lutPath?: string | null;
  luts?: LUTLayer[];
  colorCurves?: ColorCurves;
  threeWayColor?: ThreeWayColor;
}

export interface ColorNodePosition {
  x: number;
  y: number;
}

export interface ColorNode {
  id: string;
  type: ColorNodeType;
  name: string;
  position: ColorNodePosition;
  correction: ColorNodeCorrection;
  lutPath?: string | null;
  blendMode?: ColorNodeBlendMode;
  mix?: number;
  enabled?: boolean;
}

export interface ColorNodeConnection {
  id: string;
  from: string;
  to: string;
}

export interface ColorNodeGraph {
  version: 1;
  nodes: ColorNode[];
  connections: ColorNodeConnection[];
  outputNodeId: string;
}

export interface ColorNodeGraphTemplate {
  id: ColorNodeTemplateId;
  name: string;
  description: string;
  graph: ColorNodeGraph;
}

export type ColorNodeTemplateId = 'cinematic' | 'portrait' | 'landscape' | 'black-white' | 'negative';

export interface ColorNodeGraphArtifact {
  clipId: string;
  nodeId: string;
  kind: 'curve-lut' | 'log-lut';
  text: string;
  fileName: string;
  placeholder: string;
}

export interface BuildColorNodeGraphFilterPlanOptions {
  inputLabel: string;
  outputLabel: string;
  clipId?: string;
  mediaKind?: 'video' | 'audio';
  escapeFilePath?: (path: string) => string;
  registerArtifact?: (artifact: ColorNodeGraphArtifact) => string;
}

export interface ColorNodeGraphFilterPlan {
  filters: string[];
  outputLabel: string;
  order: ColorNode[];
}

export const DEFAULT_COLOR_NODE_CORRECTION: ColorNodeCorrection = {
  inputColorSpace: REC709_INPUT_COLOR_SPACE,
  brightness: 0,
  contrast: 1,
  saturation: 1,
  hue: 0,
  lutPath: null,
  luts: [],
  colorCurves: DEFAULT_COLOR_CURVES,
  threeWayColor: DEFAULT_THREE_WAY_COLOR
};

export class ColorNodeGraphCycleError extends Error {
  readonly nodeIds: string[];

  constructor(nodeIds: string[]) {
    super(`Color node graph contains a cycle: ${nodeIds.join(' -> ')}`);
    this.name = 'ColorNodeGraphCycleError';
    this.nodeIds = nodeIds;
  }
}

export function createDefaultColorNodeGraph(correction?: Partial<ColorNodeCorrection>): ColorNodeGraph {
  const node: ColorNode = {
    id: 'node-default',
    type: 'sequential',
    name: 'Default Grade',
    position: { x: 280, y: 160 },
    correction: normalizeColorNodeCorrection(correction)
  };
  return {
    version: 1,
    nodes: [node],
    connections: [],
    outputNodeId: node.id
  };
}

export function normalizeColorNodeCorrection(correction: Partial<ColorNodeCorrection> | undefined): ColorNodeCorrection {
  return {
    inputColorSpace: normalizeInputColorSpace(correction?.inputColorSpace),
    brightness: round(Math.min(1, Math.max(-1, finiteOrDefault(correction?.brightness, DEFAULT_COLOR_NODE_CORRECTION.brightness)))),
    contrast: round(Math.min(2, Math.max(0, finiteOrDefault(correction?.contrast, DEFAULT_COLOR_NODE_CORRECTION.contrast)))),
    saturation: round(Math.min(2, Math.max(0, finiteOrDefault(correction?.saturation, DEFAULT_COLOR_NODE_CORRECTION.saturation)))),
    hue: round(Math.min(180, Math.max(-180, finiteOrDefault(correction?.hue, DEFAULT_COLOR_NODE_CORRECTION.hue)))),
    lutPath: normalizeLutPath(correction?.lutPath),
    luts: normalizeLutLayers(correction?.luts, correction?.lutPath),
    colorCurves: normalizeColorCurves(correction?.colorCurves),
    threeWayColor: normalizeThreeWayColor(correction?.threeWayColor)
  };
}

export function isDefaultColorNodeCorrection(correction: Partial<ColorNodeCorrection> | undefined): boolean {
  const normalized = normalizeColorNodeCorrection(correction);
  return (
    normalized.inputColorSpace === DEFAULT_COLOR_NODE_CORRECTION.inputColorSpace &&
    normalized.brightness === DEFAULT_COLOR_NODE_CORRECTION.brightness &&
    normalized.contrast === DEFAULT_COLOR_NODE_CORRECTION.contrast &&
    normalized.saturation === DEFAULT_COLOR_NODE_CORRECTION.saturation &&
    normalized.hue === DEFAULT_COLOR_NODE_CORRECTION.hue &&
    normalized.lutPath === DEFAULT_COLOR_NODE_CORRECTION.lutPath &&
    (normalized.luts?.length ?? 0) === 0 &&
    isDefaultColorCurves(normalized.colorCurves) &&
    isNeutralThreeWayColor(normalized.threeWayColor)
  );
}

export function normalizeColorNodeGraph(graph: Partial<ColorNodeGraph> | undefined, fallbackCorrection?: Partial<ColorNodeCorrection>): ColorNodeGraph {
  if (!graph || typeof graph !== 'object' || !Array.isArray(graph.nodes) || graph.nodes.length === 0) {
    return createDefaultColorNodeGraph(fallbackCorrection);
  }
  const nodes: ColorNode[] = [];
  const seenNodeIds = new Set<string>();
  graph.nodes.forEach((node, index) => {
    if (!node || typeof node !== 'object') {
      return;
    }
    const rawId = typeof node.id === 'string' && node.id.trim() ? node.id.trim() : `node-${index + 1}`;
    const id = seenNodeIds.has(rawId) ? `${rawId}-${index + 1}` : rawId;
    seenNodeIds.add(id);
    nodes.push({
      id,
      type: normalizeColorNodeType(node.type),
      name: normalizeNodeName(node.name, normalizeColorNodeType(node.type), index),
      position: normalizePosition(node.position, index),
      correction: normalizeColorNodeCorrection(node.correction),
      lutPath: normalizeLutPath(node.lutPath),
      blendMode: normalizeBlendMode(node.blendMode),
      mix: normalizeMix(node.mix),
      enabled: node.enabled !== false
    });
  });
  if (nodes.length === 0) {
    return createDefaultColorNodeGraph(fallbackCorrection);
  }
  const nodeIds = new Set(nodes.map((node) => node.id));
  const seenConnectionIds = new Set<string>();
  const connections: ColorNodeConnection[] = [];
  (Array.isArray(graph.connections) ? graph.connections : []).forEach((connection, index) => {
    if (!connection || typeof connection !== 'object' || !nodeIds.has(connection.from) || !nodeIds.has(connection.to) || connection.from === connection.to) {
      return;
    }
    const rawId = typeof connection.id === 'string' && connection.id.trim() ? connection.id.trim() : `${connection.from}-${connection.to}`;
    const id = seenConnectionIds.has(rawId) ? `${rawId}-${index + 1}` : rawId;
    seenConnectionIds.add(id);
    connections.push({ id, from: connection.from, to: connection.to });
  });
  const outputNodeId =
    typeof graph.outputNodeId === 'string' && nodeIds.has(graph.outputNodeId)
      ? graph.outputNodeId
      : nodes.find((node) => node.type === 'output')?.id ?? findSinkNodeId(nodes, connections) ?? nodes[nodes.length - 1].id;
  return {
    version: 1,
    nodes,
    connections,
    outputNodeId
  };
}

export function detectColorNodeGraphCycle(graph: Partial<ColorNodeGraph> | undefined): string[] | null {
  const normalized = normalizeColorNodeGraph(graph);
  const byFrom = groupConnections(normalized.connections, 'from');
  const state = new Map<string, 'visiting' | 'visited'>();
  const stack: string[] = [];
  const visit = (nodeId: string): string[] | null => {
    if (state.get(nodeId) === 'visiting') {
      const start = stack.indexOf(nodeId);
      return [...stack.slice(Math.max(0, start)), nodeId];
    }
    if (state.get(nodeId) === 'visited') {
      return null;
    }
    state.set(nodeId, 'visiting');
    stack.push(nodeId);
    for (const edge of byFrom.get(nodeId) ?? []) {
      const cycle = visit(edge.to);
      if (cycle) {
        return cycle;
      }
    }
    stack.pop();
    state.set(nodeId, 'visited');
    return null;
  };
  for (const node of normalized.nodes) {
    const cycle = visit(node.id);
    if (cycle) {
      return cycle;
    }
  }
  return null;
}

export function topologicallySortColorNodeGraph(graph: Partial<ColorNodeGraph> | undefined): ColorNode[] {
  const normalized = normalizeColorNodeGraph(graph);
  const cycle = detectColorNodeGraphCycle(normalized);
  if (cycle) {
    throw new ColorNodeGraphCycleError(cycle);
  }
  const nodesById = new Map(normalized.nodes.map((node) => [node.id, node]));
  const incomingByTo = groupConnections(normalized.connections, 'to');
  const visited = new Set<string>();
  const order: ColorNode[] = [];
  const visit = (nodeId: string): void => {
    if (visited.has(nodeId)) {
      return;
    }
    visited.add(nodeId);
    for (const edge of incomingByTo.get(nodeId) ?? []) {
      visit(edge.from);
    }
    const node = nodesById.get(nodeId);
    if (node) {
      order.push(node);
    }
  };
  visit(normalized.outputNodeId);
  return order;
}

export function buildColorNodeGraphFilterPlan(graph: Partial<ColorNodeGraph> | undefined, options: BuildColorNodeGraphFilterPlanOptions): ColorNodeGraphFilterPlan {
  const normalized = normalizeColorNodeGraph(graph);
  const order = topologicallySortColorNodeGraph(normalized);
  const orderIds = new Set(order.map((node) => node.id));
  const incomingByTo = groupConnections(
    normalized.connections.filter((edge) => orderIds.has(edge.from) && orderIds.has(edge.to)),
    'to'
  );
  const outgoingByFrom = groupConnections(
    normalized.connections.filter((edge) => orderIds.has(edge.from) && orderIds.has(edge.to)),
    'from'
  );
  const sourceNodes = order.filter((node) => (incomingByTo.get(node.id) ?? []).length === 0);
  const sourceLabels = new Map<string, string>();
  const filters: string[] = [];
  if (sourceNodes.length > 1) {
    const labels = sourceNodes.map((node) => `${safeLabel(options.outputLabel)}_${safeLabel(node.id)}_source`);
    filters.push(`[${options.inputLabel}]split=${labels.length}${labels.map((label) => `[${label}]`).join('')}`);
    sourceNodes.forEach((node, index) => sourceLabels.set(node.id, labels[index]));
  } else if (sourceNodes[0]) {
    sourceLabels.set(sourceNodes[0].id, options.inputLabel);
  }

  const outputByNodeId = new Map<string, string>();
  const outputByEdgeId = new Map<string, string>();
  for (const node of order) {
    const incoming = incomingByTo.get(node.id) ?? [];
    const inputLabels = incoming.length === 0 ? [sourceLabels.get(node.id) ?? options.inputLabel] : incoming.map((edge) => outputByEdgeId.get(edge.id) ?? outputByNodeId.get(edge.from) ?? options.inputLabel);
    const mergedLabel = mergeNodeInputs(filters, inputLabels, node, options);
    const nodeFilters = buildNodeFilters(node, options);
    const nodeLabel = nodeFilters.length > 0 ? `${safeLabel(options.outputLabel)}_${safeLabel(node.id)}` : mergedLabel;
    if (nodeFilters.length > 0) {
      filters.push(`[${mergedLabel}]${nodeFilters.join(',')}[${nodeLabel}]`);
    }
    outputByNodeId.set(node.id, nodeLabel);
    const outgoing = outgoingByFrom.get(node.id) ?? [];
    if (outgoing.length > 1) {
      const labels = outgoing.map((edge) => `${safeLabel(options.outputLabel)}_${safeLabel(edge.id)}_edge`);
      filters.push(`[${nodeLabel}]split=${labels.length}${labels.map((label) => `[${label}]`).join('')}`);
      outgoing.forEach((edge, index) => outputByEdgeId.set(edge.id, labels[index]));
    }
  }
  const finalLabel = outputByNodeId.get(normalized.outputNodeId) ?? options.inputLabel;
  if (finalLabel !== options.outputLabel) {
    filters.push(`[${finalLabel}]copy[${options.outputLabel}]`);
  }
  return { filters, outputLabel: options.outputLabel, order };
}

export function serializeColorNodeGraphFile(graph: Partial<ColorNodeGraph>, name = 'Open Factory Node Graph'): string {
  return `${JSON.stringify({ format: 'open-factory-node-graph', version: 1, name, graph: normalizeColorNodeGraph(graph) }, null, 2)}\n`;
}

export function parseColorNodeGraphFile(source: string): ColorNodeGraph {
  const parsed = JSON.parse(source) as { format?: unknown; graph?: Partial<ColorNodeGraph> };
  if (parsed.format !== 'open-factory-node-graph' || !parsed.graph) {
    throw new Error('Unsupported color node graph file.');
  }
  return normalizeColorNodeGraph(parsed.graph);
}

export const BUILT_IN_COLOR_NODE_GRAPH_TEMPLATES: readonly ColorNodeGraphTemplate[] = [
  {
    id: 'cinematic',
    name: 'Cinematic',
    description: 'Soft contrast, warmer highlights, and a subtle teal shadow bias.',
    graph: createTemplateGraph('cinematic', [
      node('input', 'input', 'Source', 40, 120),
      node('sequential', 'contrast', 'Soft Contrast', 280, 120, { contrast: 1.18, saturation: 1.08 }),
      node('sequential', 'tone', 'Warm Highlight', 520, 120, {
        threeWayColor: {
          lift: { r: -0.04, g: 0.02, b: 0.06, intensity: 1 },
          gamma: { r: 0, g: 0, b: 0, intensity: 1 },
          gain: { r: 0.08, g: 0.02, b: -0.04, intensity: 1 }
        }
      }),
      node('output', 'output', 'Output', 760, 120)
    ])
  },
  {
    id: 'portrait',
    name: 'Portrait',
    description: 'Gentle lift with controlled saturation for faces.',
    graph: createTemplateGraph('portrait', [
      node('input', 'input', 'Source', 40, 120),
      node('sequential', 'skin', 'Skin Balance', 280, 120, { brightness: 0.04, contrast: 1.08, saturation: 1.04 }),
      node('output', 'output', 'Output', 520, 120)
    ])
  },
  {
    id: 'landscape',
    name: 'Landscape',
    description: 'More contrast and saturation for outdoor footage.',
    graph: createTemplateGraph('landscape', [
      node('input', 'input', 'Source', 40, 120),
      node('sequential', 'punch', 'Punch', 280, 120, { contrast: 1.24, saturation: 1.22 }),
      node('sequential', 'curve', 'Sky Curve', 520, 120, {
        colorCurves: {
          ...DEFAULT_COLOR_CURVES,
          master: [
            { x: 0, y: 0 },
            { x: 0.45, y: 0.4 },
            { x: 1, y: 1 }
          ],
          b: [
            { x: 0, y: 0 },
            { x: 1, y: 1 }
          ]
        }
      }),
      node('output', 'output', 'Output', 760, 120)
    ])
  },
  {
    id: 'black-white',
    name: 'Black and White',
    description: 'Neutral monochrome with a mild contrast lift.',
    graph: createTemplateGraph('black-white', [
      node('input', 'input', 'Source', 40, 120),
      node('sequential', 'mono', 'Monochrome', 280, 120, { saturation: 0, contrast: 1.15 }),
      node('output', 'output', 'Output', 520, 120)
    ])
  },
  {
    id: 'negative',
    name: 'Negative',
    description: 'Inverted channel curves for a clean negative look.',
    graph: createTemplateGraph('negative', [
      node('input', 'input', 'Source', 40, 120),
      node('sequential', 'invert', 'Invert Curve', 280, 120, {
        colorCurves: {
          master: [
            { x: 0, y: 1 },
            { x: 1, y: 0 }
          ],
          r: [
            { x: 0, y: 0 },
            { x: 1, y: 1 }
          ],
          g: [
            { x: 0, y: 0 },
            { x: 1, y: 1 }
          ],
          b: [
            { x: 0, y: 0 },
            { x: 1, y: 1 }
          ]
        }
      }),
      node('output', 'output', 'Output', 520, 120)
    ])
  }
] as const;

function createTemplateGraph(templateId: string, nodes: ColorNode[]): ColorNodeGraph {
  const connections = nodes.slice(0, -1).map((item, index) => ({ id: `${templateId}-${item.id}-${nodes[index + 1].id}`, from: item.id, to: nodes[index + 1].id }));
  return normalizeColorNodeGraph({
    version: 1,
    nodes,
    connections,
    outputNodeId: nodes[nodes.length - 1].id
  });
}

function node(type: ColorNodeType, id: string, name: string, x: number, y: number, correction?: Partial<ColorNodeCorrection>): ColorNode {
  return {
    id,
    type,
    name,
    position: { x, y },
    correction: normalizeColorNodeCorrection(correction),
    enabled: true
  };
}

function mergeNodeInputs(filters: string[], inputLabels: string[], node: ColorNode, options: BuildColorNodeGraphFilterPlanOptions): string {
  if (inputLabels.length <= 1) {
    return inputLabels[0] ?? options.inputLabel;
  }
  const outputLabel = `${safeLabel(options.outputLabel)}_${safeLabel(node.id)}_merge`;
  if (options.mediaKind === 'audio') {
    filters.push(`${inputLabels.map((label) => `[${label}]`).join('')}amix=inputs=${inputLabels.length}:duration=longest:normalize=0[${outputLabel}]`);
    return outputLabel;
  }
  if (node.type === 'layer') {
    let current = inputLabels[0];
    for (let index = 1; index < inputLabels.length; index += 1) {
      const next = index === inputLabels.length - 1 ? outputLabel : `${outputLabel}_${index}`;
      filters.push(`[${current}][${inputLabels[index]}]overlay=x=0:y=0:eval=frame[${next}]`);
      current = next;
    }
    return outputLabel;
  }
  const mode = mapBlendMode(node.blendMode);
  let current = inputLabels[0];
  for (let index = 1; index < inputLabels.length; index += 1) {
    const next = index === inputLabels.length - 1 ? outputLabel : `${outputLabel}_${index}`;
    filters.push(`[${current}][${inputLabels[index]}]blend=all_mode=${mode}:all_opacity=${formatFfmpegNumber(node.mix ?? 1)},format=rgba[${next}]`);
    current = next;
  }
  return outputLabel;
}

function buildNodeFilters(node: ColorNode, options: BuildColorNodeGraphFilterPlanOptions): string[] {
  if (node.enabled === false || node.type === 'input' || node.type === 'output') {
    return [];
  }
  const correction = normalizeColorNodeCorrection({
    ...node.correction,
    lutPath: node.type === 'lut' ? node.lutPath ?? node.correction.lutPath : node.correction.lutPath,
    luts: node.correction.luts
  });
  const filters: string[] = [];
  const inputColorSpace = correction.inputColorSpace ?? REC709_INPUT_COLOR_SPACE;
  if (isLogInputColorSpace(inputColorSpace)) {
    const lut = getLogToRec709Lut(inputColorSpace);
    if (lut) {
      filters.push(`lut3d=file=${registerLogLut(node, lut.colorSpace, options)}`);
    }
  }
  const lutLayers = normalizeLutLayers(correction.luts, correction.lutPath);
  for (const layer of lutLayers) {
    if (layer.intensity <= 0) continue;
    filters.push(`lut3d=file=${(options.escapeFilePath ?? defaultEscapeFilePath)(layer.path)}`);
  }
  if (
    correction.brightness !== DEFAULT_COLOR_NODE_CORRECTION.brightness ||
    correction.contrast !== DEFAULT_COLOR_NODE_CORRECTION.contrast ||
    correction.saturation !== DEFAULT_COLOR_NODE_CORRECTION.saturation ||
    Math.abs(correction.hue) > 0.001
  ) {
    filters.push(`eq=brightness=${formatFfmpegNumber(correction.brightness)}:contrast=${formatFfmpegNumber(correction.contrast)}:saturation=${formatFfmpegNumber(correction.saturation)}`);
  }
  if (Math.abs(correction.hue) > 0.001) {
    filters.push(`hue=h=${formatFfmpegNumber(correction.hue)}`);
  }
  if (!isNeutralThreeWayColor(correction.threeWayColor)) {
    filters.push(buildThreeWayColorFilter(correction.threeWayColor));
  }
  if (!isDefaultColorCurves(correction.colorCurves)) {
    filters.push(`lut1d=file=${registerCurveLut(node, correction.colorCurves, options)}`);
  }
  return filters;
}

function registerCurveLut(node: ColorNode, curves: ColorCurves | undefined, options: BuildColorNodeGraphFilterPlanOptions): string {
  const clipId = options.clipId ?? 'clip';
  const safeNodeId = safeLabel(node.id);
  const placeholder = `__NODE_CURVE_LUT_${safeLabel(clipId)}_${safeNodeId}__`;
  const artifact: ColorNodeGraphArtifact = {
    clipId,
    nodeId: node.id,
    kind: 'curve-lut',
    text: serializeColorCurvesToCube(curves, 17, `open-factory node curves ${clipId} ${node.id}`),
    fileName: `node-curves-${safeLabel(clipId)}-${safeNodeId}.cube`,
    placeholder
  };
  return options.registerArtifact?.(artifact) ?? placeholder;
}

function registerLogLut(node: ColorNode, colorSpace: LogInputColorSpace, options: BuildColorNodeGraphFilterPlanOptions): string {
  const clipId = options.clipId ?? 'clip';
  const safeNodeId = safeLabel(node.id);
  const placeholder = `__NODE_LOG_LUT_${safeLabel(clipId)}_${safeLabel(colorSpace)}_${safeNodeId}__`;
  const artifact: ColorNodeGraphArtifact = {
    clipId,
    nodeId: node.id,
    kind: 'log-lut',
    text: serializeLogToRec709Cube(colorSpace),
    fileName: `node-log-${safeLabel(colorSpace)}-${safeLabel(clipId)}-${safeNodeId}.cube`,
    placeholder
  };
  return options.registerArtifact?.(artifact) ?? placeholder;
}

function buildThreeWayColorFilter(value: ThreeWayColor | undefined): string {
  const color = normalizeThreeWayColor(value);
  const params = [
    ['rs', colorBalanceValue(color.lift, 'r')],
    ['gs', colorBalanceValue(color.lift, 'g')],
    ['bs', colorBalanceValue(color.lift, 'b')],
    ['rm', colorBalanceValue(color.gamma, 'r')],
    ['gm', colorBalanceValue(color.gamma, 'g')],
    ['bm', colorBalanceValue(color.gamma, 'b')],
    ['rh', colorBalanceValue(color.gain, 'r')],
    ['gh', colorBalanceValue(color.gain, 'g')],
    ['bh', colorBalanceValue(color.gain, 'b')]
  ].filter(([, value]) => Math.abs(value as number) > 0.001);
  return `colorbalance=${params.map(([name, value]) => `${name}=${formatFfmpegNumber(value as number)}`).join(':')}`;
}

function colorBalanceValue(value: ColorWheelValue, channel: 'r' | 'g' | 'b'): number {
  return Math.min(1, Math.max(-1, value[channel] + value.intensity - 1));
}

function findSinkNodeId(nodes: ColorNode[], connections: ColorNodeConnection[]): string | undefined {
  const withOutgoing = new Set(connections.map((connection) => connection.from));
  return nodes.find((node) => !withOutgoing.has(node.id))?.id;
}

function groupConnections(connections: ColorNodeConnection[], key: 'from' | 'to'): Map<string, ColorNodeConnection[]> {
  const grouped = new Map<string, ColorNodeConnection[]>();
  for (const connection of connections) {
    const list = grouped.get(connection[key]) ?? [];
    list.push(connection);
    grouped.set(connection[key], list);
  }
  for (const list of grouped.values()) {
    list.sort((left, right) => left.id.localeCompare(right.id));
  }
  return grouped;
}

function normalizeColorNodeType(type: unknown): ColorNodeType {
  return type === 'input' || type === 'parallel' || type === 'layer' || type === 'output' || type === 'lut' || type === 'sequential' ? type : 'sequential';
}

function normalizeBlendMode(mode: unknown): ColorNodeBlendMode {
  return mode === 'normal' || mode === 'multiply' || mode === 'screen' || mode === 'overlay' || mode === 'addition' ? mode : 'average';
}

function mapBlendMode(mode: ColorNodeBlendMode | undefined): string {
  if (mode === 'addition') {
    return 'addition';
  }
  if (mode === 'multiply' || mode === 'screen' || mode === 'overlay') {
    return mode;
  }
  return 'average';
}

function normalizeNodeName(name: unknown, type: ColorNodeType, index: number): string {
  const trimmed = typeof name === 'string' ? name.trim() : '';
  if (trimmed) {
    return trimmed.slice(0, 80);
  }
  const label = type === 'input' ? 'Input' : type === 'parallel' ? 'Parallel' : type === 'layer' ? 'Layer' : type === 'output' ? 'Output' : type === 'lut' ? 'LUT' : 'Sequential';
  return `${label} ${index + 1}`;
}

function normalizePosition(position: Partial<ColorNodePosition> | undefined, index: number): ColorNodePosition {
  return {
    x: round(Math.max(0, finiteOrDefault(position?.x, 160 + index * 220))),
    y: round(Math.max(0, finiteOrDefault(position?.y, 160)))
  };
}

function normalizeMix(mix: unknown): number {
  return round(Math.min(1, Math.max(0, typeof mix === 'number' && Number.isFinite(mix) ? mix : 1)));
}

function normalizeLutPath(path: string | null | undefined): string | null {
  const trimmed = path?.trim();
  return trimmed ? trimmed : null;
}

function finiteOrDefault(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function safeLabel(value: string): string {
  return value.replace(/[^a-zA-Z0-9_]/g, '_');
}

function formatFfmpegNumber(value: number): string {
  const rounded = Math.round(value * 1000) / 1000;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(/0+$/g, '').replace(/\.$/g, '');
}

function defaultEscapeFilePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'");
}
