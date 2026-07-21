# 创作辅助工具文档

> Open Factory 为创作者提供完整的工具链支持，帮助创作者高效完成插件和工作流的开发、测试与发布。

## 工具概览

### 工具矩阵

| 工具 | 用途 | 适用阶段 |
|------|------|---------|
| 插件开发 SDK | 插件开发框架 | 开发 |
| 工作流编辑器 | 可视化工作流设计 | 设计 |
| 测试沙箱 | 安全测试环境 | 测试 |
| 发布助手 | 打包和发布 | 发布 |
| 数据分析面板 | 数据洞察 | 运营 |
| 代码生成器 | 快速生成代码模板 | 开发 |
| 文档生成器 | 自动生成 API 文档 | 文档 |
| 性能分析器 | 性能优化建议 | 优化 |

## 插件开发 SDK

### 功能特性

- 完整的 TypeScript 类型定义
- 丰富的 API 接口
- 事件系统支持
- 生命周期管理
- 错误处理机制

### 安装

```bash
npm install @open-factory/plugin-sdk
# 或
pnpm add @open-factory/plugin-sdk
```

### 快速开始

```typescript
import { Plugin, PluginContext } from '@open-factory/plugin-sdk';

export class MyPlugin implements Plugin {
  name = 'my-plugin';
  version = '1.0.0';

  async activate(context: PluginContext) {
    // Register commands
    context.commands.register('myCommand', this.handleCommand);
    
    // Register event listeners
    context.events.on('document:change', this.handleChange);
    
    // Register UI components
    context.ui.registerPanel({
      id: 'myPanel',
      title: 'My Panel',
      render: this.renderPanel
    });
  }

  async deactivate() {
    // Cleanup resources
  }
}
```

### 核心模块

#### 命令系统

```typescript
// Register a command
context.commands.register('formatDocument', async (params) => {
  const { document } = params;
  // Format logic
  return { success: true };
});

// Execute a command
const result = await context.commands.execute('formatDocument', {
  document: activeDocument
});
```

#### 事件系统

```typescript
// Listen to events
context.events.on('document:save', (event) => {
  console.log('Document saved:', event.documentId);
});

// Emit custom events
context.events.emit('myPlugin:customEvent', { data: 'value' });
```

#### UI 扩展

```typescript
// Register a panel
context.ui.registerPanel({
  id: 'codeAnalyzer',
  title: 'Code Analyzer',
  position: 'right',
  render: (container) => {
    container.innerHTML = '<div>Panel content</div>';
  }
});

// Register a toolbar button
context.ui.registerToolbarItem({
  id: 'analyzeBtn',
  icon: 'analyze',
  tooltip: 'Analyze Code',
  onClick: () => { /* handler */ }
});
```

### API 参考

完整 API 文档请参阅：
- [Plugin API Reference](https://docs.open-factory.dev/sdk/plugin-api)
- [Event Reference](https://docs.open-factory.dev/sdk/events)
- [UI Extension API](https://docs.open-factory.dev/sdk/ui)

## 工作流编辑器

### 功能特性

- 拖拽式节点设计
- 可视化连线
- 节点库扩展
- 实时预览
- 导入导出

### 界面布局

```
┌─────────────────────────────────────────────────────────────┐
│  工具栏  │  保存  │  运行  │  调试  │  导出  │  设置      │
├─────────┴────────┴────────┴────────┴────────┴──────────────┤
│         │                                    │              │
│  节点   │                                    │   属性       │
│  库     │         画布区域                    │   面板       │
│         │                                    │              │
│  ┌───┐  │    ┌─────┐      ┌─────┐           │  节点名称    │
│  │输入│  │    │处理 │ ──>  │输出 │           │  参数配置    │
│  └───┘  │    └─────┘      └─────┘           │  高级设置    │
│  ┌───┐  │                                    │              │
│  │处理│  │                                    │              │
│  └───┘  │                                    │              │
│  ┌───┐  │                                    │              │
│  │输出│  │                                    │              │
│  └───┘  │                                    │              │
├─────────┴────────────────────────────────────┴──────────────┤
│                     执行日志 / 调试信息                       │
└─────────────────────────────────────────────────────────────┘
```

### 节点类型

| 类型 | 说明 | 示例 |
|------|------|------|
| 输入节点 | 数据输入 | HTTP 请求、文件读取、数据库查询 |
| 处理节点 | 数据处理 | 转换、过滤、聚合、AI 处理 |
| 控制节点 | 流程控制 | 条件判断、循环、并行、延迟 |
| 输出节点 | 数据输出 | HTTP 响应、文件写入、消息发送 |

### 创建自定义节点

```typescript
import { NodeDefinition } from '@open-factory/workflow-sdk';

export const customNode: NodeDefinition = {
  type: 'custom-transform',
  name: 'Custom Transform',
  category: 'processing',
  inputs: [
    { id: 'data', type: 'any', label: 'Input Data' }
  ],
  outputs: [
    { id: 'result', type: 'any', label: 'Result' }
  ],
  parameters: [
    {
      id: 'transformType',
      type: 'select',
      label: 'Transform Type',
      options: ['uppercase', 'lowercase', 'capitalize']
    }
  ],
  execute: async (inputs, params) => {
    const { data } = inputs;
    const { transformType } = params;
    
    switch (transformType) {
      case 'uppercase':
        return { result: String(data).toUpperCase() };
      case 'lowercase':
        return { result: String(data).toLowerCase() };
      case 'capitalize':
        return { result: String(data).replace(/\b\w/g, l => l.toUpperCase()) };
    }
  }
};
```

## 测试沙箱

### 功能特性

- 隔离的测试环境
- 模拟数据支持
- 性能监控
- 错误追踪
- 自动化测试

### 使用方式

#### 启动沙箱

```bash
# 启动本地测试沙箱
open-factory sandbox start

# 指定插件目录
open-factory sandbox start --plugin ./my-plugin

# 指定工作流
open-factory sandbox start --workflow ./my-workflow.json
```

#### 编写测试

```typescript
import { Sandbox } from '@open-factory/testing';

describe('MyPlugin', () => {
  let sandbox: Sandbox;

  beforeEach(async () => {
    sandbox = await Sandbox.create();
    await sandbox.loadPlugin('./my-plugin');
  });

  afterEach(async () => {
    await sandbox.cleanup();
  });

  test('should process input correctly', async () => {
    const result = await sandbox.execute('myCommand', {
      input: 'test data'
    });
    
    expect(result.success).toBe(true);
    expect(result.output).toBe('expected output');
  });
});
```

#### 性能测试

```typescript
import { PerformanceProfiler } from '@open-factory/testing';

const profiler = new PerformanceProfiler();

profiler.start();

// Execute operations
for (let i = 0; i < 1000; i++) {
  await sandbox.execute('myCommand', { input: `data-${i}` });
}

const report = profiler.stop();

console.log('Performance Report:', {
  totalTime: report.totalTime,
  averageTime: report.averageTime,
  p95Time: report.p95Time,
  memoryUsage: report.memoryUsage
});
```

## 发布助手

### 功能特性

- 一键打包
- 版本管理
- 依赖检查
- 安全扫描
- 自动发布

### 使用流程

#### 1. 准备发布配置

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "My awesome plugin",
  "author": "creator-name",
  "license": "MIT",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "files": ["dist"],
  "keywords": ["open-factory", "plugin"]
}
```

#### 2. 执行发布

```bash
# 检查发布条件
open-factory publish check

# 打包
open-factory publish pack

# 发布到测试环境
open-factory publish --env staging

# 发布到生产环境
open-factory publish --env production
```

#### 3. 版本管理

```bash
# 升级版本
open-factory version patch  # 1.0.0 -> 1.0.1
open-factory version minor  # 1.0.0 -> 1.1.0
open-factory version major  # 1.0.0 -> 2.0.0

# 查看版本历史
open-factory version history
```

### 发布检查清单

- [ ] 代码无 TypeScript 错误
- [ ] 所有测试通过
- [ ] 文档完整
- [ ] 版本号已更新
- [ ] CHANGELOG 已更新
- [ ] 无安全漏洞

## 代码生成器

### 功能特性

- 项目脚手架生成
- 代码模板生成
- API 代码生成
- 测试代码生成

### 使用方式

#### 生成插件项目

```bash
# 交互式生成
open-factory generate plugin

# 指定参数生成
open-factory generate plugin \
  --name my-plugin \
  --type tool \
  --language typescript \
  --template basic
```

#### 生成代码片段

```bash
# 生成命令处理器
open-factory generate command --name myCommand

# 生成事件处理器
open-factory generate handler --event document:save

# 生成 UI 组件
open-factory generate panel --name myPanel
```

### 模板库

| 模板 | 说明 | 适用场景 |
|------|------|---------|
| basic | 基础插件模板 | 简单工具插件 |
| full | 完整插件模板 | 复杂功能插件 |
| ui | UI 扩展模板 | 界面扩展插件 |
| integration | 集成模板 | 第三方集成 |

## 文档生成器

### 功能特性

- API 文档自动生成
- Markdown 输出
- 示例代码生成
- 多语言支持

### 使用方式

```bash
# 生成 API 文档
open-factory docs generate

# 指定输出格式
open-factory docs generate --format markdown

# 包含示例代码
open-factory docs generate --examples

# 监听文件变化自动更新
open-factory docs watch
```

### 生成示例

```markdown
## myCommand

Execute a custom command.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| input | string | Yes | Input data to process |
| options | object | No | Processing options |

### Returns

| Type | Description |
|------|-------------|
| Promise<CommandResult> | Command execution result |

### Example

```typescript
const result = await context.commands.execute('myCommand', {
  input: 'hello world',
  options: { uppercase: true }
});
console.log(result.output); // "HELLO WORLD"
```
```

## 性能分析器

### 功能特性

- CPU 性能分析
- 内存使用分析
- 执行时间追踪
- 瓶颈识别
- 优化建议

### 使用方式

```typescript
import { PerformanceAnalyzer } from '@open-factory/tools';

const analyzer = new PerformanceAnalyzer();

// Start profiling
analyzer.start();

// Execute code to analyze
await myPlugin.heavyOperation();

// Stop and get report
const report = analyzer.stop();

console.log('Performance Report:', report);
// {
//   cpu: { user: 150, system: 30 },
//   memory: { heapUsed: 45MB, heapTotal: 67MB },
//   duration: 1234,
//   bottlenecks: ['heavyOperation took 80% of total time'],
//   suggestions: ['Consider caching results of heavyOperation']
// }
```

### 性能基准

| 指标 | 目标 | 说明 |
|------|------|------|
| 启动时间 | < 100ms | 插件激活时间 |
| 命令响应 | < 50ms | 命令执行时间 |
| 内存占用 | < 50MB | 插件内存占用 |
| CPU 使用 | < 10% | 空闲时 CPU 占用 |

## CLI 工具

### 安装

```bash
npm install -g @open-factory/cli
```

### 常用命令

```bash
# 项目管理
open-factory init              # 初始化项目
open-factory dev               # 启动开发服务器
open-factory build             # 构建项目
open-factory test              # 运行测试

# 插件管理
open-factory plugin create     # 创建插件
open-factory plugin test       # 测试插件
open-factory plugin publish    # 发布插件

# 工作流管理
open-factory workflow create   # 创建工作流
open-factory workflow run      # 运行工作流
open-factory workflow export   # 导出工作流

# 工具
open-factory docs generate     # 生成文档
open-factory lint              # 代码检查
open-factory format            # 代码格式化
```

## 集成开发环境

### VS Code 扩展

- 语法高亮
- 代码补全
- 调试支持
- 片段模板
- 实时预览

### JetBrains 插件

- 代码导航
- 重构支持
- 检查提示
- 快速修复

## 最佳实践

### 开发流程

1. 使用代码生成器创建项目脚手架
2. 使用工作流编辑器设计业务流程
3. 使用测试沙箱进行测试
4. 使用性能分析器优化性能
5. 使用发布助手发布作品

### 代码规范

- 使用 TypeScript 严格模式
- 遵循 ESLint 规则
- 编写单元测试
- 添加 JSDoc 注释

### 性能优化

- 避免阻塞主线程
- 使用缓存减少重复计算
- 延迟加载非关键资源
- 定期检查内存泄漏
