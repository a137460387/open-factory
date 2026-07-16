# Contributing

感谢你参与 open-factory。这个项目是本地优先的桌面视频字幕编辑器，贡献时请优先保护用户媒体、工程文件和本地设备边界。

## 环境准备

- Rust stable >= 1.77
- Node.js >= 20 LTS
- Bun 1.3.14，匹配根目录固定的 `packageManager`
- FFmpeg，需包含常见编码器以及 `drawtext`/`libfreetype`
- Windows 需要 WebView2 Runtime 和 Visual Studio C++ Build Tools
- macOS 需要 Xcode Command Line Tools
- Linux 需要 Tauri WebKit 和 GTK 相关依赖

安装依赖：

```bash
bun install
```

## 开发流程

1. 从最新主分支创建功能分支。
2. 阅读 `AGENTS.md` 和相关源码，确认改动边界。
3. 优先修改核心逻辑和测试，再接 UI 和 Tauri 层。
4. 时间线变更必须通过 command 对象，不要在 React 组件里直接改写 timeline clips 或 tracks。
5. 所有 Tauri invoke/listen/dialog/shell 调用必须通过 `apps/desktop/src/lib/tauri-bridge.ts`。
6. 本地媒体预览必须使用 Tauri `convertFileSrc` 封装后的路径，不要直接设置 `file://`。

常用命令：

```bash
bun run dev
bun run typecheck
bun run test
bun run build
```

## 提 Issue 规范

提交 Issue 时请包含：

- 问题类型：bug、功能建议、文档、构建问题或安全问题。
- 操作系统、open-factory 版本、FFmpeg 版本。
- 最小复现步骤和实际结果。
- 期望结果。
- 可公开的截图、日志或示例工程。

请不要上传私人媒体文件。安全漏洞请按 `SECURITY.md` 私下报告，不要公开披露复现细节。

## PR 流程

1. 保持 PR 范围聚焦，避免混合无关重构。
2. 为核心时间线算法、导出规划、项目迁移、缓存键和 Relink 评分补充对应测试。
3. UI 主流程变更应保留或补充有用的 `data-testid`，便于 Playwright E2E 覆盖。
4. 新增 Tauri command 时必须在 `apps/desktop/src-tauri/src/lib.rs` 注册，并通过桥接层调用。
5. 修改导出预设、FFmpeg 参数或队列行为时，补充 core builder 测试或 E2E 覆盖。
6. 提交前运行 typecheck、测试和 build，并在 PR 描述里写明验证结果。

## 代码风格

### TypeScript / React

- **格式化**：使用 Prettier 统一代码风格，提交前运行 `bun run format`
- **格式检查**：CI 中会运行 `bun run format:check`，确保代码格式一致
- **类型安全**：禁止使用 `as any` 类型断言，使用具体类型或泛型
- **命名规范**：
  - 组件使用 PascalCase：`MyComponent`
  - 函数/变量使用 camelCase：`myFunction`
  - 常量使用 UPPER_SNAKE_CASE：`MY_CONSTANT`
  - 类型/接口使用 PascalCase：`MyInterface`
- **JSDoc**：公共 API 和复杂函数必须添加 JSDoc 注释
- **React.memo**：频繁渲染的纯组件应使用 `React.memo` 包裹
- **React.lazy**：重型对话框和面板组件应使用 `React.lazy` 延迟加载

### Rust

- **格式化**：使用 `cargo fmt` 统一代码风格
- **错误处理**：生产代码禁止使用 `expect()` 和 `unwrap()`，使用 `map_err` 或 `?` 运算符
- **文档注释**：公共函数和结构体必须添加 `///` 文档注释
- **FFmpeg 调用**：使用 `Command::new("ffmpeg").args(&plan.full_args)` 参数数组，禁止执行 shell 字符串

### 通用规范

- 注释应解释复杂约束或安全边界，不重复代码本身
- 不复制第三方项目代码、资产、logo 或宣传文案

## 提交规范

使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### 类型（type）

| 类型 | 说明 |
|------|------|
| `feat` | 新功能 |
| `fix` | 修复 bug |
| `docs` | 文档更新 |
| `style` | 代码格式调整（不影响逻辑） |
| `refactor` | 重构（既不修复 bug 也不添加功能） |
| `perf` | 性能优化 |
| `test` | 添加或修改测试 |
| `chore` | 构建过程或辅助工具变动 |

### 范围（scope）

常用范围：`editor-core`、`desktop`、`plugin-sdk`、`timeline`、`export`、`ai`、`media`

### 示例

```
feat(timeline): 添加片段分组功能
fix(export): 修复 FFmpeg 编码参数错误
refactor: 清理 P2 级别技术债
test(window-mask): 添加边界情况测试
```

## 测试要求

- **单元测试**：editor-core 包覆盖率不低于 80%
- **边界情况**：新功能必须包含边界情况测试
- **E2E 测试**：核心流程变更需要添加或更新 E2E 测试
- **测试命令**：
  ```bash
  bun run test              # 运行所有单元测试
  bun run test -- --watch   # 监听模式
  bun run e2e               # 运行 E2E 测试
  ```

## 架构原则

- **本地优先**：不添加遥测、登录或云服务
- **Timeline 命令对象**：Timeline 变更必须通过命令对象，禁止直接调用 Zustand setter
- **Tauri Bridge**：所有 Tauri invoke/listen/dialog/shell 调用必须通过 `tauri-bridge/` 模块
- **路径安全**：使用 `validate_path` 和 `validate_path_for_write` 验证路径
- **媒体处理**：本地媒体预览使用 Tauri `convertFileSrc`，禁止直接使用 `file://`

## 模块化规范 (v4.26.0)

v4.26.0 完成了大规模架构重构，新代码必须遵循以下规范：

### Store 规范

- **禁止**向 `editorUIStore.ts` 或 `editorFeatureStore.ts` 添加新状态
- 新 UI 状态按功能域添加到对应的 Store：
  - 对话框状态 → `dialogStore.ts`
  - 模态框状态 → `modalStore.ts`
  - 面板状态 → `panelStore.ts`
  - 工具栏状态 → `toolbarStore.ts`
- 新功能状态按功能域添加到对应的 Store：
  - AI 功能 → `aiFeatureStore.ts`
  - 导出功能 → `exportFeatureStore.ts`
  - 时间线功能 → `timelineFeatureStore.ts`
  - 媒体功能 → `mediaFeatureStore.ts`

### 组件规范

- **禁止**向 `Timeline.tsx` 或 `Inspector.tsx` 主组件添加超过 50 行的新逻辑
- 新逻辑应提取到对应的 hook 或子组件：
  - Timeline 状态逻辑 → `useTimelineState.ts`
  - Timeline 事件处理 → `useTimelineHandlers.ts`
  - Inspector 状态逻辑 → `useClipInspectorState.ts`
  - Inspector 字段组件 → `InspectorFields.tsx`
  - Inspector 编辑器组件 → `InspectorEditors.tsx`

### editor-core 规范

- **禁止**向 `ffmpeg-builder/index.ts`、`model/index.ts`、`tauri-bridge/index.ts` 添加新逻辑
- 新的 FFmpeg 滤镜逻辑添加到 `ffmpeg-builder/` 对应子模块
- 新的模型规范化逻辑添加到 `model/` 对应子模块
- 新的 Tauri 桥接逻辑添加到 `tauri-bridge/` 对应子模块

### 向后兼容

- 旧的 import 路径通过 barrel re-export 保持可用
- 推荐直接引用具体模块路径以优化 Tree-shaking
- 详见 [迁移指南](docs/migration/v4.26.0-migration-guide.md)
