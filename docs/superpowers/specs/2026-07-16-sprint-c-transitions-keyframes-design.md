# Open Factory v4.28.0 Sprint C — 转场效果库与关键帧增强设计文档

> 日期：2026-07-16 | 状态：已批准（自动执行模式）

## 1. 背景与目标

v4.27.0 发布后，项目架构健康、测试完备。Sprint C 聚焦于补齐专业视频编辑器两大核心短板：**转场效果**和**关键帧动画**体验。基于 v4.26.0 拆分后的模块化架构扩展。

### 现状分析

| 领域 | 现有能力 | 差距 |
|------|---------|------|
| 转场类型 | 16 种 (dissolve, wipe×4, zoom, flash×2, block, rotate, film-roll×2, shape×2, motion-blur-wipe) | 缺少推拉、3D、故障风等高级转场 |
| 转场 UI | TimelineMenus.tsx 中的弹出菜单 + canvas 缩略图 | 缺少独立的可视化浏览面板 |
| 缓动函数 | 6 种 (linear, ease-in, ease-out, ease-in-out, elastic, bounce) | 需要 30+ 专业缓动预设 |
| 贝塞尔手柄 | KeyframeCurveEditor 已支持拖拽 inHandle/outHandle | 手柄可视化需要增强 |
| 关键帧复制粘贴 | PasteKeyframeDialog 已支持相对/绝对模式 | 已完整，仅需微调 |

## 2. 转场效果库扩展

### 2.1 新增转场类型

在现有 16 种基础上新增 10 种，总计 26 种：

| 类别 | 新增类型 | FFmpeg xfade 映射 |
|------|---------|-------------------|
| 推拉类 | `push-left`, `push-right`, `push-up`, `push-down` | `slideleft`, `slideright`, `slideup`, `slidedown` |
| 进阶类 | `light-leak`, `glitch` | 自定义滤镜链 |
| 3D 类 | `flip-horizontal`, `flip-vertical`, `cube-rotate`, `portal` | 自定义滤镜链 |

### 2.2 架构变更

**类型扩展** (`model-types.ts`):
```typescript
export type TransitionType =
  | 'fade-black' | 'dissolve' | 'wipe-left' | 'wipe-right'
  | 'wipe-up' | 'wipe-down' | 'zoom-dissolve' | 'flash-white'
  | 'flash-black' | 'block' | 'rotate' | 'film-roll-open'
  | 'film-roll-close' | 'shape-heart' | 'shape-star' | 'motion-blur-wipe'
  // 新增 ↓
  | 'push-left' | 'push-right' | 'push-up' | 'push-down'
  | 'light-leak' | 'glitch'
  | 'flip-horizontal' | 'flip-vertical' | 'cube-rotate' | 'portal';
```

**参数生成模块** (`packages/editor-core/src/export/transitions/`):
```
transitions/
  index.ts              -- barrel re-export
  transition-registry.ts -- 转场注册表（元数据 + 分类 + FFmpeg 映射）
  xfade-params.ts       -- xfade 参数生成（标准转场）
  custom-filters.ts     -- 自定义滤镜链生成（高级转场）
  preview-args.ts       -- 预览缩略图参数生成（从 visual-filters.ts 迁移）
  __tests__/
    xfade-params.test.ts
    custom-filters.test.ts
    transition-registry.test.ts
```

### 2.3 自定义转场 FFmpeg 实现

**light-leak**: 叠加半透明光线纹理 + dissolve
```
[from]format=rgba[from_r];[to]format=rgba[to_r];
[from_r][to_r]xfade=transition=dissolve:duration=D:offset=O[base];
color=c=white:s=WxH:d=D,format=rgba[leak];
[leak]geq=r='255*exp(-pow(X/W-0.5,2)*8)*rand(1)':g='200*exp(-pow(X/W-0.5,2)*8)':b='100*exp(-pow(X/W-0.5,2)*8)':a='128*exp(-pow(X/W-0.5,2)*8)*clip(T/D,0,1)'[leak_a];
[base][leak_a]overlay=format=auto[out]
```

**glitch**: 块状位移 + 色彩偏移 + 像素化
```
[from][to]xfade=transition=pixelize:duration=D:offset=O[base];
[base]rgbashift=rh=-5:bh=5:gh=0,eq=contrast=1.5[out]
```

**flip-horizontal**: 水平翻转 + fade
```
[from]hflip[from_f];[from_f][to]xfade=transition=fade:duration=D:offset=O[out]
```

**flip-vertical**: 垂直翻转 + fade
```
[from]vflip[from_f];[from_f][to]xfade=transition=fade:duration=D:offset=O[out]
```

**cube-rotate**: 透视变换模拟立方体旋转（使用 rotate + zoom + fade 组合）
```
[from]rotate='PI/2*t/D':ow=iw:oh=ih:c=black@0,format=rgba[from_r];
[from_r][to]xfade=transition=fade:duration=D:offset=O[out]
```

**portal**: 圆形缩放打开效果
```
[from][to]xfade=transition=circleopen:duration=D:offset=O[base];
[base]zoompan=z='1+0.05*on/D':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=WxH[out]
```

### 2.4 转场注册表

```typescript
export interface TransitionDefinition {
  type: TransitionType;
  label: string;          // 显示名称
  category: 'basic' | 'advanced' | '3d';
  icon: string;           // lucide icon 名
  xfadeName?: string;     // FFmpeg xfade 名称（标准转场）
  customBuilder?: string; // 自定义构建器标识（高级转场）
  defaultDuration: number;
  description: string;
}

export const TRANSITION_REGISTRY: TransitionDefinition[] = [
  // 现有 16 种 + 新增 10 种
];
```

## 3. TransitionLibrary 预览面板

### 3.1 组件架构

```
apps/desktop/src/components/Transitions/
  TransitionLibrary.tsx            -- 主面板（lazy loaded）
  TransitionCard.tsx               -- 单个转场卡片（WebGL + canvas 2D fallback）
  webgl-transition-renderer.ts     -- WebGL shader 转场渲染器
```

### 3.2 预览渲染方案

**WebGL Shader（主路径）：**
- 使用 GPU 加速的 fragment shader 实现转场效果预览
- 每种转场类型对应一个 GLSL fragment shader
- 支持 dissolve、wipe、push、zoom、flash、glitch、flip、portal 等效果
- `createWebGLTransitionRenderer()` 工厂函数创建渲染器实例
- 自动检测 WebGL 支持，不可用时 fallback 到 canvas 2D

**Canvas 2D（fallback）：**
- 当 WebGL 不可用时使用纯 canvas 2D 绘制
- 覆盖所有转场类型的视觉效果

### 3.3 功能

- 网格布局展示所有转场，按分类分组（基础/进阶/3D）
- 搜索框支持按名称/描述筛选
- 鼠标悬停播放预览动画（WebGL shader 加速，canvas 2D fallback）
- 支持收藏（复用 transition-favorites.ts）
- 拖拽到时间线片段之间应用转场（通过 TRANSITION_DRAG_MIME + useTimelineHandlers drop handler）
- 点击选中后在 Inspector 中显示转场参数

### 3.3 集成

- 在 EditorShell.tsx 中以 lazy chunk 加载
- 通过 panelStore 注册面板可见性
- 复用现有的 `TransitionPreviewCanvas` 组件

## 4. 关键帧曲线编辑器增强

### 4.1 缓动预设库扩展

新增 `easing-presets.ts` 模块 (`packages/editor-core/src/keyframes/`):

```typescript
export interface EasingPreset {
  id: string;
  label: string;
  category: 'standard' | 'overshoot' | 'spring' | 'steps';
  easing: KeyframeEasing;     // 基础缓动类型
  inHandle?: KeyframeHandle;  // 贝塞尔手柄覆盖
  outHandle?: KeyframeHandle;
  description: string;
}

export const EASING_PRESETS: EasingPreset[] = [
  // 标准类 (12)
  { id: 'linear', ... },
  { id: 'ease-in', ... },
  { id: 'ease-out', ... },
  { id: 'ease-in-out', ... },
  { id: 'cubic-in', inHandle: { dx: 0.55, dy: 0.055 }, ... },
  { id: 'cubic-out', inHandle: { dx: 0.215, dy: 0.61 }, ... },
  { id: 'cubic-in-out', ... },
  { id: 'quart-in', ... },
  { id: 'quart-out', ... },
  { id: 'quint-in', ... },
  { id: 'sine-in', ... },
  { id: 'sine-out', ... },
  // 过冲类 (6)
  { id: 'back-in', ... },
  { id: 'back-out', ... },
  { id: 'back-in-out', ... },
  { id: 'circ-in', ... },
  { id: 'circ-out', ... },
  { id: 'circ-in-out', ... },
  // 弹簧类 (6)
  { id: 'elastic', ... },
  { id: 'bounce', ... },
  { id: 'spring-soft', ... },
  { id: 'spring-medium', ... },
  { id: 'spring-hard', ... },
  { id: 'spring-bouncy', ... },
  // 步进类 (6)
  { id: 'steps-2', ... },
  { id: 'steps-3', ... },
  { id: 'steps-4', ... },
  { id: 'steps-5', ... },
  { id: 'steps-8', ... },
  { id: 'steps-12', ... },
];
```

### 4.2 实现方式

- **不修改 `KeyframeEasing` 类型**：保持 6 种基础缓动类型不变
- **预设通过贝塞尔手柄实现**：预设的曲线形状通过设置 `inHandle`/`outHandle` 实现
- **步进缓动**：在 `applyEasing()` 中新增 steps 支持（`Math.floor(t * steps) / steps`）
- **UI 层面**：在 KeyframeCurveEditor 的缓动选择器中增加"预设库"下拉面板

### 4.3 贝塞尔手柄可视化增强

现有 `KeyframeCurveEditor` 已支持：
- Canvas 绘制曲线 + 关键帧点
- 拖拽 inHandle/outHandle
- 右键切换 handleMode

增强项：
- **手柄连线**：从关键帧点到手柄控制点的连线（当前只有控制点）
- **手柄端点圆圈**：更明显的拖拽目标
- **悬停高亮**：鼠标悬停时高亮手柄和连线
- **数值显示**：拖拽时显示 dx/dy 数值

## 5. 关键帧复制/粘贴增强

### 5.1 现状

已有：
- `PasteKeyframeDialog` 支持相对/绝对时间模式
- `normalizePastedKeyframes()` 处理跨属性值转换
- `PasteKeyframesCommand` 命令模式

### 5.2 增强项

- **跨片段复制**：从片段 A 复制关键帧，粘贴到片段 B（已支持，需确保 UI 流程顺畅）
- **批量属性复制**：一次复制多个属性的关键帧
- **快捷键**：Ctrl+Shift+C / Ctrl+Shift+V 用于关键帧复制粘贴

## 6. 状态管理

### 6.1 新增 useTransitionStore

```typescript
// apps/desktop/src/store/transitionStore.ts
interface TransitionStoreState {
  libraryOpen: boolean;
  selectedCategory: 'all' | 'basic' | 'advanced' | '3d';
  searchQuery: string;
  previewingType: TransitionType | null;
  // actions
  setLibraryOpen: (open: boolean) => void;
  setSelectedCategory: (cat: ...) => void;
  setSearchQuery: (query: string) => void;
  setPreviewingType: (type: TransitionType | null) => void;
}
```

### 6.2 关键帧状态

关键帧相关状态保持在现有 `editorStore` 中，不新增 store。

## 7. 测试策略

| 模块 | 测试类型 | 覆盖要求 |
|------|---------|---------|
| `transition-registry.ts` | Vitest | 所有注册表条目完整且类型正确 |
| `xfade-params.ts` | Vitest | 每种标准转场的参数生成 |
| `custom-filters.ts` | Vitest | 每种自定义转场的滤镜链 |
| `preview-args.ts` | Vitest | 预览参数数组正确 |
| `easing-presets.ts` | Vitest | 预设数量 ≥ 30，贝塞尔值正确 |
| `KeyframeCurveEditor` | Vitest + E2E | 手柄拖拽、预设选择 |
| `TransitionLibrary` | E2E | 浏览、搜索、拖拽应用 |

## 8. 文件变更清单

### 新增文件
- `packages/editor-core/src/export/transitions/index.ts`
- `packages/editor-core/src/export/transitions/transition-registry.ts`
- `packages/editor-core/src/export/transitions/xfade-params.ts`
- `packages/editor-core/src/export/transitions/custom-filters.ts`
- `packages/editor-core/src/export/transitions/preview-args.ts`
- `packages/editor-core/src/export/transitions/__tests__/xfade-params.test.ts`
- `packages/editor-core/src/export/transitions/__tests__/custom-filters.test.ts`
- `packages/editor-core/src/export/transitions/__tests__/transition-registry.test.ts`
- `packages/editor-core/src/easing-presets.ts`
- `packages/editor-core/__tests__/easing-presets.test.ts`
- `apps/desktop/src/components/Transitions/TransitionLibrary.tsx`
- `apps/desktop/src/components/Transitions/TransitionCard.tsx`
- `apps/desktop/src/components/Transitions/webgl-transition-renderer.ts`
- `apps/desktop/src/store/transitionStore.ts`

### 修改文件
- `packages/editor-core/src/model-types.ts` — 扩展 TransitionType
- `packages/editor-core/src/model/defaults.ts` — 扩展 TRANSITION_TYPES
- `packages/editor-core/src/export/ffmpeg-builder/visual-filters.ts` — 更新 mapTransitionType / buildSmartTransitionFilters
- `packages/editor-core/src/keyframes.ts` — 新增 steps 缓动支持
- `packages/editor-core/src/index.ts` — 导出新模块
- `apps/desktop/src/components/Inspector/InspectorEditors.tsx` — 增强 KeyframeCurveEditor + EasingPresetSelector
- `apps/desktop/src/components/layout/ShellRightPanel.tsx` — lazy 集成 TransitionLibrary
- `apps/desktop/src/components/Timeline/useTimelineHandlers.ts` — 转场拖拽 drop handler
- `apps/desktop/src/i18n/strings.ts` — 新转场中英文名称

## 9. 实施顺序

1. **Phase 1**: 转场类型扩展 + 注册表 + 参数生成 + 测试
2. **Phase 2**: TransitionLibrary 面板组件
3. **Phase 3**: 缓动预设库 + KeyframeCurveEditor 增强
4. **Phase 4**: 验证（typecheck + tests + build）
