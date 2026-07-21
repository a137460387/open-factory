---
sidebar_position: 1
---

# 插件开发指南

本指南将带你从零开始创建一个 Open Factory 插件，涵盖项目初始化、开发、测试和发布的完整流程。

## 前置条件

- Node.js >= 18.0
- Bun >= 1.3
- 基本的 TypeScript 知识
- 了解 Open Factory 的基本操作

## 快速开始

### 使用脚手架创建插件

```bash
# 使用内置的插件创建工具
bun run create-plugin

# 或手动创建项目目录
mkdir my-open-factory-plugin
cd my-open-factory-plugin
bun init
```

### 项目结构

```
my-plugin/
├── src/
│   ├── index.ts          # 插件入口
│   ├── hooks/            # Hook 实现
│   │   ├── on-clip-selected.ts
│   │   └── on-export-before.ts
│   └── utils/            # 工具函数
│       └── helpers.ts
├── manifest.json         # 插件清单
├── package.json
└── tsconfig.json
```

### 安装依赖

```bash
bun add @open-factory/plugin-sdk
bun add -D typescript @types/node
```

### 配置 tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "declaration": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

## 开发插件

### 第一步：定义 Manifest

创建 `manifest.json`：

```json
{
  "id": "com.example.my-plugin",
  "name": "My Awesome Plugin",
  "version": "1.0.0",
  "description": "A powerful plugin for Open Factory",
  "permissions": ["read-project", "menu-register"],
  "main": "./dist/index.js"
}
```

### 第二步：实现插件主体

创建 `src/index.ts`：

```typescript
import type { OpenFactoryPlugin, PluginHooks } from '@open-factory/plugin-sdk';

/**
 * Plugin hooks implementation.
 * Each hook is called at a specific point in the editor lifecycle.
 */
const hooks: PluginHooks = {
  /**
   * Called when a clip is selected in the timeline.
   * Use this to react to user selection and update UI.
   */
  onClipSelected({ clip }) {
    if (!clip) {
      console.log('Selection cleared');
      return;
    }

    console.log(`Selected clip: ${clip.id} (${clip.type})`);
    console.log(`  Start: ${clip.start}s, Duration: ${clip.duration}s`);
  },

  /**
   * Called before export starts.
   * Use this to modify export settings or perform pre-processing.
   */
  onExportBefore({ project, outputPath, settings }) {
    console.log(`Exporting "${project.name}" to ${outputPath}`);

    // Example: Add a watermark for free tier users
    if (settings) {
      settings.watermark = {
        text: 'Created with My Plugin',
        position: 'bottom-right',
        opacity: 0.3,
      };
    }
  },

  /**
   * Called to register custom menu items.
   * Add your plugin's actions to the editor menu.
   */
  onMenuRegister({ menus }) {
    menus.push(
      {
        id: 'my-plugin-analyze',
        label: 'Analyze Selected Clips',
      },
      {
        id: 'my-plugin-batch-rename',
        label: 'Batch Rename Clips',
      }
    );
  },
};

/**
 * Plugin definition.
 */
const plugin: OpenFactoryPlugin = {
  id: 'com.example.my-plugin',
  name: 'My Awesome Plugin',
  version: '1.0.0',
  description: 'A powerful plugin for Open Factory',
  permissions: ['read-project', 'menu-register'],
  hooks,
};

export default plugin;
```

### 第三步：使用插件 API

访问宿主提供的 API：

```typescript
/**
 * Example: Analyze all clips in the current project.
 */
async function analyzeClips(): Promise<void> {
  // Access the global plugin API
  const project = await openFactory.getProject();

  let totalDuration = 0;
  const clipTypes: Record<string, number> = {};

  for (const track of project.tracks) {
    for (const clip of track.clips) {
      totalDuration += clip.duration;
      clipTypes[clip.type] = (clipTypes[clip.type] ?? 0) + 1;
    }
  }

  const summary = {
    projectName: project.name,
    trackCount: project.tracks.length,
    totalDuration: `${totalDuration.toFixed(1)}s`,
    clipTypes,
  };

  // Show results in a toast notification
  await openFactory.showToast(
    'info',
    'Analysis Complete',
    `Found ${Object.values(clipTypes).reduce((a, b) => a + b, 0)} clips`
  );

  // Save report to file
  await openFactory.writeTextFile(
    '/output/analysis.json',
    JSON.stringify(summary, null, 2)
  );
}
```

### 第四步：插件间通信

```typescript
/**
 * Send data to another plugin.
 */
async function shareData(targetPluginId: string): Promise<void> {
  const project = await openFactory.getProject();

  await openFactory.sendMessage(targetPluginId, 'project-data', {
    name: project.name,
    duration: project.duration,
    trackCount: project.tracks.length,
  });
}

/**
 * Listen for messages from other plugins.
 */
function setupMessageListener(): void {
  openFactory.onMessage((payload) => {
    console.log(`Received "${payload.event}" from ${payload.fromPluginId}`);

    if (payload.event === 'request-analysis') {
      analyzeClips();
    }
  });
}
```

## 高级功能

### 文件操作

```typescript
/**
 * Read and process a configuration file.
 */
async function loadConfig(): Promise<Record<string, unknown>> {
  try {
    const content = await openFactory.readTextFile('/config/settings.json');
    return JSON.parse(content);
  } catch {
    // File doesn't exist, return defaults
    return { theme: 'default', autoSave: true };
  }
}

/**
 * Save plugin state to file.
 */
async function saveState(state: PluginState): Promise<void> {
  await openFactory.writeTextFile(
    '/state/last-session.json',
    JSON.stringify(state, null, 2)
  );
}
```

### 动态菜单注册

```typescript
/**
 * Register context-aware menu items.
 */
hooks: {
  onMenuRegister({ menus }) {
    menus.push({
      id: 'smart-tools',
      label: 'Smart Tools',
    });

    // Add more items based on plugin capabilities
    menus.push({
      id: 'export-report',
      label: 'Export Analysis Report',
    });
  },
}
```

## 测试插件

### 单元测试

```typescript
import { describe, it, expect, vi } from 'vitest';
import plugin from '../src/index';

describe('My Plugin', () => {
  it('should have correct manifest', () => {
    expect(plugin.id).toBe('com.example.my-plugin');
    expect(plugin.name).toBe('My Awesome Plugin');
    expect(plugin.permissions).toContain('read-project');
  });

  it('should register menu items', () => {
    const menus: { id: string; label: string }[] = [];
    plugin.hooks.onMenuRegister?.({ menus });

    expect(menus).toHaveLength(2);
    expect(menus[0].id).toBe('my-plugin-analyze');
  });

  it('should handle clip selection', () => {
    const consoleSpy = vi.spyOn(console, 'log');

    plugin.hooks.onClipSelected?.({
      clip: {
        id: 'clip-1',
        type: 'video',
        start: 0,
        duration: 5,
      } as any,
    });

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Selected clip: clip-1')
    );
  });
});
```

### 集成测试

```typescript
import { PluginHost } from '@open-factory/plugin-sdk';
import plugin from '../src/index';

describe('Plugin Integration', () => {
  let host: PluginHost;

  beforeEach(() => {
    host = new PluginHost({ maxPlugins: 10 });
  });

  it('should load and enable plugin', async () => {
    await host.loadPlugin(plugin.id, {
      id: plugin.id,
      name: plugin.name,
      version: plugin.version,
      permissions: plugin.permissions,
    });

    const status = host.getStatus();
    expect(status.loadedPlugins).toBe(1);
    expect(status.enabledPlugins).toBe(1);
  });

  it('should enforce sandbox permissions', async () => {
    await host.loadPlugin(plugin.id, {
      id: plugin.id,
      name: plugin.name,
      version: plugin.version,
      permissions: ['read-project'],  // Only read permission
    });

    const api = host.getPluginApi(plugin.id);

    // Should be able to read
    await expect(api.editor.getProject()).resolves.toBeDefined();

    // Write operations should be restricted by sandbox
    // (depending on the specific API implementation)
  });
});
```

## 调试技巧

### 使用日志

```typescript
// 在插件中使用 console 输出调试信息
console.log('[MyPlugin] Debug:', someVariable);

// 使用 showToast 显示运行时信息
await openFactory.showToast('info', 'Debug', JSON.stringify(data));
```

### 沙箱违规调试

```typescript
import { PluginSandbox } from '@open-factory/plugin-sdk';

const sandbox = new PluginSandbox();

sandbox.onViolation((violation) => {
  console.error(`[Sandbox] ${violation.type}: ${violation.message}`);
  console.error('Details:', violation.details);
});
```

## 发布插件

### 准备发布

1. 确保 `manifest.json` 包含完整信息
2. 运行测试确保通过
3. 构建生产版本：

```bash
bun run build
```

### 发布到插件市场

```bash
# 使用插件 CLI 工具发布
bun run plugin-cli publish

# 或手动上传到插件市场
```

### 版本管理

遵循语义化版本：

- **MAJOR** — 不兼容的 API 变更
- **MINOR** — 向后兼容的功能添加
- **PATCH** — 向后兼容的 Bug 修复

```bash
# 更新版本
bun run plugin-cli version patch  # 1.0.0 -> 1.0.1
bun run plugin-cli version minor  # 1.0.0 -> 1.1.0
bun run plugin-cli version major  # 1.0.0 -> 2.0.0
```

## 最佳实践

1. **最小权限原则** — 只申请必要的权限
2. **错误处理** — 所有异步操作都要处理错误
3. **不可变操作** — 不要修改传入的对象，创建新对象
4. **性能意识** — 避免在 Hook 中执行耗时操作
5. **用户体验** — 使用 toast 提供操作反馈
6. **资源清理** — 在插件卸载时清理资源

## 示例插件

完整的示例插件可以在 `examples/` 目录中找到：

- `examples/basic-plugin` — 基础插件模板
- `examples/ai-enhancer` — AI 增强插件
- `examples/export-tool` — 导出工具插件
- `examples/color-grader` — 调色插件
