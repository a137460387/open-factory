# 调色与音频混音系统增强 — 集成优先设计文档

> **日期**：2026-07-12（修订）
> **方案**：集成优先 — 连接已有但断开的代码，补全缺失节点和效果映射
> **范围**：补全节点图引擎、接通 FFmpeg 导出、持久化混音状态、集成效果链、增强 E2E 测试

---

## 1. 概述

### 1.1 背景

项目已有完整的调色和音频混音系统（PR #47-#50），但存在关键缺口：
- 节点图引擎只处理 4/10 种节点类型
- `colorGradingGraph` 未接入 FFmpeg 导出管线
- `MixerState` 无持久化路径
- 音频效果链未连接到预览渲染和导出
- 自动化曲线是死代码
- E2E 测试覆盖薄弱

### 1.2 目标

以最小改动量连接已有代码，使现有功能真正可用：

1. **调色节点图**：补全 6 种缺失节点类型，接通 FFmpeg 导出
2. **音频混音**：持久化 MixerState，连接效果链到预览和导出
3. **自动化**：实现曲线评估，连接到播放和导出
4. **测试**：强化 E2E 测试，添加 Page Objects

### 1.3 设计原则

1. **复用优先**：优先使用已有的 `color-curves.ts`、`lut.ts`、`effect-chain.ts` 等模块
2. **命令模式**：所有状态变更通过 Command 对象，支持撤销/重做
3. **向后兼容**：新系统与现有 `colorCorrection` 共存，渐进迁移
4. **双渲染路径**：预览用 WebGL + Web Audio，导出用 FFmpeg

---

## 2. 调色节点图引擎增强

### 2.1 问题分析

`NodeGraphEngine.executeNode()`（node-graph-engine.ts:107-122）只处理 4 种节点：
- `primary-wheel` ✅
- `primary-slider` ✅
- `hsl-qualifier` ✅
- `window-mask` ✅
- `curves` ❌ 空操作
- `lut-apply` ❌ 空操作
- `tracking-mask` ❌ 空操作
- `color-space` ❌ 空操作
- `mixer-node` ❌ 空操作
- `output` ❌ 空操作

### 2.2 新增节点实现

#### 2.2.1 曲线节点（`curves`）

复用 `color-grading/color-curves.ts` 的 `sampleColorCurves()`。

**参数类型**（types.ts 新增）：
```typescript
interface CurvesNodeParams {
  master: CurvePoint[];
  red: CurvePoint[];
  green: CurvePoint[];
  blue: CurvePoint[];
}
```

**GLSL 实现**：生成 256x1 查找纹理，使用 `sampler2D` 采样。
```glsl
uniform sampler2D u_curvesLUT_{nodeId};
vec4 applyCurves_{nodeId}(vec4 color) {
  float r = texture2D(u_curvesLUT_{nodeId}, vec2(color.r, 0.5)).r;
  float g = texture2D(u_curvesLUT_{nodeId}, vec2(color.g, 0.5)).g;
  float b = texture2D(u_curvesLUT_{nodeId}, vec2(color.b, 0.5)).b;
  return vec4(r, g, b, color.a);
}
```

**FFmpeg 映射**：`curves=r='0/0 0.5/0.6 1/1':g='...':b='...'`

#### 2.2.2 LUT 应用节点（`lut-apply`）

复用 `color-grading/lut.ts` 的 `LUTData` 和 `lut-parser.ts`。

**参数类型**（types.ts 新增）：
```typescript
interface LUTApplyNodeParams {
  lutId: string;
  intensity: number;  // 0-1
}
```

**GLSL 实现**：使用 `sampler3D` 纹理查找 + `mix()` 混合。
```glsl
uniform sampler3D u_lut3D_{nodeId};
uniform float u_lutIntensity_{nodeId};
vec4 applyLUT_{nodeId}(vec4 color) {
  vec3 lutColor = texture3D(u_lut3D_{nodeId}, color.rgb).rgb;
  return vec4(mix(color.rgb, lutColor, u_lutIntensity_{nodeId}), color.a);
}
```

**FFmpeg 映射**：`lut3d=file='path.cube':interp=tetrahedral`

#### 2.2.3 跟踪遮罩节点（`tracking-mask`）

参数类型已有定义。GLSL 实现基于跟踪点生成贝塞尔遮罩，与 `window-mask` 类似。
FFmpeg 不支持（仅预览）。

#### 2.2.4 辅助节点

- `output`：标记图终点，不生成着色器代码
- `color-space`：记录输入/输出色彩空间元数据
- `mixer-node`：混合多个输入的 alpha 通道

### 2.3 Shader 编译器更新

`node-shader-compiler.ts` 的 `compileColorGradingShader()` 需要：
- 为 `curves` 节点生成 256x1 纹理 uniform 声明
- 为 `lut-apply` 节点生成 `sampler3D` uniform 声明
- 修复多 HSL 限定器节点共享 GLSL 函数定义的问题

### 2.4 修改文件清单

| 文件 | 改动 |
|------|------|
| `color-grading/types.ts` | 添加 `CurvesNodeParams`、`LUTApplyNodeParams`、`TrackingMaskNodeParams`；更新 `createColorGradingNode()` 和 `normalizeColorNode()` |
| `color-grading/node-graph-engine.ts` | 添加 curves/lut-apply/tracking-mask/output 执行器 |
| `lib/color-grading/node-shader-compiler.ts` | 添加曲线纹理和 LUT 3D 纹理的 GLSL 代码生成；修复多 HSL 节点问题 |
| `color-grading/color-grading-presets.ts` | 添加 6+ 内置预设展示新节点类型 |

---

## 3. 调色 FFmpeg 导出集成

### 3.1 问题分析

- `ExportClip` 类型缺少 `colorGradingGraph` 字段
- `buildExportTimeline()` 不传递该字段
- `buildColorGradingFilters()` 是死代码（已导出但从未调用）

### 3.2 设计

#### 3.2.1 扩展 ExportClip

```typescript
// export/export-types.ts
interface ExportClip {
  // ... existing fields ...
  colorGradingGraph?: ColorGradingGraph;  // 新增
}
```

#### 3.2.2 传递数据

```typescript
// ffmpeg-builder.ts - buildExportTimeline()
const exportClip: ExportClip = {
  // ... existing mappings ...
  colorGradingGraph: clip.colorGradingGraph,  // 新增
};
```

#### 3.2.3 激活导出过滤器

在 `buildVideoFilters()` 中，优先级链：
```
1. colorGradingGraph（最高优先级 - 新节点图系统）
2. colorNodeGraph（旧节点图系统）
3. colorCorrection（传统调色）
```

如果 `colorGradingGraph` 存在且非空，调用 `buildColorGradingFilters()`；否则回退到现有逻辑。

#### 3.2.4 补全 buildColorGradingFilters

当前只处理 5 种节点类型，需补全：
- `curves` → `curves=r='...':g='...':b='...'`
- `lut-apply` → `lut3d=file=path`
- `tracking-mask` → 跳过（仅预览）
- `output`/`color-space`/`mixer-node` → 元数据，不生成过滤器

### 3.3 修改文件清单

| 文件 | 改动 |
|------|------|
| `export/export-types.ts` | 添加 `colorGradingGraph` 字段 |
| `export/ffmpeg-builder.ts` | 传递字段 + 激活 `buildColorGradingFilters` + 补全节点类型 |
| `export/ffmpeg-builder.test.ts` | 添加 colorGradingGraph 导出测试 |

---

## 4. 音频混音状态持久化

### 4.1 问题分析

`MixerState`（包含效果链、总线路由、自动化）定义在 `mixer-types.ts`，但 `Project` 模型上没有 `mixerState` 属性，数据无法保存到项目文件。

### 4.2 设计

#### 4.2.1 Project 模型扩展

```typescript
// model-types.ts
interface Project {
  // ... existing fields ...
  mixerState?: MixerState;  // 新增
}
```

#### 4.2.2 模型规范化

```typescript
// model.ts
function normalizeMixerState(raw: any): MixerState | undefined {
  if (!raw) return undefined;
  return {
    channels: (raw.channels ?? []).map(normalizeMixerChannel),
    buses: (raw.buses ?? []).map(normalizeBus),
    masterBus: normalizeBus(raw.masterBus),
  };
}
```

#### 4.2.3 项目迁移

```typescript
// project-migration.ts
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

#### 4.2.4 UI 连接

`AudioMixer.tsx` 需要：
- 从 `project.mixerState` 读取初始状态
- 通过 `UpdateProjectCommand` 保存变更（支持撤销/重做）
- 移除本地状态管理，改用 project 状态

### 4.3 修改文件清单

| 文件 | 改动 |
|------|------|
| `model-types.ts` | 添加 `mixerState?: MixerState` |
| `model.ts` | 添加 `normalizeMixerState()` |
| `project-migration.ts` | v6→v7 迁移 |
| `project-migration.test.ts` | 迁移测试 |
| `AudioMixer.tsx` | 连接到 project.mixerState |

---

## 5. 音频效果链集成

### 5.1 问题分析

- 预览只支持 4/20 种效果（音量/声像/EQ/压缩器）
- 导出不使用效果链（`buildAudioEffectChainFilters` 是死代码）
- 11/20 种效果类型生成 `anull` 空操作

### 5.2 补全 FFmpeg 效果映射

在 `EffectChainEngine.effectToFfmpeg()` 中补全：

| 效果类型 | FFmpeg 过滤器 | 参数 |
|----------|--------------|------|
| `eq-8band` | 8x `equalizer` | f=Hz:width_type=h:width=W:g=G |
| `expander` | `acompressor` | ratio < 1 实现扩展 |
| `chorus` | `chorus` | inGain:outGain:delays:decays:speeds:depths |
| `flanger` | `flanger` | delay:depth:regen:speed |
| `distortion` | `aeval` | clip 函数实现削波 |
| `de-esser` | `equalizer` + `acompressor` | 频段压缩 |
| `noise-reduction` | `afftdn` | nf=降噪量 |
| `pitch-shift` | `asetrate` + `aresample` | 比率 = 2^(semitones/12) |
| `stereo-widener` | `stereotools` | mlev:slev |
| `mid-side` | `stereotools` | mode=ms |
| `phase-invert` | `aeval` | -val(0) |

### 5.3 预览渲染器扩展

在 `PreviewAudioRenderer.getAudioNode()` 中添加效果链节点：

```typescript
private createEffectChainNodes(
  effects: AudioEffectSlot[],
  context: AudioContext
): AudioNode[] {
  const nodes: AudioNode[] = [];
  const sorted = effects
    .filter(e => e.enabled)
    .sort((a, b) => a.order - b.order);

  for (const effect of sorted) {
    switch (effect.effectType) {
      case 'reverb':
        // ConvolverNode + 生成简单脉冲响应
        break;
      case 'delay':
        // DelayNode + FeedbackGainNode
        break;
      case 'high-pass':
      case 'low-pass':
        // BiquadFilterNode
        break;
      case 'gain':
        // GainNode
        break;
      // 其他效果在预览中跳过，导出时生效
    }
  }
  return nodes;
}
```

优先实现高频效果（reverb、delay、high-pass、low-pass、gain），其余在预览中跳过但在导出中生效。

### 5.4 导出集成

```typescript
// ffmpeg-builder.ts - buildAudioFilters()
function buildAudioFilters(clip: ExportClip): string[] {
  const filters: string[] = [];

  // 现有：基本音量/声像/EQ/压缩器
  filters.push(...buildBasicAudioFilters(clip));

  // 新增：效果链
  if (clip.effectsChain?.length) {
    const chainEngine = new EffectChainEngine();
    const chainFilters = chainEngine.toFfmpegFilters(clip.effectsChain);
    filters.push(...chainFilters.map(f => buildFfmpegFilterString(f)));
  }

  return filters;
}
```

### 5.5 修改文件清单

| 文件 | 改动 |
|------|------|
| `audio/effect-chain.ts` | 补全 11 种效果的 FFmpeg 映射 + 参数范围 |
| `lib/preview/audio-renderer.ts` | 添加效果链 Web Audio 节点创建 |
| `export/ffmpeg-builder.ts` | 在 `buildAudioFilters` 中调用效果链 |
| `export/export-types.ts` | 添加 `effectsChain` 字段到 ExportClip |
| `audio/effect-chain.test.ts` | 补全 11 种效果的测试 |

---

## 6. 自动化曲线集成

### 6.1 问题分析

`AutomationCurve` 和 `ChannelAutomation` 类型已定义但从未被评估。`AutomationEditor` 组件是死代码。

### 6.2 设计

#### 6.2.1 自动化曲线评估器

新文件 `audio/automation-evaluator.ts`：

```typescript
interface AutomationEvaluationResult {
  volume: number;    // dB
  pan: number;       // -1 to 1
  effectParams: Record<string, number>;
}

function evaluateAutomation(
  automation: ChannelAutomation,
  timeSeconds: number
): AutomationEvaluationResult;

function evaluateCurve(
  points: AutomationPoint[],
  time: number,
  curveType: 'linear' | 'bezier' | 'step' | 'smooth'
): number;
```

插值算法：
- `linear`：线性插值
- `bezier`：贝塞尔曲线（使用 handleIn/handleOut）
- `step`：阶跃（取前一个点的值）
- `smooth`：Catmull-Rom 样条

#### 6.2.2 预览集成

```typescript
// audio-renderer.ts - syncClipAudio()
const automation = mixerState?.channels
  ?.find(c => c.trackId === track.id)?.automation;
if (automation) {
  const auto = evaluateAutomation(automation, currentTimeSeconds);
  gainNode.gain.value *= dbToLinear(auto.volume);
  pannerNode.pan.value = clamp(
    pannerNode.pan.value + auto.pan, -1, 1
  );
}
```

#### 6.2.3 导出集成

自动化曲线转换为 FFmpeg `volume` 关键帧表达式：
```typescript
function buildAutomationKeyframes(
  automation: ChannelAutomation,
  duration: number
): string {
  // 采样自动化曲线，生成 volume='if(between(t,0,1), -6, 0)' 表达式
}
```

### 6.3 修改文件清单

| 文件 | 改动 |
|------|------|
| `audio/automation-evaluator.ts` | 新建：曲线评估逻辑 |
| `audio/automation-evaluator.test.ts` | 新建：评估器测试 |
| `lib/preview/audio-renderer.ts` | 在 syncClipAudio 中调用评估器 |
| `export/ffmpeg-builder.ts` | 自动化曲线转 FFmpeg 关键帧 |

---

## 7. E2E 测试增强

### 7.1 问题分析

- 音频 E2E 测试仅是条件可见性检查（`if (await ...isVisible())`）
- 调色测试只覆盖 Lift 色轮，无曲线/HSL/LUT 节点测试
- 无 Page Object，测试使用散落的 `page.getByTestId()`

### 7.2 新增 Page Objects

```typescript
// e2e/pages/color-grading.page.ts
class ColorGradingPage {
  readonly workspace: Locator;
  readonly nodeGraph: Locator;
  readonly curvesEditor: Locator;
  readonly lutManager: Locator;

  async addNode(type: string): Promise<void>;
  async adjustSlider(name: string, value: number): Promise<void>;
  async selectNode(index: number): Promise<void>;
  async removeNode(index: number): Promise<void>;
}

// e2e/pages/audio-mixer.page.ts
class AudioMixerPage {
  readonly mixer: Locator;
  channelStrip(index: number): ChannelStripLocators;

  async setVolume(trackIndex: number, db: number): Promise<void>;
  async setPan(trackIndex: number, value: number): Promise<void>;
  async toggleMute(trackIndex: number): Promise<void>;
  async toggleSolo(trackIndex: number): Promise<void>;
}
```

### 7.3 更新 fixtures.ts

```typescript
export const test = base.extend<{
  colorGradingPage: ColorGradingPage;
  audioMixerPage: AudioMixerPage;
}>({ ... });
```

### 7.4 增强测试用例

**调色测试（移除条件守卫，添加真实交互）：**
- 曲线节点：添加 → 编辑 RGB 曲线 → 验证预览更新
- LUT 节点：添加 → 选择 LUT → 验证应用
- HSL 限定器：添加 → 选择色相范围 → 验证隔离效果
- 导出验证：应用调色图 → 导出 → 验证 FFmpeg 参数

**音频测试（移除条件守卫，添加真实交互）：**
- 音量调整：拖动滑块到 -6dB → 验证状态更新
- 静音/独奏：切换 → 验证状态
- EQ 调整：修改频段 → 导出 → 验证 `equalizer` 过滤器
- 效果链：添加压缩器 → 导出 → 验证 `acompressor` 过滤器

### 7.5 修改文件清单

| 文件 | 改动 |
|------|------|
| `e2e/pages/color-grading.page.ts` | 新建 Page Object |
| `e2e/pages/audio-mixer.page.ts` | 新建 Page Object |
| `e2e/fixtures.ts` | 添加新 fixtures |
| `e2e/color-grading-audio.spec.ts` | 重写为强测试 |

---

## 8. 内置预设扩展

### 8.1 调色预设

当前仅 2 个内置预设（Cinematic、Vintage）。新增：

| 预设名 | 节点组合 | 效果 |
|--------|---------|------|
| Teal & Orange | wheel + slider + hsl-qualifier | 阴影偏青，高光偏橙 |
| Bleach Bypass | slider + curves | 低饱和度，高对比度 |
| Day for Night | wheel + slider + window-mask | 整体压暗，蓝色偏移 |
| Black & White | slider + curves | 去饱和，调对比度 |
| Cross Process | wheel + slider + curves | 跨冲洗色彩偏移 |
| Film Print | slider + lut-apply | 胶片打印模拟 |

### 8.2 音频预设

当前仅 2 个内置预设（Podcast、Music）。新增：

| 预设名 | 效果链 | 用途 |
|--------|--------|------|
| Cinematic Trailer | compressor + eq + reverb + limiter | 电影预告片 |
| Voice Over | high-pass + compressor + eq + de-esser + limiter | 旁白配音 |
| Live Concert | gate + eq + compressor + reverb + limiter | 现场音乐会 |

### 8.3 修改文件清单

| 文件 | 改动 |
|------|------|
| `color-grading/color-grading-presets.ts` | 添加 6 个内置预设 |
| `audio/audio-mix-presets.ts` | 添加 3 个内置预设 |

---

## 9. 完整修改文件清单

### editor-core（纯逻辑层）

| 文件 | 改动类型 | 描述 |
|------|---------|------|
| `color-grading/types.ts` | 修改 | 添加 CurvesNodeParams、LUTApplyNodeParams、TrackingMaskNodeParams |
| `color-grading/node-graph-engine.ts` | 修改 | 补全 6 种节点执行器 |
| `color-grading/color-grading-presets.ts` | 修改 | 添加 6 个内置预设 |
| `audio/effect-chain.ts` | 修改 | 补全 11 种效果的 FFmpeg 映射 |
| `audio/automation-evaluator.ts` | **新建** | 自动化曲线评估器 |
| `audio/audio-mix-presets.ts` | 修改 | 添加 3 个内置预设 |
| `model-types.ts` | 修改 | 添加 mixerState 字段 |
| `model.ts` | 修改 | 添加 normalizeMixerState |
| `project-migration.ts` | 修改 | v6→v7 迁移 |
| `export/export-types.ts` | 修改 | 添加 colorGradingGraph、effectsChain 字段 |
| `export/ffmpeg-builder.ts` | 修改 | 传递新字段 + 激活导出过滤器 |

### desktop（UI + 渲染层）

| 文件 | 改动类型 | 描述 |
|------|---------|------|
| `lib/color-grading/node-shader-compiler.ts` | 修改 | 补全曲线/LUT GLSL 生成 |
| `lib/preview/audio-renderer.ts` | 修改 | 添加效果链和自动化集成 |
| `components/AudioMixer/AudioMixer.tsx` | 修改 | 连接到 project.mixerState |
| `e2e/pages/color-grading.page.ts` | **新建** | Page Object |
| `e2e/pages/audio-mixer.page.ts` | **新建** | Page Object |
| `e2e/fixtures.ts` | 修改 | 添加新 fixtures |
| `e2e/color-grading-audio.spec.ts` | 修改 | 重写为强测试 |

### 测试文件

| 文件 | 改动类型 | 描述 |
|------|---------|------|
| `__tests__/color-grading/node-graph-engine.test.ts` | 修改 | 补全新节点类型测试 |
| `__tests__/audio/effect-chain.test.ts` | 修改 | 补全 11 种效果测试 |
| `__tests__/audio/automation-evaluator.test.ts` | **新建** | 评估器测试 |
| `__tests__/project-migration.test.ts` | 修改 | v6→v7 迁移测试 |
| `__tests__/export/ffmpeg-builder.test.ts` | 修改 | colorGradingGraph 导出测试 |

---

## 10. 实现顺序

1. **调色节点图引擎** → types.ts + node-graph-engine.ts + node-shader-compiler.ts
2. **调色 FFmpeg 导出** → export-types.ts + ffmpeg-builder.ts
3. **音频状态持久化** → model-types.ts + model.ts + project-migration.ts
4. **音频效果链** → effect-chain.ts + audio-renderer.ts + ffmpeg-builder.ts
5. **自动化曲线** → automation-evaluator.ts + audio-renderer.ts + ffmpeg-builder.ts
6. **内置预设** → color-grading-presets.ts + audio-mix-presets.ts
7. **E2E 测试** → Page Objects + fixtures + 测试重写

---

## 11. 验收标准

### 调色系统
- [ ] 节点图引擎处理全部 10 种节点类型
- [ ] 曲线节点在预览中正确渲染
- [ ] LUT 节点在预览中正确应用
- [ ] `colorGradingGraph` 正确导出为 FFmpeg 过滤器
- [ ] 6+ 内置预设可加载和应用

### 音频系统
- [ ] MixerState 保存到项目文件并正确恢复
- [ ] 效果链连接到预览渲染（至少 reverb/delay/high-pass/low-pass/gain）
- [ ] 效果链正确导出为 FFmpeg 过滤器
- [ ] 11 种缺失效果类型不再生成 `anull`
- [ ] 自动化曲线在播放时正确评估
- [ ] 3+ 内置音频预设可加载

### 测试
- [ ] E2E 测试移除所有条件守卫
- [ ] Page Objects 覆盖调色和音频混音
- [ ] 所有新代码有单元测试覆盖
- [ ] `pnpm typecheck` 无报错
- [ ] `pnpm test` 全部通过
