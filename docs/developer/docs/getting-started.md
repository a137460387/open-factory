---
sidebar_position: 1
slug: /
---

# 快速开始

欢迎使用 Open Factory 开发者文档。本指南将帮助你快速了解项目结构并开始开发。

## 概述

Open Factory 是一个**本地优先**的 AI 视频编辑器，采用 TypeScript monorepo 架构。核心特性包括：

- 非线性视频编辑引擎
- AI 智能剪辑与分析
- 插件扩展系统
- 实时多人协作
- 命令行渲染工具

## 项目结构

```
open-factory/
├── apps/
│   └── desktop/          # Tauri 桌面应用
├── packages/
│   ├── editor-core/      # 编辑器核心引擎
│   ├── plugin-sdk/       # 插件开发 SDK
│   ├── cli/              # 命令行工具
│   ├── collaboration-server/  # 协作服务器（开发中）
│   ├── plugin-market/    # 插件市场（开发中）
│   └── plugin-cli/       # 插件脚手架工具
├── docs/                 # 项目文档
├── tools/                # 开发工具
└── tests/                # 集成测试
```

## 环境准备

### 系统要求

| 工具 | 版本要求 |
|------|---------|
| Node.js | >= 18.0 |
| Bun | >= 1.3 |
| Rust | >= 1.77（用于 Tauri） |
| Git | >= 2.0 |

### 安装依赖

```bash
# 克隆仓库
git clone https://github.com/a137460387/open-factory.git
cd open-factory

# 安装依赖
bun install

# 类型检查
bun run typecheck

# 运行测试
bun run test
```

### 启动开发服务器

```bash
# 启动桌面应用开发模式
bun run dev

# 启动 Tauri 开发模式（包含原生窗口）
bun run tauri:dev
```

## 包概览

### editor-core

编辑器核心引擎，提供时间线管理、剪辑操作、AI 分析、导出渲染等功能。

```typescript
import {
  splitClip,
  findClipAtTime,
  getActiveClipsAtTime,
} from '@open-factory/editor-core';

// 在指定时间点分割剪辑
const [left, right] = splitClip(clip, splitTime);

// 查找指定时间的剪辑
const clip = findClipAtTime(track, currentTime);
```

**主要模块：**

| 模块 | 说明 |
|------|------|
| `timeline` | 时间线操作（分割、裁剪、排序） |
| `keyframes` | 关键帧动画系统 |
| `effects` | 视频/音频效果 |
| `color-grading` | 调色与色彩管理 |
| `export` | 导出与渲染管线 |
| `ai/*` | AI 智能功能 |
| `collaboration` | 协作编辑支持 |

### plugin-sdk

插件开发框架，提供安全沙箱、生命周期管理和 API 访问控制。

```typescript
import type { OpenFactoryPlugin } from '@open-factory/plugin-sdk';

const myPlugin: OpenFactoryPlugin = {
  id: 'my-plugin',
  name: 'My Plugin',
  version: '1.0.0',
  description: 'A sample plugin',
  permissions: ['read-project', 'menu-register'],
  hooks: {
    onClipSelected({ clip }) {
      console.log('Selected:', clip?.id);
    },
    onMenuRegister({ menus }) {
      menus.push({ id: 'my-action', label: 'My Action' });
    },
  },
};

export default myPlugin;
```

### cli

命令行工具，支持无头渲染、模板应用和自动化工作流。

```bash
# 渲染项目文件
of render --input project.json --output output.mp4

# 应用模板
of apply-template --template cinematic --input ./raw-media

# 分析视频质量
of analyze --input video.mp4 --type quality

# 运行工作流
of workflow --definition workflow.json
```

## 下一步

- 阅读 [Editor Core API](./api/editor-core.md) 了解核心编辑功能
- 阅读 [Plugin SDK API](./api/plugin-sdk.md) 开始插件开发
- 阅读 [插件开发指南](./guides/plugin-development.md) 获取详细教程
- 阅读 [贡献指南](./contributing.md) 参与项目开发
