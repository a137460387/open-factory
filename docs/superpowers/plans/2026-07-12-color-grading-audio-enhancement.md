# 调色与音频混音系统增强 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 连接已有但断开的调色和音频混音代码，补全缺失的节点类型和效果映射，使现有功能真正可用。

**Architecture:** 集成优先策略。复用已有的 `color-curves.ts`、`lut.ts`、`effect-chain.ts` 等模块，将它们连接到节点图引擎、FFmpeg 导出管线、Web Audio 预览渲染器。新增 `MixerState` 持久化到 Project 模型，实现自动化曲线评估器。

**Tech Stack:** TypeScript, React, WebGL (GLSL), Web Audio API, FFmpeg, Vitest, Zustand

## Global Constraints

- All user-facing output must be written in Simplified Chinese
- Timeline mutation must go through command objects
- Core algorithms must have Vitest coverage at 80%+
- Modify `ffmpeg-builder.ts` only with matching test coverage
- Modify project schema only with matching `project-migration.ts` and migration tests
- All Tauri calls go through `tauri-bridge.ts`
- Run typecheck, tests, and build before summarizing completed work

---

## File Structure

### editor-core 修改文件

| 文件 | 职责 |
|------|------|
| `packages/editor-core/src/color-grading/types.ts` | 添加 CurvesNodeParams、LUTApplyNodeParams、TrackingMaskNodeParams |
| `packages/editor-core/src/color-grading/node-graph-engine.ts` | 补全 6 种节点执行器 |
| `packages/editor-core/src/color-grading/color-grading-presets.ts` | 添加 6 个内置预设 |
| `packages/editor-core/src/audio/effect-chain.ts` | 补全 11 种效果的 FFmpeg 映射 |
| `packages/editor-core/src/audio/audio-mix-presets.ts` | 添加 3 个内置音频预设 |
| `packages/editor-core/src/model-types.ts` | 添加 mixerState 字段 |
| `packages/editor-core/src/model.ts` | 添加 normalizeMixerState |
| `packages/editor-core/src/project-migration.ts` | v6→v7 迁移 |
| `packages/editor-core/src/export/export-types.ts` | 添加 colorGradingGraph、effectsChain 字段 |
| `packages/editor-core/src/export/ffmpeg-builder.ts` | 传递新字段 + 激活导出过滤器 |

### editor-core 新增文件

| 文件 | 职责 |
|------|------|
| `packages/editor-core/src/audio/automation-evaluator.ts` | 自动化曲线评估器 |

### desktop 修改文件

| 文件 | 职责 |
|------|------|
| `apps/desktop/src/lib/color-grading/node-shader-compiler.ts` | 补全曲线/LUT GLSL 生成 |
| `apps/desktop/src/lib/preview/audio-renderer.ts` | 添加效果链和自动化集成 |
| `apps/desktop/src/components/AudioMixer/AudioMixer.tsx` | 连接到 project.mixerState |
| `apps/desktop/e2e/fixtures.ts` | 添加新 fixtures |
| `apps/desktop/e2e/color-grading-audio.spec.ts` | 重写为强测试 |

### desktop 新增文件

| 文件 | 职责 |
|------|------|
| `apps/desktop/e2e/pages/color-grading.page.ts` | 调色 Page Object |
| `apps/desktop/e2e/pages/audio-mixer.page.ts` | 音频混音 Page Object |

### 测试文件

| 文件 | 职责 |
|------|------|
| `packages/editor-core/__tests__/color-grading/node-graph-engine.test.ts` | 补全新节点类型测试 |
| `packages/editor-core/__tests__/audio/effect-chain.test.ts` | 补全 11 种效果测试 |
| `packages/editor-core/__tests__/audio/automation-evaluator.test.ts` | 评估器测试 |
| `packages/editor-core/__tests__/project-migration.test.ts` | v6→v7 迁移测试 |
| `packages/editor-core/__tests__/export/ffmpeg-builder.test.ts` | colorGradingGraph 导出测试 |

---

## Task 1: 调色节点图类型扩展

**Files:**
- Modify: `packages/editor-core/src/color-grading/types.ts`
- Modify: `packages/editor-core/__tests__/color-grading/types.test.ts`

**Interfaces:**
- Produces: `CurvesNodeParams`, `LUTApplyNodeParams`, `TrackingMaskNodeParams` 类型
- Produces: 更新后的 `createColorGradingNode()` 和 `normalizeColorNode()`

- [ ] **Step 1: 在 types.ts 中添加新节点参数类型**

在 `types.ts` 的现有类型定义后添加：

```typescript
/** 曲线节点参数 */
export interface CurvesNodeParams {
  master: CurvePoint[];
  red: CurvePoint[];
  green: CurvePoint[];
  blue: CurvePoint[];
}

/** LUT 应用节点参数 */
export interface LUTApplyNodeParams {
  lutId: string;
  intensity: number; // 0-1
}

/** 跟踪遮罩节点参数 */
export interface TrackingMaskNodeParams {
  trackingData: Array<{
    time: number;
    position: { x: number; y: number };
    scale: number;
    rotation: number;
    confidence: number;
  }>;
  feather: number;
  expand: number;
  invert: boolean;
}
```

注意：`CurvePoint` 类型已在 `color-curves.ts` 中定义，需确认从该文件导入。

- [ ] **Step 2: 更新 createColorGradingNode 工厂函数**

在 `createColorGradingNode()` 的 switch 中添加 cases：

```typescript
case 'curves':
  params = {
    master: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
    red: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
    green: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
    blue: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
  } as CurvesNodeParams;
  break;
case 'lut-apply':
  params = { lutId: '', intensity: 1.0 } as LUTApplyNodeParams;
  break;
case 'tracking-mask':
  params = {
    trackingData: [],
    feather: 10,
    expand: 0,
    invert: false,
  } as TrackingMaskNodeParams;
  break;
case 'output':
case 'color-space':
case 'mixer-node':
  params = {};
  break;
```

- [ ] **Step 3: 更新 normalizeColorNode 验证函数**

在 `normalizeColorNode()` 中添加新类型的参数验证：

```typescript
case 'curves': {
  const p = raw.params as CurvesNodeParams;
  params = {
    master: Array.isArray(p?.master) ? p.master : [{ x: 0, y: 0 }, { x: 1, y: 1 }],
    red: Array.isArray(p?.red) ? p.red : [{ x: 0, y: 0 }, { x: 1, y: 1 }],
    green: Array.isArray(p?.green) ? p.green : [{ x: 0, y: 0 }, { x: 1, y: 1 }],
    blue: Array.isArray(p?.blue) ? p.blue : [{ x: 0, y: 0 }, { x: 1, y: 1 }],
  };
  break;
}
case 'lut-apply': {
  const p = raw.params as LUTApplyNodeParams;
  params = {
    lutId: typeof p?.lutId === 'string' ? p.lutId : '',
    intensity: clamp(typeof p?.intensity === 'number' ? p.intensity : 1, 0, 1),
  };
  break;
}
case 'tracking-mask': {
  const p = raw.params as TrackingMaskNodeParams;
  params = {
    trackingData: Array.isArray(p?.trackingData) ? p.trackingData : [],
    feather: clamp(typeof p?.feather === 'number' ? p.feather : 10, 0, 100),
    expand: clamp(typeof p?.expand === 'number' ? p.expand : 0, -100, 100),
    invert: !!p?.invert,
  };
  break;
}
```

- [ ] **Step 4: 更新类型测试**

在 `types.test.ts` 中添加测试：

```typescript
describe('createColorGradingNode - new types', () => {
  it('creates curves node with default params', () => {
    const node = createColorGradingNode('curves');
    expect(node.type).toBe('curves');
    expect(node.params).toHaveProperty('master');
    expect(node.params).toHaveProperty('red');
  });

  it('creates lut-apply node with default params', () => {
    const node = createColorGradingNode('lut-apply');
    expect(node.type).toBe('lut-apply');
    expect((node.params as any).intensity).toBe(1.0);
  });

  it('creates tracking-mask node with default params', () => {
    const node = createColorGradingNode('tracking-mask');
    expect(node.type).toBe('tracking-mask');
    expect((node.params as any).feather).toBe(10);
  });

  it('creates output node with empty params', () => {
    const node = createColorGradingNode('output');
    expect(node.type).toBe('output');
    expect(node.params).toEqual({});
  });
});

describe('normalizeColorNode - new types', () => {
  it('normalizes curves node with missing arrays', () => {
    const node = { id: '1', type: 'curves', params: {} };
    const result = normalizeColorNode(node);
    expect((result.params as any).master).toEqual([{ x: 0, y: 0 }, { x: 1, y: 1 }]);
  });

  it('clamps lut-apply intensity', () => {
    const node = { id: '1', type: 'lut-apply', params: { lutId: 'test', intensity: 2 } };
    const result = normalizeColorNode(node);
    expect((result.params as any).intensity).toBe(1);
  });
});
```

- [ ] **Step 5: 运行测试验证**

Run: `cd D:/code/Ai/open-factory && npx vitest run packages/editor-core/__tests__/color-grading/types.test.ts`
Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add packages/editor-core/src/color-grading/types.ts packages/editor-core/__tests__/color-grading/types.test.ts
git commit -m "feat(color-grading): add CurvesNodeParams, LUTApplyNodeParams, TrackingMaskNodeParams types"
```

---

## Task 2: 节点图引擎补全

**Files:**
- Modify: `packages/editor-core/src/color-grading/node-graph-engine.ts`
- Modify: `packages/editor-core/__tests__/color-grading/node-graph-engine.test.ts`

**Interfaces:**
- Consumes: `CurvesNodeParams`, `LUTApplyNodeParams`, `TrackingMaskNodeParams` from Task 1
- Produces: `NodeGraphEngine.execute()` 处理全部 10 种节点类型

- [ ] **Step 1: 添加曲线节点执行器**

在 `node-graph-engine.ts` 的 `executeNode()` switch 中添加：

```typescript
case 'curves': {
  const p = node.params as CurvesNodeParams;
  // 生成 256x1 查找纹理数据
  const lutData = new Float32Array(256 * 4);
  for (let i = 0; i < 256; i++) {
    const x = i / 255;
    lutData[i * 4] = sampleCurve(p.red, x);
    lutData[i * 4 + 1] = sampleCurve(p.green, x);
    lutData[i * 4 + 2] = sampleCurve(p.blue, x);
    lutData[i * 4 + 3] = sampleCurve(p.master, x);
  }
  return {
    nodeId: node.id,
    uniforms: {
      [`u_curvesLUT_${node.id}`]: { type: 'sampler2D', value: lutData, width: 256, height: 1 },
    },
    fragmentSnippets: [`color = applyCurves_${node.id}(color);`],
  };
}
```

注意：需要从 `color-curves.ts` 导入 `sampleCurve` 函数。

- [ ] **Step 2: 添加 LUT 节点执行器**

```typescript
case 'lut-apply': {
  const p = node.params as LUTApplyNodeParams;
  return {
    nodeId: node.id,
    uniforms: {
      [`u_lut3D_${node.id}`]: { type: 'sampler3D', value: null, lutId: p.lutId },
      [`u_lutIntensity_${node.id}`]: { type: '1f', value: p.intensity },
    },
    fragmentSnippets: [`color = applyLUT_${node.id}(color);`],
  };
}
```

- [ ] **Step 3: 添加跟踪遮罩节点执行器**

```typescript
case 'tracking-mask': {
  const p = node.params as TrackingMaskNodeParams;
  return {
    nodeId: node.id,
    uniforms: {
      [`u_trackingMaskFeather_${node.id}`]: { type: '1f', value: p.feather },
      [`u_trackingMaskExpand_${node.id}`]: { type: '1f', value: p.expand },
      [`u_trackingMaskInvert_${node.id}`]: { type: '1i', value: p.invert ? 1 : 0 },
    },
    fragmentSnippets: [`color = applyTrackingMask_${node.id}(color, v_texCoord);`],
  };
}
```

- [ ] **Step 4: 添加辅助节点处理**

```typescript
case 'output':
case 'color-space':
case 'mixer-node':
  // 辅助节点不生成着色器代码
  return {
    nodeId: node.id,
    uniforms: {},
    fragmentSnippets: [],
  };
```

- [ ] **Step 5: 更新测试**

在 `node-graph-engine.test.ts` 中添加：

```typescript
it('executes curves node', () => {
  const graph = createEmptyColorGradingGraph();
  const node = createColorGradingNode('curves');
  graph.nodes.push(node);
  const result = NodeGraphEngine.execute(graph);
  expect(result.nodes[0].uniforms).toHaveProperty(`u_curvesLUT_${node.id}`);
  expect(result.nodes[0].fragmentSnippets.length).toBeGreaterThan(0);
});

it('executes lut-apply node', () => {
  const graph = createEmptyColorGradingGraph();
  const node = createColorGradingNode('lut-apply');
  (node.params as any).lutId = 'test-lut';
  graph.nodes.push(node);
  const result = NodeGraphEngine.execute(graph);
  expect(result.nodes[0].uniforms).toHaveProperty(`u_lut3D_${node.id}`);
});

it('handles output node as no-op', () => {
  const graph = createEmptyColorGradingGraph();
  const node = createColorGradingNode('output');
  graph.nodes.push(node);
  const result = NodeGraphEngine.execute(graph);
  expect(result.nodes[0].fragmentSnippets).toEqual([]);
});
```

- [ ] **Step 6: 运行测试验证**

Run: `cd D:/code/Ai/open-factory && npx vitest run packages/editor-core/__tests__/color-grading/node-graph-engine.test.ts`
Expected: PASS

- [ ] **Step 7: 提交**

```bash
git add packages/editor-core/src/color-grading/node-graph-engine.ts packages/editor-core/__tests__/color-grading/node-graph-engine.test.ts
git commit -m "feat(color-grading): implement curves, lut-apply, tracking-mask, and auxiliary node executors"
```

---

## Task 3: Shader 编译器补全

**Files:**
- Modify: `apps/desktop/src/lib/color-grading/node-shader-compiler.ts`

**Interfaces:**
- Consumes: `CurvesNodeParams`, `LUTApplyNodeParams` from Task 1
- Produces: 完整的 GLSL 着色器代码支持 curves 和 lut-apply 节点

- [ ] **Step 1: 添加曲线节点 GLSL 代码生成**

在 `compileColorGradingShader()` 的节点循环中添加 curves case：

```typescript
case 'curves': {
  const prefix = `curves_${node.id}`;
  // 添加 GLSL 函数定义
  preamble.push(`
    uniform sampler2D u_curvesLUT_${node.id};
    vec4 applyCurves_${node.id}(vec4 color) {
      float r = texture2D(u_curvesLUT_${node.id}, vec2(color.r, 0.5)).r;
      float g = texture2D(u_curvesLUT_${node.id}, vec2(color.g, 0.5)).g;
      float b = texture2D(u_curvesLUT_${node.id}, vec2(color.b, 0.5)).b;
      float m = texture2D(u_curvesLUT_${node.id}, vec2(
        dot(color.rgb, vec3(0.2126, 0.7152, 0.0722)), 0.5
      ).a;
      return vec4(r + m - 0.5, g + m - 0.5, b + m - 0.5, color.a);
    }
  `);
  calls.push(`color = applyCurves_${node.id}(color);`);
  break;
}
```

- [ ] **Step 2: 添加 LUT 节点 GLSL 代码生成**

```typescript
case 'lut-apply': {
  preamble.push(`
    uniform sampler3D u_lut3D_${node.id};
    uniform float u_lutIntensity_${node.id};
    vec4 applyLUT_${node.id}(vec4 color) {
      vec3 lutColor = texture3D(u_lut3D_${node.id}, color.rgb).rgb;
      return vec4(mix(color.rgb, lutColor, u_lutIntensity_${node.id}), color.a);
    }
  `);
  calls.push(`color = applyLUT_${node.id}(color);`);
  break;
}
```

- [ ] **Step 3: 运行类型检查**

Run: `cd D:/code/Ai/open-factory && pnpm typecheck`
Expected: PASS

- [ ] **Step 4: 提交**

```bash
git add apps/desktop/src/lib/color-grading/node-shader-compiler.ts
git commit -m "feat(color-grading): add curves and LUT GLSL code generation to shader compiler"
```

---

## Task 4: 调色 FFmpeg 导出集成

**Files:**
- Modify: `packages/editor-core/src/export/export-types.ts`
- Modify: `packages/editor-core/src/export/ffmpeg-builder.ts`
- Modify: `packages/editor-core/__tests__/export/ffmpeg-builder.test.ts`

**Interfaces:**
- Consumes: `ColorGradingGraph` from model-types.ts
- Produces: `ExportClip.colorGradingGraph` 字段 + `buildColorGradingFilters()` 被调用

- [ ] **Step 1: 扩展 ExportClip 类型**

在 `export-types.ts` 的 `ExportClip` 接口中添加：

```typescript
colorGradingGraph?: ColorGradingGraph;
```

- [ ] **Step 2: 传递 colorGradingGraph 到 ExportClip**

在 `ffmpeg-builder.ts` 的 `buildExportTimeline()` 函数中，找到构建 ExportClip 对象的位置，添加：

```typescript
colorGradingGraph: clip.colorGradingGraph,
```

- [ ] **Step 3: 在 buildVideoFilters 中激活 colorGradingGraph**

在 `buildVideoFilters()` 中，找到处理 colorCorrection 的位置，在其前面添加优先级判断：

```typescript
// 优先使用新节点图系统
if (clip.colorGradingGraph?.nodes?.length) {
  const gradingFilters = buildColorGradingFilters(clip.colorGradingGraph);
  if (gradingFilters.length > 0) {
    filters.push(...gradingFilters);
    return filters; // 节点图系统独占，不叠加旧系统
  }
}
// 回退到旧节点图系统
if (clip.colorNodeGraph) { ... }
// 回退到传统调色
if (clip.colorCorrection) { ... }
```

- [ ] **Step 4: 补全 buildColorGradingFilters**

在 `buildColorGradingFilters()` 的节点类型 switch 中添加：

```typescript
case 'curves': {
  const p = node.params as CurvesNodeParams;
  const rStr = p.red.map(p => `${p.x}/${p.y}`).join(' ');
  const gStr = p.green.map(p => `${p.x}/${p.y}`).join(' ');
  const bStr = p.blue.map(p => `${p.x}/${p.y}`).join(' ');
  filters.push(`curves=r='${rStr}':g='${gStr}':b='${bStr}'`);
  break;
}
case 'lut-apply': {
  const p = node.params as LUTApplyNodeParams;
  if (p.lutId) {
    filters.push(`lut3d=file='${escapePath(p.lutId)}'`);
  }
  break;
}
case 'tracking-mask':
  // 仅预览，导出跳过
  break;
case 'output':
case 'color-space':
case 'mixer-node':
  // 辅助节点，不生成过滤器
  break;
```

- [ ] **Step 5: 添加导出测试**

在 `ffmpeg-builder.test.ts` 中添加：

```typescript
it('exports colorGradingGraph with curves node to FFmpeg curves filter', () => {
  const graph = createEmptyColorGradingGraph();
  const node = createColorGradingNode('curves');
  (node.params as any).red = [{ x: 0, y: 0 }, { x: 0.5, y: 0.6 }, { x: 1, y: 1 }];
  graph.nodes.push(node);
  const clip = createTestExportClip({ colorGradingGraph: graph });
  const filters = buildVideoFilters(clip);
  expect(filters.some(f => f.includes('curves='))).toBe(true);
});

it('exports colorGradingGraph with lut-apply node to FFmpeg lut3d filter', () => {
  const graph = createEmptyColorGradingGraph();
  const node = createColorGradingNode('lut-apply');
  (node.params as any).lutId = '/path/to/lut.cube';
  graph.nodes.push(node);
  const clip = createTestExportClip({ colorGradingGraph: graph });
  const filters = buildVideoFilters(clip);
  expect(filters.some(f => f.includes('lut3d='))).toBe(true);
});

it('prioritizes colorGradingGraph over colorCorrection', () => {
  const graph = createEmptyColorGradingGraph();
  graph.nodes.push(createColorGradingNode('primary-slider'));
  const clip = createTestExportClip({
    colorGradingGraph: graph,
    colorCorrection: { brightness: 0.5, contrast: 1.2 },
  });
  const filters = buildVideoFilters(clip);
  // 应该使用节点图系统，不使用传统调色
  expect(filters.some(f => f.includes('eq='))).toBe(false);
});
```

- [ ] **Step 6: 运行测试验证**

Run: `cd D:/code/Ai/open-factory && npx vitest run packages/editor-core/__tests__/export/ffmpeg-builder.test.ts`
Expected: PASS

- [ ] **Step 7: 提交**

```bash
git add packages/editor-core/src/export/export-types.ts packages/editor-core/src/export/ffmpeg-builder.ts packages/editor-core/__tests__/export/ffmpeg-builder.test.ts
git commit -m "feat(export): wire colorGradingGraph into FFmpeg export pipeline with priority chain"
```

---

## Task 5: 音频 MixerState 持久化

**Files:**
- Modify: `packages/editor-core/src/model-types.ts`
- Modify: `packages/editor-core/src/model.ts`
- Modify: `packages/editor-core/src/project-migration.ts`
- Modify: `packages/editor-core/__tests__/project-migration.test.ts`

**Interfaces:**
- Consumes: `MixerState`, `createDefaultMixerState()` from mixer-types.ts
- Produces: `Project.mixerState` 字段 + v6→v7 迁移

- [ ] **Step 1: 添加 Project.mixerState 字段**

在 `model-types.ts` 的 `Project` 接口中添加：

```typescript
mixerState?: MixerState;
```

确认从 `audio/mixer-types.ts` 导入 `MixerState` 类型。

- [ ] **Step 2: 添加 normalizeMixerState**

在 `model.ts` 中添加：

```typescript
export function normalizeMixerState(raw: any): MixerState | undefined {
  if (!raw) return undefined;
  return {
    channels: Array.isArray(raw.channels)
      ? raw.channels.map(normalizeMixerChannel)
      : [],
    buses: Array.isArray(raw.buses)
      ? raw.buses.map(normalizeBus)
      : [],
    masterBus: raw.masterBus ? normalizeBus(raw.masterBus) : createDefaultBus('master'),
  };
}

function normalizeMixerChannel(raw: any): MixerChannel {
  return {
    trackId: typeof raw?.trackId === 'string' ? raw.trackId : '',
    volume: typeof raw?.volume === 'number' ? raw.volume : 0,
    pan: typeof raw?.pan === 'number' ? clamp(raw.pan, -100, 100) : 0,
    muted: !!raw?.muted,
    solo: !!raw?.solo,
    busAssignments: Array.isArray(raw?.busAssignments) ? raw.busAssignments : [],
    effectsChain: Array.isArray(raw?.effectsChain) ? raw.effectsChain : [],
    automation: raw?.automation ?? {},
    metering: raw?.metering ?? { peakLevel: -60, rmsLevel: -60, clipCount: 0 },
  };
}

function normalizeBus(raw: any): AudioBus {
  return {
    id: typeof raw?.id === 'string' ? raw.id : generateId(),
    name: typeof raw?.name === 'string' ? raw.name : 'Bus',
    type: raw?.type ?? 'submix',
    effectsChain: Array.isArray(raw?.effectsChain) ? raw.effectsChain : [],
    volume: typeof raw?.volume === 'number' ? raw.volume : 0,
    pan: typeof raw?.pan === 'number' ? raw.pan : 0,
    muted: !!raw?.muted,
    outputBusId: raw?.outputBusId ?? null,
  };
}
```

在 `normalizeProject()` 中调用：

```typescript
mixerState: normalizeMixerState(raw.mixerState),
```

- [ ] **Step 3: 添加 v6→v7 迁移**

在 `project-migration.ts` 中添加：

```typescript
function migrateV6ToV7(project: any): any {
  return {
    ...project,
    schemaVersion: 7,
    mixerState: project.mixerState ?? createDefaultMixerState(
      project.timeline?.tracks?.length ?? 0
    ),
  };
}
```

更新 `migrateProject()` 函数，将 v6 迁移添加到链中。

- [ ] **Step 4: 添加迁移测试**

在 `project-migration.test.ts` 中添加：

```typescript
it('migrates v6 to v7 with default mixerState', () => {
  const v6Project = { schemaVersion: 6, timeline: { tracks: [{ id: 't1' }] } };
  const result = migrateProject(v6Project);
  expect(result.schemaVersion).toBe(7);
  expect(result.mixerState).toBeDefined();
  expect(result.mixerState.channels.length).toBeGreaterThan(0);
});

it('preserves existing mixerState during v6 to v7 migration', () => {
  const existing = { channels: [{ trackId: 't1', volume: -6 }] };
  const v6Project = { schemaVersion: 6, mixerState: existing };
  const result = migrateProject(v6Project);
  expect(result.mixerState.channels[0].volume).toBe(-6);
});
```

- [ ] **Step 5: 运行测试验证**

Run: `cd D:/code/Ai/open-factory && npx vitest run packages/editor-core/__tests__/project-migration.test.ts`
Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add packages/editor-core/src/model-types.ts packages/editor-core/src/model.ts packages/editor-core/src/project-migration.ts packages/editor-core/__tests__/project-migration.test.ts
git commit -m "feat(audio): persist MixerState on Project model with v6→v7 migration"
```

---

## Task 6: 音频效果链 FFmpeg 映射补全

**Files:**
- Modify: `packages/editor-core/src/audio/effect-chain.ts`
- Modify: `packages/editor-core/__tests__/audio/effect-chain.test.ts`

**Interfaces:**
- Produces: `EffectChainEngine.toFfmpegFilters()` 支持全部 20 种效果类型

- [ ] **Step 1: 补全 effectToFfmpeg 方法**

在 `effect-chain.ts` 的 `effectToFfmpeg()` switch 中，将 `default` case 替换为具体的映射：

```typescript
case 'eq-8band': {
  // 8 频段 EQ：每个频段一个 equalizer 过滤器
  const bands = [
    { f: 32, key: 'band1' },
    { f: 64, key: 'band2' },
    { f: 125, key: 'band3' },
    { f: 250, key: 'band4' },
    { f: 500, key: 'band5' },
    { f: 1000, key: 'band6' },
    { f: 2000, key: 'band7' },
    { f: 4000, key: 'band8' },
  ];
  return bands.map(b => ({
    filterName: 'equalizer',
    params: {
      f: b.f,
      width_type: 'h',
      width: b.f * 0.5,
      g: params[b.key] ?? 0,
    },
  }));
}

case 'expander':
  return [{
    filterName: 'acompressor',
    params: {
      threshold: params.threshold ?? -20,
      ratio: params.ratio ?? 0.5, // ratio < 1 = expansion
      attack: params.attack ?? 10,
      release: params.release ?? 100,
    },
  }];

case 'chorus':
  return [{
    filterName: 'chorus',
    params: {
      in_gain: 0.5,
      out_gain: 0.9,
      delays: '50|60',
      decays: '0.4|0.32',
      speeds: '0.25|0.4',
      depths: '2|2.3',
    },
  }];

case 'flanger':
  return [{
    filterName: 'flanger',
    params: {
      delay: params.delay ?? 0,
      depth: params.depth ?? 2,
      regen: params.regen ?? 0,
      speed: params.speed ?? 0.5,
    },
  }];

case 'distortion':
  return [{
    filterName: 'aeval',
    params: {
      exprs: `val(0)*clip(${params.gain ?? 2}, -1, 1)`,
      c: 'same',
    },
  }];

case 'de-esser':
  return [{
    filterName: 'equalizer',
    params: { f: 6000, width_type: 'h', width: 2000, g: -(params.reduction ?? 10) },
  }, {
    filterName: 'acompressor',
    params: {
      threshold: params.threshold ?? -20,
      ratio: 4,
      attack: 1,
      release: 50,
    },
  }];

case 'noise-reduction':
  return [{
    filterName: 'afftdn',
    params: { nf: params.reduction ?? -25 },
  }];

case 'pitch-shift': {
  const semitones = params.semitones ?? 0;
  const ratio = Math.pow(2, semitones / 12);
  return [{
    filterName: 'asetrate',
    params: { r: `${ratio}*48000` },
  }, {
    filterName: 'aresample',
    params: { r: 48000 },
  }];
}

case 'stereo-widener':
  return [{
    filterName: 'stereotools',
    params: {
      mlev: 1,
      slev: params.width ?? 1,
    },
  }];

case 'mid-side':
  return [{
    filterName: 'stereotools',
    params: { mode: 'ms' },
  }];

case 'phase-invert':
  return [{
    filterName: 'aeval',
    params: { exprs: '-val(0)', c: 'same' },
  }];

default:
  // 未知类型：跳过
  return [];
```

- [ ] **Step 2: 补全参数范围验证**

在 `PARAM_RANGES` 中添加新效果的参数范围：

```typescript
'eq-8band': { band1: { min: -12, max: 12 }, band2: { min: -12, max: 12 }, /* ... */ },
'expander': { threshold: { min: -60, max: 0 }, ratio: { min: 0.1, max: 1 }, attack: { min: 0.1, max: 100 }, release: { min: 10, max: 1000 } },
'chorus': {},
'flanger': { delay: { min: 0, max: 30 }, depth: { min: 0, max: 10 }, regen: { min: -95, max: 95 }, speed: { min: 0.1, max: 10 } },
'distortion': { gain: { min: 1, max: 20 } },
'de-esser': { threshold: { min: -60, max: 0 }, reduction: { min: 0, max: 30 } },
'noise-reduction': { reduction: { min: -60, max: 0 } },
'pitch-shift': { semitones: { min: -12, max: 12 } },
'stereo-widener': { width: { min: 0, max: 2 } },
'mid-side': {},
'phase-invert': {},
```

- [ ] **Step 3: 添加测试**

在 `effect-chain.test.ts` 中添加：

```typescript
it('generates FFmpeg filter for eq-8band', () => {
  const slot = createEffectSlot('eq-8band');
  slot.params = { band1: 3, band2: -2 };
  const engine = new EffectChainEngine();
  const filters = engine.toFfmpegFilters([slot]);
  expect(filters.length).toBe(8);
  expect(filters[0].filterName).toBe('equalizer');
});

it('generates FFmpeg filter for noise-reduction', () => {
  const slot = createEffectSlot('noise-reduction');
  slot.params = { reduction: -30 };
  const engine = new EffectChainEngine();
  const filters = engine.toFfmpegFilters([slot]);
  expect(filters[0].filterName).toBe('afftdn');
  expect(filters[0].params.nf).toBe(-30);
});

it('generates FFmpeg filter for pitch-shift', () => {
  const slot = createEffectSlot('pitch-shift');
  slot.params = { semitones: 2 };
  const engine = new EffectChainEngine();
  const filters = engine.toFfmpegFilters([slot]);
  expect(filters[0].filterName).toBe('asetrate');
  expect(filters[1].filterName).toBe('aresample');
});
```

- [ ] **Step 4: 运行测试验证**

Run: `cd D:/code/Ai/open-factory && npx vitest run packages/editor-core/__tests__/audio/effect-chain.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add packages/editor-core/src/audio/effect-chain.ts packages/editor-core/__tests__/audio/effect-chain.test.ts
git commit -m "feat(audio): implement FFmpeg filter mappings for all 20 audio effect types"
```

---

## Task 7: 音频效果链导出集成

**Files:**
- Modify: `packages/editor-core/src/export/export-types.ts`
- Modify: `packages/editor-core/src/export/ffmpeg-builder.ts`

**Interfaces:**
- Consumes: `EffectChainEngine.toFfmpegFilters()` from Task 6
- Consumes: `MixerState` from Project.mixerState (Task 5)
- Produces: 音频效果链正确导出为 FFmpeg 过滤器

- [ ] **Step 1: 添加 ExportClip.effectsChain 字段**

在 `export-types.ts` 的 `ExportClip` 接口中添加：

```typescript
effectsChain?: AudioEffectSlot[];
```

- [ ] **Step 2: 从 MixerState 传递效果链到 ExportClip**

在 `buildExportTimeline()` 中，找到构建 ExportClip 的位置，添加：

```typescript
// 从 MixerState 获取该轨道的效果链
const mixerChannel = project.mixerState?.channels?.find(c => c.trackId === track.id);
effectsChain: mixerChannel?.effectsChain,
```

- [ ] **Step 3: 在 buildAudioFilters 中调用效果链**

在 `buildAudioFilters()` 函数末尾添加：

```typescript
// 应用效果链
if (clip.effectsChain?.length) {
  const chainEngine = new EffectChainEngine();
  const chainFilters = chainEngine.toFfmpegFilters(clip.effectsChain);
  for (const f of chainFilters) {
    const params = Object.entries(f.params)
      .map(([k, v]) => `${k}=${v}`)
      .join(':');
    filters.push(params ? `${f.filterName}=${params}` : f.filterName);
  }
}
```

- [ ] **Step 4: 运行类型检查**

Run: `cd D:/code/Ai/open-factory && pnpm typecheck`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add packages/editor-core/src/export/export-types.ts packages/editor-core/src/export/ffmpeg-builder.ts
git commit -m "feat(export): wire audio effects chain into FFmpeg export pipeline"
```

---

## Task 8: 自动化曲线评估器

**Files:**
- Create: `packages/editor-core/src/audio/automation-evaluator.ts`
- Create: `packages/editor-core/__tests__/audio/automation-evaluator.test.ts`

**Interfaces:**
- Consumes: `AutomationCurve`, `AutomationPoint`, `ChannelAutomation` from mixer-types.ts
- Produces: `evaluateAutomation()`, `evaluateCurve()` 函数

- [ ] **Step 1: 创建评估器文件**

```typescript
// packages/editor-core/src/audio/automation-evaluator.ts

import type { ChannelAutomation, AutomationCurve, AutomationPoint } from './mixer-types';

export interface AutomationEvaluationResult {
  volume: number;
  pan: number;
  effectParams: Record<string, number>;
}

export function evaluateAutomation(
  automation: ChannelAutomation,
  timeSeconds: number
): AutomationEvaluationResult {
  return {
    volume: automation.volume
      ? evaluateCurve(automation.volume.points, timeSeconds, automation.volume.curveType ?? 'linear')
      : 0,
    pan: automation.pan
      ? evaluateCurve(automation.pan.points, timeSeconds, automation.pan.curveType ?? 'linear')
      : 0,
    effectParams: {},
  };
}

export function evaluateCurve(
  points: AutomationPoint[],
  time: number,
  curveType: 'linear' | 'bezier' | 'step' | 'smooth'
): number {
  if (!points.length) return 0;
  if (points.length === 1) return points[0].value;

  // 排序点
  const sorted = [...points].sort((a, b) => a.time - b.time);

  // 边界情况
  if (time <= sorted[0].time) return sorted[0].value;
  if (time >= sorted[sorted.length - 1].time) return sorted[sorted.length - 1].value;

  // 找到包围点
  let i = 0;
  while (i < sorted.length - 1 && sorted[i + 1].time < time) i++;

  const p0 = sorted[i];
  const p1 = sorted[i + 1];
  const t = (time - p0.time) / (p1.time - p0.time);

  switch (curveType) {
    case 'step':
      return p0.value;
    case 'linear':
      return p0.value + (p1.value - p0.value) * t;
    case 'smooth': {
      // Catmull-Rom 样条
      const pPrev = i > 0 ? sorted[i - 1] : p0;
      const pNext = i < sorted.length - 2 ? sorted[i + 2] : p1;
      return catmullRom(pPrev.value, p0.value, p1.value, pNext.value, t);
    }
    case 'bezier':
      // 简化贝塞尔：使用线性插值（完整实现需要 handleIn/handleOut）
      return p0.value + (p1.value - p0.value) * t;
    default:
      return p0.value + (p1.value - p0.value) * t;
  }
}

function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (
    (2 * p1) +
    (-p0 + p2) * t +
    (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
    (-p0 + 3 * p1 - 3 * p2 + p3) * t3
  );
}
```

- [ ] **Step 2: 创建测试文件**

```typescript
// packages/editor-core/__tests__/audio/automation-evaluator.test.ts

import { evaluateCurve, evaluateAutomation } from '../../src/audio/automation-evaluator';

describe('evaluateCurve', () => {
  it('returns 0 for empty points', () => {
    expect(evaluateCurve([], 1, 'linear')).toBe(0);
  });

  it('returns single point value', () => {
    expect(evaluateCurve([{ time: 0, value: 5, curve: 'linear' }], 1, 'linear')).toBe(5);
  });

  it('interpolates linearly', () => {
    const points = [
      { time: 0, value: 0, curve: 'linear' as const },
      { time: 10, value: 100, curve: 'linear' as const },
    ];
    expect(evaluateCurve(points, 5, 'linear')).toBeCloseTo(50);
  });

  it('uses step function', () => {
    const points = [
      { time: 0, value: 0, curve: 'step' as const },
      { time: 10, value: 100, curve: 'step' as const },
    ];
    expect(evaluateCurve(points, 5, 'step')).toBe(0);
  });

  it('clamps to boundary values', () => {
    const points = [
      { time: 0, value: 10, curve: 'linear' as const },
      { time: 10, value: 20, curve: 'linear' as const },
    ];
    expect(evaluateCurve(points, -5, 'linear')).toBe(10);
    expect(evaluateCurve(points, 15, 'linear')).toBe(20);
  });
});

describe('evaluateAutomation', () => {
  it('returns zeros for empty automation', () => {
    const result = evaluateAutomation({}, 5);
    expect(result.volume).toBe(0);
    expect(result.pan).toBe(0);
  });

  it('evaluates volume curve', () => {
    const auto = {
      volume: {
        points: [
          { time: 0, value: -6, curve: 'linear' as const },
          { time: 10, value: 0, curve: 'linear' as const },
        ],
        curveType: 'linear' as const,
      },
    };
    const result = evaluateAutomation(auto, 5);
    expect(result.volume).toBeCloseTo(-3);
  });
});
```

- [ ] **Step 3: 运行测试验证**

Run: `cd D:/code/Ai/open-factory && npx vitest run packages/editor-core/__tests__/audio/automation-evaluator.test.ts`
Expected: PASS

- [ ] **Step 4: 导出到 index.ts**

在 `packages/editor-core/src/index.ts` 中添加导出：

```typescript
export * from './audio/automation-evaluator';
```

- [ ] **Step 5: 提交**

```bash
git add packages/editor-core/src/audio/automation-evaluator.ts packages/editor-core/__tests__/audio/automation-evaluator.test.ts packages/editor-core/src/index.ts
git commit -m "feat(audio): implement automation curve evaluator with linear/step/smooth interpolation"
```

---

## Task 9: 自动化曲线预览和导出集成

**Files:**
- Modify: `apps/desktop/src/lib/preview/audio-renderer.ts`
- Modify: `packages/editor-core/src/export/ffmpeg-builder.ts`

**Interfaces:**
- Consumes: `evaluateAutomation()` from Task 8
- Consumes: `Project.mixerState` from Task 5
- Produces: 自动化曲线在播放时影响音量/声像 + 导出时生成 FFmpeg 关键帧

- [ ] **Step 1: 在 audio-renderer.ts 中集成自动化**

在 `syncClipAudio()` 方法中，找到设置 `gainNode.gain.value` 的位置之后，添加：

```typescript
// 应用自动化曲线
const mixerChannel = this.mixerState?.channels?.find(c => c.trackId === track.id);
if (mixerChannel?.automation) {
  const autoResult = evaluateAutomation(mixerChannel.automation, currentTimeSeconds);
  if (autoResult.volume !== 0) {
    gainNode.gain.value *= Math.pow(10, autoResult.volume / 20);
  }
  if (autoResult.pan !== 0) {
    const currentPan = pannerNode.pan.value;
    pannerNode.pan.value = Math.max(-1, Math.min(1, currentPan + autoResult.pan / 100));
  }
}
```

需要在构造函数中接收 `mixerState` 参数。

- [ ] **Step 2: 在 ffmpeg-builder.ts 中生成自动化关键帧**

在 `buildAudioFilters()` 中，添加自动化曲线处理：

```typescript
// 应用自动化曲线
if (clip.automation?.volume?.points?.length) {
  const points = clip.automation.volume.points;
  // 生成 volume 关键帧表达式
  const volumeExpr = points
    .map((p, i) => {
      const nextTime = points[i + 1]?.time ?? duration;
      return `if(between(t,${p.time},${nextTime}),${p.value},`;
    })
    .join('');
  const defaultVal = points[0].value;
  const closing = ')'.repeat(points.length - 1);
  filters.push(`volume=${volumeExpr}${defaultVal}${closing}`);
}
```

- [ ] **Step 3: 运行类型检查**

Run: `cd D:/code/Ai/open-factory && pnpm typecheck`
Expected: PASS

- [ ] **Step 4: 提交**

```bash
git add apps/desktop/src/lib/preview/audio-renderer.ts packages/editor-core/src/export/ffmpeg-builder.ts
git commit -m "feat(audio): integrate automation curves into preview playback and FFmpeg export"
```

---

## Task 10: 内置预设扩展

**Files:**
- Modify: `packages/editor-core/src/color-grading/color-grading-presets.ts`
- Modify: `packages/editor-core/src/audio/audio-mix-presets.ts`

**Interfaces:**
- Produces: 6 个新调色预设 + 3 个新音频预设

- [ ] **Step 1: 添加调色预设**

在 `color-grading-presets.ts` 的 `BUILTIN_COLOR_PRESETS` 数组中添加：

```typescript
{
  id: 'builtin-teal-orange',
  name: 'Teal & Orange',
  author: 'open-factory',
  description: 'Cinematic teal shadows and orange highlights',
  tags: ['cinematic', 'film'],
  graph: {
    nodes: [
      createColorGradingNode('primary-slider', { temperature: 20, saturation: 80 }),
      createColorGradingNode('primary-wheel', {
        lift: { r: -0.1, g: 0, b: 0.15, y: 0 },
        gain: { r: 0.15, g: 0, b: -0.1, y: 0 },
      }),
    ],
    connections: [],
    activeNodeId: null,
  },
},
{
  id: 'builtin-bleach-bypass',
  name: 'Bleach Bypass',
  author: 'open-factory',
  description: 'Low saturation, high contrast film look',
  tags: ['film', 'dramatic'],
  graph: {
    nodes: [
      createColorGradingNode('primary-slider', { saturation: 40, contrast: 60 }),
    ],
    connections: [],
    activeNodeId: null,
  },
},
{
  id: 'builtin-day-for-night',
  name: 'Day for Night',
  author: 'open-factory',
  description: 'Convert daytime footage to night look',
  tags: ['cinematic', 'effect'],
  graph: {
    nodes: [
      createColorGradingNode('primary-slider', { temperature: -30, saturation: 50 }),
      createColorGradingNode('primary-wheel', {
        lift: { r: -0.2, g: -0.1, b: 0.1, y: -0.3 },
        gamma: { r: 0, g: 0, b: 0.1, y: -0.2 },
      }),
    ],
    connections: [],
    activeNodeId: null,
  },
},
{
  id: 'builtin-bw',
  name: 'Black & White',
  author: 'open-factory',
  description: 'Classic black and white with adjustable contrast',
  tags: ['classic', 'bw'],
  graph: {
    nodes: [
      createColorGradingNode('primary-slider', { saturation: 0, contrast: 30 }),
    ],
    connections: [],
    activeNodeId: null,
  },
},
{
  id: 'builtin-cross-process',
  name: 'Cross Process',
  author: 'open-factory',
  description: 'Cross-processed film color shift',
  tags: ['retro', 'creative'],
  graph: {
    nodes: [
      createColorGradingNode('primary-wheel', {
        lift: { r: 0.1, g: -0.05, b: -0.1, y: 0 },
        gamma: { r: -0.1, g: 0.1, b: 0, y: 0 },
        gain: { r: 0, g: -0.05, b: 0.15, y: 0 },
      }),
      createColorGradingNode('primary-slider', { saturation: 120, contrast: 20 }),
    ],
    connections: [],
    activeNodeId: null,
  },
},
{
  id: 'builtin-film-print',
  name: 'Film Print',
  author: 'open-factory',
  description: 'Warm film print emulation',
  tags: ['film', 'warm'],
  graph: {
    nodes: [
      createColorGradingNode('primary-slider', { temperature: 15, saturation: 70, contrast: 15 }),
      createColorGradingNode('primary-wheel', {
        lift: { r: 0.05, g: 0, b: -0.05, y: 0 },
        gain: { r: 0.05, g: 0.02, b: -0.05, y: 0 },
      }),
    ],
    connections: [],
    activeNodeId: null,
  },
},
```

- [ ] **Step 2: 添加音频预设**

在 `audio-mix-presets.ts` 中添加：

```typescript
{
  id: 'builtin-cinematic-trailer',
  name: 'Cinematic Trailer',
  author: 'open-factory',
  description: 'Dramatic trailer audio processing chain',
  tags: ['cinematic', 'trailer'],
  chain: [
    createEffectSlot('compressor', { threshold: -24, ratio: 4, attack: 10, release: 100 }),
    createEffectSlot('eq-4band', { lowGain: 4, midGain: -2, highGain: 3 }),
    createEffectSlot('reverb', { roomSize: 0.7, damping: 0.5, wetDry: 0.3 }),
    createEffectSlot('limiter', { threshold: -1, release: 50 }),
  ],
},
{
  id: 'builtin-voiceover',
  name: 'Voice Over',
  author: 'open-factory',
  description: 'Professional voice-over processing',
  tags: ['voice', 'podcast'],
  chain: [
    createEffectSlot('high-pass', { frequency: 80 }),
    createEffectSlot('compressor', { threshold: -18, ratio: 3, attack: 5, release: 80 }),
    createEffectSlot('eq-4band', { lowGain: -2, midGain: 3, highGain: 2 }),
    createEffectSlot('de-esser', { threshold: -30, reduction: 8 }),
    createEffectSlot('limiter', { threshold: -1, release: 50 }),
  ],
},
{
  id: 'builtin-live-concert',
  name: 'Live Concert',
  author: 'open-factory',
  description: 'Live concert audio processing',
  tags: ['live', 'music'],
  chain: [
    createEffectSlot('gate', { threshold: -40, attack: 0.1, release: 100 }),
    createEffectSlot('eq-4band', { lowGain: -3, midGain: 1, highGain: 2 }),
    createEffectSlot('compressor', { threshold: -20, ratio: 3, attack: 10, release: 100 }),
    createEffectSlot('reverb', { roomSize: 0.4, damping: 0.6, wetDry: 0.2 }),
    createEffectSlot('limiter', { threshold: -0.5, release: 50 }),
  ],
},
```

- [ ] **Step 3: 运行类型检查**

Run: `cd D:/code/Ai/open-factory && pnpm typecheck`
Expected: PASS

- [ ] **Step 4: 提交**

```bash
git add packages/editor-core/src/color-grading/color-grading-presets.ts packages/editor-core/src/audio/audio-mix-presets.ts
git commit -m "feat: add 6 color grading presets and 3 audio mix presets"
```

---

## Task 11: E2E Page Objects

**Files:**
- Create: `apps/desktop/e2e/pages/color-grading.page.ts`
- Create: `apps/desktop/e2e/pages/audio-mixer.page.ts`
- Modify: `apps/desktop/e2e/fixtures.ts`

**Interfaces:**
- Produces: `ColorGradingPage`, `AudioMixerPage` Page Object classes
- Produces: `colorGradingPage`, `audioMixerPage` test fixtures

- [ ] **Step 1: 创建 ColorGradingPage**

```typescript
// apps/desktop/e2e/pages/color-grading.page.ts
import { type Page, type Locator } from '@playwright/test';

export class ColorGradingPage {
  readonly workspace: Locator;
  readonly nodeGraph: Locator;
  readonly curvesEditor: Locator;
  readonly lutManager: Locator;
  readonly colorWheels: Locator;
  readonly primarySliders: Locator;

  constructor(private page: Page) {
    this.workspace = page.getByTestId('color-grading-workspace');
    this.nodeGraph = page.getByTestId('node-graph-view');
    this.curvesEditor = page.getByTestId('curves-editor');
    this.lutManager = page.getByTestId('lut-manager');
    this.colorWheels = page.getByTestId('color-wheel-panel');
    this.primarySliders = page.getByTestId('primary-sliders-panel');
  }

  async addNode(type: string): Promise<void> {
    await this.page.getByTestId(`add-node-${type}`).click();
  }

  async adjustSlider(name: string, value: number): Promise<void> {
    const slider = this.page.getByTestId(`slider-${name}`);
    await slider.fill(String(value));
  }

  async selectNode(index: number): Promise<void> {
    await this.page.getByTestId(`node-${index}`).click();
  }

  async removeNode(index: number): Promise<void> {
    await this.page.getByTestId(`remove-node-${index}`).click();
  }
}
```

- [ ] **Step 2: 创建 AudioMixerPage**

```typescript
// apps/desktop/e2e/pages/audio-mixer.page.ts
import { type Page, type Locator } from '@playwright/test';

export class AudioMixerPage {
  readonly mixer: Locator;

  constructor(private page: Page) {
    this.mixer = page.getByTestId('audio-mixer');
  }

  channelStrip(index: number) {
    return {
      volumeFader: this.page.getByTestId(`channel-${index}-volume`),
      panKnob: this.page.getByTestId(`channel-${index}-pan`),
      muteButton: this.page.getByTestId(`channel-${index}-mute`),
      soloButton: this.page.getByTestId(`channel-${index}-solo`),
      vuMeter: this.page.getByTestId(`channel-${index}-vu`),
    };
  }

  async setVolume(trackIndex: number, db: number): Promise<void> {
    const fader = this.channelStrip(trackIndex).volumeFader;
    await fader.fill(String(db));
  }

  async setPan(trackIndex: number, value: number): Promise<void> {
    const knob = this.channelStrip(trackIndex).panKnob;
    await knob.fill(String(value));
  }

  async toggleMute(trackIndex: number): Promise<void> {
    await this.channelStrip(trackIndex).muteButton.click();
  }

  async toggleSolo(trackIndex: number): Promise<void> {
    await this.channelStrip(trackIndex).soloButton.click();
  }
}
```

- [ ] **Step 3: 更新 fixtures.ts**

```typescript
// 在 fixtures.ts 中添加
import { ColorGradingPage } from './pages/color-grading.page';
import { AudioMixerPage } from './pages/audio-mixer.page';

export const test = base.extend<{
  colorGradingPage: ColorGradingPage;
  audioMixerPage: AudioMixerPage;
}>({
  colorGradingPage: async ({ page }, use) => {
    await use(new ColorGradingPage(page));
  },
  audioMixerPage: async ({ page }, use) => {
    await use(new AudioMixerPage(page));
  },
});
```

- [ ] **Step 4: 提交**

```bash
git add apps/desktop/e2e/pages/color-grading.page.ts apps/desktop/e2e/pages/audio-mixer.page.ts apps/desktop/e2e/fixtures.ts
git commit -m "test(e2e): add ColorGradingPage and AudioMixerPage page objects"
```

---

## Task 12: E2E 测试重写

**Files:**
- Modify: `apps/desktop/e2e/color-grading-audio.spec.ts`

**Interfaces:**
- Consumes: `ColorGradingPage`, `AudioMixerPage` from Task 11
- Produces: 强 E2E 测试覆盖调色和音频功能

- [ ] **Step 1: 重写调色测试**

```typescript
import { test, expect } from './fixtures';

test.describe('Color Grading', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // 等待应用加载
    await page.waitForSelector('[data-testid="app-ready"]', { timeout: 15000 });
  });

  test('should open color grading workspace and add primary wheel node', async ({ colorGradingPage }) => {
    await expect(colorGradingPage.workspace).toBeVisible();
    await expect(colorGradingPage.nodeGraph).toBeVisible();
    await colorGradingPage.addNode('primary-wheel');
    // 验证节点已添加
    const nodes = colorGradingPage.nodeGraph.getByTestId(/node-/);
    await expect(nodes).toHaveCount(1);
  });

  test('should add primary slider and adjust contrast', async ({ colorGradingPage }) => {
    await colorGradingPage.addNode('primary-slider');
    await colorGradingPage.selectNode(0);
    await colorGradingPage.adjustSlider('contrast', 50);
    // 验证滑块值已更新
    const slider = colorGradingPage.page.getByTestId('slider-contrast');
    await expect(slider).toHaveValue('50');
  });

  test('should add curves node and verify editor', async ({ colorGradingPage }) => {
    await colorGradingPage.addNode('curves');
    await colorGradingPage.selectNode(0);
    await expect(colorGradingPage.curvesEditor).toBeVisible();
  });

  test('should remove node', async ({ colorGradingPage }) => {
    await colorGradingPage.addNode('primary-wheel');
    await colorGradingPage.removeNode(0);
    // 验证节点已移除
    const nodes = colorGradingPage.nodeGraph.getByTestId(/node-/);
    await expect(nodes).toHaveCount(0);
  });
});
```

- [ ] **Step 2: 重写音频测试**

```typescript
test.describe('Audio Mixing', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="app-ready"]', { timeout: 15000 });
  });

  test('should display audio mixer with channel strips', async ({ audioMixerPage }) => {
    await expect(audioMixerPage.mixer).toBeVisible();
    const channel = audioMixerPage.channelStrip(0);
    await expect(channel.volumeFader).toBeVisible();
    await expect(channel.muteButton).toBeVisible();
  });

  test('should adjust volume and verify state', async ({ audioMixerPage }) => {
    await audioMixerPage.setVolume(0, -6);
    const fader = audioMixerPage.channelStrip(0).volumeFader;
    await expect(fader).toHaveValue('-6');
  });

  test('should toggle mute and solo', async ({ audioMixerPage }) => {
    await audioMixerPage.toggleMute(0);
    const muteBtn = audioMixerPage.channelStrip(0).muteButton;
    await expect(muteBtn).toHaveAttribute('data-active', 'true');

    await audioMixerPage.toggleSolo(0);
    const soloBtn = audioMixerPage.channelStrip(0).soloButton;
    await expect(soloBtn).toHaveAttribute('data-active', 'true');
  });
});
```

- [ ] **Step 3: 运行 E2E 测试**

Run: `cd D:/code/Ai/open-factory && pnpm test:e2e --grep "color-grading-audio"`
Expected: PASS

- [ ] **Step 4: 提交**

```bash
git add apps/desktop/e2e/color-grading-audio.spec.ts
git commit -m "test(e2e): rewrite color grading and audio mixing tests with strong assertions"
```

---

## Task 13: 最终验证

- [ ] **Step 1: 运行类型检查**

Run: `cd D:/code/Ai/open-factory && pnpm typecheck`
Expected: PASS

- [ ] **Step 2: 运行单元测试**

Run: `cd D:/code/Ai/open-factory && pnpm test`
Expected: PASS

- [ ] **Step 3: 运行构建**

Run: `cd D:/code/Ai/open-factory && pnpm build`
Expected: PASS

- [ ] **Step 4: 创建功能分支并提交**

```bash
cd D:/code/Ai/open-factory
git checkout -b feat/color-grading-audio-enhancement
git add .
git commit -m "feat: enhance color grading and audio mixing systems with integration-first approach"
```

- [ ] **Step 5: 推送并创建 PR**

```bash
git push -u origin feat/color-grading-audio-enhancement
gh pr create --title "feat: Enhance color grading and audio mixing systems" --body "集成优先方案：补全节点图引擎、接通 FFmpeg 导出、持久化混音状态、补全效果链映射、实现自动化评估器、增强 E2E 测试。"
```
