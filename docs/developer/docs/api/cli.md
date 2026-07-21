---
sidebar_position: 3
---

# CLI API

`@open-factory/cli` 是 Open Factory 的命令行工具，提供无头渲染、模板应用、质量分析和自动化工作流功能。

## 安装

```bash
# 全局安装
bun add -g @open-factory/cli

# 或在项目中使用
bun add -D @open-factory/cli
```

## 命令概览

```bash
of <command> [options]
```

| 命令 | 说明 |
|------|------|
| `of render` | 渲染项目文件为视频 |
| `of apply-template` | 对媒体文件应用模板 |
| `of analyze` | 分析视频质量/语义/合规性 |
| `of workflow` | 执行工作流定义文件 |

### 全局选项

```bash
of --log-level <level>    # 日志级别: silent|error|warn|info|debug（默认 info）
of --json                 # 以 JSON 格式输出
of --version              # 显示版本号
of --help                 # 显示帮助信息
```

## render 命令

将项目文件渲染为视频输出。

### 用法

```bash
of render --input <file> --output <file> [options]
```

### 选项

| 选项 | 说明 | 默认值 |
|------|------|--------|
| `--input, -i` | 项目文件路径 | 必填 |
| `--output, -o` | 输出文件路径 | 必填 |
| `--format` | 输出格式 (mp4, webm, mov) | mp4 |
| `--codec` | 视频编码 (h264, h265, vp9) | h264 |
| `--quality` | 质量预设 (low, medium, high, lossy) | high |
| `--fps` | 帧率 | 项目设置 |
| `--resolution` | 分辨率 (1080p, 4k, 自定义 WxH) | 项目设置 |
| `--bitrate` | 比特率 (如 8M) | 自动 |
| `--range` | 渲染范围 (如 "10-30" 秒) | 全部 |
| `--progress` | 显示进度条 | true |

### 示例

```bash
# 基本渲染
of render -i project.json -o output.mp4

# 指定编码和质量
of render -i project.json -o output.mp4 --codec h265 --quality high

# 渲染特定时间范围
of render -i project.json -o clip.mp4 --range "10-30"

# 4K 输出
of render -i project.json -o output.mp4 --resolution 4k

# JSON 格式输出（用于脚本集成）
of render -i project.json -o output.mp4 --json
```

### JSON 输出格式

```json
{
  "success": true,
  "output": "/path/to/output.mp4",
  "duration": 120.5,
  "fileSize": 52428800,
  "encoding": {
    "codec": "h264",
    "resolution": "1920x1080",
    "fps": 30,
    "bitrate": "8M"
  },
  "renderTime": 45.2
}
```

## apply-template 命令

对媒体文件批量应用模板。

### 用法

```bash
of apply-template --template <name> --input <dir> [options]
```

### 选项

| 选项 | 说明 | 默认值 |
|------|------|--------|
| `--template, -t` | 模板名称或路径 | 必填 |
| `--input, -i` | 输入媒体目录 | 必填 |
| `--output, -o` | 输出目录 | ./output |
| `--overwrite` | 覆盖已有文件 | false |
| `--dry-run` | 仅预览不执行 | false |

### 示例

```bash
# 应用内置模板
of apply-template -t cinematic -i ./raw-media -o ./output

# 使用自定义模板
of apply-template -t ./my-template.json -i ./media

# 预览模式
of apply-template -t cinematic -i ./raw-media --dry-run
```

### 模板文件格式

```json
{
  "name": "Cinematic Look",
  "version": "1.0.0",
  "colorGrading": {
    "contrast": 1.1,
    "saturation": 0.9,
    "temperature": 6500,
    "tint": 0
  },
  "transitions": {
    "default": "dissolve",
    "duration": 0.5
  },
  "text": {
    "font": "Noto Sans SC",
    "size": 48,
    "color": "#ffffff"
  },
  "export": {
    "format": "mp4",
    "codec": "h264",
    "quality": "high"
  }
}
```

## analyze 命令

分析视频的质量、语义内容或合规性。

### 用法

```bash
of analyze --input <file> --type <type> [options]
```

### 分析类型

| 类型 | 说明 |
|------|------|
| `quality` | 技术质量分析（清晰度、曝光、噪点） |
| `semantic` | 语义内容分析（场景、人脸、物体） |
| `compliance` | 广播合规性检查（安全区域、音频电平） |
| `all` | 执行所有分析 |

### 选项

| 选项 | 说明 | 默认值 |
|------|------|--------|
| `--input, -i` | 视频文件路径 | 必填 |
| `--type` | 分析类型 | all |
| `--output, -o` | 报告输出路径 | stdout |
| `--format` | 报告格式 (json, text, html) | text |

### 示例

```bash
# 质量分析
of analyze -i video.mp4 --type quality

# 语义分析，输出 JSON
of analyze -i video.mp4 --type semantic --format json

# 合规性检查，输出报告文件
of analyze -i video.mp4 --type compliance -o report.html --format html

# 全面分析
of analyze -i video.mp4 --type all --format json -o full-report.json
```

### 质量分析报告

```json
{
  "type": "quality",
  "overall": 85,
  "metrics": {
    "sharpness": { "score": 90, "issues": [] },
    "exposure": { "score": 78, "issues": ["slightly overexposed at 00:15-00:22"] },
    "noise": { "score": 92, "issues": [] },
    "stability": { "score": 85, "issues": ["minor shake at 01:05"] },
    "color": { "score": 88, "issues": [] }
  },
  "recommendations": [
    "Consider adjusting exposure at 00:15-00:22",
    "Apply stabilization at 01:05"
  ]
}
```

## workflow 命令

执行工作流定义文件，支持多步骤自动化处理。

### 用法

```bash
of workflow --definition <file> [options]
```

### 选项

| 选项 | 说明 | 默认值 |
|------|------|--------|
| `--definition, -d` | 工作流定义文件 | 必填 |
| `--var` | 变量覆盖 (key=value) | - |
| `--dry-run` | 仅验证不执行 | false |
| `--parallel` | 并行执行独立步骤 | false |

### 示例

```bash
# 执行工作流
of workflow -d workflow.json

# 带变量覆盖
of workflow -d workflow.json --var inputDir=./media --var outputDir=./output

# 验证工作流
of workflow -d workflow.json --dry-run
```

### 工作流定义格式

```json
{
  "name": "Video Processing Pipeline",
  "version": "1.0.0",
  "variables": {
    "inputDir": "./raw",
    "outputDir": "./processed",
    "quality": "high"
  },
  "steps": [
    {
      "id": "analyze",
      "command": "analyze",
      "args": {
        "input": "${inputDir}/*.mp4",
        "type": "quality"
      },
      "condition": "quality.overall >= 70"
    },
    {
      "id": "apply-template",
      "command": "apply-template",
      "args": {
        "template": "cinematic",
        "input": "${inputDir}",
        "output": "${outputDir}/templated"
      },
      "dependsOn": ["analyze"]
    },
    {
      "id": "render",
      "command": "render",
      "args": {
        "input": "${outputDir}/templated/*.json",
        "output": "${outputDir}/final",
        "quality": "${quality}"
      },
      "dependsOn": ["apply-template"]
    }
  ]
}
```

## 编程方式使用

可以通过 API 方式在 Node.js/Bun 脚本中使用 CLI 功能。

```typescript
import { createCli, createLogger, ExitCode } from '@open-factory/cli';

// 创建 CLI 实例
const cli = createCli();

// 解析并执行命令
await cli.parseAsync(['node', 'of', 'render', '-i', 'project.json', '-o', 'output.mp4']);
```

### 日志系统

```typescript
import { createLogger, type LogLevel } from '@open-factory/cli';

const logger = createLogger({ level: 'debug' });

logger.debug('Debug message');
logger.info('Processing...');
logger.warn('Low disk space');
logger.error('Failed to render', { code: 'RENDER_ERROR' });
```

### 错误处理

```typescript
import { ExitCode, exitWith, withCliOutput } from '@open-factory/cli';

// 标准退出码
enum ExitCode {
  SUCCESS = 0,
  GENERAL_ERROR = 1,
  INVALID_ARGS = 2,
  FILE_NOT_FOUND = 3,
  RENDER_FAILED = 4,
}

// 带输出的命令执行
const result = await withCliOutput(async (output) => {
  output.info('Starting render...');
  // ... 执行渲染
  output.info('Render complete');
  return { success: true };
});
```
