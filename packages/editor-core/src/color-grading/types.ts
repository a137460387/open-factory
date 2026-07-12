/** 调色节点类型 */
export type ColorNodeType =
  | 'primary-wheel'
  | 'primary-slider'
  | 'curves'
  | 'hsl-qualifier'
  | 'window-mask'
  | 'tracking-mask'
  | 'lut-apply'
  | 'color-space'
  | 'mixer-node'
  | 'output';

/** 一级色轮参数 */
export interface PrimaryWheelParams {
  lift: { r: number; g: number; b: number; y: number };
  liftMaster: number;
  gamma: { r: number; g: number; b: number; y: number };
  gammaMaster: number;
  gain: { r: number; g: number; b: number; y: number };
  gainMaster: number;
  offset: { r: number; g: number; b: number; y: number };
  offsetMaster: number;
}

/** 一级滑块参数 */
export interface PrimarySliderParams {
  temperature: number;
  tint: number;
  contrast: number;
  pivot: number;
  saturation: number;
  hue: number;
}

/** 节点参数联合类型 */
export type ColorNodeParams =
  | PrimaryWheelParams
  | PrimarySliderParams
  | Record<string, unknown>;

/** 调色节点 */
export interface ColorNode {
  id: string;
  type: ColorNodeType;
  enabled: boolean;
  params: ColorNodeParams;
  inputs: string[];
  output: string | null;
  position: { x: number; y: number };
}

/** 节点连接 */
export interface ColorConnection {
  id: string;
  fromNodeId: string;
  fromOutput: string;
  toNodeId: string;
  toInput: string;
}

/** 节点图 */
export interface ColorGradingGraph {
  nodes: ColorNode[];
  connections: ColorConnection[];
  activeNodeId: string | null;
}

/** 创建默认一级色轮参数 */
export function createDefaultPrimaryWheelParams(): PrimaryWheelParams {
  return {
    lift: { r: 0, g: 0, b: 0, y: 0 },
    liftMaster: 0,
    gamma: { r: 0, g: 0, b: 0, y: 0 },
    gammaMaster: 0,
    gain: { r: 0, g: 0, b: 0, y: 0 },
    gainMaster: 0,
    offset: { r: 0, g: 0, b: 0, y: 0 },
    offsetMaster: 0,
  };
}

/** 创建默认一级滑块参数 */
export function createDefaultPrimarySliderParams(): PrimarySliderParams {
  return {
    temperature: 0,
    tint: 0,
    contrast: 0,
    pivot: 0.5,
    saturation: 100,
    hue: 0,
  };
}

/** 创建空节点图 */
export function createEmptyColorGradingGraph(): ColorGradingGraph {
  return {
    nodes: [],
    connections: [],
    activeNodeId: null,
  };
}

/** 创建调色节点 */
export function createColorNode(
  type: ColorNodeType,
  position: { x: number; y: number } = { x: 0, y: 0 }
): ColorNode {
  const id = `color-node-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  let params: ColorNodeParams;

  switch (type) {
    case 'primary-wheel':
      params = createDefaultPrimaryWheelParams();
      break;
    case 'primary-slider':
      params = createDefaultPrimarySliderParams();
      break;
    default:
      params = {};
  }

  return {
    id,
    type,
    enabled: true,
    params,
    inputs: [],
    output: null,
    position,
  };
}

/** 验证色轮参数范围 */
export function validatePrimaryWheelParams(params: PrimaryWheelParams): PrimaryWheelParams {
  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
  const clampChannel = (ch: { r: number; g: number; b: number; y: number }) => ({
    r: clamp(ch.r, -1, 1),
    g: clamp(ch.g, -1, 1),
    b: clamp(ch.b, -1, 1),
    y: clamp(ch.y, -1, 1),
  });

  return {
    lift: clampChannel(params.lift),
    liftMaster: clamp(params.liftMaster, -1, 1),
    gamma: clampChannel(params.gamma),
    gammaMaster: clamp(params.gammaMaster, -1, 1),
    gain: clampChannel(params.gain),
    gainMaster: clamp(params.gainMaster, -1, 1),
    offset: clampChannel(params.offset),
    offsetMaster: clamp(params.offsetMaster, -1, 1),
  };
}

/** 验证滑块参数范围 */
export function validatePrimarySliderParams(params: PrimarySliderParams): PrimarySliderParams {
  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

  return {
    temperature: clamp(params.temperature, -100, 100),
    tint: clamp(params.tint, -100, 100),
    contrast: clamp(params.contrast, -100, 100),
    pivot: clamp(params.pivot, 0, 1),
    saturation: clamp(params.saturation, 0, 200),
    hue: clamp(params.hue, -180, 180),
  };
}

/** 归一化节点图（去除无效数据） */
export function normalizeColorGradingGraph(
  graph: unknown
): ColorGradingGraph {
  if (!graph || typeof graph !== 'object') {
    return createEmptyColorGradingGraph();
  }

  const g = graph as Record<string, unknown>;
  const nodes = Array.isArray(g.nodes)
    ? (g.nodes as unknown[]).filter(isValidColorNode).map(normalizeColorNode)
    : [];
  const connections = Array.isArray(g.connections)
    ? (g.connections as unknown[]).filter(isValidConnection)
    : [];

  return {
    nodes,
    connections: connections as ColorConnection[],
    activeNodeId: typeof g.activeNodeId === 'string' ? g.activeNodeId : null,
  };
}

function isValidColorNode(node: unknown): boolean {
  if (!node || typeof node !== 'object') return false;
  const n = node as Record<string, unknown>;
  return typeof n.id === 'string' && typeof n.type === 'string';
}

function normalizeColorNode(node: unknown): ColorNode {
  const n = node as Record<string, unknown>;
  const type = n.type as ColorNodeType;

  let params: ColorNodeParams;
  if (type === 'primary-wheel') {
    params = validatePrimaryWheelParams(
      (n.params as PrimaryWheelParams) ?? createDefaultPrimaryWheelParams()
    );
  } else if (type === 'primary-slider') {
    params = validatePrimarySliderParams(
      (n.params as PrimarySliderParams) ?? createDefaultPrimarySliderParams()
    );
  } else {
    params = (n.params as Record<string, unknown>) ?? {};
  }

  return {
    id: n.id as string,
    type,
    enabled: n.enabled !== false,
    params,
    inputs: Array.isArray(n.inputs) ? n.inputs as string[] : [],
    output: typeof n.output === 'string' ? n.output : null,
    position: isValidPosition(n.position) ? n.position as { x: number; y: number } : { x: 0, y: 0 },
  };
}

function isValidPosition(pos: unknown): boolean {
  if (!pos || typeof pos !== 'object') return false;
  const p = pos as Record<string, unknown>;
  return typeof p.x === 'number' && typeof p.y === 'number';
}

function isValidConnection(conn: unknown): boolean {
  if (!conn || typeof conn !== 'object') return false;
  const c = conn as Record<string, unknown>;
  return typeof c.id === 'string' && typeof c.fromNodeId === 'string' && typeof c.toNodeId === 'string';
}
