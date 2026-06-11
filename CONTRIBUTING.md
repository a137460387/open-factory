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

- TypeScript/React 遵循项目现有结构和命名。
- 使用 ESLint 和 Prettier 的默认项目格式，不提交无关格式化。
- Rust 代码提交前运行 `cargo fmt`。
- 注释应解释复杂约束或安全边界，不重复代码本身。
- 不复制第三方项目代码、资产、logo 或宣传文案。
