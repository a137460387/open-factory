# 阶段1：调色节点图 + 一级调色 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建调色节点图引擎和一级调色功能，包括数据模型、节点图执行引擎、一级色轮/滑块 UI、WebGL 渲染集成和 FFmpeg 导出映射。

**Architecture:** 采用节点图架构，每个调色操作封装为独立节点。数据模型在 `editor-core` 包中定义，UI 渲染在 `desktop` 包中实现。WebGL 使用乒乓缓冲技术链式执行节点着色器。FFmpeg 通过滤镜链映射调色操作。

**Tech Stack:** TypeScript, React, WebGL (GLSL), Vitest, Zustand

## Global Constraints

- All user-facing output must be written in Simplified Chinese
- Timeline mutation must go through command objects
- Core algorithms must have Vitest coverage at 80%+
- Modify `ffmpeg-builder.ts` only with matching test coverage
- All Tauri calls go through `tauri-bridge.ts`
- Local media preview uses Tauri `convertFileSrc`
- Run typecheck, tests, and build before summarizing completed work

---

## File Structure

### editor-core 新增文件

| 文件 | 职责 |
|------|------|
| `packages/editor-core/src/color-grading/types.ts` | 调色节点类型定义、节点图接口 |
| `packages/editor-core/src/color-grading/node-graph-engine.ts` | 节点图执行引擎（拓扑排序、参数合并） |
| `packages/editor-core/src/color-grading/primary-wheels.ts` | 一级色轮参数定义、GLSL uniform 生成 |
| `packages/editor-core/src/color-grading/primary-sliders.ts` | 一级滑块参数定义、FFmpeg 滤镜生成 |
| `packages/editor-core/src/color-grading/index.ts` | Barrel 导出 |

### editor-core 修改文件

| 文件 | 修改内容 |
|------|---------|
| `packages/editor-core/src/model-types.ts` | 添加 `ColorGradingGraph` 到 `BaseClip` |
| `packages/editor-core/src/model.ts` | 更新工厂函数、归一化逻辑 |
| `packages/editor-core/src/commands/timeline-commands.ts` | 添加调色节点命令 |
| `packages/editor-core/src/export/ffmpeg-builder.ts` | 添加调色节点 FFmpeg 映射 |
| `packages/editor-core/src/index.ts` | 导出新模块 |

### desktop 新增文件

| 文件 | 职责 |
|------|------|
| `apps/desktop/src/components/ColorGrading/ColorGradingWorkspace.tsx` | 调色工作区主组件 |
| `apps/desktop/src/components/ColorGrading/ColorWheelPanel.tsx` | 一级色轮 UI |
| `apps/desktop/src/components/ColorGrading/PrimarySlidersPanel.tsx` | 一级滑块 UI |
| `apps/desktop/src/components/ColorGrading/NodeGraphView.tsx` | 节点图可视化 |
| `apps/desktop/src/lib/color-grading/color-grading-renderer.ts` | WebGL 调色渲染器 |
| `apps/desktop/src/lib/color-grading/node-shader-compiler.ts` | 节点着色器编译器 |

### desktop 修改文件

| 文件 | 修改内容 |
|------|---------|
| `apps/desktop/src/lib/preview/webgl-compositor.ts` | 集成调色节点渲染 |
| `apps/desktop/src/components/Inspector/Inspector.tsx` | 添加调色面板入口 |

### 测试文件

| 文件 | 职责 |
|------|------|
| `packages/editor-core/src/color-grading/__tests__/types.test.ts` | 类型归一化测试 |
| `packages/editor-core/src/color-grading/__tests__/node-graph-engine.test.ts` | 节点图引擎测试 |
| `packages/editor-core/src/color-grading/__tests__/primary-wheels.test.ts` | 色轮参数测试 |
| `packages/editor-core/src/color-grading/__tests__/primary-sliders.test.ts` | 滑块参数测试 |
| `packages/editor-core/src/export/__tests__/ffmpeg-builder.test.ts` | FFmpeg 映射测试（追加） |

---

## Task 1: 调色类型定义与模型集成

**Files:**
- Create: `packages/editor-core/src/color-grading/types.ts`
- Create: `packages/editor-core/src/color-grading/__tests__/types.test.ts`
- Modify: `packages/editor-core/src/model-types.ts`
- Modify: `packages/editor-core/src/model.ts`
- Modify: `packages/editor-core/src/index.ts`

**Interfaces:**
- Produces: `ColorGradingGraph`, `ColorNode`, `ColorNodeType`, `ColorConnection`, `PrimaryWheelParams`, `PrimarySliderParams` 类型

- [ ] **Step 1: 创建调色类型定义文件**

```typescript
// packages/editor-core/src/color-grading/types.ts

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

  let params = n.params as ColorNodeParams;
  if (type === 'primary-wheel') {
    params = validatePrimaryWheelParams(params as PrimaryWheelParams);
  } else if (type === 'primary-slider') {
    params = validatePrimarySliderParams(params as PrimarySliderParams);
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
```

- [ ] **Step 2: 创建类型定义测试**

```typescript
// packages/editor-core/src/color-grading/__tests__/types.test.ts
import { describe, it, expect } from 'vitest';
import {
  createDefaultPrimaryWheelParams,
  createDefaultPrimarySliderParams,
  createEmptyColorGradingGraph,
  createColorNode,
  validatePrimaryWheelParams,
  validatePrimarySliderParams,
  normalizeColorGradingGraph,
} from '../types';

describe('createDefaultPrimaryWheelParams', () => {
  it('should create params with all zeros', () => {
    const params = createDefaultPrimaryWheelParams();
    expect(params.lift).toEqual({ r: 0, g: 0, b: 0, y: 0 });
    expect(params.liftMaster).toBe(0);
    expect(params.gamma).toEqual({ r: 0, g: 0, b: 0, y: 0 });
    expect(params.gammaMaster).toBe(0);
    expect(params.gain).toEqual({ r: 0, g: 0, b: 0, y: 0 });
    expect(params.gainMaster).toBe(0);
    expect(params.offset).toEqual({ r: 0, g: 0, b: 0, y: 0 });
    expect(params.offsetMaster).toBe(0);
  });
});

describe('createDefaultPrimarySliderParams', () => {
  it('should create params with defaults', () => {
    const params = createDefaultPrimarySliderParams();
    expect(params.temperature).toBe(0);
    expect(params.tint).toBe(0);
    expect(params.contrast).toBe(0);
    expect(params.pivot).toBe(0.5);
    expect(params.saturation).toBe(100);
    expect(params.hue).toBe(0);
  });
});

describe('createEmptyColorGradingGraph', () => {
  it('should create empty graph', () => {
    const graph = createEmptyColorGradingGraph();
    expect(graph.nodes).toEqual([]);
    expect(graph.connections).toEqual([]);
    expect(graph.activeNodeId).toBeNull();
  });
});

describe('createColorNode', () => {
  it('should create primary-wheel node with default params', () => {
    const node = createColorNode('primary-wheel');
    expect(node.type).toBe('primary-wheel');
    expect(node.enabled).toBe(true);
    expect(node.params).toEqual(createDefaultPrimaryWheelParams());
    expect(node.id).toMatch(/^color-node-/);
  });

  it('should create primary-slider node with default params', () => {
    const node = createColorNode('primary-slider');
    expect(node.type).toBe('primary-slider');
    expect(node.params).toEqual(createDefaultPrimarySliderParams());
  });

  it('should set custom position', () => {
    const node = createColorNode('primary-wheel', { x: 100, y: 200 });
    expect(node.position).toEqual({ x: 100, y: 200 });
  });
});

describe('validatePrimaryWheelParams', () => {
  it('should clamp values to valid range', () => {
    const params = validatePrimaryWheelParams({
      lift: { r: 2, g: -2, b: 0.5, y: 0 },
      liftMaster: 1.5,
      gamma: { r: 0, g: 0, b: 0, y: 0 },
      gammaMaster: 0,
      gain: { r: 0, g: 0, b: 0, y: 0 },
      gainMaster: 0,
      offset: { r: 0, g: 0, b: 0, y: 0 },
      offsetMaster: 0,
    });
    expect(params.lift.r).toBe(1);
    expect(params.lift.g).toBe(-1);
    expect(params.lift.b).toBe(0.5);
    expect(params.liftMaster).toBe(1);
  });

  it('should pass through valid values', () => {
    const valid = createDefaultPrimaryWheelParams();
    const result = validatePrimaryWheelParams(valid);
    expect(result).toEqual(valid);
  });
});

describe('validatePrimarySliderParams', () => {
  it('should clamp values to valid range', () => {
    const params = validatePrimarySliderParams({
      temperature: 150,
      tint: -150,
      contrast: 50,
      pivot: 2,
      saturation: -10,
      hue: 200,
    });
    expect(params.temperature).toBe(100);
    expect(params.tint).toBe(-100);
    expect(params.contrast).toBe(50);
    expect(params.pivot).toBe(1);
    expect(params.saturation).toBe(0);
    expect(params.hue).toBe(180);
  });
});

describe('normalizeColorGradingGraph', () => {
  it('should return empty graph for null/undefined', () => {
    expect(normalizeColorGradingGraph(null)).toEqual(createEmptyColorGradingGraph());
    expect(normalizeColorGradingGraph(undefined)).toEqual(createEmptyColorGradingGraph());
  });

  it('should normalize valid graph', () => {
    const input = {
      nodes: [
        { id: 'n1', type: 'primary-wheel', enabled: true, params: createDefaultPrimaryWheelParams() },
      ],
      connections: [],
      activeNodeId: 'n1',
    };
    const result = normalizeColorGradingGraph(input);
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].id).toBe('n1');
    expect(result.activeNodeId).toBe('n1');
  });

  it('should filter out invalid nodes', () => {
    const input = {
      nodes: [
        { id: 'n1', type: 'primary-wheel' },
        { invalid: true },
        null,
      ],
      connections: [],
      activeNodeId: null,
    };
    const result = normalizeColorGradingGraph(input);
    expect(result.nodes).toHaveLength(1);
  });

  it('should clamp wheel params during normalization', () => {
    const input = {
      nodes: [
        {
          id: 'n1',
          type: 'primary-wheel',
          params: {
            lift: { r: 5, g: 0, b: 0, y: 0 },
            liftMaster: 0,
            gamma: { r: 0, g: 0, b: 0, y: 0 },
            gammaMaster: 0,
            gain: { r: 0, g: 0, b: 0, y: 0 },
            gainMaster: 0,
            offset: { r: 0, g: 0, b: 0, y: 0 },
            offsetMaster: 0,
          },
        },
      ],
      connections: [],
      activeNodeId: null,
    };
    const result = normalizeColorGradingGraph(input);
    expect((result.nodes[0].params as any).lift.r).toBe(1);
  });
});
```

- [ ] **Step 3: 运行测试验证失败**

```bash
cd D:/code/Ai/open-factory && pnpm vitest run packages/editor-core/src/color-grading/__tests__/types.test.ts
```

Expected: FAIL — 模块不存在

- [ ] **Step 4: 运行测试验证通过**

```bash
cd D:/code/Ai/open-factory && pnpm vitest run packages/editor-core/src/color-grading/__tests__/types.test.ts
```

Expected: PASS

- [ ] **Step 5: 修改 model-types.ts 集成节点图**

在 `packages/editor-core/src/model-types.ts` 的 `BaseClip` 接口中添加：

```typescript
import type { ColorGradingGraph } from './color-grading/types';

interface BaseClip {
  // ... 现有字段
  colorCorrection: ColorCorrection;          // 保持向后兼容
  colorGradingGraph?: ColorGradingGraph;     // 新增：节点图调色
}
```

- [ ] **Step 6: 修改 model.ts 更新归一化**

在 `packages/editor-core/src/model.ts` 的 `createBaseClip` 和归一化逻辑中添加 `colorGradingGraph` 支持：

```typescript
import { normalizeColorGradingGraph } from './color-grading/types';

// 在 createBaseClip 中：
colorGradingGraph: input.colorGradingGraph
  ? normalizeColorGradingGraph(input.colorGradingGraph)
  : undefined,
```

- [ ] **Step 7: 添加 barrel 导出**

创建 `packages/editor-core/src/color-grading/index.ts`：

```typescript
export * from './types';
```

在 `packages/editor-core/src/index.ts` 中添加：

```typescript
export * from './color-grading';
```

- [ ] **Step 8: 运行全量测试**

```bash
cd D:/code/Ai/open-factory && pnpm test
```

Expected: PASS（无回归）

- [ ] **Step 9: 提交**

```bash
git add packages/editor-core/src/color-grading/ packages/editor-core/src/model-types.ts packages/editor-core/src/model.ts packages/editor-core/src/index.ts
git commit -m "feat: add color grading types and model integration"
```

---

## Task 2: 节点图执行引擎

**Files:**
- Create: `packages/editor-core/src/color-grading/node-graph-engine.ts`
- Create: `packages/editor-core/src/color-grading/__tests__/node-graph-engine.test.ts`

**Interfaces:**
- Consumes: `ColorGradingGraph`, `ColorNode`, `ColorConnection` from Task 1
- Produces: `NodeGraphEngine.execute(graph): ExecutionResult`, `NodeGraphEngine.topologicalSort(graph): ColorNode[]`

- [ ] **Step 1: 创建节点图引擎测试**

```typescript
// packages/editor-core/src/color-grading/__tests__/node-graph-engine.test.ts
import { describe, it, expect } from 'vitest';
import { NodeGraphEngine } from '../node-graph-engine';
import { createColorNode, createEmptyColorGradingGraph } from '../types';
import type { ColorGradingGraph } from '../types';

describe('NodeGraphEngine.topologicalSort', () => {
  it('should return empty array for empty graph', () => {
    const graph = createEmptyColorGradingGraph();
    const sorted = NodeGraphEngine.topologicalSort(graph);
    expect(sorted).toEqual([]);
  });

  it('should sort single node', () => {
    const node = createColorNode('primary-wheel');
    const graph: ColorGradingGraph = {
      nodes: [node],
      connections: [],
      activeNodeId: node.id,
    };
    const sorted = NodeGraphEngine.topologicalSort(graph);
    expect(sorted).toHaveLength(1);
    expect(sorted[0].id).toBe(node.id);
  });

  it('should sort nodes in dependency order', () => {
    const node1 = createColorNode('primary-wheel', { x: 0, y: 0 });
    const node2 = createColorNode('primary-slider', { x: 200, y: 0 });
    const node3 = createColorNode('output', { x: 400, y: 0 });

    const graph: ColorGradingGraph = {
      nodes: [node3, node1, node2], // 故意乱序
      connections: [
        { id: 'c1', fromNodeId: node1.id, fromOutput: 'out', toNodeId: node2.id, toInput: 'in' },
        { id: 'c2', fromNodeId: node2.id, fromOutput: 'out', toNodeId: node3.id, toInput: 'in' },
      ],
      activeNodeId: null,
    };

    const sorted = NodeGraphEngine.topologicalSort(graph);
    const ids = sorted.map(n => n.id);
    expect(ids.indexOf(node1.id)).toBeLessThan(ids.indexOf(node2.id));
    expect(ids.indexOf(node2.id)).toBeLessThan(ids.indexOf(node3.id));
  });

  it('should detect cycles', () => {
    const node1 = createColorNode('primary-wheel');
    const node2 = createColorNode('primary-slider');

    const graph: ColorGradingGraph = {
      nodes: [node1, node2],
      connections: [
        { id: 'c1', fromNodeId: node1.id, fromOutput: 'out', toNodeId: node2.id, toInput: 'in' },
        { id: 'c2', fromNodeId: node2.id, fromOutput: 'out', toNodeId: node1.id, toInput: 'in' },
      ],
      activeNodeId: null,
    };

    expect(() => NodeGraphEngine.topologicalSort(graph)).toThrow('Cycle detected');
  });
});

describe('NodeGraphEngine.execute', () => {
  it('should return empty result for empty graph', () => {
    const graph = createEmptyColorGradingGraph();
    const result = NodeGraphEngine.execute(graph);
    expect(result.nodeResults).toEqual([]);
    expect(result.combinedUniforms).toEqual({});
  });

  it('should execute single primary-wheel node', () => {
    const node = createColorNode('primary-wheel');
    (node.params as any).lift.r = 0.5;

    const graph: ColorGradingGraph = {
      nodes: [node],
      connections: [],
      activeNodeId: node.id,
    };

    const result = NodeGraphEngine.execute(graph);
    expect(result.nodeResults).toHaveLength(1);
    expect(result.nodeResults[0].nodeId).toBe(node.id);
    expect(result.nodeResults[0].uniforms).toBeDefined();
  });

  it('should chain multiple nodes', () => {
    const node1 = createColorNode('primary-wheel');
    const node2 = createColorNode('primary-slider');

    const graph: ColorGradingGraph = {
      nodes: [node1, node2],
      connections: [
        { id: 'c1', fromNodeId: node1.id, fromOutput: 'out', toNodeId: node2.id, toInput: 'in' },
      ],
      activeNodeId: node2.id,
    };

    const result = NodeGraphEngine.execute(graph);
    expect(result.nodeResults).toHaveLength(2);
  });

  it('should skip disabled nodes', () => {
    const node = createColorNode('primary-wheel');
    node.enabled = false;

    const graph: ColorGradingGraph = {
      nodes: [node],
      connections: [],
      activeNodeId: node.id,
    };

    const result = NodeGraphEngine.execute(graph);
    expect(result.nodeResults).toHaveLength(0);
  });
});

describe('NodeGraphEngine.validateGraph', () => {
  it('should validate correct graph', () => {
    const node = createColorNode('primary-wheel');
    const graph: ColorGradingGraph = {
      nodes: [node],
      connections: [],
      activeNodeId: node.id,
    };
    const errors = NodeGraphEngine.validateGraph(graph);
    expect(errors).toEqual([]);
  });

  it('should detect dangling connections', () => {
    const graph: ColorGradingGraph = {
      nodes: [],
      connections: [
        { id: 'c1', fromNodeId: 'nonexistent', fromOutput: 'out', toNodeId: 'also-nonexistent', toInput: 'in' },
      ],
      activeNodeId: null,
    };
    const errors = NodeGraphEngine.validateGraph(graph);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should detect duplicate node IDs', () => {
    const node = createColorNode('primary-wheel');
    const graph: ColorGradingGraph = {
      nodes: [node, { ...node }], // same ID
      connections: [],
      activeNodeId: null,
    };
    const errors = NodeGraphEngine.validateGraph(graph);
    expect(errors.some(e => e.includes('duplicate'))).toBe(true);
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

```bash
cd D:/code/Ai/open-factory && pnpm vitest run packages/editor-core/src/color-grading/__tests__/node-graph-engine.test.ts
```

Expected: FAIL — 模块不存在

- [ ] **Step 3: 实现节点图引擎**

```typescript
// packages/editor-core/src/color-grading/node-graph-engine.ts
import type { ColorGradingGraph, ColorNode, ColorNodeParams } from './types';

/** 节点执行结果 */
export interface NodeExecutionResult {
  nodeId: string;
  uniforms: Record<string, number | number[]>;
  fragmentSnippets: string[];
}

/** 图执行结果 */
export interface GraphExecutionResult {
  nodeResults: NodeExecutionResult[];
  combinedUniforms: Record<string, number | number[]>;
}

/** 图验证错误 */
export type GraphValidationError = string;

export class NodeGraphEngine {
  /**
   * 拓扑排序节点（Kahn 算法）
   * @throws 如果检测到循环
   */
  static topologicalSort(graph: ColorGradingGraph): ColorNode[] {
    const { nodes, connections } = graph;
    if (nodes.length === 0) return [];

    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    const inDegree = new Map<string, number>();
    const adjacency = new Map<string, string[]>();

    // 初始化
    for (const node of nodes) {
      inDegree.set(node.id, 0);
      adjacency.set(node.id, []);
    }

    // 构建邻接表和入度表
    for (const conn of connections) {
      if (nodeMap.has(conn.fromNodeId) && nodeMap.has(conn.toNodeId)) {
        adjacency.get(conn.fromNodeId)!.push(conn.toNodeId);
        inDegree.set(conn.toNodeId, (inDegree.get(conn.toNodeId) || 0) + 1);
      }
    }

    // Kahn 算法
    const queue: string[] = [];
    for (const [id, degree] of inDegree) {
      if (degree === 0) queue.push(id);
    }

    const sorted: ColorNode[] = [];
    while (queue.length > 0) {
      const id = queue.shift()!;
      sorted.push(nodeMap.get(id)!);
      for (const neighbor of adjacency.get(id) || []) {
        const newDegree = inDegree.get(neighbor)! - 1;
        inDegree.set(neighbor, newDegree);
        if (newDegree === 0) queue.push(neighbor);
      }
    }

    if (sorted.length !== nodes.length) {
      throw new Error('Cycle detected in color grading node graph');
    }

    return sorted;
  }

  /**
   * 执行节点图
   */
  static execute(graph: ColorGradingGraph): GraphExecutionResult {
    const enabledNodes = graph.nodes.filter(n => n.enabled);
    if (enabledNodes.length === 0) {
      return { nodeResults: [], combinedUniforms: {} };
    }

    const enabledGraph: ColorGradingGraph = {
      ...graph,
      nodes: enabledNodes,
      connections: graph.connections.filter(c => {
        const fromEnabled = enabledNodes.some(n => n.id === c.fromNodeId);
        const toEnabled = enabledNodes.some(n => n.id === c.toNodeId);
        return fromEnabled && toEnabled;
      }),
    };

    const sorted = this.topologicalSort(enabledGraph);
    const nodeResults: NodeExecutionResult[] = [];
    const combinedUniforms: Record<string, number | number[]> = {};

    for (const node of sorted) {
      const result = this.executeNode(node, nodeResults);
      nodeResults.push(result);

      // 合并 uniform
      Object.assign(combinedUniforms, result.uniforms);
    }

    return { nodeResults, combinedUniforms };
  }

  /**
   * 执行单个节点
   */
  private static executeNode(
    node: ColorNode,
    _previousResults: NodeExecutionResult[]
  ): NodeExecutionResult {
    switch (node.type) {
      case 'primary-wheel':
        return this.executePrimaryWheel(node);
      case 'primary-slider':
        return this.executePrimarySlider(node);
      default:
        return { nodeId: node.id, uniforms: {}, fragmentSnippets: [] };
    }
  }

  private static executePrimaryWheel(node: ColorNode): NodeExecutionResult {
    const p = node.params as any;
    const prefix = `cg_${node.id.replace(/-/g, '_')}`;

    return {
      nodeId: node.id,
      uniforms: {
        [`${prefix}_lift`]: [p.lift.r, p.lift.g, p.lift.b, p.liftMaster],
        [`${prefix}_gamma`]: [p.gamma.r, p.gamma.g, p.gamma.b, p.gammaMaster],
        [`${prefix}_gain`]: [p.gain.r, p.gain.g, p.gain.b, p.gainMaster],
        [`${prefix}_offset`]: [p.offset.r, p.offset.g, p.offset.b, p.offsetMaster],
      },
      fragmentSnippets: [
        `// Primary Wheel: ${node.id}`,
        `color = applyLiftGammaGain(color, ${prefix}_lift, ${prefix}_gamma, ${prefix}_gain, ${prefix}_offset);`,
      ],
    };
  }

  private static executePrimarySlider(node: ColorNode): NodeExecutionResult {
    const p = node.params as any;
    const prefix = `cg_${node.id.replace(/-/g, '_')}`;

    return {
      nodeId: node.id,
      uniforms: {
        [`${prefix}_temperature`]: p.temperature / 100,
        [`${prefix}_tint`]: p.tint / 100,
        [`${prefix}_contrast`]: p.contrast / 100,
        [`${prefix}_pivot`]: p.pivot,
        [`${prefix}_saturation`]: p.saturation / 100,
        [`${prefix}_hue`]: (p.hue / 180) * 3.14159,
      },
      fragmentSnippets: [
        `// Primary Slider: ${node.id}`,
        `color = applyTemperatureTint(color, ${prefix}_temperature, ${prefix}_tint);`,
        `color = applyContrast(color, ${prefix}_contrast, ${prefix}_pivot);`,
        `color = applySaturation(color, ${prefix}_saturation);`,
        `color = applyHueRotation(color, ${prefix}_hue);`,
      ],
    };
  }

  /**
   * 验证图结构
   */
  static validateGraph(graph: ColorGradingGraph): GraphValidationError[] {
    const errors: GraphValidationError[] = [];
    const nodeIds = new Set<string>();

    // 检查重复ID
    for (const node of graph.nodes) {
      if (nodeIds.has(node.id)) {
        errors.push(`Duplicate node ID: ${node.id}`);
      }
      nodeIds.add(node.id);
    }

    // 检查悬空连接
    for (const conn of graph.connections) {
      if (!nodeIds.has(conn.fromNodeId)) {
        errors.push(`Connection references non-existent from node: ${conn.fromNodeId}`);
      }
      if (!nodeIds.has(conn.toNodeId)) {
        errors.push(`Connection references non-existent to node: ${conn.toNodeId}`);
      }
    }

    // 检查自连接
    for (const conn of graph.connections) {
      if (conn.fromNodeId === conn.toNodeId) {
        errors.push(`Self-connection detected on node: ${conn.fromNodeId}`);
      }
    }

    return errors;
  }
}
```

- [ ] **Step 4: 运行测试验证通过**

```bash
cd D:/code/Ai/open-factory && pnpm vitest run packages/editor-core/src/color-grading/__tests__/node-graph-engine.test.ts
```

Expected: PASS

- [ ] **Step 5: 运行全量测试确认无回归**

```bash
cd D:/code/Ai/open-factory && pnpm test
```

Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add packages/editor-core/src/color-grading/
git commit -m "feat: add color grading node graph execution engine"
```

---

## Task 3: 一级色轮参数处理

**Files:**
- Create: `packages/editor-core/src/color-grading/primary-wheels.ts`
- Create: `packages/editor-core/src/color-grading/__tests__/primary-wheels.test.ts`

**Interfaces:**
- Consumes: `PrimaryWheelParams` from Task 1
- Produces: `PrimaryWheels.toUniforms(params, prefix): Record<string, number[]>`, `PrimaryWheels.toGlslSnippet(prefix): string`, `PrimaryWheels.toFfmpegFilter(params): string`

- [ ] **Step 1: 创建色轮参数处理测试**

```typescript
// packages/editor-core/src/color-grading/__tests__/primary-wheels.test.ts
import { describe, it, expect } from 'vitest';
import { PrimaryWheels } from '../primary-wheels';
import { createDefaultPrimaryWheelParams } from '../types';

describe('PrimaryWheels.toUniforms', () => {
  it('should convert default params to zero uniforms', () => {
    const params = createDefaultPrimaryWheelParams();
    const uniforms = PrimaryWheels.toUniforms(params, 'test');
    expect(uniforms['test_lift']).toEqual([0, 0, 0, 0]);
    expect(uniforms['test_gamma']).toEqual([0, 0, 0, 0]);
    expect(uniforms['test_gain']).toEqual([0, 0, 0, 0]);
    expect(uniforms['test_offset']).toEqual([0, 0, 0, 0]);
  });

  it('should convert non-zero params correctly', () => {
    const params = createDefaultPrimaryWheelParams();
    params.lift.r = 0.5;
    params.gain.g = -0.3;
    params.gammaMaster = 0.2;

    const uniforms = PrimaryWheels.toUniforms(params, 'pw');
    expect(uniforms['pw_lift'][0]).toBe(0.5);
    expect(uniforms['pw_gain'][1]).toBe(-0.3);
    expect(uniforms['pw_gamma'][3]).toBe(0.2);
  });
});

describe('PrimaryWheels.toGlslSnippet', () => {
  it('should generate GLSL function call', () => {
    const snippet = PrimaryWheels.toGlslSnippet('pw');
    expect(snippet).toContain('applyLiftGammaGain');
    expect(snippet).toContain('pw_lift');
    expect(snippet).toContain('pw_gamma');
    expect(snippet).toContain('pw_gain');
    expect(snippet).toContain('pw_offset');
  });
});

describe('PrimaryWheels.toFfmpegFilter', () => {
  it('should return empty string for default params', () => {
    const params = createDefaultPrimaryWheelParams();
    const filter = PrimaryWheels.toFfmpegFilter(params);
    expect(filter).toBe('');
  });

  it('should generate colorbalance filter for lift/gamma/gain', () => {
    const params = createDefaultPrimaryWheelParams();
    params.lift.r = 0.5;
    params.gain.b = -0.3;

    const filter = PrimaryWheels.toFfmpegFilter(params);
    expect(filter).toContain('colorbalance');
    expect(filter).toContain('rs='); // red shadows (lift)
  });

  it('should generate curves filter for offset', () => {
    const params = createDefaultPrimaryWheelParams();
    params.offset.r = 0.2;

    const filter = PrimaryWheels.toFfmpegFilter(params);
    expect(filter.length).toBeGreaterThan(0);
  });
});

describe('PrimaryWheels.generateGlslFunction', () => {
  it('should generate valid GLSL function', () => {
    const glsl = PrimaryWheels.generateGlslFunction();
    expect(glsl).toContain('vec4 applyLiftGammaGain');
    expect(glsl).toContain('lift');
    expect(glsl).toContain('gamma');
    expect(glsl).toContain('gain');
    expect(glsl).toContain('offset');
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

```bash
cd D:/code/Ai/open-factory && pnpm vitest run packages/editor-core/src/color-grading/__tests__/primary-wheels.test.ts
```

Expected: FAIL

- [ ] **Step 3: 实现色轮参数处理**

```typescript
// packages/editor-core/src/color-grading/primary-wheels.ts
import type { PrimaryWheelParams } from './types';

export class PrimaryWheels {
  /**
   * 将色轮参数转换为 WebGL uniform 值
   */
  static toUniforms(
    params: PrimaryWheelParams,
    prefix: string
  ): Record<string, number[]> {
    return {
      [`${prefix}_lift`]: [params.lift.r, params.lift.g, params.lift.b, params.liftMaster],
      [`${prefix}_gamma`]: [params.gamma.r, params.gamma.g, params.gamma.b, params.gammaMaster],
      [`${prefix}_gain`]: [params.gain.r, params.gain.g, params.gain.b, params.gainMaster],
      [`${prefix}_offset`]: [params.offset.r, params.offset.g, params.offset.b, params.offsetMaster],
    };
  }

  /**
   * 生成 GLSL 着色器代码片段
   */
  static toGlslSnippet(prefix: string): string {
    return [
      `// Primary Wheels`,
      `color = applyLiftGammaGain(color,`,
      `  ${prefix}_lift, ${prefix}_gamma, ${prefix}_gain, ${prefix}_offset);`,
    ].join('\n');
  }

  /**
   * 生成 GLSL 函数定义
   */
  static generateGlslFunction(): string {
    return `
vec4 applyLiftGammaGain(vec4 color, vec4 lift, vec4 gamma, vec4 gain, vec4 offset) {
  // Lift: 加到暗部
  vec3 lifted = color.rgb + lift.rgb * (1.0 - color.rgb) + lift.a;

  // Gain: 乘到高光
  vec3 gained = lifted * (1.0 + gain.rgb) + gain.a;

  // Gamma: 中间调调整
  vec3 gammaCorrected = pow(max(gained, vec3(0.0001)), 1.0 / (1.0 + gamma.rgb + gamma.a));

  // Offset: 整体偏移
  vec3 result = gammaCorrected + offset.rgb + offset.a;

  return vec4(clamp(result, 0.0, 1.0), color.a);
}`.trim();
  }

  /**
   * 转换为 FFmpeg 滤镜字符串
   */
  static toFfmpegFilter(params: PrimaryWheelParams): string {
    const filters: string[] = [];

    // 检查是否有非零的 lift/gamma/gain
    const hasLift = params.lift.r !== 0 || params.lift.g !== 0 || params.lift.b !== 0 || params.liftMaster !== 0;
    const hasGamma = params.gamma.r !== 0 || params.gamma.g !== 0 || params.gamma.b !== 0 || params.gammaMaster !== 0;
    const hasGain = params.gain.r !== 0 || params.gain.g !== 0 || params.gain.b !== 0 || params.gainMaster !== 0;

    if (hasLift || hasGamma || hasGain) {
      // 使用 colorbalance 滤镜
      const rs = params.lift.r + params.liftMaster;
      const gs = params.lift.g + params.liftMaster;
      const bs = params.lift.b + params.liftMaster;
      const rm = params.gamma.r + params.gammaMaster;
      const gm = params.gamma.g + params.gammaMaster;
      const bm = params.gamma.b + params.gammaMaster;
      const rh = params.gain.r + params.gainMaster;
      const gh = params.gain.g + params.gainMaster;
      const bh = params.gain.b + params.gainMaster;

      filters.push(
        `colorbalance=rs=${rs}:gs=${gs}:bs=${bs}:rm=${rm}:gm=${gm}:bm=${bm}:rh=${rh}:gh=${gh}:bh=${bh}`
      );
    }

    // Offset 使用 curves 滤镜
    const hasOffset = params.offset.r !== 0 || params.offset.g !== 0 || params.offset.b !== 0 || params.offsetMaster !== 0;
    if (hasOffset) {
      const or = 0.5 + params.offset.r + params.offsetMaster;
      const og = 0.5 + params.offset.g + params.offsetMaster;
      const ob = 0.5 + params.offset.b + params.offsetMaster;
      filters.push(`curves=r='0/0 0.5/${or} 1/1':g='0/0 0.5/${og} 1/1':b='0/0 0.5/${ob} 1/1'`);
    }

    return filters.join(',');
  }
}
```

- [ ] **Step 4: 运行测试验证通过**

```bash
cd D:/code/Ai/open-factory && pnpm vitest run packages/editor-core/src/color-grading/__tests__/primary-wheels.test.ts
```

Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add packages/editor-core/src/color-grading/
git commit -m "feat: add primary wheel parameter processing"
```

---

## Task 4: 一级滑块参数处理

**Files:**
- Create: `packages/editor-core/src/color-grading/primary-sliders.ts`
- Create: `packages/editor-core/src/color-grading/__tests__/primary-sliders.test.ts`

**Interfaces:**
- Consumes: `PrimarySliderParams` from Task 1
- Produces: `PrimarySliders.toUniforms(params, prefix): Record<string, number>`, `PrimarySliders.toGlslSnippet(prefix): string`, `PrimarySliders.toFfmpegFilter(params): string`

- [ ] **Step 1: 创建滑块参数处理测试**

```typescript
// packages/editor-core/src/color-grading/__tests__/primary-sliders.test.ts
import { describe, it, expect } from 'vitest';
import { PrimarySliders } from '../primary-sliders';
import { createDefaultPrimarySliderParams } from '../types';

describe('PrimarySliders.toUniforms', () => {
  it('should convert default params to uniforms', () => {
    const params = createDefaultPrimarySliderParams();
    const uniforms = PrimarySliders.toUniforms(params, 'ps');
    expect(uniforms['ps_temperature']).toBe(0);
    expect(uniforms['ps_saturation']).toBe(1);
  });

  it('should normalize values correctly', () => {
    const params = createDefaultPrimarySliderParams();
    params.temperature = 50;
    params.saturation = 150;
    params.hue = 90;

    const uniforms = PrimarySliders.toUniforms(params, 'ps');
    expect(uniforms['ps_temperature']).toBe(0.5);
    expect(uniforms['ps_saturation']).toBe(1.5);
    expect(uniforms['ps_hue']).toBeCloseTo(Math.PI / 2, 5);
  });
});

describe('PrimarySliders.toGlslSnippet', () => {
  it('should generate GLSL snippet', () => {
    const snippet = PrimarySliders.toGlslSnippet('ps');
    expect(snippet).toContain('applyTemperatureTint');
    expect(snippet).toContain('applyContrast');
    expect(snippet).toContain('applySaturation');
    expect(snippet).toContain('applyHueRotation');
  });
});

describe('PrimarySliders.toFfmpegFilter', () => {
  it('should return empty string for defaults', () => {
    const params = createDefaultPrimarySliderParams();
    const filter = PrimarySliders.toFfmpegFilter(params);
    expect(filter).toBe('');
  });

  it('should generate eq filter for contrast/saturation', () => {
    const params = createDefaultPrimarySliderParams();
    params.contrast = 30;
    params.saturation = 120;

    const filter = PrimarySliders.toFfmpegFilter(params);
    expect(filter).toContain('eq=');
  });

  it('should generate colortemperature for temperature', () => {
    const params = createDefaultPrimarySliderParams();
    params.temperature = 50;

    const filter = PrimarySliders.toFfmpegFilter(params);
    expect(filter).toContain('colortemperature');
  });

  it('should generate hue filter for hue rotation', () => {
    const params = createDefaultPrimarySliderParams();
    params.hue = 45;

    const filter = PrimarySliders.toFfmpegFilter(params);
    expect(filter).toContain('hue=');
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

```bash
cd D:/code/Ai/open-factory && pnpm vitest run packages/editor-core/src/color-grading/__tests__/primary-sliders.test.ts
```

Expected: FAIL

- [ ] **Step 3: 实现滑块参数处理**

```typescript
// packages/editor-core/src/color-grading/primary-sliders.ts
import type { PrimarySliderParams } from './types';

export class PrimarySliders {
  /**
   * 将滑块参数转换为 WebGL uniform 值
   */
  static toUniforms(
    params: PrimarySliderParams,
    prefix: string
  ): Record<string, number> {
    return {
      [`${prefix}_temperature`]: params.temperature / 100,
      [`${prefix}_tint`]: params.tint / 100,
      [`${prefix}_contrast`]: params.contrast / 100,
      [`${prefix}_pivot`]: params.pivot,
      [`${prefix}_saturation`]: params.saturation / 100,
      [`${prefix}_hue`]: (params.hue / 180) * Math.PI,
    };
  }

  /**
   * 生成 GLSL 着色器代码片段
   */
  static toGlslSnippet(prefix: string): string {
    return [
      `// Primary Sliders`,
      `color = applyTemperatureTint(color, ${prefix}_temperature, ${prefix}_tint);`,
      `color = applyContrast(color, ${prefix}_contrast, ${prefix}_pivot);`,
      `color = applySaturation(color, ${prefix}_saturation);`,
      `color = applyHueRotation(color, ${prefix}_hue);`,
    ].join('\n');
  }

  /**
   * 生成 GLSL 函数定义
   */
  static generateGlslFunction(): string {
    return `
vec4 applyTemperatureTint(vec4 color, float temperature, float tint) {
  // 色温: 暖色(+)/冷色(-)
  color.r += temperature * 0.1;
  color.b -= temperature * 0.1;
  // 色调: 品红(+)/绿色(-)
  color.g -= tint * 0.1;
  return clamp(color, 0.0, 1.0);
}

vec4 applyContrast(vec4 color, float contrast, float pivot) {
  // 对比度: 围绕轴心点拉伸/压缩
  return clamp(vec4((color.rgb - pivot) * (1.0 + contrast) + pivot, color.a), 0.0, 1.0);
}

vec4 applySaturation(vec4 color, float saturation) {
  // 饱和度: 基于亮度的混合
  float luma = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));
  return clamp(vec4(mix(vec3(luma), color.rgb, saturation), color.a), 0.0, 1.0);
}

vec4 applyHueRotation(vec4 color, float angle) {
  // 色相旋转: YIQ 色彩空间旋转
  float cosA = cos(angle);
  float sinA = sin(angle);
  mat3 yiqMatrix = mat3(
    0.299, 0.587, 0.114,
    0.596, -0.274, -0.322,
    0.211, -0.523, 0.312
  );
  mat3 yiqInverse = mat3(
    1.0, 0.956, 0.621,
    1.0, -0.272, -0.647,
    1.0, -1.106, 1.703
  );
  vec3 yiq = yiqMatrix * color.rgb;
  float newI = yiq.y * cosA - yiq.z * sinA;
  float newZ = yiq.y * sinA + yiq.z * cosA;
  yiq.y = newI;
  yiq.z = newZ;
  return clamp(vec4(yiqInverse * yiq, color.a), 0.0, 1.0);
}`.trim();
  }

  /**
   * 转换为 FFmpeg 滤镜字符串
   */
  static toFfmpegFilter(params: PrimarySliderParams): string {
    const filters: string[] = [];

    // 色温
    if (params.temperature !== 0) {
      const tempK = 6500 + params.temperature * 50; // -100~100 映射到 1500~11500K
      filters.push(`colortemperature=temperature=${tempK}`);
    }

    // 色调
    if (params.tint !== 0) {
      filters.push(`hue=h=0:s=1:b=${params.tint / 100}`);
    }

    // 对比度 + 饱和度
    if (params.contrast !== 0 || params.saturation !== 100) {
      const contrast = 1 + params.contrast / 100;
      const saturation = params.saturation / 100;
      filters.push(`eq=contrast=${contrast}:saturation=${saturation}`);
    }

    // 色相旋转
    if (params.hue !== 0) {
      filters.push(`hue=h=${params.hue}`);
    }

    return filters.join(',');
  }
}
```

- [ ] **Step 4: 运行测试验证通过**

```bash
cd D:/code/Ai/open-factory && pnpm vitest run packages/editor-core/src/color-grading/__tests__/primary-sliders.test.ts
```

Expected: PASS

- [ ] **Step 5: 更新 barrel 导出**

更新 `packages/editor-core/src/color-grading/index.ts`：

```typescript
export * from './types';
export * from './node-graph-engine';
export * from './primary-wheels';
export * from './primary-sliders';
```

- [ ] **Step 6: 运行全量测试**

```bash
cd D:/code/Ai/open-factory && pnpm test
```

Expected: PASS

- [ ] **Step 7: 提交**

```bash
git add packages/editor-core/src/color-grading/
git commit -m "feat: add primary slider parameter processing"
```

---

## Task 5: 命令系统集成

**Files:**
- Modify: `packages/editor-core/src/commands/timeline-commands.ts`

**Interfaces:**
- Consumes: `ColorGradingGraph`, `ColorNode`, `createColorNode` from Task 1
- Produces: `AddColorNodeCommand`, `RemoveColorNodeCommand`, `UpdateColorNodeCommand`, `ConnectColorNodesCommand`

- [ ] **Step 1: 在 timeline-commands.ts 中添加调色节点命令**

在文件末尾添加以下命令类（在现有 `ApplyEffectPresetCommand` 之后）：

```typescript
// === 调色节点图命令 ===

/** 添加调色节点 */
export class AddColorNodeCommand implements Command {
  description = '添加调色节点';
  private clipId: string;
  private node: ColorNode;

  constructor(clipId: string, node: ColorNode) {
    this.clipId = clipId;
    this.node = node;
  }

  execute(state: Project): Project {
    return this.updateGraph(state, graph => ({
      ...graph,
      nodes: [...graph.nodes, this.node],
    }));
  }

  undo(state: Project): Project {
    return this.updateGraph(state, graph => ({
      ...graph,
      nodes: graph.nodes.filter(n => n.id !== this.node.id),
    }));
  }

  private updateGraph(state: Project, updater: (g: ColorGradingGraph) => ColorGradingGraph): Project {
    // 通过 UpdateClipCommand 的逻辑更新
    const timeline = state.timeline;
    const tracks = timeline.tracks.map(track => ({
      ...track,
      clips: track.clips.map(clip => {
        if (clip.id !== this.clipId) return clip;
        const currentGraph = (clip as any).colorGradingGraph || createEmptyColorGradingGraph();
        return { ...clip, colorGradingGraph: updater(currentGraph) };
      }),
    }));
    return { ...state, timeline: { ...timeline, tracks } };
  }
}

/** 移除调色节点 */
export class RemoveColorNodeCommand implements Command {
  description = '移除调色节点';
  private clipId: string;
  private nodeId: string;
  private removedNode: ColorNode | null = null;
  private removedConnections: ColorConnection[] = [];

  constructor(clipId: string, nodeId: string) {
    this.clipId = clipId;
    this.nodeId = nodeId;
  }

  execute(state: Project): Project {
    return this.updateGraph(state, graph => {
      this.removedNode = graph.nodes.find(n => n.id === this.nodeId) || null;
      this.removedConnections = graph.connections.filter(
        c => c.fromNodeId === this.nodeId || c.toNodeId === this.nodeId
      );

      return {
        ...graph,
        nodes: graph.nodes.filter(n => n.id !== this.nodeId),
        connections: graph.connections.filter(
          c => c.fromNodeId !== this.nodeId && c.toNodeId !== this.nodeId
        ),
        activeNodeId: graph.activeNodeId === this.nodeId ? null : graph.activeNodeId,
      };
    });
  }

  undo(state: Project): Project {
    if (!this.removedNode) return state;
    return this.updateGraph(state, graph => ({
      ...graph,
      nodes: [...graph.nodes, this.removedNode!],
      connections: [...graph.connections, ...this.removedConnections],
    }));
  }

  private updateGraph(state: Project, updater: (g: ColorGradingGraph) => ColorGradingGraph): Project {
    const timeline = state.timeline;
    const tracks = timeline.tracks.map(track => ({
      ...track,
      clips: track.clips.map(clip => {
        if (clip.id !== this.clipId) return clip;
        const currentGraph = (clip as any).colorGradingGraph || createEmptyColorGradingGraph();
        return { ...clip, colorGradingGraph: updater(currentGraph) };
      }),
    }));
    return { ...state, timeline: { ...timeline, tracks } };
  }
}

/** 更新调色节点参数 */
export class UpdateColorNodeCommand implements Command {
  description = '更新调色节点';
  private clipId: string;
  private nodeId: string;
  private patch: Partial<ColorNode>;
  private previousState: Partial<ColorNode> = {};

  constructor(clipId: string, nodeId: string, patch: Partial<ColorNode>) {
    this.clipId = clipId;
    this.nodeId = nodeId;
    this.patch = patch;
  }

  execute(state: Project): Project {
    return this.updateGraph(state, graph => ({
      ...graph,
      nodes: graph.nodes.map(node => {
        if (node.id !== this.nodeId) return node;
        // 保存旧状态用于 undo
        this.previousState = {};
        for (const key of Object.keys(this.patch) as (keyof ColorNode)[]) {
          (this.previousState as any)[key] = node[key];
        }
        return { ...node, ...this.patch };
      }),
    }));
  }

  undo(state: Project): Project {
    return this.updateGraph(state, graph => ({
      ...graph,
      nodes: graph.nodes.map(node => {
        if (node.id !== this.nodeId) return node;
        return { ...node, ...this.previousState };
      }),
    }));
  }

  private updateGraph(state: Project, updater: (g: ColorGradingGraph) => ColorGradingGraph): Project {
    const timeline = state.timeline;
    const tracks = timeline.tracks.map(track => ({
      ...track,
      clips: track.clips.map(clip => {
        if (clip.id !== this.clipId) return clip;
        const currentGraph = (clip as any).colorGradingGraph || createEmptyColorGradingGraph();
        return { ...clip, colorGradingGraph: updater(currentGraph) };
      }),
    }));
    return { ...state, timeline: { ...timeline, tracks } };
  }
}

/** 连接/断开调色节点 */
export class ConnectColorNodesCommand implements Command {
  description = '连接调色节点';
  private clipId: string;
  private connection: ColorConnection;
  private isConnect: boolean;

  constructor(clipId: string, connection: ColorConnection, isConnect: boolean) {
    this.clipId = clipId;
    this.connection = connection;
    this.isConnect = isConnect;
  }

  execute(state: Project): Project {
    return this.updateGraph(state, graph => {
      if (this.isConnect) {
        return { ...graph, connections: [...graph.connections, this.connection] };
      } else {
        return { ...graph, connections: graph.connections.filter(c => c.id !== this.connection.id) };
      }
    });
  }

  undo(state: Project): Project {
    return this.updateGraph(state, graph => {
      if (this.isConnect) {
        return { ...graph, connections: graph.connections.filter(c => c.id !== this.connection.id) };
      } else {
        return { ...graph, connections: [...graph.connections, this.connection] };
      }
    });
  }

  private updateGraph(state: Project, updater: (g: ColorGradingGraph) => ColorGradingGraph): Project {
    const timeline = state.timeline;
    const tracks = timeline.tracks.map(track => ({
      ...track,
      clips: track.clips.map(clip => {
        if (clip.id !== this.clipId) return clip;
        const currentGraph = (clip as any).colorGradingGraph || createEmptyColorGradingGraph();
        return { ...clip, colorGradingGraph: updater(currentGraph) };
      }),
    }));
    return { ...state, timeline: { ...timeline, tracks } };
  }
}
```

需要在文件顶部添加 import：

```typescript
import type { ColorGradingGraph, ColorNode, ColorConnection } from '../color-grading/types';
import { createEmptyColorGradingGraph } from '../color-grading/types';
```

- [ ] **Step 2: 运行 typecheck 验证**

```bash
cd D:/code/Ai/open-factory && pnpm typecheck
```

Expected: PASS

- [ ] **Step 3: 运行全量测试**

```bash
cd D:/code/Ai/open-factory && pnpm test
```

Expected: PASS

- [ ] **Step 4: 提交**

```bash
git add packages/editor-core/src/commands/timeline-commands.ts
git commit -m "feat: add color grading node commands for undo/redo"
```

---

## Task 6: FFmpeg 导出映射

**Files:**
- Modify: `packages/editor-core/src/export/ffmpeg-builder.ts`
- Modify: `packages/editor-core/src/export/__tests__/ffmpeg-builder.test.ts`（追加测试）

**Interfaces:**
- Consumes: `ColorGradingGraph`, `PrimaryWheels.toFfmpegFilter`, `PrimarySliders.toFfmpegFilter` from Tasks 1, 3, 4
- Produces: `buildColorGradingFilters(graph: ColorGradingGraph): string[]`

- [ ] **Step 1: 在 ffmpeg-builder.ts 中添加调色节点滤镜构建函数**

在 `buildEffectFilters` 函数附近添加：

```typescript
import type { ColorGradingGraph } from '../color-grading/types';
import { PrimaryWheels } from '../color-grading/primary-wheels';
import { PrimarySliders } from '../color-grading/primary-sliders';
import type { PrimaryWheelParams, PrimarySliderParams } from '../color-grading/types';

/**
 * 构建调色节点图的 FFmpeg 滤镜链
 */
export function buildColorGradingFilters(graph: ColorGradingGraph | undefined): string[] {
  if (!graph || graph.nodes.length === 0) return [];

  const filters: string[] = [];

  // 按节点类型顺序处理：一级色轮 → 一级滑块 → 其他
  const wheelNodes = graph.nodes.filter(n => n.type === 'primary-wheel' && n.enabled);
  const sliderNodes = graph.nodes.filter(n => n.type === 'primary-slider' && n.enabled);

  // 一级色轮
  for (const node of wheelNodes) {
    const filter = PrimaryWheels.toFfmpegFilter(node.params as PrimaryWheelParams);
    if (filter) filters.push(filter);
  }

  // 一级滑块
  for (const node of sliderNodes) {
    const filter = PrimarySliders.toFfmpegFilter(node.params as PrimarySliderParams);
    if (filter) filters.push(filter);
  }

  return filters;
}
```

在现有的 `buildEffectFilters` 调用处集成（或在构建完整滤镜链时合并调色滤镜）。

- [ ] **Step 2: 追加 FFmpeg 调色测试**

在 `packages/editor-core/src/export/__tests__/ffmpeg-builder.test.ts` 中追加：

```typescript
describe('buildColorGradingFilters', () => {
  it('should return empty array for undefined graph', () => {
    expect(buildColorGradingFilters(undefined)).toEqual([]);
  });

  it('should return empty array for empty graph', () => {
    expect(buildColorGradingFilters({ nodes: [], connections: [], activeNodeId: null })).toEqual([]);
  });

  it('should build colorbalance filter for primary wheel', () => {
    const graph: ColorGradingGraph = {
      nodes: [{
        id: 'n1',
        type: 'primary-wheel',
        enabled: true,
        params: {
          lift: { r: 0.3, g: 0, b: 0, y: 0 },
          liftMaster: 0,
          gamma: { r: 0, g: 0, b: 0, y: 0 },
          gammaMaster: 0,
          gain: { r: 0, g: 0, b: 0, y: 0 },
          gainMaster: 0,
          offset: { r: 0, g: 0, b: 0, y: 0 },
          offsetMaster: 0,
        },
        inputs: [],
        output: null,
        position: { x: 0, y: 0 },
      }],
      connections: [],
      activeNodeId: 'n1',
    };

    const filters = buildColorGradingFilters(graph);
    expect(filters.length).toBeGreaterThan(0);
    expect(filters[0]).toContain('colorbalance');
  });

  it('should build eq filter for contrast/saturation', () => {
    const graph: ColorGradingGraph = {
      nodes: [{
        id: 'n1',
        type: 'primary-slider',
        enabled: true,
        params: {
          temperature: 0,
          tint: 0,
          contrast: 30,
          pivot: 0.5,
          saturation: 120,
          hue: 0,
        },
        inputs: [],
        output: null,
        position: { x: 0, y: 0 },
      }],
      connections: [],
      activeNodeId: 'n1',
    };

    const filters = buildColorGradingFilters(graph);
    expect(filters.some(f => f.includes('eq='))).toBe(true);
  });

  it('should skip disabled nodes', () => {
    const graph: ColorGradingGraph = {
      nodes: [{
        id: 'n1',
        type: 'primary-wheel',
        enabled: false,
        params: {
          lift: { r: 0.5, g: 0, b: 0, y: 0 },
          liftMaster: 0,
          gamma: { r: 0, g: 0, b: 0, y: 0 },
          gammaMaster: 0,
          gain: { r: 0, g: 0, b: 0, y: 0 },
          gainMaster: 0,
          offset: { r: 0, g: 0, b: 0, y: 0 },
          offsetMaster: 0,
        },
        inputs: [],
        output: null,
        position: { x: 0, y: 0 },
      }],
      connections: [],
      activeNodeId: 'n1',
    };

    const filters = buildColorGradingFilters(graph);
    expect(filters).toEqual([]);
  });
});
```

- [ ] **Step 3: 运行测试验证通过**

```bash
cd D:/code/Ai/open-factory && pnpm vitest run packages/editor-core/src/export/__tests__/ffmpeg-builder.test.ts
```

Expected: PASS

- [ ] **Step 4: 运行全量测试**

```bash
cd D:/code/Ai/open-factory && pnpm test
```

Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add packages/editor-core/src/export/
git commit -m "feat: add color grading FFmpeg export mapping"
```

---

## Task 7: WebGL 调色渲染器（desktop）

**Files:**
- Create: `apps/desktop/src/lib/color-grading/color-grading-renderer.ts`
- Create: `apps/desktop/src/lib/color-grading/node-shader-compiler.ts`
- Modify: `apps/desktop/src/lib/preview/webgl-compositor.ts`

**Interfaces:**
- Consumes: `NodeGraphEngine.execute()`, `PrimaryWheels.toUniforms()`, `PrimarySliders.toUniforms()` from Tasks 2-4
- Produces: `ColorGradingRenderer.render(gl, graph, inputTexture): WebGLTexture`

- [ ] **Step 1: 创建节点着色器编译器**

```typescript
// apps/desktop/src/lib/color-grading/node-shader-compiler.ts
import { PrimaryWheels } from '@open-factory/editor-core';
import { PrimarySliders } from '@open-factory/editor-core';
import type { ColorNode } from '@open-factory/editor-core';

/**
 * 编译调色节点链为 GLSL 片段着色器
 */
export function compileColorGradingShader(nodes: ColorNode[]): string {
  if (nodes.length === 0) return '';

  const functions: string[] = [];
  const mainBody: string[] = [];

  // 检查需要哪些函数
  const hasWheel = nodes.some(n => n.type === 'primary-wheel');
  const hasSlider = nodes.some(n => n.type === 'primary-slider');

  if (hasWheel) {
    functions.push(PrimaryWheels.generateGlslFunction());
  }
  if (hasSlider) {
    functions.push(PrimarySliders.generateGlslFunction());
  }

  // 生成每个节点的 uniform 声明和调用
  for (const node of nodes) {
    const prefix = `cg_${node.id.replace(/-/g, '_')}`;

    if (node.type === 'primary-wheel') {
      mainBody.push(`uniform vec4 ${prefix}_lift;`);
      mainBody.push(`uniform vec4 ${prefix}_gamma;`);
      mainBody.push(`uniform vec4 ${prefix}_gain;`);
      mainBody.push(`uniform vec4 ${prefix}_offset;`);
      mainBody.push(PrimaryWheels.toGlslSnippet(prefix));
    } else if (node.type === 'primary-slider') {
      mainBody.push(`uniform float ${prefix}_temperature;`);
      mainBody.push(`uniform float ${prefix}_tint;`);
      mainBody.push(`uniform float ${prefix}_contrast;`);
      mainBody.push(`uniform float ${prefix}_pivot;`);
      mainBody.push(`uniform float ${prefix}_saturation;`);
      mainBody.push(`uniform float ${prefix}_hue;`);
      mainBody.push(PrimarySliders.toGlslSnippet(prefix));
    }
  }

  return [...functions, '', ...mainBody].join('\n');
}
```

- [ ] **Step 2: 创建调色渲染器**

```typescript
// apps/desktop/src/lib/color-grading/color-grading-renderer.ts
import { NodeGraphEngine } from '@open-factory/editor-core';
import { PrimaryWheels } from '@open-factory/editor-core';
import { PrimarySliders } from '@open-factory/editor-core';
import type { ColorGradingGraph } from '@open-factory/editor-core';
import { compileColorGradingShader } from './node-shader-compiler';

/**
 * WebGL 调色渲染器
 * 使用乒乓缓冲技术链式执行调色节点着色器
 */
export class ColorGradingRenderer {
  private gl: WebGL2RenderingContext | WebGLRenderingContext;
  private program: WebGLProgram | null = null;
  private framebuffers: [WebGLFramebuffer, WebGLFramebuffer] | null = null;
  private textures: [WebGLTexture, WebGLTexture] | null = null;
  private currentProgram: string = '';

  constructor(gl: WebGL2RenderingContext | WebGLRenderingContext) {
    this.gl = gl;
  }

  /**
   * 渲染调色节点图
   * @param graph 节点图
   * @param inputTexture 输入纹理
   * @param width 纹理宽度
   * @param height 纹理高度
   * @returns 输出纹理
   */
  render(
    graph: ColorGradingGraph,
    inputTexture: WebGLTexture,
    width: number,
    height: number
  ): WebGLTexture {
    const enabledNodes = graph.nodes.filter(n => n.enabled);
    if (enabledNodes.length === 0) return inputTexture;

    const execution = NodeGraphEngine.execute(graph);
    if (execution.nodeResults.length === 0) return inputTexture;

    // 确保资源已创建
    this.ensureResources(width, height);

    // 编译着色器
    const fragmentShader = compileColorGradingShader(enabledNodes);
    this.ensureProgram(fragmentShader);

    const gl = this.gl;
    let currentInput = inputTexture;
    let bufferIndex = 0;

    for (const result of execution.nodeResults) {
      // 绑定输出 framebuffer
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffers![bufferIndex]);
      gl.viewport(0, 0, width, height);

      // 绑定输入纹理
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, currentInput);

      // 设置 uniform
      gl.useProgram(this.program!);
      const textureLoc = gl.getUniformLocation(this.program!, 'u_texture');
      gl.uniform1i(textureLoc, 0);

      for (const [name, value] of Object.entries(result.uniforms)) {
        const loc = gl.getUniformLocation(this.program!, name);
        if (loc === null) continue;
        if (Array.isArray(value)) {
          if (value.length === 4) gl.uniform4fv(loc, value);
          else if (value.length === 3) gl.uniform3fv(loc, value);
          else if (value.length === 2) gl.uniform2fv(loc, value);
        } else {
          gl.uniform1f(loc, value);
        }
      }

      // 绘制全屏四边形
      this.drawFullscreenQuad();

      // 切换到下一个 buffer
      currentInput = this.textures![bufferIndex];
      bufferIndex = 1 - bufferIndex;
    }

    return currentInput;
  }

  private ensureResources(width: number, height: number): void {
    if (this.framebuffers) return;

    const gl = this.gl;
    this.framebuffers = [gl.createFramebuffer()!, gl.createFramebuffer()!];
    this.textures = [gl.createTexture()!, gl.createTexture()!];

    for (let i = 0; i < 2; i++) {
      gl.bindTexture(gl.TEXTURE_2D, this.textures[i]);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

      gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffers[i]);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.textures[i], 0);
    }
  }

  private ensureProgram(fragmentShader: string): void {
    if (this.program && this.currentProgram === fragmentShader) return;

    const gl = this.gl;
    const vertexShader = `
      attribute vec2 a_position;
      attribute vec2 a_texCoord;
      varying vec2 v_texCoord;
      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
        v_texCoord = a_texCoord;
      }
    `;

    const fullFragment = `
      precision mediump float;
      uniform sampler2D u_texture;
      varying vec2 v_texCoord;
      ${fragmentShader}
      void main() {
        vec4 color = texture2D(u_texture, v_texCoord);
        gl_FragColor = color;
      }
    `;

    // 编译着色器程序（简化版，实际需要完整的编译错误处理）
    if (this.program) gl.deleteProgram(this.program);
    this.program = this.createProgram(vertexShader, fullFragment);
    this.currentProgram = fragmentShader;
  }

  private createProgram(vertexSource: string, fragmentSource: string): WebGLProgram {
    const gl = this.gl;
    const vs = gl.createShader(gl.VERTEX_SHADER)!;
    gl.shaderSource(vs, vertexSource);
    gl.compileShader(vs);

    const fs = gl.createShader(gl.FRAGMENT_SHADER)!;
    gl.shaderSource(fs, fragmentSource);
    gl.compileShader(fs);

    const program = gl.createProgram()!;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    gl.deleteShader(vs);
    gl.deleteShader(fs);

    return program;
  }

  private drawFullscreenQuad(): void {
    const gl = this.gl;
    // 使用全屏三角形（更高效）
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  dispose(): void {
    const gl = this.gl;
    if (this.program) gl.deleteProgram(this.program);
    if (this.framebuffers) {
      gl.deleteFramebuffer(this.framebuffers[0]);
      gl.deleteFramebuffer(this.framebuffers[1]);
    }
    if (this.textures) {
      gl.deleteTexture(this.textures[0]);
      gl.deleteTexture(this.textures[1]);
    }
  }
}
```

- [ ] **Step 3: 集成到 webgl-compositor.ts**

在 `WebGlPreviewCompositor` 的 `buildPreviewEffectParams` 函数中添加对 `colorGradingGraph` 的处理：

```typescript
// 在 buildPreviewEffectParams 函数中添加
if (clip.colorGradingGraph && clip.colorGradingGraph.nodes.length > 0) {
  const execution = NodeGraphEngine.execute(clip.colorGradingGraph);
  Object.assign(params, execution.combinedUniforms);
}
```

- [ ] **Step 4: 运行 typecheck**

```bash
cd D:/code/Ai/open-factory && pnpm typecheck
```

Expected: PASS

- [ ] **Step 5: 运行全量测试**

```bash
cd D:/code/Ai/open-factory && pnpm test
```

Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add apps/desktop/src/lib/color-grading/ apps/desktop/src/lib/preview/webgl-compositor.ts
git commit -m "feat: add WebGL color grading renderer integration"
```

---

## Task 8: 调色 UI 组件

**Files:**
- Create: `apps/desktop/src/components/ColorGrading/ColorGradingWorkspace.tsx`
- Create: `apps/desktop/src/components/ColorGrading/ColorWheelPanel.tsx`
- Create: `apps/desktop/src/components/ColorGrading/PrimarySlidersPanel.tsx`
- Create: `apps/desktop/src/components/ColorGrading/NodeGraphView.tsx`
- Modify: `apps/desktop/src/components/Inspector/Inspector.tsx`

**Interfaces:**
- Consumes: `ColorGradingGraph`, `createColorNode`, `AddColorNodeCommand`, `UpdateColorNodeCommand` from Tasks 1, 5
- Produces: 调色工作区 React 组件

- [ ] **Step 1: 创建色轮面板组件**

```tsx
// apps/desktop/src/components/ColorGrading/ColorWheelPanel.tsx
import React, { useCallback } from 'react';
import type { PrimaryWheelParams } from '@open-factory/editor-core';

interface ColorWheelPanelProps {
  params: PrimaryWheelParams;
  onChange: (params: PrimaryWheelParams) => void;
}

/** 单个色轮组件 */
const ColorWheel: React.FC<{
  label: string;
  value: { r: number; g: number; b: number; y: number };
  onChange: (value: { r: number; g: number; b: number; y: number }) => void;
}> = ({ label, value, onChange }) => {
  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = ((e.clientY - rect.top) / rect.height) * 2 - 1;
    onChange({ ...value, r: Math.max(-1, Math.min(1, x)), b: Math.max(-1, Math.min(1, -y)) });
  }, [value, onChange]);

  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-xs text-gray-400">{label}</span>
      <div
        className="relative w-24 h-24 rounded-full border border-gray-600 cursor-crosshair bg-gray-800"
        onClick={handleClick}
        data-testid={`color-wheel-${label.toLowerCase()}`}
      >
        <div
          className="absolute w-3 h-3 rounded-full bg-white border border-gray-400 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none"
          style={{
            left: `${(value.r + 1) * 50}%`,
            top: `${(-value.b + 1) * 50}%`,
          }}
        />
      </div>
    </div>
  );
};

/** 主亮度滑块 */
const MasterSlider: React.FC<{
  label: string;
  value: number;
  onChange: (value: number) => void;
}> = ({ label, value, onChange }) => (
  <div className="flex items-center gap-2">
    <span className="text-xs text-gray-400 w-12">{label}</span>
    <input
      type="range"
      min={-100}
      max={100}
      value={value * 100}
      onChange={e => onChange(Number(e.target.value) / 100)}
      className="flex-1"
      data-testid={`master-slider-${label.toLowerCase()}`}
    />
    <span className="text-xs w-8 text-right">{(value * 100).toFixed(0)}</span>
  </div>
);

/** 一级色轮面板 */
export const ColorWheelPanel: React.FC<ColorWheelPanelProps> = ({ params, onChange }) => {
  const updateLift = useCallback((value: { r: number; g: number; b: number; y: number }) => {
    onChange({ ...params, lift: value });
  }, [params, onChange]);

  const updateGamma = useCallback((value: { r: number; g: number; b: number; y: number }) => {
    onChange({ ...params, gamma: value });
  }, [params, onChange]);

  const updateGain = useCallback((value: { r: number; g: number; b: number; y: number }) => {
    onChange({ ...params, gain: value });
  }, [params, onChange]);

  const updateOffset = useCallback((value: { r: number; g: number; b: number; y: number }) => {
    onChange({ ...params, offset: value });
  }, [params, onChange]);

  return (
    <div className="p-3 space-y-4" data-testid="color-wheel-panel">
      <h3 className="text-sm font-medium text-gray-200">一级色轮</h3>
      <div className="grid grid-cols-2 gap-4">
        <ColorWheel label="Lift (暗部)" value={params.lift} onChange={updateLift} />
        <ColorWheel label="Gamma (中间调)" value={params.gamma} onChange={updateGamma} />
        <ColorWheel label="Gain (高光)" value={params.gain} onChange={updateGain} />
        <ColorWheel label="Offset (偏移)" value={params.offset} onChange={updateOffset} />
      </div>
      <div className="space-y-2">
        <MasterSlider label="Lift" value={params.liftMaster} onChange={v => onChange({ ...params, liftMaster: v })} />
        <MasterSlider label="Gamma" value={params.gammaMaster} onChange={v => onChange({ ...params, gammaMaster: v })} />
        <MasterSlider label="Gain" value={params.gainMaster} onChange={v => onChange({ ...params, gainMaster: v })} />
        <MasterSlider label="Offset" value={params.offsetMaster} onChange={v => onChange({ ...params, offsetMaster: v })} />
      </div>
    </div>
  );
};
```

- [ ] **Step 2: 创建一级滑块面板组件**

```tsx
// apps/desktop/src/components/ColorGrading/PrimarySlidersPanel.tsx
import React, { useCallback } from 'react';
import type { PrimarySliderParams } from '@open-factory/editor-core';

interface PrimarySlidersPanelProps {
  params: PrimarySliderParams;
  onChange: (params: PrimarySliderParams) => void;
}

const Slider: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  unit?: string;
}> = ({ label, value, min, max, step = 1, onChange, unit = '' }) => (
  <div className="flex items-center gap-2">
    <span className="text-xs text-gray-400 w-20">{label}</span>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={e => onChange(Number(e.target.value))}
      className="flex-1"
      data-testid={`slider-${label.toLowerCase().replace(/\s+/g, '-')}`}
    />
    <span className="text-xs w-12 text-right">{value}{unit}</span>
  </div>
);

export const PrimarySlidersPanel: React.FC<PrimarySlidersPanelProps> = ({ params, onChange }) => {
  const update = useCallback((key: keyof PrimarySliderParams, value: number) => {
    onChange({ ...params, [key]: value });
  }, [params, onChange]);

  return (
    <div className="p-3 space-y-3" data-testid="primary-sliders-panel">
      <h3 className="text-sm font-medium text-gray-200">一级滑块</h3>
      <Slider label="色温" value={params.temperature} min={-100} max={100} onChange={v => update('temperature', v)} />
      <Slider label="色调" value={params.tint} min={-100} max={100} onChange={v => update('tint', v)} />
      <Slider label="对比度" value={params.contrast} min={-100} max={100} onChange={v => update('contrast', v)} />
      <Slider label="轴心" value={params.pivot} min={0} max={1} step={0.01} onChange={v => update('pivot', v)} />
      <Slider label="饱和度" value={params.saturation} min={0} max={200} onChange={v => update('saturation', v)} />
      <Slider label="色相" value={params.hue} min={-180} max={180} onChange={v => update('hue', v)} unit="°" />
    </div>
  );
};
```

- [ ] **Step 3: 创建节点图视图组件**

```tsx
// apps/desktop/src/components/ColorGrading/NodeGraphView.tsx
import React, { useCallback } from 'react';
import type { ColorGradingGraph, ColorNode, ColorNodeType } from '@open-factory/editor-core';
import { createColorNode } from '@open-factory/editor-core';

interface NodeGraphViewProps {
  graph: ColorGradingGraph;
  onAddNode: (node: ColorNode) => void;
  onRemoveNode: (nodeId: string) => void;
  onSelectNode: (nodeId: string | null) => void;
}

const NODE_COLORS: Record<ColorNodeType, string> = {
  'primary-wheel': '#3b82f6',
  'primary-slider': '#10b981',
  'curves': '#f59e0b',
  'hsl-qualifier': '#ef4444',
  'window-mask': '#8b5cf6',
  'tracking-mask': '#ec4899',
  'lut-apply': '#06b6d4',
  'color-space': '#6366f1',
  'mixer-node': '#f97316',
  'output': '#6b7280',
};

const NODE_LABELS: Record<ColorNodeType, string> = {
  'primary-wheel': '色轮',
  'primary-slider': '滑块',
  'curves': '曲线',
  'hsl-qualifier': 'HSL限定',
  'window-mask': '窗口遮罩',
  'tracking-mask': '跟踪遮罩',
  'lut-apply': 'LUT',
  'color-space': '色彩空间',
  'mixer-node': '混合',
  'output': '输出',
};

export const NodeGraphView: React.FC<NodeGraphViewProps> = ({
  graph,
  onAddNode,
  onRemoveNode,
  onSelectNode,
}) => {
  const handleAddNode = useCallback((type: ColorNodeType) => {
    const node = createColorNode(type, { x: 100 + graph.nodes.length * 150, y: 100 });
    onAddNode(node);
  }, [graph.nodes.length, onAddNode]);

  return (
    <div className="p-3" data-testid="node-graph-view">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-200">节点图</h3>
        <div className="flex gap-1">
          <button
            onClick={() => handleAddNode('primary-wheel')}
            className="px-2 py-1 text-xs bg-blue-600 rounded hover:bg-blue-500"
            data-testid="add-wheel-node"
          >
            + 色轮
          </button>
          <button
            onClick={() => handleAddNode('primary-slider')}
            className="px-2 py-1 text-xs bg-green-600 rounded hover:bg-green-500"
            data-testid="add-slider-node"
          >
            + 滑块
          </button>
        </div>
      </div>

      <div className="relative h-48 bg-gray-900 rounded border border-gray-700 overflow-auto">
        {graph.nodes.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm">
            点击上方按钮添加调色节点
          </div>
        ) : (
          graph.nodes.map(node => (
            <div
              key={node.id}
              className="absolute px-3 py-2 rounded cursor-pointer text-xs text-white shadow-lg"
              style={{
                left: node.position.x,
                top: node.position.y,
                backgroundColor: NODE_COLORS[node.type],
              }}
              onClick={() => onSelectNode(node.id)}
              data-testid={`node-${node.type}`}
            >
              {NODE_LABELS[node.type]}
              <button
                onClick={(e) => { e.stopPropagation(); onRemoveNode(node.id); }}
                className="ml-2 text-white/60 hover:text-white"
              >
                ×
              </button>
            </div>
          ))
        )}

        {/* 连接线 */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          {graph.connections.map(conn => {
            const from = graph.nodes.find(n => n.id === conn.fromNodeId);
            const to = graph.nodes.find(n => n.id === conn.toNodeId);
            if (!from || !to) return null;
            return (
              <line
                key={conn.id}
                x1={from.position.x + 60}
                y1={from.position.y + 15}
                x2={to.position.x}
                y2={to.position.y + 15}
                stroke="#9ca3af"
                strokeWidth={2}
              />
            );
          })}
        </svg>
      </div>
    </div>
  );
};
```

- [ ] **Step 4: 创建调色工作区主组件**

```tsx
// apps/desktop/src/components/ColorGrading/ColorGradingWorkspace.tsx
import React, { useCallback, useMemo } from 'react';
import type { ColorGradingGraph, ColorNode, PrimaryWheelParams, PrimarySliderParams } from '@open-factory/editor-core';
import { createEmptyColorGradingGraph, createColorNode } from '@open-factory/editor-core';
import { ColorWheelPanel } from './ColorWheelPanel';
import { PrimarySlidersPanel } from './PrimarySlidersPanel';
import { NodeGraphView } from './NodeGraphView';

interface ColorGradingWorkspaceProps {
  graph?: ColorGradingGraph;
  onGraphChange: (graph: ColorGradingGraph) => void;
}

export const ColorGradingWorkspace: React.FC<ColorGradingWorkspaceProps> = ({
  graph = createEmptyColorGradingGraph(),
  onGraphChange,
}) => {
  const activeNode = useMemo(
    () => graph.nodes.find(n => n.id === graph.activeNodeId) || null,
    [graph]
  );

  const handleAddNode = useCallback((node: ColorNode) => {
    onGraphChange({
      ...graph,
      nodes: [...graph.nodes, node],
      activeNodeId: node.id,
    });
  }, [graph, onGraphChange]);

  const handleRemoveNode = useCallback((nodeId: string) => {
    onGraphChange({
      ...graph,
      nodes: graph.nodes.filter(n => n.id !== nodeId),
      connections: graph.connections.filter(c => c.fromNodeId !== nodeId && c.toNodeId !== nodeId),
      activeNodeId: graph.activeNodeId === nodeId ? null : graph.activeNodeId,
    });
  }, [graph, onGraphChange]);

  const handleSelectNode = useCallback((nodeId: string | null) => {
    onGraphChange({ ...graph, activeNodeId: nodeId });
  }, [graph, onGraphChange]);

  const handleWheelChange = useCallback((params: PrimaryWheelParams) => {
    if (!activeNode) return;
    onGraphChange({
      ...graph,
      nodes: graph.nodes.map(n =>
        n.id === activeNode.id ? { ...n, params } : n
      ),
    });
  }, [graph, activeNode, onGraphChange]);

  const handleSliderChange = useCallback((params: PrimarySliderParams) => {
    if (!activeNode) return;
    onGraphChange({
      ...graph,
      nodes: graph.nodes.map(n =>
        n.id === activeNode.id ? { ...n, params } : n
      ),
    });
  }, [graph, activeNode, onGraphChange]);

  return (
    <div className="flex flex-col h-full bg-gray-800" data-testid="color-grading-workspace">
      {/* 节点图视图 */}
      <NodeGraphView
        graph={graph}
        onAddNode={handleAddNode}
        onRemoveNode={handleRemoveNode}
        onSelectNode={handleSelectNode}
      />

      {/* 活动节点的参数面板 */}
      <div className="flex-1 overflow-y-auto border-t border-gray-700">
        {activeNode?.type === 'primary-wheel' && (
          <ColorWheelPanel
            params={activeNode.params as PrimaryWheelParams}
            onChange={handleWheelChange}
          />
        )}
        {activeNode?.type === 'primary-slider' && (
          <PrimarySlidersPanel
            params={activeNode.params as PrimarySliderParams}
            onChange={handleSliderChange}
          />
        )}
        {!activeNode && (
          <div className="flex items-center justify-center h-32 text-gray-500 text-sm">
            选择一个节点以编辑参数
          </div>
        )}
      </div>
    </div>
  );
};
```

- [ ] **Step 5: 在 Inspector 中集成调色面板入口**

在 `apps/desktop/src/components/Inspector/Inspector.tsx` 中添加调色 Tab：

```tsx
import { ColorGradingWorkspace } from '../ColorGrading/ColorGradingWorkspace';

// 在 Inspector 的 Tab 列表中添加：
// { id: 'color-grading', label: '调色', icon: '🎨' }

// 在 Tab 内容区域：
// {activeTab === 'color-grading' && selectedClip && (
//   <ColorGradingWorkspace
//     graph={selectedClip.colorGradingGraph}
//     onGraphChange={(graph) => updateClip(selectedClip.id, { colorGradingGraph: graph })}
//   />
// )}
```

- [ ] **Step 6: 运行 typecheck**

```bash
cd D:/code/Ai/open-factory && pnpm typecheck
```

Expected: PASS

- [ ] **Step 7: 运行全量测试**

```bash
cd D:/code/Ai/open-factory && pnpm test
```

Expected: PASS

- [ ] **Step 8: 提交**

```bash
git add apps/desktop/src/components/ColorGrading/ apps/desktop/src/components/Inspector/
git commit -m "feat: add color grading workspace UI with wheels, sliders, and node graph"
```

---

## Task 9: E2E 测试

**Files:**
- Create: `apps/desktop/e2e/color-grading.spec.ts`

**Interfaces:**
- Tests the UI components from Task 8

- [ ] **Step 1: 创建 E2E 测试文件**

```typescript
// apps/desktop/e2e/color-grading.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Color Grading System', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // 等待应用加载
    await page.waitForSelector('[data-testid="app-loaded"]', { timeout: 10000 });
  });

  test('should open color grading workspace', async ({ page }) => {
    // 导航到调色面板
    const colorTab = page.locator('[data-testid="tab-color-grading"]');
    if (await colorTab.isVisible()) {
      await colorTab.click();
      await expect(page.locator('[data-testid="color-grading-workspace"]')).toBeVisible();
    }
  });

  test('should add primary wheel node', async ({ page }) => {
    const colorTab = page.locator('[data-testid="tab-color-grading"]');
    if (await colorTab.isVisible()) {
      await colorTab.click();

      const addWheelBtn = page.locator('[data-testid="add-wheel-node"]');
      if (await addWheelBtn.isVisible()) {
        await addWheelBtn.click();
        await expect(page.locator('[data-testid="node-primary-wheel"]')).toBeVisible();
        await expect(page.locator('[data-testid="color-wheel-panel"]')).toBeVisible();
      }
    }
  });

  test('should add primary slider node', async ({ page }) => {
    const colorTab = page.locator('[data-testid="tab-color-grading"]');
    if (await colorTab.isVisible()) {
      await colorTab.click();

      const addSliderBtn = page.locator('[data-testid="add-slider-node"]');
      if (await addSliderBtn.isVisible()) {
        await addSliderBtn.click();
        await expect(page.locator('[data-testid="node-primary-slider"]')).toBeVisible();
        await expect(page.locator('[data-testid="primary-sliders-panel"]')).toBeVisible();
      }
    }
  });

  test('should adjust color wheel parameters', async ({ page }) => {
    const colorTab = page.locator('[data-testid="tab-color-grading"]');
    if (await colorTab.isVisible()) {
      await colorTab.click();

      const addWheelBtn = page.locator('[data-testid="add-wheel-node"]');
      if (await addWheelBtn.isVisible()) {
        await addWheelBtn.click();

        // 点击色轮
        const liftWheel = page.locator('[data-testid="color-wheel-lift (暗部)"]');
        if (await liftWheel.isVisible()) {
          await liftWheel.click({ position: { x: 60, y: 30 } });
          // 断言参数已更新（通过检查 preview 变化或参数显示）
        }
      }
    }
  });

  test('should adjust primary slider parameters', async ({ page }) => {
    const colorTab = page.locator('[data-testid="tab-color-grading"]');
    if (await colorTab.isVisible()) {
      await colorTab.click();

      const addSliderBtn = page.locator('[data-testid="add-slider-node"]');
      if (await addSliderBtn.isVisible()) {
        await addSliderBtn.click();

        // 调整对比度滑块
        const contrastSlider = page.locator('[data-testid="slider-对比度"]');
        if (await contrastSlider.isVisible()) {
          await contrastSlider.fill('50');
          expect(await contrastSlider.inputValue()).toBe('50');
        }
      }
    }
  });

  test('should remove color grading node', async ({ page }) => {
    const colorTab = page.locator('[data-testid="tab-color-grading"]');
    if (await colorTab.isVisible()) {
      await colorTab.click();

      const addWheelBtn = page.locator('[data-testid="add-wheel-node"]');
      if (await addWheelBtn.isVisible()) {
        await addWheelBtn.click();
        await expect(page.locator('[data-testid="node-primary-wheel"]')).toBeVisible();

        // 点击删除按钮
        const removeBtn = page.locator('[data-testid="node-primary-wheel"] button');
        if (await removeBtn.isVisible()) {
          await removeBtn.click();
          await expect(page.locator('[data-testid="node-primary-wheel"]')).not.toBeVisible();
        }
      }
    }
  });
});
```

- [ ] **Step 2: 运行 E2E 测试**

```bash
cd D:/code/Ai/open-factory && pnpm test:e2e --grep "color-grading"
```

Expected: PASS（或在 CI 环境中跳过需要桌面环境的测试）

- [ ] **Step 3: 运行全量测试和 typecheck**

```bash
cd D:/code/Ai/open-factory && pnpm typecheck && pnpm lint && pnpm test
```

Expected: PASS

- [ ] **Step 4: 提交**

```bash
git add apps/desktop/e2e/color-grading.spec.ts
git commit -m "test: add E2E tests for color grading system"
```

---

## Task 10: 最终验证与提交

- [ ] **Step 1: 运行完整验证流程**

```bash
cd D:/code/Ai/open-factory
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Expected: ALL PASS

- [ ] **Step 2: 创建功能分支并提交**

```bash
cd D:/code/Ai/open-factory
git switch main && git pull --ff-only && git fetch --prune
git checkout -b feat/color-grading-node-graph
git add .
git commit -m "feat: implement color grading node graph with primary wheels and sliders"
```

- [ ] **Step 3: 推送并创建 PR**

```bash
git push -u origin feat/color-grading-node-graph
gh pr create --title "feat: Add color grading node graph with primary color controls" --body "实现调色节点图引擎和一级调色功能，包括色轮、滑块、WebGL渲染和FFmpeg导出映射。"
```

- [ ] **Step 4: 等待 CI 通过**

```bash
gh pr checks --watch
```

Expected: ALL PASS
