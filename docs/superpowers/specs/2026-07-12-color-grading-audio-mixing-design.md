# 高级调色与音频混音系统 — 架构设计文档

> **日期**：2026-07-12
> **方案**：混合架构 — 节点图调色 + 线性效果链音频 + 共享抽象层
> **范围**：DaVinci Resolve 级别调色UI + 专业音频混音系统

---

## 1. 概述

### 1.1 目标

为 open-factory 视频编辑器添加专业级调色和音频混音能力：

- **调色系统**：一级调色（色轮/滑块）、二级调色（HSL限定器/窗口遮罩/跟踪遮罩）、LUT管理、节点图流程、示波器
- **音频系统**：多轨混音器控制台、音频效果链（20+效果类型）、参数自动化曲线、总线路由系统

### 1.2 现有能力

项目已有以下基础：
- `ColorCorrection` 类型：亮度、对比度、饱和度、色调、LUT图层、色彩曲线、三路色轮
- 音频处理：音量、声像、4频段EQ、压缩器、空间音频(HRTF)、淡入淡出、变调
- 效果系统：模糊、锐化、暗角、胶片颗粒、色差、运动模糊、自定义着色器
- WebGL 渲染管线：完整 GLSL 着色器，支持所有效果
- FFmpeg 导出管线：所有效果和音频处理的完整滤镜链
- 效果预设系统：`.ofeffect.json` 格式

### 1.3 设计原则

1. **数据模型在 `editor-core`**：类型定义、序列化逻辑不依赖 DOM
2. **UI组件在 `desktop`**：React 组件、WebGL 渲染、Web Audio
3. **命令模式**：所有状态变更通过 Command 对象，支持撤销/重做
4. **双渲染路径**：预览用 WebGL + Web Audio，导出用 FFmpeg
5. **向后兼容**：新系统与现有 `ColorCorrection` 共存，渐进迁移

---

## 2. 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                    共享抽象层 (Shared Layer)                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │ 参数管理  │  │ 预设系统  │  │ 自动化引擎│  │ 序列化   │    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────────┐  ┌──────────────────────────┐    │
│  │   调色系统 (Color)    │  │   音频系统 (Audio)        │    │
│  │  ┌─────────────────┐ │  │  ┌──────────────────┐    │    │
│  │  │  节点图引擎       │ │  │  │  效果链引擎       │    │    │
│  │  │  NodeGraphEngine │ │  │  │  EffectChainEngine│    │    │
│  │  └─────────────────┘ │  │  └──────────────────┘    │    │
│  │  ┌─────────────────┐ │  │  ┌──────────────────┐    │    │
│  │  │  一级调色节点     │ │  │  │  混音器控制台     │    │    │
│  │  │  ColorWheels     │ │  │  │  MixerConsole    │    │    │
│  │  └─────────────────┘ │  │  └──────────────────┘    │    │
│  │  ┌─────────────────┐ │  │  ┌──────────────────┐    │    │
│  │  │  二级调色节点     │ │  │  │  效果链面板       │    │    │
│  │  │  HSLQualifier   │ │  │  │  EffectsRack     │    │    │
│  │  └─────────────────┘ │  │  └──────────────────┘    │    │
│  │  ┌─────────────────┐ │  │  ┌──────────────────┐    │    │
│  │  │  LUT管理器       │ │  │  │  总线路由         │    │    │
│  │  │  LUTManager     │ │  │  │  BusRouter       │    │    │
│  │  └─────────────────┘ │  │  └──────────────────┘    │    │
│  │  ┌─────────────────┐ │  │  ┌──────────────────┐    │    │
│  │  │  示波器          │ │  │  │  自动化曲线编辑器  │    │    │
│  │  │  Scopes         │ │  │  │  AutomationEditor│    │    │
│  │  └─────────────────┘ │  │  └──────────────────┘    │    │
│  └──────────────────────┘  └──────────────────────────┘    │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                    渲染后端 (Render Backends)                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                  │
│  │  WebGL   │  │  FFmpeg  │  │ Web Audio│                  │
│  │ (预览)   │  │ (导出)   │  │ (预览)   │                  │
│  └──────────┘  └──────────┘  └──────────┘                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. 调色系统

### 3.1 节点图引擎

#### 3.1.1 节点类型定义

```typescript
// packages/editor-core/src/color-grading/types.ts

/** 调色节点类型 */
type ColorNodeType =
  | 'primary-wheel'      // 一级色轮（Lift/Gamma/Gain）
  | 'primary-slider'     // 一级滑块（亮度/对比度/饱和度/色温/色调）
  | 'curves'             // RGB/色相/亮度曲线
  | 'hsl-qualifier'      // HSL限定器（二级调色）
  | 'window-mask'        // 窗口遮罩（圆形/线性渐变/多边形）
  | 'tracking-mask'      // 跟踪遮罩
  | 'lut-apply'          // LUT应用节点
  | 'color-space'        // 色彩空间转换
  | 'mixer-node'         // 节点混合（串联/并联）
  | 'output';            // 输出节点

/** 调色节点 */
interface ColorNode {
  id: string;
  type: ColorNodeType;
  enabled: boolean;
  params: ColorNodeParams;
  inputs: string[];        // 连接的上游节点ID
  output: string | null;   // 连接的下游节点ID
  position: { x: number; y: number };  // 节点图中的位置
}

/** 节点图 */
interface ColorGradingGraph {
  nodes: ColorNode[];
  connections: ColorConnection[];
  activeNodeId: string | null;
}

/** 节点连接 */
interface ColorConnection {
  id: string;
  fromNodeId: string;
  fromOutput: string;
  toNodeId: string;
  toInput: string;
}
```

#### 3.1.2 数据模型集成

```typescript
interface BaseClip {
  // ... 现有字段保持不变
  colorCorrection: ColorCorrection;     // 保持向后兼容
  colorGradingGraph?: ColorGradingGraph; // 新增：节点图调色
}
```

**兼容策略**：如果 `colorGradingGraph` 存在且非空，优先使用节点图渲染；否则回退到现有 `colorCorrection`。

### 3.2 一级调色

#### 3.2.1 色轮参数（Primary Wheels）

```typescript
interface PrimaryWheelParams {
  // Lift（暗部）- 低亮度区域
  lift: { r: number; g: number; b: number; y: number };  // -1 ~ 1
  liftMaster: number;  // -1 ~ 1

  // Gamma（中间调）- 中亮度区域
  gamma: { r: number; g: number; b: number; y: number };
  gammaMaster: number;

  // Gain（高光）- 高亮度区域
  gain: { r: number; g: number; b: number; y: number };
  gainMaster: number;

  // Offset（整体偏移）
  offset: { r: number; g: number; b: number; y: number };
  offsetMaster: number;
}
```

#### 3.2.2 滑块参数（Primary Sliders）

```typescript
interface PrimarySliderParams {
  temperature: number;   // 色温 -100 ~ 100 (冷→暖)
  tint: number;          // 色调 -100 ~ 100 (绿→品红)
  contrast: number;      // 对比度 -100 ~ 100
  pivot: number;         // 对比度轴心 0 ~ 1
  saturation: number;    // 饱和度 0 ~ 200
  hue: number;           // 色相旋转 -180 ~ 180
}
```

### 3.3 曲线编辑器

```typescript
interface CurvesParams {
  // 主曲线
  master: CurvePoint[];
  // RGB通道
  red: CurvePoint[];
  green: CurvePoint[];
  blue: CurvePoint[];
  // HSL曲线
  hueVsHue: CurvePoint[];        // 色相→色相
  hueVsSaturation: CurvePoint[]; // 色相→饱和度
  hueVsLuminance: CurvePoint[];  // 色相→亮度
  satVsSaturation: CurvePoint[]; // 饱和度→饱和度
  lumVsSaturation: CurvePoint[]; // 亮度→饱和度
}

interface CurvePoint {
  x: number;  // 0 ~ 1
  y: number;  // 0 ~ 1
  handleIn?: { x: number; y: number };
  handleOut?: { x: number; y: number };
}
```

### 3.4 二级调色

#### 3.4.1 HSL限定器

```typescript
interface HSLQualifierParams {
  // 选中范围
  hueRange: { center: number; width: number; softness: number };     // 0-360
  saturationRange: { min: number; max: number; softness: number };   // 0-100
  luminanceRange: { min: number; max: number; softness: number };    // 0-100

  // 选中区域的调色调整
  adjustments: {
    hueShift: number;        // -180 ~ 180
    saturation: number;      // -100 ~ 100
    brightness: number;      // -100 ~ 100
    contrast: number;        // -100 ~ 100
    temperature: number;     // -100 ~ 100
    tint: number;            // -100 ~ 100
  };

  // 显示模式
  viewMode: 'final' | 'matte' | 'overlay';
  matteClean: number;  // 遮罩清理（去噪）0 ~ 100
}
```

#### 3.4.2 窗口遮罩

```typescript
interface WindowMaskParams {
  shape: 'circle' | 'linear-gradient' | 'polygon';

  circle?: {
    center: { x: number; y: number };   // 归一化坐标 0~1
    radius: number;
    softness: number;   // 边缘柔和度 0~1
    rotation: number;
  };

  linearGradient?: {
    startPoint: { x: number; y: number };
    endPoint: { x: number; y: number };
    softness: number;
  };

  polygon?: {
    points: { x: number; y: number }[];
    softness: number;
  };

  adjustments: HSLQualifierParams['adjustments'];
  invert: boolean;
  feather: number;  // 像素
}
```

#### 3.4.3 跟踪遮罩

```typescript
interface TrackingMaskParams {
  mask: WindowMaskParams;
  trackingData: TrackingKeyframe[];
  trackingMode: 'point' | 'area';
  searchArea: number;  // 搜索范围倍数
  confidence: number;  // 置信度阈值 0~1
}

interface TrackingKeyframe {
  time: number;
  position: { x: number; y: number };
  scale: number;
  rotation: number;
  confidence: number;
}
```

**跟踪算法**：基于特征点的光流跟踪（Lucas-Kanade），在 Web Worker 中运行。

### 3.5 LUT管理

#### 3.5.1 数据类型

```typescript
// packages/editor-core/src/color-grading/lut.ts

interface LUTData {
  size: number;         // 3D LUT 尺寸（如 17, 33, 65）
  domainMin: [number, number, number];
  domainMax: [number, number, number];
  data: Float32Array;   // RGB 值数组，size^3 * 3
}

interface LUTLayer {
  id: string;
  lutId: string;        // 引用 LUTLibrary 中的ID
  intensity: number;    // 0 ~ 1 混合强度
  enabled: boolean;
}

interface LUTLibraryEntry {
  id: string;
  name: string;
  filePath: string;
  format: 'cube' | '3dl';
  size: number;
  thumbnail?: string;   // 预览缩略图
  tags: string[];
  createdAt: string;
}
```

#### 3.5.2 LUT文件解析

- `.cube` 格式：解析 `LUT_3D_SIZE`、`DOMAIN_MIN`/`DOMAIN_MAX` 和数据行
- `.3dl` 格式：解析 Mesh3d 格式的 3D LUT 数据
- 支持 1D LUT（仅亮度映射）和 3D LUT（完整色彩映射）

#### 3.5.3 LUT导出

将当前调色设置采样为 3D 网格，输出标准 `.cube` 格式。

#### 3.5.4 LUT WebGL渲染

- LUT 数据上传为 WebGL 3D Texture（`TEXTURE_3D`）
- 着色器中通过三维坐标采样实现色彩映射
- 纹理格式：`RGBA16F` 或 `RGBA8`，尺寸 = LUT size³

### 3.6 示波器（Scopes）

```typescript
type ScopeType = 'waveform' | 'vectorscope' | 'histogram' | 'parade';

interface ScopeConfig {
  type: ScopeType;
  channel: 'rgb' | 'red' | 'green' | 'blue' | 'luma';
  intensity: number;  // 显示亮度
  graticule: boolean; // 刻度线
}
```

**实现**：使用 Canvas 2D 从 WebGL 渲染结果读取像素数据，实时绘制示波器。

### 3.7 WebGL渲染管线

```
原始帧纹理 → [节点1: 一级调色] → [节点2: LUT] → [节点3: HSL限定器] → [节点4: 遮罩] → 输出
```

**实现策略**：
- 每个调色节点编译为独立的 GLSL 片段着色器
- 使用乒乓缓冲（Ping-Pong Buffer）：节点链每步渲染到临时纹理
- 简单一级调色可合并到现有 `webgl-compositor.ts` 主着色器
- 复杂节点（HSL限定器、遮罩、LUT）使用独立渲染通道

### 3.8 FFmpeg导出映射

| 节点类型 | FFmpeg 滤镜 |
|---------|------------|
| 一级色轮 (Lift/Gamma/Gain) | `curves` 或 `colorbalance` |
| 色温/色调 | `colortemperature` + `hue` |
| 对比度/饱和度 | `eq=contrast=N:saturation=N` |
| HSL限定器 | `selectivecolor` 或自定义 `geq` |
| 窗口遮罩 | `maskmerge` + 生成遮罩帧 |
| LUT应用 | `lut3d=file='xxx.cube'` |
| 曲线 | `curves=r='...':g='...':b='...'` |

---

## 4. 音频混音系统

### 4.1 混音器控制台

```typescript
// packages/editor-core/src/audio/mixer-types.ts

/** 混音器通道条 */
interface MixerChannel {
  trackId: string;
  name: string;

  // 基本控制
  volume: number;        // dB (-∞ ~ +12)
  pan: number;           // -100 ~ 100 (L/R)
  muted: boolean;
  solo: boolean;

  // 信号路由
  busAssignments: BusAssignment[];
  inputBus: string | null;

  // 效果链
  effectsChain: AudioEffectSlot[];

  // 自动化
  automation: ChannelAutomation;

  // 计量
  metering: {
    peakLevel: number;    // dB
    rmsLevel: number;     // dB
    clipCount: number;
  };
}
```

### 4.2 音频效果链

```typescript
/** 音频效果槽 */
interface AudioEffectSlot {
  id: string;
  effectType: AudioEffectType;
  enabled: boolean;
  params: Record<string, number>;
  wetDry: number;  // 0 ~ 1 干湿比
  order: number;   // 在效果链中的顺序
}

type AudioEffectType =
  | 'eq-4band'           // 4频段参量EQ
  | 'eq-8band'           // 8频段参量EQ
  | 'compressor'         // 压缩器
  | 'limiter'            // 限制器
  | 'gate'               // 噪声门
  | 'expander'           // 扩展器
  | 'reverb'             // 混响
  | 'delay'              // 延迟
  | 'chorus'             // 合唱
  | 'flanger'            // 镶边
  | 'distortion'         // 失真
  | 'de-esser'           // 齿音消除
  | 'noise-reduction'    // 降噪
  | 'pitch-shift'        // 变调
  | 'stereo-widener'     // 立体声增强
  | 'mid-side'           // M/S处理
  | 'gain'               // 增益
  | 'phase-invert'       // 相位反转
  | 'high-pass'          // 高通滤波
  | 'low-pass';          // 低通滤波
```

**效果链执行顺序**：
1. 增益/相位（信号调理）
2. EQ/滤波器（频率处理）
3. 动态处理（压缩/门/扩展）
4. 时间效果（混响/延迟/合唱）
5. 立体声处理（M/S/声像/增强）
6. 限制器（最终保护）

### 4.3 总线路由系统

```typescript
/** 总线类型 */
type BusType = 'submix' | 'send' | 'aux' | 'master';

/** 总线 */
interface AudioBus {
  id: string;
  name: string;
  type: BusType;

  effectsChain: AudioEffectSlot[];
  volume: number;
  pan: number;
  muted: boolean;

  sendLevel?: number;    // 发送电平 0~1（发送总线特有）
  sendPrePost?: 'pre' | 'post';

  outputBusId: string | null;  // 输出到哪条总线（master为null）
}

/** 总线分配 */
interface BusAssignment {
  busId: string;
  level: number;   // 0 ~ 1
  enabled: boolean;
}
```

**默认总线配置**：
- **Master**：主输出总线（不可删除）
- **Music**：音乐/背景音乐子混音
- **Dialogue**：对白子混音
- **SFX**：音效子混音
- **Send 1/2**：辅助发送（用于混响/延迟等共享效果）

### 4.4 参数自动化曲线

```typescript
/** 自动化通道 */
interface ChannelAutomation {
  volume?: AutomationCurve;
  pan?: AutomationCurve;
  [effectParam: string]: AutomationCurve | undefined;  // effectId.paramName
}

/** 自动化曲线 */
interface AutomationCurve {
  points: AutomationPoint[];
  mode: 'read' | 'write' | 'touch' | 'latch';
}

interface AutomationPoint {
  time: number;
  value: number;
  curve: 'linear' | 'bezier' | 'step' | 'smooth';
  handleIn?: { time: number; value: number };
  handleOut?: { time: number; value: number };
}
```

### 4.5 Web Audio渲染管线

```
源音频 → [效果链] → [总线路由] → [Master效果] → 输出
```

每个效果使用对应的 Web Audio API 节点：
- `BiquadFilterNode`：EQ/滤波
- `DynamicsCompressorNode`：压缩/限制
- `ConvolverNode`：混响（使用脉冲响应）
- `DelayNode`：延迟/回声
- `StereoPannerNode`：声像

### 4.6 FFmpeg导出映射

| 音频效果 | FFmpeg 滤镜 |
|---------|------------|
| EQ 4/8频段 | `equalizer` 链 |
| 压缩器 | `acompressor` |
| 限制器 | `alimiter` |
| 噪声门 | `agate` |
| 混响 | `aecho` 或 `areverb` |
| 延迟 | `aecho` |
| 合唱 | `chorus` |
| 镶边 | `flanger` |
| 齿音消除 | `adeclick` |
| 降噪 | `arnndn` |
| 变调 | `asetrate` + `aresample` |
| 立体声增强 | `stereotools` |
| M/S处理 | `stereotools=mode=ms` |
| 高通/低通 | `highpass` / `lowpass` |

---

## 5. 共享抽象层

### 5.1 参数管理

```typescript
// packages/editor-core/src/shared/param-manager.ts

interface ParamDefinition {
  key: string;
  label: string;
  type: 'number' | 'boolean' | 'enum' | 'color' | 'curve';
  min?: number;
  max?: number;
  step?: number;
  default: unknown;
  unit?: string;
}
```

### 5.2 预设系统扩展

扩展现有 `EffectPreset` 以支持调色预设和音频效果预设：

```typescript
interface ColorGradingPreset {
  id: string;
  name: string;
  author: string;
  description?: string;
  tags: string[];
  graph: ColorGradingGraph;
  thumbnail?: string;
  createdAt: string;
  updatedAt: string;
}

interface AudioEffectPreset {
  id: string;
  name: string;
  author: string;
  description?: string;
  tags: string[];
  chain: AudioEffectSlot[];
  createdAt: string;
  updatedAt: string;
}
```

### 5.3 自动化引擎

共享的自动化引擎，支持调色参数和音频参数的动态变化：

```typescript
// packages/editor-core/src/shared/automation-engine.ts

interface AutomationEngine {
  evaluate(curve: AutomationCurve, time: number): number;
  addPoint(curve: AutomationCurve, point: AutomationPoint): void;
  removePoint(curve: AutomationCurve, pointId: string): void;
  interpolate(points: AutomationPoint[], time: number): number;
}
```

---

## 6. UI工作区布局

```
┌──────────────────────────────────────────────────────────┐
│  工具栏  │  [调色] [混音器] [效果] [自动化] [LUT]        │
├──────────────┬───────────────────────┬───────────────────┤
│              │                       │                   │
│   媒体库     │     预览画面          │   调色/混音面板    │
│              │                       │                   │
│              │                       │  ┌─────────────┐  │
│              │                       │  │ 色轮 / 曲线  │  │
│              │                       │  │ HSL限定器    │  │
│              │                       │  │ LUT管理器    │  │
│              │                       │  │ 混音器控制台  │  │
│              │                       │  │ 效果链面板    │  │
│              │                       │  │ 示波器       │  │
│              │                       │  └─────────────┘  │
├──────────────┴───────────────────────┴───────────────────┤
│                      时间线                               │
│  [自动化曲线编辑器]                                       │
└──────────────────────────────────────────────────────────┘
```

**Tab切换**：调色/混音面板采用 Tab 模式：
- **调色Tab**：色轮 + 曲线 + HSL限定器 + 窗口遮罩
- **混音器Tab**：多轨道推子 + VU表 + 声像
- **效果Tab**：选中片段的效果链
- **自动化Tab**：参数自动化曲线编辑
- **LUTTab**：LUT库 + 预览 + 管理

---

## 7. 文件结构

### 7.1 新增文件（editor-core）

```
packages/editor-core/src/color-grading/
  types.ts                    # 节点图、节点类型定义
  node-graph-engine.ts        # 节点图执行引擎
  primary-wheels.ts           # 一级色轮参数和逻辑
  primary-sliders.ts          # 一级滑块参数
  curves.ts                   # 曲线编辑器参数
  hsl-qualifier.ts            # HSL限定器
  window-mask.ts              # 窗口遮罩
  tracking-mask.ts            # 跟踪遮罩（光流算法）
  lut.ts                      # LUT数据解析/导出
  lut-parser.ts               # .cube/.3dl文件解析器
  lut-exporter.ts             # LUT导出器
  scopes.ts                   # 示波器数据计算
  color-grading-presets.ts    # 调色预设

packages/editor-core/src/audio/
  mixer-types.ts              # 混音器类型定义
  effect-chain.ts             # 效果链引擎
  audio-effects.ts            # 音频效果参数定义
  bus-router.ts               # 总线路由
  audio-mix-presets.ts        # 音频预设

packages/editor-core/src/shared/
  param-manager.ts            # 参数管理
  automation-engine.ts        # 自动化引擎
```

### 7.2 新增文件（desktop）

```
apps/desktop/src/components/ColorGrading/
  ColorGradingWorkspace.tsx   # 调色工作区主组件
  ColorWheelPanel.tsx         # 色轮面板
  CurvesEditor.tsx            # 曲线编辑器
  HSLQualifierPanel.tsx       # HSL限定器面板
  WindowMaskPanel.tsx         # 窗口遮罩面板
  TrackingMaskPanel.tsx       # 跟踪遮罩面板
  LUTManager.tsx              # LUT管理器
  LUTImporter.tsx             # LUT导入对话框
  NodeGraphView.tsx           # 节点图可视化
  ScopesPanel.tsx             # 示波器面板

apps/desktop/src/components/AudioMixer/
  MixerConsole.tsx            # 混音器控制台
  ChannelStrip.tsx            # 通道条
  BusPanel.tsx                # 总线面板
  EffectsRack.tsx             # 效果链面板
  AutomationEditor.tsx        # 自动化曲线编辑器
  VUMeter.tsx                 # VU表组件

apps/desktop/src/lib/color-grading/
  color-grading-renderer.ts   # WebGL调色渲染器
  lut-texture-manager.ts      # LUT纹理管理
  node-shader-compiler.ts     # 节点着色器编译器
  scope-renderer.ts           # 示波器渲染器

apps/desktop/src/lib/audio/
  mixer-engine.ts             # 混音器引擎（Web Audio）
  effect-chain-processor.ts   # 效果链处理器
  bus-router-processor.ts     # 总线路由处理器
  automation-player.ts        # 自动化播放器
```

### 7.3 修改文件

```
packages/editor-core/src/model-types.ts     # 添加 colorGradingGraph, AudioBus 等类型
packages/editor-core/src/model.ts           # 更新工厂函数和归一化
packages/editor-core/src/commands/
  timeline-commands.ts                      # 新增调色/音频命令
packages/editor-core/src/export/
  ffmpeg-builder.ts                         # 添加调色节点和音频效果的FFmpeg映射
apps/desktop/src/lib/preview/
  webgl-compositor.ts                       # 集成调色节点渲染
  audio-renderer.ts                         # 集成效果链和总线路由
apps/desktop/src/components/Inspector/
  Inspector.tsx                             # 添加调色/音频面板入口
```

---

## 8. 命令系统

所有状态变更通过 Command 对象：

```typescript
// 调色命令
class AddColorNodeCommand implements Command { ... }
class RemoveColorNodeCommand implements Command { ... }
class UpdateColorNodeCommand implements Command { ... }
class ConnectColorNodesCommand implements Command { ... }
class ApplyLUTCommand implements Command { ... }
class ImportLUTCommand implements Command { ... }

// 音频命令
class AddAudioEffectCommand implements Command { ... }
class RemoveAudioEffectCommand implements Command { ... }
class UpdateAudioEffectCommand implements Command { ... }
class ReorderAudioEffectsCommand implements Command { ... }
class UpdateMixerChannelCommand implements Command { ... }
class AddBusCommand implements Command { ... }
class RemoveBusCommand implements Command { ... }
class UpdateAutomationCommand implements Command { ... }
```

---

## 9. 实现阶段划分

### 阶段 1：基础框架（调色节点图 + 一级调色）
- 数据模型扩展
- 节点图引擎
- 一级色轮/滑块 UI
- WebGL 集成
- 基础 FFmpeg 映射

### 阶段 2：高级调色（二级调色 + LUT）
- HSL限定器
- 窗口遮罩
- LUT 解析/应用/导出
- 曲线编辑器
- 示波器

### 阶段 3：音频混音器
- 混音器控制台 UI
- 效果链引擎
- 总线路由
- Web Audio 集成

### 阶段 4：自动化与集成
- 自动化曲线编辑器
- 参数自动化播放
- 完整 FFmpeg 映射
- 预设系统

### 阶段 5：跟踪与优化
- 跟踪遮罩（光流算法）
- 性能优化
- E2E 测试
- 文档

---

## 10. 测试策略

### 10.1 单元测试（Vitest）

- LUT 解析器：测试 .cube/.3dl 文件解析
- 节点图引擎：测试节点连接、执行顺序、参数传递
- 自动化引擎：测试插值算法、曲线求值
- 效果链：测试效果排序、参数归一化

### 10.2 集成测试

- WebGL 调色渲染：像素级比对
- Web Audio 效果链：信号流验证
- FFmpeg 映射：滤镜图生成验证

### 10.3 E2E 测试（Playwright）

- 应用调色预设 → 断言效果正确应用
- 调整混音器参数 → 断言音量/声像正确
- 导入 LUT → 断言 LUT 正确应用
- 绘制自动化曲线 → 断言参数动态变化

---

## 11. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| WebGL 3D Texture 兼容性 | LUT 无法在旧设备上渲染 | 提供 Canvas 2D 回退路径 |
| Web Audio 节点数量限制 | 复杂效果链可能断音 | 优化节点连接，减少不必要的中间节点 |
| 跟踪算法性能 | Web Worker 中光流计算可能太慢 | 降低跟踪分辨率，提供"快速跟踪"模式 |
| FFmpeg 滤镜兼容性 | 某些高级调色难以精确映射 | 逐帧渲染回退（类似自定义着色器） |
| 项目文件大小增长 | 节点图和自动化数据增加体积 | 压缩存储、延迟加载 |
