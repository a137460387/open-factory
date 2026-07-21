# 插件创作教程

> 本教程将带你从零开始创建一个 Open Factory 插件，涵盖插件开发的完整流程。

## 教程概述

### 学习目标

- 理解插件架构和生命周期
- 掌握插件开发的核心 API
- 学会测试和调试插件
- 完成插件的发布流程

### 前置要求

- Node.js 18+
- TypeScript 基础知识
- 基本的命令行操作

### 教程时长

约 2-3 小时完成全部内容。

## 第一步：环境准备

### 安装 CLI 工具

```bash
npm install -g @open-factory/cli
```

### 创建插件项目

```bash
open-factory plugin create my-first-plugin
cd my-first-plugin
```

### 项目结构

```
my-first-plugin/
├── src/
│   ├── index.ts          # 插件入口
│   ├── commands/         # 命令处理器
│   ├── services/         # 业务逻辑
│   └── utils/            # 工具函数
├── tests/
│   ├── unit/             # 单元测试
│   └── integration/      # 集成测试
├── package.json
├── tsconfig.json
└── README.md
```

## 第二步：理解插件结构

### 插件入口文件

```typescript
// src/index.ts
import { Plugin, PluginContext, PluginMetadata } from '@open-factory/plugin-sdk';

export const metadata: PluginMetadata = {
  id: 'my-first-plugin',
  name: 'My First Plugin',
  version: '1.0.0',
  description: 'A sample plugin for learning',
  author: 'Your Name',
  main: './index.js'
};

export default class MyFirstPlugin implements Plugin {
  private context: PluginContext;

  async activate(context: PluginContext): Promise<void> {
    this.context = context;
    
    // Register commands
    this.registerCommands();
    
    // Register event listeners
    this.registerEventListeners();
    
    // Register UI components
    this.registerUIComponents();
    
    console.log('My First Plugin activated!');
  }

  async deactivate(): Promise<void> {
    // Cleanup resources
    console.log('My First Plugin deactivated!');
  }

  private registerCommands(): void {
    // Commands will be registered here
  }

  private registerEventListeners(): void {
    // Event listeners will be registered here
  }

  private registerUIComponents(): void {
    // UI components will be registered here
  }
}
```

### 插件生命周期

```
┌─────────────┐
│   Created   │  插件实例创建
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Activating │  调用 activate()
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Active    │  插件运行中
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Deactivating│  调用 deactivate()
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Destroyed  │  插件销毁
└─────────────┘
```

## 第三步：实现核心功能

### 场景：创建一个字数统计插件

我们将创建一个实用的字数统计插件，支持：
- 统计选中文本的字数
- 统计整篇文档的字数
- 显示详细统计信息

### 定义命令

```typescript
// src/commands/word-count.ts
import { Command, CommandParams, CommandResult } from '@open-factory/plugin-sdk';

export class WordCountCommand implements Command {
  id = 'wordCount';
  name = 'Word Count';
  description = 'Count words in selected text or document';

  async execute(params: CommandParams): Promise<CommandResult> {
    const { text, includeSpaces = true } = params;
    
    if (!text) {
      return {
        success: false,
        error: 'No text provided'
      };
    }

    const stats = this.calculateStats(text, includeSpaces);
    
    return {
      success: true,
      data: stats
    };
  }

  private calculateStats(text: string, includeSpaces: boolean): WordStats {
    const lines = text.split('\n');
    const words = text.trim().split(/\s+/).filter(w => w.length > 0);
    const characters = includeSpaces ? text.length : text.replace(/\s/g, '').length;
    
    return {
      lines: lines.length,
      words: words.length,
      characters,
      sentences: this.countSentences(text),
      paragraphs: this.countParagraphs(text)
    };
  }

  private countSentences(text: string): number {
    return text.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
  }

  private countParagraphs(text: string): number {
    return text.split(/\n\s*\n/).filter(p => p.trim().length > 0).length;
  }
}

interface WordStats {
  lines: number;
  words: number;
  characters: number;
  sentences: number;
  paragraphs: number;
}
```

### 注册命令

```typescript
// src/index.ts (更新)
import { WordCountCommand } from './commands/word-count';

export default class MyFirstPlugin implements Plugin {
  // ... existing code ...

  private registerCommands(): void {
    this.context.commands.register('wordCount', new WordCountCommand());
  }
}
```

### 添加事件监听

```typescript
// src/index.ts (更新)
export default class MyFirstPlugin implements Plugin {
  // ... existing code ...

  private registerEventListeners(): void {
    // Listen for document changes
    this.context.events.on('document:change', this.handleDocumentChange.bind(this));
    
    // Listen for selection changes
    this.context.events.on('selection:change', this.handleSelectionChange.bind(this));
  }

  private handleDocumentChange(event: any): void {
    // Auto-update word count when document changes
    this.updateWordCount(event.documentId);
  }

  private handleSelectionChange(event: any): void {
    // Update selection stats
    this.updateSelectionStats(event.selectedText);
  }

  private async updateWordCount(documentId: string): Promise<void> {
    const document = await this.context.documents.get(documentId);
    if (document) {
      const stats = await this.context.commands.execute('wordCount', {
        text: document.content
      });
      this.context.ui.updateStatusBar(`Words: ${stats.data.words}`);
    }
  }

  private updateSelectionStats(selectedText: string): void {
    if (selectedText) {
      const words = selectedText.trim().split(/\s+/).length;
      this.context.ui.showNotification(`Selected: ${words} words`);
    }
  }
}
```

### 添加 UI 组件

```typescript
// src/index.ts (更新)
export default class MyFirstPlugin implements Plugin {
  // ... existing code ...

  private registerUIComponents(): void {
    // Register a panel to display word count stats
    this.context.ui.registerPanel({
      id: 'wordCountPanel',
      title: 'Word Count',
      position: 'right',
      icon: 'text',
      render: this.renderWordCountPanel.bind(this)
    });

    // Register a toolbar button
    this.context.ui.registerToolbarItem({
      id: 'wordCountBtn',
      icon: 'counter',
      tooltip: 'Show Word Count',
      onClick: () => this.context.ui.showPanel('wordCountPanel')
    });
  }

  private renderWordCountPanel(container: HTMLElement): void {
    container.innerHTML = `
      <div class="word-count-panel">
        <h3>Document Statistics</h3>
        <div id="stats-content">
          <p>Select text or open a document to see statistics.</p>
        </div>
      </div>
    `;
    
    // Update stats when panel opens
    this.updatePanelStats();
  }

  private async updatePanelStats(): Promise<void> {
    const activeDoc = await this.context.documents.getActive();
    if (activeDoc) {
      const stats = await this.context.commands.execute('wordCount', {
        text: activeDoc.content
      });
      
      const statsContent = document.getElementById('stats-content');
      if (statsContent && stats.data) {
        statsContent.innerHTML = `
          <div class="stat-item">
            <span class="stat-label">Words</span>
            <span class="stat-value">${stats.data.words}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Characters</span>
            <span class="stat-value">${stats.data.characters}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Lines</span>
            <span class="stat-value">${stats.data.lines}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Sentences</span>
            <span class="stat-value">${stats.data.sentences}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Paragraphs</span>
            <span class="stat-value">${stats.data.paragraphs}</span>
          </div>
        `;
      }
    }
  }
}
```

## 第四步：添加配置

### 定义配置 Schema

```typescript
// src/config.ts
export interface PluginConfig {
  showInStatusBar: boolean;
  autoUpdate: boolean;
  includeSpaces: boolean;
  defaultView: 'words' | 'characters' | 'all';
}

export const defaultConfig: PluginConfig = {
  showInStatusBar: true,
  autoUpdate: true,
  includeSpaces: true,
  defaultView: 'all'
};

export const configSchema = {
  type: 'object',
  properties: {
    showInStatusBar: {
      type: 'boolean',
      default: true,
      description: 'Show word count in status bar'
    },
    autoUpdate: {
      type: 'boolean',
      default: true,
      description: 'Auto-update count on document change'
    },
    includeSpaces: {
      type: 'boolean',
      default: true,
      description: 'Include spaces in character count'
    },
    defaultView: {
      type: 'string',
      enum: ['words', 'characters', 'all'],
      default: 'all',
      description: 'Default statistics view'
    }
  }
};
```

### 使用配置

```typescript
// src/index.ts (更新)
import { PluginConfig, defaultConfig, configSchema } from './config';

export default class MyFirstPlugin implements Plugin {
  private config: PluginConfig;

  async activate(context: PluginContext): Promise<void> {
    this.context = context;
    
    // Load configuration
    this.config = await context.config.get<PluginConfig>('my-first-plugin') || defaultConfig;
    
    // Register configuration schema
    context.config.registerSchema('my-first-plugin', configSchema);
    
    // Listen for configuration changes
    context.config.onDidChange('my-first-plugin', this.handleConfigChange.bind(this));
    
    // ... rest of activation
  }

  private handleConfigChange(newConfig: PluginConfig): void {
    this.config = newConfig;
    // Update UI based on new config
    if (newConfig.showInStatusBar) {
      this.updateWordCount();
    }
  }
}
```

## 第五步：测试插件

### 编写单元测试

```typescript
// tests/unit/word-count.test.ts
import { describe, test, expect } from 'vitest';
import { WordCountCommand } from '../../src/commands/word-count';

describe('WordCountCommand', () => {
  let command: WordCountCommand;

  beforeEach(() => {
    command = new WordCountCommand();
  });

  test('should count words correctly', async () => {
    const result = await command.execute({
      text: 'Hello World'
    });

    expect(result.success).toBe(true);
    expect(result.data.words).toBe(2);
  });

  test('should count characters correctly', async () => {
    const result = await command.execute({
      text: 'Hello World',
      includeSpaces: true
    });

    expect(result.success).toBe(true);
    expect(result.data.characters).toBe(11);
  });

  test('should count characters without spaces', async () => {
    const result = await command.execute({
      text: 'Hello World',
      includeSpaces: false
    });

    expect(result.success).toBe(true);
    expect(result.data.characters).toBe(10);
  });

  test('should handle empty text', async () => {
    const result = await command.execute({
      text: ''
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('No text provided');
  });

  test('should count sentences', async () => {
    const result = await command.execute({
      text: 'Hello. World! How are you?'
    });

    expect(result.success).toBe(true);
    expect(result.data.sentences).toBe(3);
  });

  test('should count paragraphs', async () => {
    const result = await command.execute({
      text: 'Paragraph 1\n\nParagraph 2\n\nParagraph 3'
    });

    expect(result.success).toBe(true);
    expect(result.data.paragraphs).toBe(3);
  });
});
```

### 运行测试

```bash
# 运行所有测试
open-factory test

# 运行单元测试
open-factory test --unit

# 运行带覆盖率的测试
open-factory test --coverage
```

### 调试插件

```bash
# 启动调试模式
open-factory dev --debug

# 使用测试沙箱调试
open-factory sandbox start --plugin . --debug
```

## 第六步：添加文档

### 更新 README.md

```markdown
# My First Plugin

A word count plugin for Open Factory.

## Features

- Count words, characters, lines, sentences, and paragraphs
- Real-time statistics update
- Selection word count
- Customizable display options

## Installation

```bash
open-factory plugin install my-first-plugin
```

## Usage

1. Open the Word Count panel from the toolbar
2. Statistics will update automatically as you type
3. Select text to see selection statistics

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| showInStatusBar | boolean | true | Show count in status bar |
| autoUpdate | boolean | true | Auto-update on changes |
| includeSpaces | boolean | true | Include spaces in char count |
| defaultView | string | 'all' | Default statistics view |

## Commands

| Command | Description |
|---------|-------------|
| wordCount | Count words in text |

## License

MIT
```

## 第七步：发布插件

### 准备发布

```bash
# 更新版本号
open-factory version patch

# 检查发布条件
open-factory publish check
```

### 发布检查清单

- [ ] 所有测试通过
- [ ] 文档完整
- [ ] 版本号已更新
- [ ] CHANGELOG 已更新
- [ ] 无安全漏洞
- [ ] 性能测试通过

### 执行发布

```bash
# 发布到测试环境
open-factory publish --env staging

# 测试通过后发布到生产环境
open-factory publish --env production
```

## 最佳实践

### 代码组织

- 按功能模块组织代码
- 使用依赖注入提高可测试性
- 遵循单一职责原则

### 错误处理

```typescript
try {
  const result = await riskyOperation();
  return { success: true, data: result };
} catch (error) {
  context.logger.error('Operation failed', { error, params });
  return { 
    success: false, 
    error: error.message,
    code: 'OPERATION_FAILED'
  };
}
```

### 性能优化

- 使用缓存减少重复计算
- 避免阻塞主线程
- 延迟加载非关键资源

### 安全考虑

- 验证所有用户输入
- 不要暴露敏感信息
- 使用最小权限原则

## 下一步

- 阅读 [Plugin API Reference](https://docs.open-factory.dev/sdk/plugin-api)
- 探索更多 [插件示例](https://github.com/open-factory/plugin-examples)
- 加入 [创作者社区](https://community.open-factory.dev)
- 查看 [工作流创作教程](./workflow-creation.md)

## 常见问题

### Q: 插件无法激活怎么办？

A: 检查控制台错误日志，确保所有依赖已正确安装，配置文件格式正确。

### Q: 如何调试插件？

A: 使用 `open-factory dev --debug` 启动调试模式，或在测试沙箱中调试。

### Q: 插件性能不好怎么优化？

A: 使用性能分析器识别瓶颈，参考性能优化最佳实践。
