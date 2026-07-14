# 开发指南

## 环境要求

- **Bun** 1.3+
- **Rust** 1.75+（Tauri 桌面应用编译需要）
- **FFmpeg**（用于媒体处理）
- **Node.js** 18+（用于 Playwright E2E 测试）

## 快速开始

```bash
# 安装依赖
bun install

# 启动 Web 开发服务器（Vite）
bun run dev

# 启动 Tauri 桌面应用（同时启动 Web 开发服务器 + Rust 后端）
bun run tauri:dev
```

## 常用命令

| 命令 | 说明 |
|---|---|
| `bun run typecheck` | TypeScript 类型检查 |
| `bun run test` | 运行单元测试（含覆盖率） |
| `bun run format` | Prettier 格式化代码 |
| `bun run format:check` | 检查代码格式是否符合规范 |
| `bun run build` | 构建所有包和应用 |
| `bun run e2e` | 运行 E2E 测试（Playwright） |
| `bun run e2e:headed` | 运行 E2E 测试（带浏览器界面） |
| `bun run e2e:ui` | 运行 E2E 测试（Playwright UI 模式） |
| `bun run tauri:build` | 构建 Tauri 桌面应用 |
| `bun run create-plugin` | 创建新插件脚手架 |

## 项目结构

```
open-factory/
├── apps/
│   └── desktop/          # Tauri 桌面应用（React + Vite + Rust）
├── packages/
│   ├── editor-core/      # 核心编辑器逻辑（纯 TypeScript）
│   └── plugin-sdk/       # 插件 SDK（供第三方插件使用）
├── tools/                # 工具脚本
├── scripts/              # 辅助脚本
└── docs/                 # 文档
```

本项目使用 Bun workspace 管理 monorepo，`apps/*` 和 `packages/*` 均为工作区成员。

## 代码规范

- **格式化**：使用 Prettier 统一代码格式，提交前请运行 `bun run format`。
- **TypeScript 严格模式**：所有代码必须通过 `bun run typecheck`。
- **测试覆盖率**：`editor-core` 包要求覆盖率 80% 以上。
- **提交规范**：遵循 [Conventional Commits](https://www.conventionalcommits.org/) 规范，例如 `feat: xxx`、`fix: xxx`、`docs: xxx`。

## 架构原则

- **本地优先**：本项目不添加任何遥测、登录或云服务依赖，所有数据和处理均在本地完成。
- **Timeline 变更通过命令对象**：所有对 Timeline 的修改操作均通过命令对象（Command Pattern）执行，便于实现撤销/重做。
- **Tauri 调用通过 tauri-bridge.ts**：前端与 Rust 后端的所有通信统一通过 `tauri-bridge.ts` 封装，不直接调用 Tauri API。
