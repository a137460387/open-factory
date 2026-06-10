# open-factory — AI 代理执行规格（v1.1）

你是我的首席全栈工程师、桌面应用工程师和视频编辑器架构师。请在当前仓库中一次性完成一个"OpenCut / CapCut 风格的本地优先桌面视频编辑器 MVP"，项目名称为 open-factory。不要向我反复提问；遇到不确定点，按下面的默认决策执行，并在最终报告里说明取舍。

---

## 背景参考

- 参考对象是 OpenCut Classic：本地优先、隐私优先、简单易用、时间线视频编辑器。
- 只做 clean-room 实现，不直接复制 OpenCut 的代码、资源、品牌、Logo、文案。
- 目标不是一次做完整剪映，而是做一个可运行、可编辑、可保存、可基础导出的桌面 MVP。

---

## 总体目标

构建一个跨平台桌面视频编辑器 open-factory，满足：

1. 本地运行，不强制登录，不上传用户视频。
2. 支持导入本地视频、音频、图片。
3. 支持媒体库、预览画布、时间线、属性面板、顶部工具栏。
4. 支持多轨道时间线：视频轨、音频轨、文字轨。
5. 支持添加素材到时间线、移动 clip、裁剪 clip、分割 clip、删除 clip、撤销/重做。
6. 支持播放头、播放/暂停、时间线缩放、基础吸附。
7. 支持文字叠加：内容、字号、颜色、位置、透明度。
8. 支持保存/打开项目文件：`.cutproj.json`。
9. 支持基础导出：优先调用本机 ffmpeg；如果系统没有 ffmpeg，给出清晰错误提示和安装说明，不允许出现假导出按钮。
10. 项目必须能安装依赖、启动开发环境、通过类型检查、通过测试、构建成功。

---

## 技术栈默认选择

| 层级 | 选型 |
|---|---|
| 桌面壳 | Tauri 2 |
| 前端框架 | Vite + React + TypeScript |
| UI 样式 | Tailwind CSS + 简洁自定义组件；必要时可用 Radix/Base UI |
| 状态管理 | Zustand |
| 编辑动作 | Command Pattern（见"命令系统"章节） |
| 测试 | Vitest |
| 本地文件 | Tauri 插件（见下方插件清单） |
| 导出 | Rust/Tauri command 调用系统 ffmpeg |
| 包管理 | 优先 Bun；环境没有 Bun 则用 npm 或 pnpm，并在 README 中记录 |
| Monorepo | npm / Bun workspaces（根目录 `package.json` workspaces 字段），无需 Turborepo/Nx |

### Tauri 2 必须声明的插件

在 `Cargo.toml` 和 `package.json` 中均需声明，并在 `capabilities/` 配置对应权限：

```
@tauri-apps/plugin-fs          → 文件读写（读取媒体文件、保存项目文件）
@tauri-apps/plugin-dialog      → 系统文件选择器 / 保存对话框
@tauri-apps/plugin-shell       → 检测并调用系统 ffmpeg（通过 Command::new）
```

### Tauri 2 本地媒体访问协议（关键，不处理预览完全失效）

Tauri 2 默认禁止 `file://` 协议访问本地文件。前端加载本地视频/图片时**必须**：

```typescript
import { convertFileSrc } from '@tauri-apps/api/core';

// 将本地绝对路径转换为 tauri://localhost/... 协议 URL
const src = convertFileSrc(asset.path);
videoElement.src = src;
```

同时在 `src-tauri/capabilities/default.json`（或对应 capabilities 文件）中添加：

```json
{
  "permissions": [
    "core:asset:default",
    "fs:allow-read-file",
    "fs:allow-exists"
  ]
}
```

不允许绕过此协议直接用 `file://` 赋值给 `<video src>`，否则在生产构建中会静默失败。

---

## 如果当前仓库为空

1. 初始化一个可运行项目。
2. 目录结构：
   ```
   open-factory/
   ├── apps/
   │   └── desktop/          # Tauri 2 + Vite + React 桌面应用
   ├── packages/
   │   └── editor-core/      # 纯 TypeScript 编辑器核心模型、命令、时间线算法
   ├── docs/                 # 产品方案、架构、路线图
   ├── package.json          # 根 workspaces 配置
   ├── tsconfig.json         # 根 tsconfig（references 模式）
   ├── README.md
   ├── AGENTS.md
   └── .gitignore
   ```
3. `packages/editor-core` 编译为 ESM + 类型声明（`.d.ts`），供 `apps/desktop` 直接 import。

## 如果当前仓库已有内容

1. 先检查现有结构。
2. 尽量不要破坏已有代码。
3. 在适合的位置新增应用和包。
4. 如需调整结构，先在 `docs/migration-notes.md` 记录原因。

---

## 建议实现顺序

> AI 代理应按以下顺序执行，避免先做 UI 再发现底层模型需要返工。

1. `packages/editor-core` — 数据模型 + 时间线算法 + Command Pattern + 单元测试
2. `apps/desktop` 脚手架 — Tauri 2 + Vite + React + Zustand store 接入 editor-core
3. 媒体导入 + 媒体库 UI（含 `convertFileSrc` 本地协议处理）
4. 时间线 UI + 拖拽基础
5. 预览画布（含视频 seek/drawImage 异步处理 + 音频同步）
6. Inspector 属性面板
7. 保存 / 打开项目
8. 导出（ffmpeg 集成 + 进度回传）
9. 快捷键绑定
10. React 错误边界 + Toast 错误显示
11. 全量 `typecheck` + `test` + `build` 验证，修复后汇总报告

---

## 必须实现的文件和模块

---

### 一、文档

创建或更新：

#### 1. README.md

内容包括：
- 项目介绍与截图占位
- 功能清单
- **开发前置依赖（必须列出）**：
  - Rust stable >= 1.77（`rustup install stable`）
  - Node.js >= 20 LTS
  - Bun >= 1.1（或注明使用 npm/pnpm 替代）
  - macOS：`xcode-select --install`
  - Windows：WebView2 Runtime + Microsoft C++ Build Tools（Visual Studio Installer）
  - Linux：`libwebkit2gtk-4.1-dev libssl-dev libgtk-3-dev` 等 Tauri 依赖
- 安装依赖命令
- 开发命令（`bun run dev` / `npm run dev`）
- 构建命令
- 测试命令
- ffmpeg 依赖说明：
  - 安装方式：macOS `brew install ffmpeg`，Windows `winget install ffmpeg`，Linux `apt install ffmpeg`
  - 文字叠加导出需要 ffmpeg 编译时包含 `--enable-libfreetype`（Homebrew / 官方二进制均已包含）
- 当前 MVP 已知限制

#### 2. docs/product-plan.md

- 产品定位
- 用户场景
- MVP 范围
- 非目标
- 后续路线图

#### 3. docs/architecture.md

- 分层架构（editor-core / Tauri Rust / React UI）
- 数据模型（含 `cutproj.json` schema，见下方）
- 命令系统（含 Zustand 集成方式，见下方）
- 预览渲染流程（含 seek/drawImage 异步处理）
- 导出流程（含 ffmpeg 进度回传机制）
- 本地隐私原则（无遥测、无登录、无云服务）
- Tauri 2 媒体访问协议说明（`convertFileSrc` 使用规范）

#### 4. docs/roadmap.md

- v0.1 MVP（当前）
- v0.2 多轨增强 + 媒体路径相对化 + 更好的音视频同步
- v0.3 GPU/WASM 渲染加速
- v0.4 插件 / 脚本 / 模板系统

#### 5. AGENTS.md

写明后续 Codex / AI 代理开发约束：
- 不上传用户媒体
- 时间线修改必须走 command（禁止直接 `set` Zustand timeline state）
- 核心算法必须有测试，`packages/editor-core` 覆盖率目标 ≥ 80%
- 不直接复制第三方项目代码
- 本地媒体访问必须使用 `convertFileSrc`，禁止直接 `file://`
- 运行 `build` / `test` 后再总结
- 建议实现顺序参见根目录规格文件

---

### 二、核心数据模型

在 `packages/editor-core/src/` 中实现：

#### 1. Time helpers（`time.ts`）

- 使用 **seconds（浮点数）** 作为内部 MVP 时间单位，后续可迁移 ticks。
- 提供：`clamp`、`snap`、`round`、`secondsToFrames`、`framesToSeconds`。
- **吸附精度默认 `1/30` 秒（一帧）**，`snap(t, grid = 1/30)` 取最近网格点。

#### 2. Project model（`model.ts`）

```typescript
interface Project {
  version: '0.1';           // 必须有版本字段，用于未来迁移
  id: string;
  name: string;
  createdAt: string;        // ISO 8601
  updatedAt: string;
  settings: ProjectSettings;
  assets: MediaAsset[];
  timeline: Timeline;
}

interface ProjectSettings {
  fps: number;              // 默认 30
  width: number;            // 默认 1280
  height: number;           // 默认 720
}

interface MediaAsset {
  id: string;
  type: 'video' | 'audio' | 'image';
  name: string;
  path: string;             // 绝对路径（MVP），v0.2 迁移为相对路径
  duration: number;         // seconds（图片为 0）
  width: number;
  height: number;
  missing?: boolean;        // 打开项目时路径不存在则标记
}

interface Timeline {
  tracks: Track[];
}

interface Track {
  id: string;
  type: 'video' | 'audio' | 'text';
  name: string;
  clips: Clip[];
}

type Clip = VideoClip | AudioClip | ImageClip | TextClip;

interface BaseClip {
  id: string;
  name: string;
  trackId: string;
  start: number;            // 在时间线上的起始时间（seconds）
  duration: number;         // 在时间线上的持续时间（seconds）
  trimStart: number;        // 素材头部裁剪量（seconds）
  trimEnd: number;          // 素材尾部裁剪量（seconds）
  transform: Transform;
}

interface Transform {
  x: number;                // 相对画布中心偏移，单位 px（1280x720 坐标系）
  y: number;
  scale: number;            // 1.0 = 原始大小
  rotation: number;         // 度数
  opacity: number;          // 0.0 ~ 1.0
}

interface VideoClip extends BaseClip { type: 'video'; mediaId: string; volume: number; }
interface AudioClip extends BaseClip { type: 'audio'; mediaId: string; volume: number; }
interface ImageClip extends BaseClip { type: 'image'; mediaId: string; }
interface TextClip extends BaseClip {
  type: 'text';
  text: string;
  style: TextStyle;
}

interface TextStyle {
  fontSize: number;
  color: string;            // CSS color string
  fontFamily: string;
  bold: boolean;
  italic: boolean;
}
```

#### 3. Timeline helpers（`timeline.ts`）

- `findClipAtTime(track, time)` → `Clip | undefined`
- `getActiveClipsAtTime(timeline, time)` → `Clip[]`（所有轨道中 start ≤ time < start+duration 的 clip）
- `splitClip(clip, splitTime)` → `[Clip, Clip]`（在时间线时间轴上切分，正确计算 trimStart/trimEnd）
- `trimClip(clip, newTrimStart, newTrimEnd)` → `Clip`
- `moveClip(clip, newStart)` → `Clip`（不允许 start < 0）
- `detectOverlap(track, clip, excludeId?)` → `boolean`（检测 clip 与同轨道其他 clip 是否时间重叠）
- `snapTime(time, grid?)` → `number`（默认 grid = 1/30）
- `getTimelineDuration(timeline)` → `number`（所有 clip 的最大结束时间）

---

### 三、Command Pattern

在 `packages/editor-core/src/commands/` 中实现：

#### 1. Command 接口（`command.ts`）

```typescript
export interface Command {
  execute(): void;
  undo(): void;
  description: string;
}
```

#### 2. CommandManager（`command-manager.ts`）

```typescript
export class CommandManager {
  private history: Command[] = [];
  private cursor: number = -1;
  private readonly maxHistory: number = 100;  // 必须有上限，防止内存无限增长

  execute(command: Command): void;
  undo(): void;
  redo(): void;
  canUndo(): boolean;
  canRedo(): boolean;
  clear(): void;
}
```

**Zustand 集成方式（架构决策，必须遵守）**：

```
CommandManager 作为模块级单例（不放在 Zustand store 内）
Command.execute() / undo() 直接调用 useEditorStore.getState().set(...)
Zustand store 持有：timeline state、选中状态、historyMeta: { canUndo, canRedo }
每次 execute/undo/redo 后，CommandManager 调用 updateHistoryMeta() 同步 canUndo/canRedo
禁止：在 React 组件中直接调用 store.set() 修改 timeline——必须通过 commandManager.execute(new XxxCommand(...))
```

#### 3. 必须实现的 Commands

- `AddTrackCommand`
- `AddClipCommand`
- `MoveClipCommand`
- `TrimClipCommand`
- `SplitClipCommand`
- `DeleteClipCommand`
- `UpdateClipCommand`（用于 Inspector 中修改 transform、text、style 等属性）

#### 4. 单元测试覆盖（`packages/editor-core/__tests__/`）

测试用例必须覆盖：
- split clip（普通情况、边界处分割）
- trim clip（头部、尾部、双端）
- move clip（正常移动、防止 start < 0）
- undo / redo（单步、多步、undo 后执行新 command 清空 redo 栈）
- overlap detection（有重叠、无重叠、相邻但不重叠）
- project serialization（序列化 → 反序列化 → 结构完整性）
- CommandManager maxHistory（超出 100 条时最旧记录被移除）

覆盖率目标：`packages/editor-core` ≥ 80%（在 `vitest.config.ts` 中配置 `coverage.thresholds`）。

---

### 四、桌面应用 UI

在 `apps/desktop/src/` 中实现：

#### 错误边界（必须，优先实现）

```
在以下层级添加 React ErrorBoundary：
- EditorShell 根层（兜底，防止白屏）
- PreviewCanvas（canvas 渲染错误不影响时间线）
- Timeline（drag/drop 错误不影响预览）
- Inspector（表单错误不影响其他面板）
捕获后显示 Toast 提示 + "重新加载此面板"按钮，不要让整个应用崩溃。
```

#### 1. EditorShell（`components/EditorShell.tsx`）

四区域布局：
- 顶部工具栏（Toolbar）
- 左侧媒体库（MediaBin）
- 中央预览画布（PreviewCanvas）
- 右侧属性面板（Inspector）
- 底部时间线（Timeline）

#### 2. MediaBin（`components/MediaBin/`）

- 导入按钮（调用 Tauri dialog 文件选择器）
- 拖拽导入（支持从 OS 文件管理器拖文件进入应用窗口，使用 Tauri 的 `dragDrop` 事件或 HTML5 `ondrop`）
- 媒体卡片（缩略图 + 文件名 + 时长/尺寸）
- 媒体缺失时卡片显示"⚠ 文件缺失"徽标
- 相同路径文件重复导入时，直接复用已有 asset 记录（不重复添加），并 Toast 提示"已存在"

#### 3. PreviewCanvas（`components/PreviewCanvas/`）

预览核心规则：

**视频帧渲染（异步 seek，必须正确处理）：**
```
1. 计算 sourceTime = playheadTime - clip.start + clip.trimStart
2. 如果 videoElement.currentTime !== sourceTime，先 seek
3. seek 是异步的：必须监听 'seeked' 事件，事件触发后才调用 drawImage
4. 不要在 seek 后立即 drawImage（currentTime 尚未更新，会画错帧）
5. 每个不同 mediaId 维护一个 HTMLVideoElement 实例（简单对象池，避免重复创建）
```

**播放循环：**
```
使用 requestAnimationFrame 循环：
- 每帧更新 playheadTime（根据 AudioContext.currentTime 或 Date.now() 差值）
- 触发 canvas 重绘
- 多个视频 clip 按轨道顺序从下到上 drawImage 到同一个 canvas
```

**音频预览同步：**
```
MVP 使用 HTMLAudioElement 播放音频轨：
- 播放时：同步设置 audioElement.currentTime 并 play()
- 暂停/seek 时：pause() 并同步 currentTime
- 音视频 currentTime 每秒校准一次（防止累积漂移）
注：不强制使用 Web Audio API，但若遇到多音轨混音需求可迁移。
```

- 支持视频、图片、文字 clip 的 transform（x/y/scale/rotation）和 opacity
- 预览逻辑封装在 `lib/preview/` 目录，不散落在组件中
- 画布分辨率 1280×720，`<canvas>` 元素用 CSS 缩放适配容器尺寸

#### 4. Timeline（`components/Timeline/`）

- 多轨显示（视频/音频/文字轨道，可添加轨道）
- 播放头（可拖动）
- Clip 块（色块 + 名称 + 持续时间）
- 拖拽移动：鼠标释放时检测 `detectOverlap`，**有重叠则弹回原位并 Toast 提示"此位置与其他片段重叠"**（MVP 选择拒绝放置策略）
- 左右边缘拖拽裁剪（拖动左边缘修改 trimStart，拖动右边缘修改 trimEnd）
- 分割按钮 / 快捷键 `S`（在播放头处分割选中 clip）
- 删除按钮 / 快捷键 `Delete`/`Backspace`
- 时间线缩放（鼠标滚轮 + 缩放滑块）
- 吸附：拖动时吸附到播放头、其他 clip 边缘、时间标尺网格（精度 1/30s）
- 导出前检查：时间线为空时禁用导出按钮，tooltip 显示"请先添加素材到时间线"

#### 5. Inspector（`components/Inspector/`）

选中 clip 后可编辑（通过 `UpdateClipCommand` 提交修改）：
- 名称、start、duration
- x / y（相对画布中心，px）
- scale（百分比滑块）
- rotation（度数）
- opacity（0%~100% 滑块）
- volume（仅音频/视频，0%~100% 滑块）
- text（仅文字 clip）
- fontSize、color、fontFamily、bold、italic（仅文字 clip）

#### 6. Toolbar（`components/Toolbar.tsx`）

- 新建项目（有未保存修改时弹确认对话框）
- 打开项目（`.cutproj.json`）
- 保存项目（`Cmd/Ctrl+S`）
- 导入媒体（`Cmd/Ctrl+I`）
- 导出视频（时间线为空时禁用）
- 撤销 / 重做（灰度状态与 `canUndo`/`canRedo` 联动）
- 播放 / 暂停

---

### 五、媒体导入

实现：

1. 使用 Tauri `@tauri-apps/plugin-dialog` 文件选择器，支持多选。
2. 支持扩展名：
   - 视频：`mp4, mov, webm, mkv`
   - 音频：`mp3, wav, m4a, aac, ogg`
   - 图片：`png, jpg, jpeg, webp`
3. 前端生成缩略图：
   - 视频：加载到 hidden `<video>`（使用 `convertFileSrc` URL），seek 到 1 秒或 10% 时长，监听 `seeked` 事件后 `drawImage` 到 canvas，导出为 `data:image/jpeg`。
   - 图片：直接用 `<img>` 加载后 `drawImage` 到 canvas 生成缩略图。
4. 读取元信息：文件名、路径（绝对路径）、类型、时长（视频/音频）、宽高（视频/图片）。
5. **导入前去重**：相同 `path` 的文件已在媒体库中时，不重复添加，Toast 提示"已存在"。
6. 失败时显示 Toast 错误，不让 app 崩溃。

---

### 六、预览渲染

详细规则（补充自"桌面应用 UI - PreviewCanvas"章节，此处为设计约束）：

1. 预览画布比例默认 16:9，分辨率 1280×720。
2. 播放头变化时触发重绘。
3. 视频 clip 渲染：
   - 源时间 = `playheadTime - clip.start + clip.trimStart`
   - seek 异步处理：设置 `video.currentTime` 后等待 `seeked` 事件，再 `ctx.drawImage(video, ...)`
4. 图片 clip：按 `transform` 绘制。
5. 文字 clip：`ctx.fillText()`，应用颜色、字号、透明度、位置、旋转。
6. 多个可见 clip 按轨道顺序（轨道索引从小到大）合成（低序轨道在下，高序轨道在上）。
7. 所有预览逻辑封装在 `apps/desktop/src/lib/preview/`，不散落在组件中。

---

### 七、项目保存 / 打开

#### `.cutproj.json` 格式（必须包含 version 字段）

```json
{
  "version": "0.1",
  "project": {
    "id": "uuid",
    "name": "我的项目",
    "createdAt": "2025-01-01T00:00:00Z",
    "updatedAt": "2025-01-01T00:00:00Z",
    "settings": { "fps": 30, "width": 1280, "height": 720 }
  },
  "assets": [
    {
      "id": "uuid",
      "type": "video",
      "name": "clip.mp4",
      "path": "/Users/xx/Videos/clip.mp4",
      "duration": 10.5,
      "width": 1920,
      "height": 1080
    }
  ],
  "timeline": {
    "tracks": [
      {
        "id": "uuid",
        "type": "video",
        "name": "视频轨 1",
        "clips": [
          {
            "id": "uuid",
            "type": "video",
            "name": "clip.mp4",
            "mediaId": "uuid",
            "trackId": "uuid",
            "start": 0,
            "duration": 5,
            "trimStart": 0,
            "trimEnd": 0,
            "transform": { "x": 0, "y": 0, "scale": 1, "rotation": 0, "opacity": 1 },
            "volume": 1
          }
        ]
      }
    ]
  }
}
```

#### 保存行为

- 首次保存：弹出 Tauri `save` 对话框，让用户选择保存路径。
- 后续保存（已有路径）：直接覆盖写入，无需再次弹框。
- 自动保存：每 30 秒将项目序列化写入 `localStorage`（key: `open-factory:autosave`），作为崩溃恢复用，不替代正式保存。

#### 打开行为

- 恢复时间线。
- 检查每个 asset 的 `path` 是否存在（调用 Tauri `fs.exists()`）。
- 缺失 asset 标记 `missing: true`，媒体库卡片显示警告，引用该 asset 的 clip 在时间线上显示斜线样式。
- 缺失 asset 不阻止项目打开，不导致 app 崩溃。
- `version` 不匹配时在控制台 warn，预留迁移扩展点。

---

### 八、导出

实现一个真实可用的 MVP 导出（**不允许只有按钮没有功能**）：

#### 1. ffmpeg 检测

```rust
// src-tauri/src/export.rs
use std::process::Command;

#[tauri::command]
pub fn check_ffmpeg() -> bool {
    Command::new("ffmpeg").arg("-version").output().is_ok()
}
```

- macOS / Linux：检测 `ffmpeg`
- Windows：检测 `ffmpeg.exe`
- 找不到时，前端弹窗提示安装方式（见 README）

#### 2. 导出目标

- 格式：MP4，H.264 + AAC
- 分辨率：1280×720
- 帧率：30fps

#### 3. MVP 导出能力

**必须实现**：单主视频轨裁剪导出（对应第一条 video track 的所有 clip，按时间线顺序合并）。

**如果实现复杂**：先支持"单视频轨 + 音频导出"，并在导出对话框 UI 中明确显示：
> "当前版本仅支持单视频轨导出。多轨混合、文字叠加导出将在后续版本支持。"

文字叠加导出使用 ffmpeg `drawtext` filter；若系统 ffmpeg 不含 `libfreetype`，降级为纯视频导出并 Toast 提示。

#### 4. ffmpeg 进度回传（关键实现细节）

```rust
// Rust 侧：spawn ffmpeg 子进程，逐行读 stderr，通过 Tauri event 推送进度
use tauri::{AppHandle, Emitter};
use std::io::{BufRead, BufReader};

// ffmpeg stderr 格式示例：
// frame=  150 fps= 29 time=00:00:05.00 bitrate= 512.0kbits/s speed=1.2x
// 解析 time= 字段，除以总时长得到 0.0~1.0 进度
fn parse_progress(line: &str) -> Option<f64> { ... }

// 每解析到进度值，emit 事件：
app.emit("export-progress", progress_value)?;
```

```typescript
// 前端：监听进度事件
import { listen } from '@tauri-apps/api/event';
const unlisten = await listen<number>('export-progress', (e) => {
  setExportProgress(e.payload); // 0.0 ~ 1.0
});
```

#### 5. 导出流程 UI

- 导出按钮点击后进入"导出进行中"状态，禁止重复点击。
- 显示进度条（0%~100%）。
- 提供"取消"按钮（调用 Tauri command kill ffmpeg 子进程）。
- 导出成功后提示"导出完成"，并提供"打开文件夹"按钮（调用 Tauri `shell.open()`）。

#### 6. ffmpeg 命令构建逻辑

- 所有 ffmpeg 命令字符串拼接逻辑放在独立模块：`src-tauri/src/ffmpeg_builder.rs`。
- 对应前端测试辅助函数放在 `packages/editor-core/src/export/`，并加单元测试。
- **Windows 路径处理**：在传入 ffmpeg 命令前，将 Windows 反斜杠路径统一转换为正斜杠（ffmpeg on Windows 支持正斜杠）：
  ```rust
  let path = input_path.replace('\\', "/");
  ```

---

### 九、快捷键

| 快捷键 | 功能 |
|---|---|
| `Space` | 播放 / 暂停 |
| `S` | 在播放头处分割选中 clip |
| `Delete` / `Backspace` | 删除选中 clip |
| `Cmd/Ctrl+Z` | 撤销 |
| `Cmd/Ctrl+Shift+Z` 或 `Cmd/Ctrl+Y` | 重做 |
| `Cmd/Ctrl+S` | 保存项目 |
| `Cmd/Ctrl+O` | 打开项目 |
| `Cmd/Ctrl+I` | 导入媒体 |

快捷键绑定使用 React `useEffect` + `window.addEventListener('keydown')`，并在组件卸载时移除。`Space` 快捷键在输入框（`input`/`textarea`）聚焦时不触发播放。

---

### 十、窗口关闭保护

在 Tauri 的 `on_close_requested` 事件中处理未保存确认：

```rust
// src-tauri/src/main.rs
window.on_close_requested(|api| {
    // emit 事件到前端，由前端决定是否确认关闭
    api.prevent_close();
    window.emit("close-requested", ()).ok();
});
```

前端收到 `close-requested` 事件后，若有未保存修改，弹出确认对话框：
- "保存后关闭"→ 先保存，再调用 `appWindow.close()`
- "不保存直接关闭"→ 直接调用 `appWindow.close()`
- "取消"→ 不关闭

---

### 十一、质量要求

1. TypeScript strict 模式（`"strict": true` 在所有 `tsconfig.json` 中）。
2. 核心时间线算法必须有 Vitest 测试，`packages/editor-core` 覆盖率 ≥ 80%。
3. 所有主要组件拆分清晰，单文件建议不超过 300 行；如果超出，拆分子组件或 hooks。
4. 不引入无必要的重型依赖。
5. 不使用云服务、登录、远程分析。
6. 错误必须可见：Toast、dialog 或状态栏。
7. React ErrorBoundary 覆盖关键面板（见"错误边界"章节）。
8. UI 可以简洁，但必须可用。
9. 最终必须运行：
   ```
   安装依赖 → typecheck → test → build
   ```
   如果有命令失败，修复后重跑；确实受环境限制时，在最终报告中说明原因和下一步。

---

### 十二、验收标准

完成后，我应该能：

1. 启动 open-factory 桌面应用。
2. 导入一个本地 mp4。
3. 把视频加入时间线。
4. 播放 / 暂停预览（视频帧正常显示）。
5. 拖动 clip 位置（重叠时弹回，Toast 提示）。
6. 裁剪 clip 左右边缘。
7. 在播放头处分割 clip。
8. 添加文字 clip 并在预览中看到文字。
9. 保存项目为 `.cutproj.json`。
10. 重新打开项目并恢复时间线（缺失媒体时显示 warning 但不崩溃）。
11. 点击导出，如果 ffmpeg 可用则导出 MP4；如果不可用则看到清晰安装提示。
12. 运行测试和构建通过。
13. 关闭窗口时，有未保存修改则弹出确认对话框。

---

### 十三、最终输出报告

任务完成后，请给出：

1. 你创建 / 修改了哪些主要文件（按目录列出）。
2. 项目如何运行（完整命令，含前置依赖安装）。
3. 项目如何测试（命令 + 覆盖率报告路径）。
4. 项目如何构建（命令 + 产物位置）。
5. 当前实现了哪些功能。
6. 当前有哪些明确限制（与 MVP 规格的差异，需标注原因）。
7. 下一步最值得做的 5 个增强项（按优先级排序，说明理由）。
8. 如果有任何命令失败，给出：失败原因、已尝试修复方式、剩余问题、推荐的下一步解决方案。

---

## 附录 A：架构决策速查

| 决策点 | MVP 选择 | 备注 |
|---|---|---|
| 时间单位 | seconds（浮点数） | v0.2 可迁移 ticks |
| 吸附精度 | 1/30 秒（一帧） | 可配置 |
| 项目路径类型 | 绝对路径 | v0.2 迁移相对路径 |
| 重叠处理 | 拒绝放置，弹回原位 | 简单可靠 |
| 媒体重复导入 | 相同路径去重 | Toast 提示 |
| CommandManager 位置 | 模块级单例，不在 Zustand | 避免循环依赖 |
| 音频预览 | HTMLAudioElement | 简单，v0.3 迁移 Web Audio |
| 视频 seek | seeked 事件后 drawImage | 必须，否则画错帧 |
| 导出进度 | ffmpeg stderr 解析 + Tauri emit | 真实进度，非假进度条 |
| undo 历史上限 | 100 条 | 防止内存无限增长 |
| Monorepo 工具 | npm / Bun workspaces | 无需 Turborepo |
| UI 语言 | 英文（国际化友好） | 后续 i18n |

---

## 附录 B：常见坑及处理方式

| 问题 | 原因 | 处理方式 |
|---|---|---|
| 本地视频无法在 `<video>` 中播放 | Tauri 2 禁止 `file://` | 使用 `convertFileSrc()` + capabilities 配置 |
| seek 后 drawImage 画面错误 | seek 异步，currentTime 未更新 | 等 `seeked` 事件再 drawImage |
| ffmpeg 导出无进度 | 需解析 stderr | 用 `BufReader` 逐行读 stderr，解析 `time=` 字段 |
| Windows 路径导致 ffmpeg 报错 | 反斜杠路径 | 传入前 `.replace('\\', "/")` |
| 文字导出黑屏 / 报错 | ffmpeg 缺 `libfreetype` | 降级纯视频导出 + UI 提示 |
| 项目打开崩溃 | 缺失媒体引发异常 | 捕获 + 标记 missing，继续加载 |
| Undo 导致内存增长 | 无历史上限 | CommandManager.maxHistory = 100 |