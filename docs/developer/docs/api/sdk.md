---
sidebar_position: 4
---

# TypeScript SDK API

`@open-factory/sdk` 是用于构建 Open Factory 扩展的 TypeScript SDK，提供类型安全的 API 客户端和开发工具。

:::info 即将推出
此包正在开发中，API 可能会发生变化。以下文档描述了预期的接口设计。
:::

## 安装

```bash
bun add @open-factory/sdk
```

## 概述

SDK 包提供以下能力：

- **API 客户端** — 类型安全的 REST/WebSocket 客户端
- **项目操作** — 以编程方式创建和编辑项目
- **渲染控制** — 远程渲染管理
- **事件系统** — 实时事件订阅
- **工具函数** — 常用辅助工具

## API 客户端

### 初始化

```typescript
import { OpenFactoryClient } from '@open-factory/sdk';

const client = new OpenFactoryClient({
  baseUrl: 'http://localhost:3000',
  apiKey: process.env.OPEN_FACTORY_API_KEY,
  timeout: 30_000,
  retries: 3,
});
```

### 配置选项

```typescript
interface ClientConfig {
  baseUrl: string;           // API 服务地址
  apiKey?: string;           // API 密钥
  timeout?: number;          // 请求超时（毫秒）
  retries?: number;          // 重试次数
  headers?: Record<string, string>;  // 自定义请求头
  onAuth?: () => Promise<string>;    // 动态认证回调
}
```

## 项目操作

### 创建项目

```typescript
const project = await client.projects.create({
  name: 'My Video Project',
  width: 1920,
  height: 1080,
  fps: 30,
});

console.log('Created project:', project.id);
```

### 获取项目

```typescript
const project = await client.projects.get('project-id');
console.log('Project name:', project.name);
console.log('Tracks:', project.tracks.length);
```

### 更新项目

```typescript
await client.projects.update('project-id', {
  name: 'Updated Project Name',
});
```

### 列出项目

```typescript
const { projects, total, page, pageSize } = await client.projects.list({
  page: 1,
  pageSize: 20,
  sortBy: 'updatedAt',
  sortOrder: 'desc',
});
```

## 时间线操作

### 获取时间线

```typescript
const timeline = await client.timelines.get('project-id');

console.log('Duration:', timeline.duration);
console.log('Tracks:', timeline.tracks.length);
```

### 修改时间线

```typescript
// 添加轨道
const track = await client.timelines.addTrack('project-id', {
  type: 'video',
  name: 'V2',
});

// 添加剪辑
const clip = await client.timelines.addClip('project-id', track.id, {
  sourceId: 'media-id',
  start: 0,
  duration: 5,
});

// 移动剪辑
await client.timelines.updateClip('project-id', clip.id, {
  start: 10,
});

// 删除剪辑
await client.timelines.removeClip('project-id', clip.id);
```

### 分割剪辑

```typescript
const [left, right] = await client.timelines.splitClip(
  'project-id',
  'clip-id',
  5.0  // 分割时间点
);
```

## 媒体管理

### 上传媒体

```typescript
const media = await client.media.upload({
  file: fs.createReadStream('./video.mp4'),
  name: 'Interview Clip',
  tags: ['interview', 'raw'],
});

console.log('Media ID:', media.id);
console.log('Duration:', media.duration);
```

### 列出媒体

```typescript
const { media, total } = await client.media.list({
  type: 'video',
  tags: ['interview'],
  sortBy: 'createdAt',
  page: 1,
  pageSize: 50,
});
```

### 媒体分析

```typescript
const analysis = await client.media.analyze('media-id', {
  type: 'all',
});

// {
//   technical: { resolution, codec, bitrate, ... },
//   content: { scenes, faces, objects, ... },
//   quality: { sharpness, noise, exposure, ... }
// }
```

## 渲染控制

### 提交渲染任务

```typescript
const job = await client.render.submit({
  projectId: 'project-id',
  settings: {
    format: 'mp4',
    codec: 'h264',
    resolution: '1080p',
    quality: 'high',
  },
});

console.log('Render job:', job.id);
```

### 监控渲染进度

```typescript
// 轮询方式
const status = await client.render.getStatus(job.id);
console.log(`Progress: ${status.progress}%`);

// WebSocket 实时订阅
client.render.subscribe(job.id, (event) => {
  switch (event.type) {
    case 'progress':
      console.log(`Rendering: ${event.progress}%`);
      break;
    case 'completed':
      console.log('Render complete:', event.outputUrl);
      break;
    case 'error':
      console.error('Render failed:', event.error);
      break;
  }
});
```

### 下载渲染结果

```typescript
const stream = await client.render.download(job.id);
const writeStream = fs.createWriteStream('./output.mp4');
stream.pipe(writeStream);
```

## 事件系统

### 订阅事件

```typescript
// 订阅项目变更
const unsubscribe = client.events.subscribe('project-updated', (event) => {
  console.log('Project updated:', event.projectId);
  console.log('Changes:', event.changes);
});

// 取消订阅
unsubscribe();
```

### 可用事件

| 事件 | 说明 |
|------|------|
| `project-created` | 项目创建 |
| `project-updated` | 项目更新 |
| `project-deleted` | 项目删除 |
| `timeline-changed` | 时间线变更 |
| `render-started` | 渲染开始 |
| `render-progress` | 渲染进度 |
| `render-completed` | 渲染完成 |
| `render-failed` | 渲染失败 |
| `media-uploaded` | 媒体上传 |
| `collaboration-join` | 协作者加入 |
| `collaboration-leave` | 协作者离开 |

## 协作功能

### 创建协作会话

```typescript
const session = await client.collaboration.createSession({
  projectId: 'project-id',
  permissions: {
    canEdit: true,
    canComment: true,
    canExport: false,
  },
});

console.log('Session ID:', session.id);
console.log('Invite URL:', session.inviteUrl);
```

### 加入协作会话

```typescript
const session = await client.collaboration.joinSession('session-id');

// 监听远程变更
session.onChange((change) => {
  console.log(`${change.userName} modified ${change.target}`);
});

// 发送本地变更
session.sendChange({
  type: 'clip-update',
  clipId: 'clip-1',
  property: 'start',
  value: 5.0,
});
```

## 工具函数

### 时间码转换

```typescript
import { timecode, formatDuration } from '@open-factory/sdk';

// 帧数转时间码
const tc = timecode.fromFrame(900, 30);  // "00:00:30:00"

// 时间码转秒数
const seconds = timecode.toSeconds('00:01:30:00');  // 90

// 格式化时长
const text = formatDuration(125.5);  // "2:05.5"
```

### 媒体工具

```typescript
import { media } from '@open-factory/sdk';

// 获取视频信息
const info = await media.getVideoInfo('./video.mp4');
// { duration, width, height, fps, codec, bitrate }

// 生成缩略图
const thumbnail = await media.generateThumbnail('./video.mp4', {
  time: 5.0,
  width: 320,
  height: 180,
});

// 提取音频
await media.extractAudio('./video.mp4', './audio.aac');
```

### 项目验证

```typescript
import { validateProject } from '@open-factory/sdk';

const result = validateProject(projectData);

if (!result.valid) {
  console.error('Validation errors:', result.errors);
  // [{ path: 'tracks[0].clips[2].start', message: 'Must be >= 0' }]
}
```

## 错误处理

```typescript
import {
  OpenFactoryError,
  ApiError,
  ValidationError,
  TimeoutError,
} from '@open-factory/sdk';

try {
  await client.render.submit({ /* ... */ });
} catch (error) {
  if (error instanceof ApiError) {
    console.error(`API Error ${error.statusCode}: ${error.message}`);
  } else if (error instanceof ValidationError) {
    console.error('Validation failed:', error.errors);
  } else if (error instanceof TimeoutError) {
    console.error('Request timed out');
  } else if (error instanceof OpenFactoryError) {
    console.error('Open Factory error:', error.code, error.message);
  }
}
```

## 类型导出

SDK 导出所有核心类型，可在 TypeScript 项目中直接使用：

```typescript
import type {
  Project,
  Track,
  Clip,
  Timeline,
  ExportSettings,
  RenderJob,
  MediaInfo,
  CollaborationSession,
} from '@open-factory/sdk';
```
