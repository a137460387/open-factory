# 工作流创作教程

> 本教程将带你学习如何使用 Open Factory 工作流编辑器创建自动化工作流。

## 教程概述

### 学习目标

- 理解工作流的基本概念和架构
- 掌握工作流编辑器的使用方法
- 学会创建自定义节点
- 完成工作流的测试和发布

### 前置要求

- Open Factory 账号
- 基本的逻辑思维能力
- 了解 JSON 格式（可选）

### 教程时长

约 1-2 小时完成全部内容。

## 第一步：了解工作流基础

### 什么是工作流？

工作流是一系列自动化任务的有序集合，用于将复杂的业务流程简化为可重复执行的自动化流程。

### 工作流组成

```
工作流
├── 节点 (Nodes)
│   ├── 输入节点 - 接收数据
│   ├── 处理节点 - 处理数据
│   ├── 控制节点 - 流程控制
│   └── 输出节点 - 输出结果
├── 连接 (Connections)
│   └── 节点之间的数据流向
└── 配置 (Configuration)
    └── 节点参数和全局设置
```

### 常见应用场景

| 场景 | 说明 | 复杂度 |
|------|------|--------|
| 数据同步 | 定时同步数据到数据库 | 入门 |
| 内容处理 | 自动处理和转换内容 | 入门 |
| API 集成 | 调用多个 API 并整合结果 | 中级 |
| 业务自动化 | 复杂业务流程自动化 | 高级 |

## 第二步：创建工作流

### 方式一：使用可视化编辑器

1. 登录 Open Factory 控制台
2. 进入「工作流」→「新建工作流」
3. 选择空白模板或预设模板
4. 使用拖拽方式添加节点
5. 连接节点并配置参数

### 方式二：使用 JSON 定义

```json
{
  "name": "My Workflow",
  "description": "A sample workflow",
  "version": "1.0.0",
  "nodes": [
    {
      "id": "input-1",
      "type": "input",
      "name": "Start",
      "position": { "x": 100, "y": 100 }
    },
    {
      "id": "process-1",
      "type": "process",
      "name": "Transform",
      "position": { "x": 300, "y": 100 },
      "parameters": {
        "operation": "uppercase"
      }
    },
    {
      "id": "output-1",
      "type": "output",
      "name": "End",
      "position": { "x": 500, "y": 100 }
    }
  ],
  "connections": [
    { "from": "input-1", "to": "process-1" },
    { "from": "process-1", "to": "output-1" }
  ]
}
```

## 第三步：设计工作流 - 内容自动处理

### 场景描述

创建一个工作流，自动处理用户提交的内容：
1. 接收用户输入
2. 清理和格式化文本
3. 生成摘要
4. 保存结果

### 设计工作流

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   接收输入   │ ──▶ │  文本清理   │ ──▶ │  生成摘要   │ ──▶ │  保存结果   │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
```

### 实现步骤

#### 1. 添加输入节点

```typescript
// Input Node Configuration
{
  id: 'receive-input',
  type: 'input',
  name: 'Receive Input',
  outputs: [
    { id: 'content', type: 'string' },
    { id: 'metadata', type: 'object' }
  ],
  configuration: {
    source: 'api',
    endpoint: '/api/content'
  }
}
```

#### 2. 添加文本清理节点

```typescript
// Text Cleanup Node Configuration
{
  id: 'text-cleanup',
  type: 'process',
  name: 'Text Cleanup',
  inputs: [
    { id: 'text', type: 'string' }
  ],
  outputs: [
    { id: 'cleanedText', type: 'string' }
  ],
  configuration: {
    operations: [
      'trimWhitespace',
      'removeExtraSpaces',
      'normalizeLineBreaks'
    ]
  }
}
```

#### 3. 添加摘要生成节点

```typescript
// Summary Generator Node Configuration
{
  id: 'summary-generator',
  type: 'process',
  name: 'Summary Generator',
  inputs: [
    { id: 'text', type: 'string' }
  ],
  outputs: [
    { id: 'summary', type: 'string' },
    { id: 'keywords', type: 'array' }
  ],
  configuration: {
    maxLength: 200,
    extractKeywords: true
  }
}
```

#### 4. 添加输出节点

```typescript
// Save Result Node Configuration
{
  id: 'save-result',
  type: 'output',
  name: 'Save Result',
  inputs: [
    { id: 'content', type: 'string' },
    { id: 'summary', type: 'string' },
    { id: 'keywords', type: 'array' }
  ],
  configuration: {
    destination: 'database',
    table: 'processed_content'
  }
}
```

## 第四步：使用控制节点

### 条件分支

根据条件执行不同的处理路径：

```typescript
// Conditional Node Configuration
{
  id: 'condition-check',
  type: 'control',
  name: 'Check Content Type',
  inputs: [
    { id: 'contentType', type: 'string' }
  ],
  outputs: [
    { id: 'isArticle', type: 'boolean' },
    { id: 'isComment', type: 'boolean' }
  ],
  configuration: {
    conditions: [
      {
        output: 'isArticle',
        expression: 'contentType === "article"'
      },
      {
        output: 'isComment',
        expression: 'contentType === "comment"'
      }
    ]
  }
}
```

### 循环处理

批量处理多个项目：

```typescript
// Loop Node Configuration
{
  id: 'batch-process',
  type: 'control',
  name: 'Batch Process',
  inputs: [
    { id: 'items', type: 'array' }
  ],
  outputs: [
    { id: 'results', type: 'array' }
  ],
  configuration: {
    mode: 'parallel',
    maxConcurrency: 5,
    processNode: 'process-item'
  }
}
```

### 并行执行

同时执行多个任务：

```typescript
// Parallel Execution Node Configuration
{
  id: 'parallel-tasks',
  type: 'control',
  name: 'Parallel Tasks',
  inputs: [
    { id: 'data', type: 'any' }
  ],
  outputs: [
    { id: 'results', type: 'array' }
  ],
  configuration: {
    tasks: [
      'analyze-sentiment',
      'extract-entities',
      'classify-content'
    ],
    waitForAll: true
  }
}
```

## 第五步：创建自定义节点

### 定义节点接口

```typescript
import { NodeDefinition, NodeInputs, NodeOutputs, NodeConfig } from '@open-factory/workflow-sdk';

export interface SentimentNodeConfig extends NodeConfig {
  language: 'en' | 'zh';
  model: 'basic' | 'advanced';
}

export const sentimentNode: NodeDefinition<SentimentNodeConfig> = {
  type: 'sentiment-analyzer',
  name: 'Sentiment Analyzer',
  description: 'Analyze text sentiment',
  category: 'ai',
  icon: 'sentiment',
  
  inputs: [
    {
      id: 'text',
      type: 'string',
      label: 'Input Text',
      required: true
    }
  ],
  
  outputs: [
    {
      id: 'sentiment',
      type: 'string',
      label: 'Sentiment (positive/negative/neutral)'
    },
    {
      id: 'score',
      type: 'number',
      label: 'Confidence Score (0-1)'
    },
    {
      id: 'details',
      type: 'object',
      label: 'Detailed Analysis'
    }
  ],
  
  parameters: [
    {
      id: 'language',
      type: 'select',
      label: 'Language',
      options: [
        { value: 'en', label: 'English' },
        { value: 'zh', label: 'Chinese' }
      ],
      default: 'en'
    },
    {
      id: 'model',
      type: 'select',
      label: 'Model',
      options: [
        { value: 'basic', label: 'Basic' },
        { value: 'advanced', label: 'Advanced' }
      ],
      default: 'basic'
    }
  ],
  
  execute: async (inputs: NodeInputs, config: SentimentNodeConfig): Promise<NodeOutputs> => {
    const { text } = inputs;
    const { language, model } = config;
    
    // Call sentiment analysis service
    const result = await analyzeSentiment(text, language, model);
    
    return {
      sentiment: result.sentiment,
      score: result.confidence,
      details: result.details
    };
  }
};

async function analyzeSentiment(
  text: string, 
  language: string, 
  model: string
): Promise<SentimentResult> {
  // Implementation would call actual sentiment analysis service
  return {
    sentiment: 'positive',
    confidence: 0.85,
    details: {
      positive: 0.85,
      negative: 0.10,
      neutral: 0.05
    }
  };
}

interface SentimentResult {
  sentiment: string;
  confidence: number;
  details: {
    positive: number;
    negative: number;
    neutral: number;
  };
}
```

### 注册自定义节点

```typescript
import { WorkflowSDK } from '@open-factory/workflow-sdk';
import { sentimentNode } from './nodes/sentiment-analyzer';

const sdk = new WorkflowSDK();

// Register custom node
sdk.nodes.register(sentimentNode);

// Now the node is available in the workflow editor
```

## 第六步：测试工作流

### 单元测试节点

```typescript
import { describe, test, expect } from 'vitest';
import { sentimentNode } from '../src/nodes/sentiment-analyzer';

describe('Sentiment Analyzer Node', () => {
  test('should analyze positive sentiment', async () => {
    const result = await sentimentNode.execute(
      { text: 'I love this product!' },
      { language: 'en', model: 'basic' }
    );

    expect(result.sentiment).toBe('positive');
    expect(result.score).toBeGreaterThan(0.5);
  });

  test('should analyze negative sentiment', async () => {
    const result = await sentimentNode.execute(
      { text: 'This is terrible.' },
      { language: 'en', model: 'basic' }
    );

    expect(result.sentiment).toBe('negative');
    expect(result.score).toBeGreaterThan(0.5);
  });
});
```

### 集成测试工作流

```typescript
import { WorkflowRunner } from '@open-factory/workflow-sdk';
import workflow from '../workflows/content-processor.json';

describe('Content Processor Workflow', () => {
  let runner: WorkflowRunner;

  beforeEach(async () => {
    runner = new WorkflowRunner(workflow);
    await runner.initialize();
  });

  test('should process content end-to-end', async () => {
    const result = await runner.execute({
      content: 'Test content for processing',
      type: 'article'
    });

    expect(result.success).toBe(true);
    expect(result.data.summary).toBeDefined();
    expect(result.data.keywords).toBeInstanceOf(Array);
  });

  test('should handle errors gracefully', async () => {
    const result = await runner.execute({
      content: '',
      type: 'article'
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});
```

### 调试工作流

```bash
# 启动调试模式
open-factory workflow debug --workflow ./my-workflow.json

# 使用测试数据
open-factory workflow debug --workflow ./my-workflow.json --input ./test-data.json

# 查看执行日志
open-factory workflow logs --workflow-id my-workflow --tail 100
```

## 第七步：优化工作流

### 性能优化

1. **并行执行**：独立节点并行运行
2. **缓存结果**：缓存重复计算的结果
3. **批处理**：批量处理减少调用次数
4. **延迟加载**：按需加载节点

### 错误处理

```typescript
// Add error handling to workflow
{
  id: 'error-handler',
  type: 'control',
  name: 'Error Handler',
  inputs: [
    { id: 'error', type: 'error' }
  ],
  configuration: {
    strategy: 'retry',
    maxRetries: 3,
    retryDelay: 1000,
    fallbackNode: 'default-output'
  }
}
```

### 监控和日志

```typescript
// Add monitoring nodes
{
  id: 'metrics-collector',
  type: 'monitoring',
  name: 'Metrics Collector',
  configuration: {
    metrics: ['executionTime', 'nodeCount', 'errorRate'],
    exportTo: 'prometheus'
  }
}
```

## 第八步：发布工作流

### 准备发布

```json
{
  "name": "Content Processor",
  "description": "Automated content processing workflow",
  "version": "1.0.0",
  "author": "your-name",
  "tags": ["content", "automation", "ai"],
  "category": "productivity"
}
```

### 发布流程

```bash
# 验证工作流
open-factory workflow validate --workflow ./my-workflow.json

# 发布到测试环境
open-factory workflow publish --workflow ./my-workflow.json --env staging

# 测试通过后发布到生产环境
open-factory workflow publish --workflow ./my-workflow.json --env production
```

### 版本管理

```bash
# 查看版本历史
open-factory workflow versions --workflow-id content-processor

# 回滚到指定版本
open-factory workflow rollback --workflow-id content-processor --version 1.0.0
```

## 工作流模板

### 内容处理模板

```json
{
  "template": "content-processing",
  "name": "Content Processing Template",
  "description": "Process and analyze content automatically",
  "nodes": ["input", "cleanup", "analyze", "output"]
}
```

### 数据同步模板

```json
{
  "template": "data-sync",
  "name": "Data Sync Template",
  "description": "Synchronize data between systems",
  "nodes": ["source", "transform", "validate", "destination"]
}
```

### API 集成模板

```json
{
  "template": "api-integration",
  "name": "API Integration Template",
  "description": "Integrate multiple APIs",
  "nodes": ["trigger", "api-calls", "merge", "response"]
}
```

## 最佳实践

### 设计原则

1. **单一职责**：每个节点只做一件事
2. **松耦合**：节点之间通过标准接口通信
3. **可测试**：每个节点都可以独立测试
4. **可复用**：通用节点可以被多个工作流使用

### 命名规范

- 节点名称：使用动词 + 名词格式（如 "ProcessData"）
- 连接名称：使用描述性名称（如 "data-to-process"）
- 参数名称：使用 camelCase 格式

### 错误处理

- 每个节点都应该有错误处理
- 使用重试机制处理临时故障
- 记录详细的错误日志
- 提供有意义的错误消息

### 性能考虑

- 避免不必要的数据传输
- 使用缓存减少重复计算
- 批量处理提高效率
- 监控工作流执行时间

## 常见问题

### Q: 工作流执行超时怎么办？

A: 检查是否有节点执行时间过长，考虑添加超时设置或优化节点实现。

### Q: 如何处理大数据量？

A: 使用批处理节点分批处理，或使用流式处理减少内存占用。

### Q: 工作流失败如何恢复？

A: 使用检查点机制记录执行状态，失败时从检查点恢复。

### Q: 如何调试复杂工作流？

A: 使用调试模式逐步执行，查看每个节点的输入输出。

## 下一步

- 阅读 [Workflow API Reference](https://docs.open-factory.dev/sdk/workflow-api)
- 探索更多 [工作流模板](https://github.com/open-factory/workflow-templates)
- 学习 [插件创作教程](./plugin-creation.md)
- 加入 [创作者社区](https://community.open-factory.dev)
