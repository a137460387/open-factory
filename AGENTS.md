# AI Agent 规则

## 通用约定

- 除非是代码、命令或路径，所有的解释、分析、规划和最终报告必须使用简体中文输出。
- 本项目是**本地优先**的桌面视频编辑器，禁止添加遥测、登录或云服务依赖（详见「核心架构约束→本地优先判定标准」）。

## 运行背景与核心约束

### 项目定位

open-factory 是一个本地优先的桌面视频编辑器，支持 AI 辅助编辑和插件扩展。所有数据和处理均在本地完成，不依赖云服务。

### 技术栈

- **前端**：React 19 + TypeScript 5.8+ + Vite 6.4
- **桌面**：Tauri 2 + Rust
- **状态管理**：Zustand 5
- **包管理**：Bun 1.3.14
- **测试**：Vitest + Playwright
- **Monorepo**：apps/* + packages/*

### 架构约束

- `packages/editor-core` 必须保持纯 TypeScript，不依赖 Tauri 或浏览器 API
- Timeline 变更必须通过命令对象执行（详见「核心架构约束→Timeline 命令对象约束」）
- 所有 Tauri 调用必须通过 `tauri-bridge`（barrel：`tauri-bridge.ts` + 子模块目录 `tauri-bridge/`，详见「核心架构约束→Tauri Bridge 约束」）
- 本地媒体预览必须使用 `convertFileSrc`（详见「特定模块约束→媒体处理」）

## 核心架构约束

### 本地优先判定标准

- **禁止**在代码中硬编码云服务端点或第三方 API 地址
- **禁止**添加用户登录/注册/认证功能
- **禁止**添加遥测数据上报或分析跟踪
- 所有数据处理必须在本地完成，不发送到外部服务器
- 本地媒体文件不得上传到任何远程服务

### Timeline 命令对象约束

- 所有 Timeline 修改必须通过命令对象执行
- **禁止**直接调用 Zustand setter 修改 timeline clips 或 tracks
- 命令对象必须支持撤销/重做操作
- 命令对象必须记录操作类型和影响范围

### Tauri Bridge 约束

- 所有 Tauri invoke/listen/dialog/shell 调用必须通过 tauri-bridge 层：barrel 入口 `apps/desktop/src/lib/tauri-bridge.ts` 及按域拆分的子模块目录 `apps/desktop/src/lib/tauri-bridge/`（types/mock-types/fs/media/export/window/ai-db/video-gen/ltx-video/audio-visual-analysis/ipc-optimizer 等）。子模块默认经 barrel `export *` 导出；audio-visual-analysis、ipc-optimizer 为按子模块路径直接引用的例外。新增 bridge 封装应加入对应子模块，不得在业务代码中直接 import `@tauri-apps/*` 运行时 API
- `import type` 形式的 `@tauri-apps/*` 类型导入豁免；仅运行时 invoke/listen/dialog/shell 调用必须走 bridge
- 新增 Tauri 命令必须在 `apps/desktop/src-tauri/src/lib.rs` 注册
- FFmpeg 执行必须使用 `Command::new("ffmpeg").args(&plan.full_args)` 参数数组
- **禁止**执行 shell 字符串，必须使用参数数组形式

### Store 规范（自 Store 按功能域拆分重构后）

> **背景**：此前 `editorUIStore.ts` 和 `editorFeatureStore.ts` 是承载所有 UI/功能状态的单体 store，现已按功能域拆分，新状态不应再加入这两个文件。

- **禁止**向 `editorUIStore.ts` 或 `editorFeatureStore.ts` 添加新状态
- 新 UI 状态按功能域添加到对应 Store：
  - 对话框状态 → `dialogStore.ts`
  - 模态框状态 → `modalStore.ts`
  - 面板状态 → `panelStore.ts`
  - 工具栏状态 → `toolbarStore.ts`
- 新功能状态按功能域添加到对应 Store：
  - AI 功能 → `aiFeatureStore.ts`
  - 导出功能 → `exportFeatureStore.ts`
  - 时间线功能 → `timelineFeatureStore.ts`
  - 媒体功能 → `mediaFeatureStore.ts`
- 实现新功能前，必须对照 `docs/roadmap.md` 和 `docs/architecture.md` 确认模块依赖顺序，按文档描述的顺序推进，不依赖固定顺序。

## 开发流程默认策略

### 验证流程

- 任何实现任务完成后必须通过 `bun run typecheck` 和 `bun run build`
- `packages/editor-core` 包必须保持 80% 以上测试覆盖率，由 `vitest.config.ts` 中 `thresholds` glob（`packages/editor-core/src/**/*.ts`）强制
- 修改 `packages/editor-core/src/export/ffmpeg-builder/**` 必须在 `packages/editor-core/__tests__/ffmpeg-builder.test.ts` 有对应覆盖

### 测试策略

- 核心时间线算法必须有 Vitest 覆盖
- 项目 schema 修改必须有迁移测试（详见「特定模块约束→项目文件」）
- 导出预设变更必须有测试覆盖（详见「特定模块约束→导出系统」）
- 缓存键规则变更必须更新 `cache-key.test.ts`（详见「特定模块约束→缓存系统」）
- Relink 评分变更必须更新 `relink-score.test.ts`（详见「特定模块约束→缓存系统」）

### 构建要求

- **禁止**伪造成功的导出、测试或构建
- 大文件处理必须异步执行，不阻塞 UI 线程
- 后台媒体作业限流规则见「特定模块约束→媒体处理」
- 原生冒烟测试必须报告真实环境结果，不能阻塞在无人值守的 OS 对话框

## 仓库安全边界

### 文件修改限制

- **禁止**修改 `package.json` / `package-lock.json`（除非任务明确需要）
- **禁止**全仓 format / lint --fix
- 新增依赖需要明确说明理由和必要性
- 不复制第三方项目代码、资产、logo 或宣传文案

### 提交规范

- 遵循 [Conventional Commits](https://www.conventionalcommits.org/) 规范
- 常用类型：`feat`、`fix`、`docs`、`style`、`refactor`、`perf`、`test`、`chore`
- 常用范围：`editor-core`、`desktop`、`plugin-sdk`、`timeline`、`export`、`ai`、`media`
- 安全相关变更必须单独提交，不得混入无关改动

### PR 流程

- PR 范围必须聚焦，避免混合无关重构
- 必须包含验证结果（typecheck、测试、build）
- 必须保持有用的 `data-testid` 覆盖，便于 Playwright E2E
- 为核心时间线算法、导出规划、项目迁移、缓存键和 Relink 评分补充对应测试

## 特定模块约束

### 媒体处理

- 本地媒体预览必须使用 Tauri `convertFileSrc` 封装后的路径，禁止直接使用 `file://`
- 代理媒体必须保持为本地缓存数据
- 预览可以使用代理，但导出必须继续使用原始源媒体
- 后台媒体作业必须顺序执行或显式限流

### 导出系统

- 导出队列必须保持每任务状态在 UI 中可见
- 取消操作必须连接到 `cancel_export` 用于正在运行的任务
- 导出预设变更必须在 E2E 或 core builder 测试中反映
- 预览音频变更必须保留本地-only 媒体访问，避免使用静音代理文件

### 缓存系统

- 缓存键规则变更必须更新 `cache-key.test.ts`
- Relink 评分变更必须更新 `relink-score.test.ts`
- 媒体导入变更必须考虑 `apps/desktop/src/cache/cache-service.ts`

### 项目文件

- 项目 schema 修改必须有 `project-migration.ts` 和迁移测试
- 向后兼容：旧的 import 路径通过 barrel re-export 保持可用
- 推荐直接引用具体模块路径以优化 Tree-shaking

## 代码风格

### TypeScript / React

- **格式化**：使用 Prettier 统一代码风格，提交前运行 `bun run format`
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
- **错误处理**：生产代码禁止使用 `expect()` 和 `unwrap()`，使用 `map_err` 或 `?` 运算符；测试代码（`#[cfg(test)]` 或 `tests/` 目录下）允许使用 `expect()`/`unwrap()`
- **文档注释**：公共函数和结构体必须添加 `///` 文档注释
- **FFmpeg 调用**：参数数组规则见「核心架构约束→Tauri Bridge 约束」

### 通用规范

- 注释应解释复杂约束或安全边界，不重复代码本身
- 不复制第三方项目代码、资产、logo 或宣传文案
- 保持实现清洁（clean-room），不直接复制粘贴外部代码

## 审计类任务规范

执行代码审计、死代码扫描、依赖分析等"生成清单类"任务时，必须遵守以下规则：

### 1. 原始工具输出必须落盘

任何基于工具输出生成的审计文档，必须同时：

- 将工具的完整原始输出保存为独立文件（如 `docs/evidence/<tool>-<date>.txt`）
- 审计文档中的每一条结论，附带指向原始文件的行号引用
- 如果无法保存完整原始输出，至少保存关键片段的原文摘录

### 2. 删除/修改前必须独立验证目标存在

对审计清单中每一项，执行操作前必须先独立确认：

- 目标在当前代码库中确实存在（grep 或读文件确认）
- 目标在原始工具输出中确实被报告过
- 存在 ≠ 检测来源可信，需要明确标注

### 3. 数字必须一致

执行过程中如果出现前后不一致的数字或事实，必须先停下核实根因，不能因为"结果好像没问题"就跳过。

### 4. 危险操作前用只读命令重新核实状态

长会话可能产生与当前任务无关的幻觉输出。执行任何写操作前，应先用纯只读命令重新核实真实状态。

### 5. 范围必须锁定

- 只执行经过确认批准的清单项
- 每一类/每一批操作后必须先验证通过，再进入下一批
- 收到暂停指令后，必须停在当前最小操作单元