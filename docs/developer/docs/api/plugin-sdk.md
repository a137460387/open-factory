---
sidebar_position: 2
---

# Plugin SDK API

`@open-factory/plugin-sdk` 是 Open Factory 的插件开发框架，提供安全沙箱、生命周期管理、API 访问控制和插件市场集成。

## 安装

```bash
bun add @open-factory/plugin-sdk
```

## 核心概念

### 插件结构

每个插件由一个 manifest 文件和一个主模块组成：

```typescript
import type { OpenFactoryPlugin } from '@open-factory/plugin-sdk';

const plugin: OpenFactoryPlugin = {
  id: 'com.example.my-plugin',
  name: 'My Plugin',
  version: '1.0.0',
  description: 'A sample plugin for Open Factory',
  permissions: ['read-project', 'menu-register'],
  hooks: {
    onClipSelected({ clip }) {
      console.log('Clip selected:', clip?.id);
    },
    onExportBefore({ project, outputPath }) {
      console.log('Exporting to:', outputPath);
    },
    onMenuRegister({ menus }) {
      menus.push({ id: 'my-action', label: 'My Custom Action' });
    },
  },
};

export default plugin;
```

### Manifest

```typescript
interface OpenFactoryPluginManifest {
  id: string;              // 唯一标识符，建议使用反向域名格式
  name: string;            // 显示名称
  version: string;         // 语义化版本号
  description?: string;    // 插件描述
  permissions?: PluginPermission[];  // 所需权限
  main?: string;           // 入口文件路径
  dev?: boolean;           // 是否为开发模式插件
}
```

## 权限系统

插件必须声明所需的权限，系统会在运行时强制执行。

```typescript
type PluginPermission =
  | 'read-project'     // 读取项目数据
  | 'write-project'    // 修改项目数据
  | 'export-hook'      // 拦截导出流程
  | 'menu-register';   // 注册菜单项
```

| 权限 | 说明 | 使用场景 |
|------|------|---------|
| `read-project` | 只读访问项目 | 分析工具、预览插件 |
| `write-project` | 读写项目数据 | 编辑工具、批量处理 |
| `export-hook` | 拦截导出事件 | 水印、后处理 |
| `menu-register` | 添加菜单项 | 所有需要 UI 入口的插件 |

## Hook 系统

### 可用 Hook

```typescript
type PluginHookName = 'onClipSelected' | 'onExportBefore' | 'onMenuRegister';

interface PluginHookPayloads {
  onClipSelected: {
    clip?: Clip;
  };
  onExportBefore: {
    project: Project;
    outputPath: string;
    settings?: Partial<ExportSettings>;
  };
  onMenuRegister: {
    menus: PluginMenuItem[];
  };
}
```

### Hook 实现示例

```typescript
hooks: {
  // 当用户选择剪辑时触发
  onClipSelected({ clip }) {
    if (clip) {
      updateUI({ clipId: clip.id, clipType: clip.type });
    }
  },

  // 在导出前触发，可以修改设置
  onExportBefore({ project, outputPath, settings }) {
    // 添加水印
    if (settings) {
      settings.watermark = {
        text: 'Processed by My Plugin',
        position: 'bottom-right',
      };
    }
  },

  // 注册自定义菜单
  onMenuRegister({ menus }) {
    menus.push(
      { id: 'analyze-clips', label: 'Analyze Clips' },
      { id: 'batch-rename', label: 'Batch Rename' },
    );
  },
}
```

## 插件 API

插件通过全局 `openFactory` 对象访问宿主 API。

### getProject()

获取当前项目的只读快照。

```typescript
const project = await openFactory.getProject();
console.log('Project name:', project.name);
console.log('Track count:', project.tracks.length);
```

### updateProject(project)

更新整个项目。

```typescript
const project = await openFactory.getProject();
project.name = 'Updated Name';
await openFactory.updateProject(project);
```

### registerMenu(item)

注册自定义菜单项。

```typescript
await openFactory.registerMenu({
  id: 'my-action',
  label: 'Run My Action',
});
```

### showToast(kind, title, message?)

显示通知消息。

```typescript
await openFactory.showToast('info', 'Processing', 'Analyzing clips...');
await openFactory.showToast('error', 'Error', 'Failed to process file');
await openFactory.showToast('warning', 'Warning', 'Low disk space');
```

### readTextFile(path) / writeTextFile(path, contents)

文件读写操作（受沙箱路径限制）。

```typescript
// 读取文件
const content = await openFactory.readTextFile('/config/settings.json');
const config = JSON.parse(content);

// 写入文件
await openFactory.writeTextFile(
  '/output/report.json',
  JSON.stringify(report, null, 2)
);
```

### sendMessage / onMessage

插件间通信。

```typescript
// 发送消息给另一个插件
await openFactory.sendMessage('other-plugin', 'data-ready', {
  clipCount: 42,
});

// 监听来自其他插件的消息
const unsubscribe = openFactory.onMessage((payload) => {
  console.log('From:', payload.fromPluginId);
  console.log('Event:', payload.event);
  console.log('Data:', payload.data);
});

// 取消监听
unsubscribe();
```

## 生命周期管理

### PluginLifecycleManager

管理插件的注册、加载、启用、禁用和卸载。

```typescript
import { PluginLifecycleManager } from '@open-factory/plugin-sdk';

const manager = new PluginLifecycleManager();

// 注册插件
manager.register({
  manifest: pluginManifest,
  module: plugin,
  metadata: { author: 'Example' },
});

// 加载并启用
await manager.load('com.example.my-plugin');
await manager.enable('com.example.my-plugin');

// 监听生命周期事件
manager.on((event) => {
  console.log(`Plugin ${event.pluginId}: ${event.event}`);
});

// 禁用和卸载
await manager.disable('com.example.my-plugin');
await manager.unload('com.example.my-plugin');
```

### 插件状态

```typescript
type PluginState =
  | 'registered'   // 已注册，未加载
  | 'loading'      // 正在加载
  | 'loaded'       // 已加载，未启用
  | 'enabled'      // 已启用，活跃状态
  | 'disabled'     // 已禁用，可重新启用
  | 'error'        // 出错状态
  | 'unloading'    // 正在卸载
  | 'unloaded';    // 已卸载
```

## 安全沙箱

### SandboxPolicy

```typescript
interface SandboxPolicy {
  permissions: PluginPermission[];
  maxMemoryBytes?: number;         // 默认 50MB
  maxExecutionTimeMs?: number;     // 默认 5000ms
  rateLimitPerMinute?: number;     // 默认 100
  allowedHosts?: string[];         // 允许的网络主机
  allowedPaths?: string[];         // 允许的文件路径
}
```

### 使用沙箱

```typescript
import { PluginSandbox } from '@open-factory/plugin-sdk';

const sandbox = new PluginSandbox();

// 注册插件沙箱策略
sandbox.register('my-plugin', {
  permissions: ['read-project'],
  maxMemoryBytes: 100 * 1024 * 1024,  // 100MB
  maxExecutionTimeMs: 10_000,           // 10 秒
  rateLimitPerMinute: 200,
  allowedPaths: ['/data/plugins/my-plugin/'],
});

// 包装 API 以强制执行权限
const safeApi = sandbox.wrapApi('my-plugin', editorApi, 'read-project');

// 监听违规事件
sandbox.onViolation((violation) => {
  console.warn(`Sandbox violation: ${violation.type} - ${violation.message}`);
});
```

### 违规类型

```typescript
type ViolationType =
  | 'permission-denied'       // 权限不足
  | 'rate-limit-exceeded'     // 超过速率限制
  | 'execution-timeout'       // 执行超时
  | 'memory-limit-exceeded'   // 内存超限
  | 'host-not-allowed'        // 访问未授权主机
  | 'path-not-allowed';       // 访问未授权路径
```

## 插件宿主 (PluginHost)

`PluginHost` 是集成所有子系统的中央协调器。

```typescript
import { PluginHost } from '@open-factory/plugin-sdk';

const host = new PluginHost({
  maxPlugins: 50,
  dataDir: './plugin-data',
  defaultSandboxPolicy: {
    maxMemoryBytes: 50 * 1024 * 1024,
    rateLimitPerMinute: 100,
  },
});

// 安装插件（从市场）
await host.installPlugin('com.example.ai-enhancer');

// 加载本地插件
await host.loadPlugin('local-tool', manifest, metadata);

// 获取插件 API
const api = host.getPluginApi('local-tool');
const project = await api.editor.getProject();

// 获取系统状态
const status = host.getStatus();
// { loadedPlugins: 5, enabledPlugins: 4, installedMarketplacePlugins: 3, availableUpdates: 1 }
```

## 插件市场 API

### PluginMarketplace

```typescript
import { PluginMarketplace } from '@open-factory/plugin-sdk';

const marketplace = new PluginMarketplace();

// 搜索插件
const results = marketplace.search({
  query: 'color grading',
  category: 'effect',
  sortBy: 'rating',
  page: 1,
  pageSize: 20,
});

// 获取插件详情
const plugin = marketplace.getPlugin('com.example.color-tools');

// 安装插件
const record = marketplace.install('com.example.color-tools');

// 检查更新
const updates = marketplace.checkUpdates();
// [{ pluginId: '...', currentVersion: '1.0.0', latestVersion: '1.1.0' }]

// 添加评价
marketplace.addReview({
  pluginId: 'com.example.color-tools',
  userId: 'user-123',
  userName: 'Alice',
  rating: 5,
  title: 'Excellent color tools',
  comment: 'Very useful for color grading workflows.',
});
```

### 插件分类

```typescript
type PluginCategory =
  | 'ai-model'       // AI 模型插件
  | 'effect'         // 视频/音频效果
  | 'template'       // 项目模板
  | 'transition'     // 转场效果
  | 'export'         // 导出格式
  | 'utility'        // 实用工具
  | 'integration'    // 第三方集成
  | 'theme';         // 主题样式
```

## 高级编辑器 API

### PluginEditorAPI

```typescript
interface PluginEditorAPI {
  getProject(): Promise<Project>;
  updateProject(project: Project): Promise<void>;
  getSelectedClips(): Promise<Clip[]>;
  selectClips(clipIds: string[]): Promise<void>;
  addClip(clip: Omit<Clip, 'id'>): Promise<Clip>;
  removeClip(clipId: string): Promise<void>;
  updateClip(clipId: string, updates: Partial<Clip>): Promise<void>;
  getTimelineDuration(): Promise<number>;
  getPlaybackPosition(): Promise<number>;
  seekTo(positionSeconds: number): Promise<void>;
}
```

### 使用示例

```typescript
const api = host.getPluginApi('my-plugin');

// 获取选中的剪辑
const selectedClips = await api.editor.getSelectedClips();

// 添加新剪辑
const newClip = await api.editor.addClip({
  type: 'video',
  start: 0,
  duration: 5,
  sourceId: 'media-1',
  // ...
});

// 跳转到指定位置
await api.editor.seekTo(30.5);
```
