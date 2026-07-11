# 多机位剪辑系统设计文档

**创建日期**：2026-07-11  
**状态**：已批准  
**作者**：ZCode AI Agent

## 1. 概述

### 1.1 背景

open-factory 项目已具备稳固的工程基础和AI粗剪功能。专业视频编辑中，多机位剪辑是必备功能，特别是活动、采访、音乐会等场景。需要实现多机位素材的自动同步、切换界面和实时编辑，提升专业工作流效率。

### 1.2 目标

- 支持多机位素材的导入和管理
- 实现三种同步方式：音频波形、时间码、手动标记
- 提供直观的多画面切换界面
- 支持切换点关键帧编辑
- 集成到现有时间线和导出系统

### 1.3 范围

本设计涵盖：
- MulticamClip 数据结构
- 同步引擎（音频、时间码、手动）
- AngleSwitcher UI 组件
- 命令系统集成
- 测试策略

## 2. 架构设计

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                      Desktop App Layer                      │
├─────────────────────────────────────────────────────────────┤
│  AngleSwitcherPanel │ PreviewRenderer │ TimelineRenderer   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Editor Core Layer                         │
├─────────────────────────────────────────────────────────────┤
│  MulticamClip │ MulticamSyncEngine │ CommandManager         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Audio Processing Layer                    │
├─────────────────────────────────────────────────────────────┤
│  auto-audio-sync │ multicam-audio-sync │ beats              │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 数据流

1. **导入阶段**：MediaAsset → MulticamClip（通过 CreateMulticamClipCommand）
2. **同步阶段**：MulticamAngle[] → MulticamSyncEngine → 更新 offset
3. **编辑阶段**：用户操作 → Command → 更新 switchPoints/activeAngle
4. **预览阶段**：currentTime + switchPoints → getActiveAngleAtTime → 渲染
5. **导出阶段**：MulticamClip → FFmpeg FilterGraph → 输出视频

## 3. 数据结构设计

### 3.1 MulticamClip 类型

```typescript
// packages/editor-core/src/model-types.ts

interface MulticamClip extends BaseClip {
  type: 'multicam';
  angles: MulticamAngle[];
  activeAngle: number;
  switchPoints: SwitchPoint[];
  syncMode: MulticamSyncMode;
  syncReferenceAngle: number;
}

interface MulticamAngle {
  id: string;
  mediaId: string;
  name: string;
  offset: number;
  volume: number;
  muted: boolean;
  colorCorrection?: ColorCorrection;
  transform?: Transform;
}

interface SwitchPoint {
  time: number;
  targetAngle: number;
  transition: SwitchTransition;
}

type SwitchTransition = 'cut' | 'dissolve' | 'wipe';

type MulticamSyncMode = 'audio' | 'timecode' | 'manual';
```

### 3.2 设计要点

1. **MulticamClip** 继承 BaseClip，复用位置、时长、速度等基础属性
2. **angles** 数组存储所有机位源，每个机位独立配置
3. **switchPoints** 使用关键帧模式，支持非破坏性编辑
4. **syncMode** 支持三种同步方式，syncReferenceAngle 指定参考机位

## 4. 同步策略设计

### 4.1 同步引擎架构

```
┌─────────────────────────────────────────────────────┐
│                   MulticamSyncEngine                │
├─────────────────────────────────────────────────────┤
│  + syncByAudio(angles[]): SyncResult               │
│  + syncByTimecode(angles[]): SyncResult            │
│  + syncByManual(markers[]): SyncResult             │
│  + detectDrift(angles[]): DriftReport              │
└─────────────────────────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        ▼               ▼               ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ AudioSync    │ │ TimecodeSync │ │ ManualSync   │
│ (复用现有)    │ │ (新增)       │ │ (新增)       │
└──────────────┘ └──────────────┘ └──────────────┘
```

### 4.2 音频波形同步（复用现有）

**已有实现**：`packages/editor-core/src/audio/multicam-audio-sync.ts`

**集成方式**：
```typescript
// 新增 packages/editor-core/src/multicam-sync.ts
import { syncMulticamAudio } from './audio/multicam-audio-sync';

export async function syncMulticamByAudio(
  angles: MulticamAngle[],
  mediaAssets: MediaAsset[]
): Promise<MulticamSyncResult> {
  // 1. 提取各机位音频数据
  // 2. 调用现有的 syncMulticamAudio()
  // 3. 转换为 MulticamAngle.offset
  // 4. 返回同步结果和置信度
}
```

**置信度阈值**：
- high: >= 0.7（自动应用）
- medium: >= 0.45（提示用户确认）
- low: < 0.45（建议手动同步）

### 4.3 时间码同步（新增）

**实现逻辑**：
```typescript
export function syncMulticamByTimecode(
  angles: MulticamAngle[],
  mediaMetadata: Record<string, MediaMetadata>
): MulticamSyncResult {
  // 1. 从媒体元数据提取时间码（录制开始时间）
  // 2. 计算各机位的时间偏移
  // 3. 以最早的时间码为参考点
  // 4. 返回同步结果
}
```

**时间码来源**：
- 视频文件元数据（creation_time、timecode）
- 代理文件生成时记录的原始时间码

### 4.4 手动标记同步（新增）

**实现逻辑**：
```typescript
export function syncMulticamByManual(
  angles: MulticamAngle[],
  markers: ManualSyncMarker[]
): MulticamSyncResult {
  // 1. 用户在各机位上标记同步点（如拍手、闪光）
  // 2. 计算各标记点相对于参考机位的偏移
  // 3. 应用偏移到 MulticamAngle.offset
  // 4. 返回同步结果
}
```

**UI交互**：
- 在 AngleSwitcher 面板中，点击"标记同步点"按钮
- 在各机位预览中点击标记位置
- 支持放大时间轴精确定位

### 4.5 漂移检测与补偿

**复用现有**：`multicam-audio-sync.ts` 中的 `detectDrift()` 和 `generateAtempoSegments()`

**应用场景**：
- 长时间录制（>30分钟）时，不同相机的时钟可能产生漂移
- 检测漂移后，提示用户是否应用速度补偿

## 5. UI组件设计

### 5.1 AngleSwitcher 组件架构

```
┌─────────────────────────────────────────────────────────┐
│                   AngleSwitcherPanel                    │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐│
│  │              MulticamPreviewGrid                    ││
│  │  ┌─────────┬─────────┬─────────┐                   ││
│  │  │ Angle 1 │ Angle 2 │ Angle 3 │                   ││
│  │  │ (active)│         │         │                   ││
│  │  ├─────────┼─────────┼─────────┤                   ││
│  │  │ Angle 4 │ Angle 5 │ Angle 6 │                   ││
│  │  │         │         │         │                   ││
│  │  └─────────┴─────────┴─────────┘                   ││
│  └─────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────┐│
│  │              SyncControls                           ││
│  │  [音频同步] [时间码同步] [手动标记] [检测漂移]       ││
│  └─────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────┐│
│  │              SwitchPointEditor                      ││
│  │  ← [切换点列表] → [添加切换点] [删除切换点]         ││
│  └─────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
```

### 5.2 组件分解

#### AngleSwitcherPanel（主面板）

**位置**：预览窗口上方，可折叠

**Props**：
```typescript
interface AngleSwitcherPanelProps {
  multicamClip: MulticamClip;
  mediaAssets: MediaAsset[];
  currentTime: number;
  isPlaying: boolean;
  onAngleSwitch: (angleIndex: number, time: number) => void;
  onSyncRequest: (mode: MulticamSyncMode) => void;
  onSwitchPointAdd: (time: number, targetAngle: number) => void;
  onSwitchPointDelete: (index: number) => void;
}
```

**快捷键**：
- 数字键 1-9：切换到对应机位
- 空格：播放/暂停
- 左右箭头：逐帧移动

#### MulticamPreviewGrid（多画面网格）

**布局**：
- 2机位：1x2 水平排列
- 3-4机位：2x2 网格
- 5-6机位：2x3 网格
- 7-9机位：3x3 网格

**功能**：
- 显示各机位实时预览
- 高亮当前激活机位（蓝色边框）
- 点击切换机位
- 显示机位名称和时间码

#### SyncControls（同步控制）

**按钮**：
- 音频同步：调用 `syncMulticamByAudio()`
- 时间码同步：调用 `syncMulticamByTimecode()`
- 手动标记：进入标记模式
- 检测漂移：调用 `detectDrift()`

#### SwitchPointEditor（切换点编辑器）

**功能**：
- 显示切换点列表（时间、目标机位、过渡类型）
- 添加切换点：在当前时间添加
- 删除切换点：选中后删除
- 编辑切换点：双击修改目标机位或过渡类型

### 5.3 文件结构

```
apps/desktop/src/components/
├── AngleSwitcher/
│   ├── AngleSwitcherPanel.tsx      # 主面板
│   ├── MulticamPreviewGrid.tsx     # 多画面网格
│   ├── SyncControls.tsx            # 同步控制
│   ├── SwitchPointEditor.tsx       # 切换点编辑器
│   └── AnglePreview.tsx            # 单机位预览
```

## 6. 命令系统集成

### 6.1 新增命令类型

```typescript
// packages/editor-core/src/commands/timeline-commands.ts

// 1. 创建多机位片段
class CreateMulticamClipCommand implements Command {
  constructor(
    private angles: MulticamAngle[],
    private syncMode: MulticamSyncMode,
    private referenceAngle: number
  ) {}
  execute(): MulticamClip { ... }
  undo(): void { ... }
}

// 2. 切换机位（添加切换点）
class SwitchMulticamAngleCommand implements Command {
  constructor(
    private multicamClipId: string,
    private time: number,
    private targetAngle: number,
    private transition: SwitchTransition = 'cut'
  ) {}
  execute(): void { ... }
  undo(): void { ... }
}

// 3. 删除切换点
class DeleteSwitchPointCommand implements Command {
  constructor(
    private multicamClipId: string,
    private switchPointIndex: number
  ) {}
  execute(): void { ... }
  undo(): void { ... }
}

// 4. 同步多机位片段
class SyncMulticamClipCommand implements Command {
  constructor(
    private multicamClipId: string,
    private syncMode: MulticamSyncMode,
    private syncResult: MulticamSyncResult
  ) {}
  execute(): void { ... }
  undo(): void { ... }
}

// 5. 更新机位属性
class UpdateMulticamAngleCommand implements Command {
  constructor(
    private multicamClipId: string,
    private angleIndex: number,
    private updates: Partial<MulticamAngle>
  ) {}
  execute(): void { ... }
  undo(): void { ... }
}
```

### 6.2 时间线集成

#### Clip渲染

在 `TimelineClip.tsx` 中添加多机位片段的特殊渲染：

```typescript
if (clip.type === 'multicam') {
  return (
    <div className="multicam-clip">
      <div className="multicam-angles-indicator">
        {clip.angles.map((angle, i) => (
          <div 
            key={angle.id}
            className={`angle-badge ${i === clip.activeAngle ? 'active' : ''}`}
          >
            {i + 1}
          </div>
        ))}
      </div>
      <div className="switch-points-track">
        {clip.switchPoints.map((sp, i) => (
          <div 
            key={i}
            className="switch-point-marker"
            style={{ left: `${sp.time / clip.duration * 100}%` }}
          />
        ))}
      </div>
    </div>
  );
}
```

#### 预览渲染

```typescript
function getActiveAngleAtTime(
  multicamClip: MulticamClip,
  time: number
): MulticamAngle {
  // 1. 找到当前时间之前的最后一个切换点
  // 2. 返回对应的机位
  // 3. 如果没有切换点，返回 activeAngle
}
```

#### 导出支持

```typescript
function buildMulticamFilterGraph(
  multicamClip: MulticamClip,
  mediaAssets: MediaAsset[]
): FFmpegFilterGraph {
  // 1. 为每个机位生成输入流
  // 2. 使用 select 滤镜根据切换点选择机位
  // 3. 使用 overlay 滤镜实现过渡效果
  // 4. 输出最终视频流
}
```

### 6.3 状态管理

```typescript
// apps/desktop/src/store/editorStore.ts

interface EditorStore {
  // 现有状态...
  
  // 多机位相关
  multicamEditMode: boolean;
  activeMulticamClipId: string | null;
  multicamPreviewLayout: '1x1' | '1x2' | '2x2' | '2x3' | '3x3';
  
  // 多机位操作
  enterMulticamEditMode: (clipId: string) => void;
  exitMulticamEditMode: () => void;
  switchMulticamAngle: (angleIndex: number) => void;
  setMulticamPreviewLayout: (layout: string) => void;
}
```

## 7. 测试策略

### 7.1 单元测试（Vitest）

**位置**：`packages/editor-core/src/__tests__/`

```typescript
// multicam-clip.test.ts
describe('MulticamClip', () => {
  test('创建多机位片段', () => { ... });
  test('添加切换点', () => { ... });
  test('删除切换点', () => { ... });
  test('获取指定时间的激活机位', () => { ... });
  test('同步多机位片段', () => { ... });
});

// multicam-sync.test.ts
describe('MulticamSync', () => {
  test('音频同步', () => { ... });
  test('时间码同步', () => { ... });
  test('手动标记同步', () => { ... });
  test('漂移检测', () => { ... });
});
```

**覆盖率目标**：≥80%

### 7.2 E2E测试（Playwright）

**位置**：`apps/desktop/e2e/multicam-editing.spec.ts`

```typescript
test.describe('多机位剪辑', () => {
  test('导入多机位素材并同步', async ({ page }) => {
    // 1. 导入多个视频文件
    // 2. 创建多机位片段
    // 3. 执行音频同步
    // 4. 验证同步结果
  });

  test('机位切换', async ({ page }) => {
    // 1. 创建多机位片段
    // 2. 按数字键切换机位
    // 3. 验证切换点正确添加
    // 4. 验证预览显示正确机位
  });

  test('多机位片段编辑', async ({ page }) => {
    // 1. 创建多机位片段
    // 2. 执行裁剪、分割、波纹删除
    // 3. 验证操作正确执行
    // 4. 验证撤销/重做正常
  });
});
```

**遵循规范**：STABILITY_CHECKLIST.md、POM模式

## 8. 实现计划

### 8.1 阶段1：数据结构 + 基础UI（第1-2周）

**任务清单**：
1. 新增 MulticamClip 类型到 model-types.ts
2. 实现 createMulticamClip() 工厂函数
3. 实现 getActiveAngleAtTime() 等核心算法
4. 实现 AngleSwitcherPanel 基础UI
5. 实现 MulticamPreviewGrid 多画面显示
6. 实现手动切换功能（点击/快捷键）
7. 编写单元测试（≥80%覆盖率）
8. 编写E2E测试基础用例

**交付物**：
- 可创建多机位片段
- 可手动切换机位
- 基础UI可用

### 8.2 阶段2：音频同步集成（第3周）

**任务清单**：
1. 实现 syncMulticamByAudio() 封装现有音频同步
2. 实现 SyncControls 同步控制UI
3. 实现同步对话框（显示进度和置信度）
4. 实现漂移检测和补偿提示
5. 编写音频同步单元测试
6. 编写音频同步E2E测试

**交付物**：
- 支持音频波形自动同步
- 支持漂移检测和补偿
- 同步结果可视化

### 8.3 阶段3：高级编辑功能（第4周）

**任务清单**：
1. 实现 SwitchPointEditor 切换点编辑器
2. 实现时间码同步
3. 实现手动标记同步
4. 实现多机位片段的裁剪、分割、波纹删除
5. 实现切换点过渡效果（cut/dissolve/wipe）
6. 实现多机位导出支持
7. 编写完整E2E测试套件
8. 性能优化和文档编写

**交付物**：
- 完整的多机位编辑功能
- 三种同步方式
- 导出支持
- 完整测试覆盖

## 9. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 音频同步精度不足 | 高 | 复用现有成熟算法，提供手动调整 |
| 多画面预览性能问题 | 中 | 使用代理媒体，按需加载 |
| 与现有Command模式冲突 | 高 | 严格遵循Command模式，充分测试 |
| 导出FFmpeg滤镜复杂 | 中 | 参考现有实现，分步构建 |

## 10. 附录

### 10.1 参考资料

- Adobe Premiere Pro 多机位编辑：https://helpx.adobe.com/premiere/desktop/edit-projects/set-up-multi-camera-sequences-for-editing/create-a-multi-camera-source-sequence.html
- Final Cut Pro 多机位工作流：https://support.apple.com/guide/final-cut-pro/multicam-editing-workflow-ver10e087fd/mac
- 现有音频同步实现：`packages/editor-core/src/audio/multicam-audio-sync.ts`

### 10.2 相关文件

- 数据模型：`packages/editor-core/src/model-types.ts`
- 工厂函数：`packages/editor-core/src/model.ts`
- 时间线操作：`packages/editor-core/src/timeline.ts`
- 命令系统：`packages/editor-core/src/commands/timeline-commands.ts`
- 音频同步：`packages/editor-core/src/audio/multicam-audio-sync.ts`
- UI组件：`apps/desktop/src/components/AngleSwitcher/`
- 状态管理：`apps/desktop/src/store/editorStore.ts`
